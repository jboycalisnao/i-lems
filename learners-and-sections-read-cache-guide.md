# DepED USIS — Satellite Application Integration Specification
## Read-Only Learner & Section Roster Cache Guide

> **Document Type:** Institutional Integration Specification & Agent Instructions  
> **Target Audience:** AI Coding Agents, Developers of External/Satellite Modules (e.g., `stelab`, `attendance-kiosk-shell`, `clinic`, `library`, `canteen`, `sports`)  
> **Applies to Schema:** `registrar_learners`, `registrar_sections`  
> **Access Mode:** **Strictly Read-Only (`SELECT` only)**  

---

## 1. System Context & Intent

DepED USIS (Unified School Information System) centralizes institutional records across all school departments. The **Registrar subsystem** is the authoritative master owner of learner enrollment records and academic section assignments.

External, satellite, or sibling client applications frequently need learner and section data (for example: identifying students during laboratory tool checkouts in `stelab`, scanning RFID at campus turnstiles, borrowing library books, or logging clinic visits). 

Because Philippine public school facilities often face intermittent, unstable, or offline local network conditions, satellite applications **must never perform blocking live network round-trips for every student lookup or barcode/RFID scan**. Instead, satellite applications must hydrate from a persistent local cache on initial mount and revalidate in the background.

---

## 2. Mandatory Agent Directives (Rules of Engagement)

When generating or modifying code for an application connecting to this database:

1. **Strictly Read-Only Enforcement**:
   - Satellite applications **MUST NEVER** execute `INSERT`, `UPDATE`, `UPSERT`, `DELETE`, or `DROP` statements on `registrar_learners`, `registrar_sections`, or their related registrar catalog tables.
   - All client queries must use `.select(...)` exclusively.
   - Do not pass or use the Supabase `SERVICE_ROLE_KEY` on client-facing applications. Use the public `ANON_KEY`.

2. **Storage Engine Rule (IndexedDB over LocalStorage)**:
   - A typical school roster contains between 1,000 and 6,000 learners. Storing full JSON objects for this volume in browser `localStorage` exceeds the 5MB browser quota and blocks the main thread during JSON parsing.
   - Satellite web apps **MUST** use `IndexedDB` (or an equivalent async key-value store) for persistent client caching.

3. **Mount Lifecycle (Stale-While-Revalidate)**:
   - **Phase 1 (Instant Boot):** On initial application mount, load data from the local `IndexedDB` cache immediately into memory. The UI must render instantly (< 50ms) without waiting for network connectivity.
   - **Phase 2 (Background Sync):** Asynchronously ping Supabase to check for updates or perform background fetch. If fresh data is received, update the `IndexedDB` cache and refresh the in-memory state seamlessly.
   - **Phase 3 (Offline Resilience):** If the device is offline or the Supabase endpoint is unreachable, fail silently to the cached snapshot and continue operating.

4. **Table Naming & Fallback Convention**:
   - Primary table names: `registrar_learners` and `registrar_sections`.
   - Legacy fallback table names: `learners` and `sections` (handle fallback if the primary table is inaccessible in older dev environments).

5. **Key Normalization**:
   - `lrn`: Always normalize as a 12-digit trimmed string (`String(lrn).trim()`).
   - `rfid`: Always normalize as an uppercase trimmed string (`String(rfid).trim().toUpperCase()`).
   - `section_id`: Always treat as a trimmed string identifier.

---

## 3. Database Schema Contract

### 3.1 Primary Table: `registrar_learners`

| Column | PostgreSQL Type | Nullable | Description / Usage |
| :--- | :--- | :--- | :--- |
| `id` | `text` / `uuid` | No | Primary Key (unique identifier). |
| `lrn` | `text` | Yes | Unique 12-digit DepEd Learner Reference Number. Primary barcode/search key. |
| `first_name` | `text` | Yes | Given name of the learner. |
| `last_name` | `text` | Yes | Family surname. |
| `middle_name` | `text` | Yes | Middle name or initial. |
| `gender` | `text` | Yes | `'Male'` or `'Female'`. |
| `birth_date` | `date` | Yes | Date of birth (`YYYY-MM-DD`). |
| `status` | `text` | Yes | Enrollment status (e.g., `'Active'`, `'Enrolled'`, `'Transferred In'`). |
| `section_id` | `text` | Yes | Foreign key reference to `registrar_sections.id`. |
| `rfid` | `text` | Yes | Optional physical RFID badge tag UID. |
| `contact_number` | `text` | Yes | Learner personal phone number. |
| `guardian_name` | `text` | Yes | Full name of registered parent/guardian. |
| `created_at` | `timestamptz` | Yes | Record creation timestamp. |
| `updated_at` | `timestamptz` | Yes | Record modification timestamp. |

