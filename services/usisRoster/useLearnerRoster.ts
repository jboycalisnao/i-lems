import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { RegistrarLearner, RegistrarSection } from './types';
import { loadCachedRoster, saveCachedRoster } from './cacheStore';
import { fetchRosterFromSupabase } from './fetchRoster';
import { supabaseReadOnly } from '../supabaseReadOnly';

// Global memory cache for instant zero-latency lookups outside React lifecycle
let globalLearnersMapByLrn = new Map<string, RegistrarLearner>();
let globalLearnersMapByRfid = new Map<string, RegistrarLearner>();
let activeSyncPromise: Promise<{ learners: RegistrarLearner[]; sections: RegistrarSection[] }> | null = null;

export const getLearnerFromMemory = (code: string): RegistrarLearner | undefined => {
  if (!code) return undefined;
  const trimmed = String(code).trim();
  const upper = trimmed.toUpperCase();
  return globalLearnersMapByRfid.get(upper) || globalLearnersMapByLrn.get(trimmed);
};

interface UseLearnerRosterOptions {
  supabase?: SupabaseClient;
  cacheTtlMs?: number; // e.g. 24 * 60 * 60 * 1000 (24 hours default)
  autoSyncOnMount?: boolean;
}

export const useLearnerRoster = (options?: UseLearnerRosterOptions) => {
  const supabase = options?.supabase || supabaseReadOnly;
  const cacheTtlMs = options?.cacheTtlMs ?? 86_400_000; // 24 hours
  const autoSyncOnMount = options?.autoSyncOnMount ?? true;

  const [learners, setLearners] = useState<RegistrarLearner[]>([]);
  const [sections, setSections] = useState<RegistrarSection[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Background revalidation logic
  const revalidate = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      if (!activeSyncPromise) {
        activeSyncPromise = fetchRosterFromSupabase(supabase).finally(() => {
          activeSyncPromise = null;
        });
      }

      const { learners: freshLearners, sections: freshSections } = await activeSyncPromise;
      
      setLearners(freshLearners);
      setSections(freshSections);
      
      const nowIso = new Date().toISOString();
      setLastSyncedAt(nowIso);

      // Persist to IndexedDB
      await saveCachedRoster(freshLearners, freshSections);
      console.log(`[USIS Roster] Successfully synced ${freshLearners.length} learners and ${freshSections.length} sections to offline cache.`);
    } catch (err: any) {
      console.warn('[USIS Roster] Network revalidation failed (continuing with cache):', err?.message);
      setError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [supabase]);

  // Initial Mount Lifecycle: Cache-First Hydration (< 50ms) + Guaranteed initial load fetch
  useEffect(() => {
    let isCancelled = false;

    const hydrateInitialData = async () => {
      try {
        const cached = await loadCachedRoster();
        if (cached && !isCancelled) {
          setLearners(cached.learners || []);
          setSections(cached.sections || []);
          setLastSyncedAt(cached.cachedAt || null);
          setIsHydrated(true);

          if (cached.learners && cached.learners.length > 0) {
            cached.learners.forEach(l => {
              if (l.lrn) globalLearnersMapByLrn.set(String(l.lrn).trim(), l);
              if (l.rfid) globalLearnersMapByRfid.set(String(l.rfid).trim().toUpperCase(), l);
            });
          }
        }
      } catch (err) {
        console.warn('[USIS Roster] Local cache hydration encountered error:', err);
      } finally {
        if (!isCancelled) {
          setIsHydrated(true);
          if (autoSyncOnMount) {
            // Guaranteed fetch of learners on initial page load
            revalidate();
          }
        }
      }
    };

    hydrateInitialData();

    return () => {
      isCancelled = true;
    };
  }, [autoSyncOnMount, revalidate]);

  // In-memory O(1) Lookup Maps
  const lookupMaps = useMemo(() => {
    const byLrn = new Map<string, RegistrarLearner>();
    const byRfid = new Map<string, RegistrarLearner>();
    const byId = new Map<string, RegistrarLearner>();
    const bySection = new Map<string, RegistrarLearner[]>();

    for (const l of learners) {
      if (l.lrn) byLrn.set(String(l.lrn).trim(), l);
      if (l.rfid) byRfid.set(String(l.rfid).trim().toUpperCase(), l);
      if (l.id) byId.set(String(l.id).trim(), l);

      const sId = String(l.section_id || '').trim();
      if (sId) {
        const list = bySection.get(sId) || [];
        list.push(l);
        bySection.set(sId, list);
      }
    }

    // Sync global singleton map for outside calls
    globalLearnersMapByLrn = byLrn;
    globalLearnersMapByRfid = byRfid;

    return { byLrn, byRfid, byId, bySection };
  }, [learners]);

  // O(1) query helper functions
  const getByLrn = useCallback((lrn: string): RegistrarLearner | undefined => {
    const key = String(lrn || '').trim();
    return lookupMaps.byLrn.get(key);
  }, [lookupMaps]);

  const getByRfid = useCallback((rfid: string): RegistrarLearner | undefined => {
    const key = String(rfid || '').trim().toUpperCase();
    return lookupMaps.byRfid.get(key);
  }, [lookupMaps]);

  const getById = useCallback((id: string): RegistrarLearner | undefined => {
    const key = String(id || '').trim();
    return lookupMaps.byId.get(key);
  }, [lookupMaps]);

  const getBySectionId = useCallback((sectionId: string): RegistrarLearner[] => {
    const key = String(sectionId || '').trim();
    return lookupMaps.bySection.get(key) || [];
  }, [lookupMaps]);

  /**
   * Universal search: matches either RFID badge UID or LRN
   */
  const findLearner = useCallback((query: string): RegistrarLearner | undefined => {
    if (!query) return undefined;
    const trimmed = String(query).trim();
    const upper = trimmed.toUpperCase();
    return lookupMaps.byRfid.get(upper) || lookupMaps.byLrn.get(trimmed);
  }, [lookupMaps]);

  return {
    learners,
    sections,
    isHydrated,      // True when initial cache has mounted
    isSyncing,       // True when background Supabase query is active
    lastSyncedAt,
    error,
    revalidate,      // Manual trigger for refresh button
    getByLrn,
    getByRfid,
    getById,
    getBySectionId,
    findLearner,
    totalCount: learners.length,
  };
};
