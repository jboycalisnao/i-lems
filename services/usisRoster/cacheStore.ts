import { RegistrarLearner, RegistrarSection, RosterCachePayload } from './types';

const DB_NAME = 'deped_usis_satellite_cache';
const DB_VERSION = 1;
const STORE_NAME = 'roster_store';
const CACHE_KEY = 'master_roster_snapshot';

const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
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