### 3.2 Primary Table: `registrar_sections`

| Column | PostgreSQL Type | Nullable | Description / Usage |
| :--- | :--- | :--- | :--- |
| `id` | `text` | No | Primary Key (section code or UUID). |
| `name` | `text` | Yes | Display name of the section (e.g., `'Emerald'`, `'Rizal'`). |
| `grade_level` | `text` | Yes | Target grade level (e.g., `'Grade 7'`, `'Grade 11'`). Check `gradeLevel` fallback. |
| `adviser_name` | `text` | Yes | Name of the assigned teacher adviser. Check `adviserName` fallback. |
| `strand` | `text` | Yes | Academic/TVL strand if Senior High School (e.g., `'STEM'`, `'HUMSS'`, `null`). |
| `school_year_id`| `text` | Yes | Foreign key identifying the school year. Check `schoolYearId` fallback. |

---

## 4. Connection Configuration

Satellite applications require standard Supabase environment variables. Store these in the satellite application's `.env.local` or `.env`:

```env
# Supabase Project Connection (Client-safe anon key)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

### Read-Only Client Instantiation

```typescript
// src/lib/supabaseReadOnly.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.');
}

export const supabaseReadOnly = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
```

---

## 5. Architectural Implementation Pattern

The standard implementation is divided into four cleanly isolated modules:
1. `types.ts` — Type definitions
2. `cacheStore.ts` — Standalone IndexedDB storage engine
3. `fetchRoster.ts` — Read-only paginated Supabase fetcher
4. `useLearnerRoster.ts` — React hook for initial mounting and fast indexed queries

```
src/
└── features/
    └── usis-roster/
        ├── types.ts
        ├── cacheStore.ts
        ├── fetchRoster.ts
        ├── useLearnerRoster.ts
        └── index.ts
```

---

## 6. Full Source Code Reference

### 6.1 Type Contracts (`types.ts`)

```typescript
export interface RegistrarSection {
  id: string;
  name: string | null;
  grade_level: string | null;
  adviser_name: string | null;
  strand: string | null;
  school_year_id: string | null;
  // Fallback compatibility keys
  gradeLevel?: string | null;
  adviserName?: string | null;
  schoolYearId?: string | null;
}

export interface RegistrarLearner {
  id: string;
  lrn: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  gender: string | null;
  birth_date: string | null;
  status: string | null;
  section_id: string | null;
  rfid?: string | null;
  contact_number?: string | null;
  guardian_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  
  // Enriched client-side attributes
  section_name?: string;
  grade_level?: string;
  full_name?: string;
}

export interface RosterCachePayload {
  learners: RegistrarLearner[];
  sections: RegistrarSection[];
  cachedAt: string; // ISO timestamp
  version: number;
}
```

---

### 6.2 IndexedDB Storage Engine (`cacheStore.ts`)

Native IndexedDB implementation with zero external dependencies:

```typescript
import { RegistrarLearner, RegistrarSection, RosterCachePayload } from './types';

const DB_NAME = 'deped_usis_satellite_cache';
const DB_VERSION = 1;
const STORE_NAME = 'roster_store';
const CACHE_KEY = 'master_roster_snapshot';

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB is not supported in this runtime.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Loads cached learners and sections from IndexedDB.
 * Returns null if no cache exists or if unparseable.
 */
export const loadCachedRoster = async (): Promise<RosterCachePayload | null> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.warn('[USIS Cache] Failed to load roster from IndexedDB:', err);
    return null;
  }
};

/**
 * Persists learner and section roster to IndexedDB atomically.
 */
export const saveCachedRoster = async (
  learners: RegistrarLearner[],
  sections: RegistrarSection[]
): Promise<void> => {
  try {
    const db = await openDatabase();
    const payload: RosterCachePayload = {
      learners,
      sections,
      cachedAt: new Date().toISOString(),
      version: 1,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(payload, CACHE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('[USIS Cache] Failed to write roster to IndexedDB:', err);
  }
};

/**
 * Clears the local roster cache (e.g. on manual user sync or account logout).
 */
export const clearCachedRoster = async (): Promise<void> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(CACHE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  } catch (err) {
    console.error('[USIS Cache] Failed to clear IndexedDB:', err);
  }
};
```

---

### 6.3 Read-Only Paginated Data Fetcher (`fetchRoster.ts`)

> [!IMPORTANT]
> Supabase PostgREST endpoints enforce a default limit (usually 1,000 rows). If a school has 3,000 learners, a single `.select('*')` will silently truncate the roster. The fetcher below uses paginated range queries to pull the complete dataset.

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import { RegistrarLearner, RegistrarSection } from './types';

const PAGE_SIZE = 1000;

/**
 * Fetches all rows from a table using range pagination to bypass 1,000-row caps.
 */
async function fetchAllRows<T>(
  supabase: SupabaseClient,
  primaryTable: string,
  fallbackTable: string
): Promise<T[]> {
  let allRecords: T[] = [];
  let currentTable = primaryTable;
  let page = 0;
  let hasMore = true;

  // Test primary table availability
  const { error: probeError } = await supabase.from(primaryTable).select('id').limit(1);
  if (probeError) {
    console.warn(`[USIS Fetcher] Primary table "${primaryTable}" probe failed, trying fallback "${fallbackTable}"`);
    currentTable = fallbackTable;
  }

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from(currentTable)
      .select('*')
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch from ${currentTable}: ${error.message}`);
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRecords = allRecords.concat(data as T[]);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  return allRecords;
}

/**
 * Normalizes learner data and links section titles and grade levels.
 */
export const enrichRosterData = (
  learners: RegistrarLearner[],
  sections: RegistrarSection[]
): RegistrarLearner[] => {
  const sectionMap = new Map<string, RegistrarSection>();
  for (const s of sections) {
    sectionMap.set(String(s.id).trim(), s);
  }

  return learners.map((learner) => {
    const sId = String(learner.section_id || '').trim();
    const section = sId ? sectionMap.get(sId) : undefined;

    const gradeLevel = section
      ? section.grade_level || section.gradeLevel || 'Unspecified Grade'
      : 'No Section Assigned';

    const sectionName = section ? section.name || 'Unnamed Section' : 'No Section Assigned';

    const firstName = learner.first_name || '';
    const lastName = learner.last_name || '';
    const middleName = learner.middle_name ? ` ${learner.middle_name}` : '';
    const fullName = `${lastName}, ${firstName}${middleName}`.trim();

    return {
      ...learner,
      lrn: learner.lrn ? String(learner.lrn).trim() : null,
      rfid: learner.rfid ? String(learner.rfid).trim().toUpperCase() : null,
      section_name: sectionName,
      grade_level: gradeLevel,
      full_name: fullName || 'Unnamed Learner',
    };
  });
};

/**
 * Executes a read-only fetch of learners and sections from Supabase.
 */
export const fetchRosterFromSupabase = async (
  supabase: SupabaseClient
): Promise<{ learners: RegistrarLearner[]; sections: RegistrarSection[] }> => {
  const [sectionsRaw, learnersRaw] = await Promise.all([
    fetchAllRows<RegistrarSection>(supabase, 'registrar_sections', 'sections'),
    fetchAllRows<RegistrarLearner>(supabase, 'registrar_learners', 'learners'),
  ]);

  const enrichedLearners = enrichRosterData(learnersRaw, sectionsRaw);

  return {
    learners: enrichedLearners,
    sections: sectionsRaw,
  };
};
```

---

### 6.4 React Initial Mounting Hook (`useLearnerRoster.ts`)

This hook handles initial mounting, instant hydration from IndexedDB, non-blocking background revalidation, and in-memory Map indexing for O(1) lookups:

```typescript
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { RegistrarLearner, RegistrarSection } from './types';
import { loadCachedRoster, saveCachedRoster } from './cacheStore';
import { fetchRosterFromSupabase } from './fetchRoster';

interface UseLearnerRosterOptions {
  supabase: SupabaseClient;
  cacheTtlMs?: number; // e.g. 24 * 60 * 60 * 1000 (24 hours default)
  autoSyncOnMount?: boolean;
}

export const useLearnerRoster = ({
  supabase,
  cacheTtlMs = 86_400_000, // 24 hours
  autoSyncOnMount = true,
}: UseLearnerRosterOptions) => {
  const [learners, setLearners] = useState<RegistrarLearner[]>([]);
  const [sections, setSections] = useState<RegistrarSection[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncLockRef = useRef(false);

  // Background revalidation logic
  const revalidate = useCallback(async () => {
    if (syncLockRef.current) return;
    syncLockRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      const { learners: freshLearners, sections: freshSections } = await fetchRosterFromSupabase(supabase);
      
      setLearners(freshLearners);
      setSections(freshSections);
      
      const nowIso = new Date().toISOString();
      setLastSyncedAt(nowIso);

      // Persist to IndexedDB
      await saveCachedRoster(freshLearners, freshSections);
    } catch (err: any) {
      console.warn('[USIS Roster] Network revalidation failed (continuing with cache):', err?.message);
      setError(err?.message || 'Sync failed');
    } finally {
      setIsSyncing(false);
      syncLockRef.current = false;
    }
  }, [supabase]);

  // Initial Mount Lifecycle: Cache-First Hydration
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

          // Evaluate TTL to decide if revalidation is needed
          const cacheAge = cached.cachedAt ? Date.now() - new Date(cached.cachedAt).getTime() : Infinity;
          if (autoSyncOnMount && cacheAge > cacheTtlMs) {
            revalidate();
          }
          return;
        }
      } catch (err) {
        console.warn('[USIS Roster] Local cache hydration encountered error:', err);
      }

      // If no cache exists, mark hydrated and trigger immediate network pull
      if (!isCancelled) {
        setIsHydrated(true);
        if (autoSyncOnMount) {
          revalidate();
        }
      }
    };

    hydrateInitialData();

    return () => {
      isCancelled = true;
    };
  }, [autoSyncOnMount, cacheTtlMs, revalidate]);

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

  return {
    learners,
    sections,
    isHydrated,      // True when initial cache has mounted (UI can render safely)
    isSyncing,       // True when background Supabase query is active
    lastSyncedAt,
    error,
    revalidate,      // Manual trigger for refresh button
    getByLrn,
    getByRfid,
    getById,
    getBySectionId,
    totalCount: learners.length,
  };
};
```

---

## 7. Example Usage in Satellite Applications

### Example: Science Laboratory Inventory or Turnstile Scanner (`App.tsx`)

```tsx
import React, { useState } from 'react';
import { supabaseReadOnly } from './lib/supabaseReadOnly';
import { useLearnerRoster } from './features/usis-roster/useLearnerRoster';

export const LabCheckoutScanner: React.FC = () => {
  const {
    isHydrated,
    isSyncing,
    totalCount,
    lastSyncedAt,
    revalidate,
    getByLrn,
    getByRfid,
  } = useLearnerRoster({
    supabase: supabaseReadOnly,
    cacheTtlMs: 12 * 60 * 60 * 1000, // Sync every 12 hours
  });

  const [inputCode, setInputCode] = useState('');
  const [activeLearner, setActiveLearner] = useState<any>(null);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputCode.trim();
    if (!query) return;

    // Search by LRN or RFID badge UID
    const found = getByLrn(query) || getByRfid(query);
    setActiveLearner(found || null);
    setInputCode('');
  };

  if (!isHydrated) {
    return <div className="p-4">Mounting offline learner roster cache...</div>;
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Equipment Checkout</h2>
        <button
          onClick={() => revalidate()}
          disabled={isSyncing}
          className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded"
        >
          {isSyncing ? 'Syncing...' : 'Sync Database'}
        </button>
      </div>

      <div className="text-xs text-slate-500 mb-4">
        Loaded {totalCount} learners from local cache. Last synced: {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Never'}
      </div>

      <form onSubmit={handleScan} className="mb-4">
        <input
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="Scan RFID or enter 12-digit LRN..."
          className="w-full border p-2 rounded"
          autoFocus
        />
      </form>

      {activeLearner ? (
        <div className="border border-green-200 bg-green-50 p-4 rounded">
          <div className="font-semibold text-green-900">{activeLearner.full_name}</div>
          <div className="text-sm text-green-800">LRN: {activeLearner.lrn}</div>
          <div className="text-sm text-green-800">Section: {activeLearner.section_name} ({activeLearner.grade_level})</div>
          <div className="text-xs text-green-700 mt-2">Status: {activeLearner.status || 'Active'}</div>
        </div>
      ) : (
        <div className="text-sm text-slate-400">Scan badge or input LRN to verify borrower.</div>
      )}
    </div>
  );
};
```

---

## 8. Implementation Verification Checklist for Agents

When generating code to fulfill a user prompt connecting a satellite module:

- [ ] **SELECT Query Only:** Verify no `.insert()`, `.update()`, `.upsert()`, or `.delete()` calls touch `registrar_learners` or `registrar_sections`.
- [ ] **No LocalStorage for Rosters:** Verify `localStorage` is not used for entire learner arrays. Ensure `IndexedDB` is used.
- [ ] **Instant Boot Hydration:** Verify the application mounts from `loadCachedRoster()` immediately and renders before any network call finishes.
- [ ] **Pagination Enforced:** Ensure data fetching uses `.range(from, to)` to avoid row cutoff at 1,000 records.
- [ ] **Resilient Normalization:** Verify LRN and RFID fields are trimmed and sanitized before being inserted into memory lookup Maps.
- [ ] **Offline Handling:** Verify network failure during background revalidation does not crash the application or clear the cache.
