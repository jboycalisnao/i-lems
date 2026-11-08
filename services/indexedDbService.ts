/**
 * IndexedDB Persistent Storage Service for I-LEMS
 * 
 * Replaces heavy synchronous localStorage operations with asynchronous, non-blocking IndexedDB.
 * Eliminates main-thread JavaScript freezing and UI lag when loading, caching, or bulk-importing
 * large laboratory equipment and school property inventory datasets.
 */

import { InventoryItem, PropertyItem, BorrowRecord, Category, BorrowRequest, AppSettings } from '../types';

const DB_NAME = 'ilems_indexed_db';
const DB_VERSION = 1;

export const STORES = {
  LAB_INVENTORY: 'laboratory_inventory',
  PROPERTY_INVENTORY: 'property_inventory',
  BORROW_RECORDS: 'borrow_records',
  CATEGORIES: 'categories',
  BORROW_REQUESTS: 'borrow_requests',
  APP_META: 'app_meta'
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open or initialize the IndexedDB database instance
 */
export const getDatabase = (): Promise<IDBDatabase> => {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Laboratory items store (keyed by item id)
        if (!db.objectStoreNames.contains(STORES.LAB_INVENTORY)) {
          const labStore = db.createObjectStore(STORES.LAB_INVENTORY, { keyPath: 'id' });
          labStore.createIndex('category', 'category', { unique: false });
          labStore.createIndex('location', 'location', { unique: false });
          labStore.createIndex('name', 'name', { unique: false });
        }

        // School Property items store (keyed by property id)
        if (!db.objectStoreNames.contains(STORES.PROPERTY_INVENTORY)) {
          const propStore = db.createObjectStore(STORES.PROPERTY_INVENTORY, { keyPath: 'id' });
          propStore.createIndex('category', 'category', { unique: false });
          propStore.createIndex('location', 'location', { unique: false });
          propStore.createIndex('propertyNumber', 'propertyNumber', { unique: false });
          propStore.createIndex('pisCode', 'pisCode', { unique: false });
        }

        // Borrow records store
        if (!db.objectStoreNames.contains(STORES.BORROW_RECORDS)) {
          const recordStore = db.createObjectStore(STORES.BORROW_RECORDS, { keyPath: 'id' });
          recordStore.createIndex('itemId', 'itemId', { unique: false });
          recordStore.createIndex('status', 'status', { unique: false });
        }

        // Categories store
        if (!db.objectStoreNames.contains(STORES.CATEGORIES)) {
          db.createObjectStore(STORES.CATEGORIES, { keyPath: 'name' });
        }

        // Borrow requests store
        if (!db.objectStoreNames.contains(STORES.BORROW_REQUESTS)) {
          const reqStore = db.createObjectStore(STORES.BORROW_REQUESTS, { keyPath: 'id' });
          reqStore.createIndex('status', 'status', { unique: false });
        }

        // App metadata store (key/value pairs for timestamps, sync states, etc.)
        if (!db.objectStoreNames.contains(STORES.APP_META)) {
          db.createObjectStore(STORES.APP_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        console.warn('IndexedDB database open request blocked.');
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
};

// ==========================================
// 1. LABORATORY INVENTORY INDEXEDDB METHODS
// ==========================================

/**
 * Get all laboratory items from IndexedDB
 */
export const getLabInventoryFromDB = async (): Promise<InventoryItem[]> => {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.LAB_INVENTORY, 'readonly');
      const store = transaction.objectStore(STORES.LAB_INVENTORY);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result || []) as InventoryItem[];
        resolve(items);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB getLabInventory error, falling back:', err);
    return [];
  }
};

/**
 * Save all laboratory items into IndexedDB in a single non-blocking transaction
 */
export const setLabInventoryInDB = async (items: InventoryItem[]): Promise<void> => {
  if (!Array.isArray(items)) return;
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.LAB_INVENTORY, 'readwrite');
      const store = transaction.objectStore(STORES.LAB_INVENTORY);

      // Clear existing records and batch insert new ones
      store.clear();
      for (const item of items) {
        if (item && item.id) {
          store.put(item);
        }
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn('IndexedDB setLabInventory error:', err);
  }
};

/**
 * Upsert a single laboratory item in IndexedDB
 */
export const upsertLabItemInDB = async (item: InventoryItem): Promise<void> => {
  if (!item || !item.id) return;
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.LAB_INVENTORY, 'readwrite');
      const store = transaction.objectStore(STORES.LAB_INVENTORY);
      store.put(item);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn('IndexedDB upsertLabItem error:', err);
  }
};

/**
 * Delete a laboratory item from IndexedDB
 */
export const deleteLabItemFromDB = async (id: string): Promise<void> => {
  if (!id) return;
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.LAB_INVENTORY, 'readwrite');
      const store = transaction.objectStore(STORES.LAB_INVENTORY);
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn('IndexedDB deleteLabItem error:', err);
  }
};

// ==========================================
// 2. PROPERTY INVENTORY INDEXEDDB METHODS
// ==========================================

/**
 * Get all property items from IndexedDB
 */
export const getPropertyInventoryFromDB = async (): Promise<PropertyItem[]> => {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROPERTY_INVENTORY, 'readonly');
      const store = transaction.objectStore(STORES.PROPERTY_INVENTORY);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result || []) as PropertyItem[];
        // Filter out any mock seeds if ever stored
        const realItems = items.filter(i => i && !String(i.id || '').startsWith('prop-seed-'));
        resolve(realItems);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB getPropertyInventory error, falling back:', err);
    return [];
  }
};

/**
 * Save all property items into IndexedDB in a single non-blocking transaction
 */
export const setPropertyInventoryInDB = async (items: PropertyItem[]): Promise<void> => {
  if (!Array.isArray(items)) return;
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROPERTY_INVENTORY, 'readwrite');
      const store = transaction.objectStore(STORES.PROPERTY_INVENTORY);

      // Clear existing records and batch insert real items
      store.clear();
      for (const item of items) {
        if (item && item.id && !String(item.id).startsWith('prop-seed-')) {
          store.put(item);
        }
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn('IndexedDB setPropertyInventory error:', err);
  }
};

/**
 * Upsert a single property item in IndexedDB
 */
export const upsertPropertyItemInDB = async (item: PropertyItem): Promise<void> => {
  if (!item || !item.id || String(item.id).startsWith('prop-seed-')) return;
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROPERTY_INVENTORY, 'readwrite');
      const store = transaction.objectStore(STORES.PROPERTY_INVENTORY);
      store.put(item);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn('IndexedDB upsertPropertyItem error:', err);
  }
};

/**
 * Delete a property item from IndexedDB
 */
export const deletePropertyItemFromDB = async (id: string): Promise<void> => {
  if (!id) return;
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.PROPERTY_INVENTORY, 'readwrite');
      const store = transaction.objectStore(STORES.PROPERTY_INVENTORY);
      store.delete(id);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (err) {
    console.warn('IndexedDB deletePropertyItem error:', err);
  }
};

// ==========================================
// 3. BORROW RECORDS & REQUESTS INDEXEDDB
// ==========================================

export const getBorrowRecordsFromDB = async (): Promise<BorrowRecord[]> => {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.BORROW_RECORDS, 'readonly');
      const store = transaction.objectStore(STORES.BORROW_RECORDS);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return [];
  }
};

export const setBorrowRecordsInDB = async (records: BorrowRecord[]): Promise<void> => {
  if (!Array.isArray(records)) return;
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.BORROW_RECORDS, 'readwrite');
      const store = transaction.objectStore(STORES.BORROW_RECORDS);
      store.clear();
      for (const rec of records) {
        if (rec && rec.id) store.put(rec);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {}
};

// ==========================================
// 4. METADATA KEY/VALUE STORE
// ==========================================

export const getMetaFromDB = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await getDatabase();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORES.APP_META, 'readonly');
      const store = transaction.objectStore(STORES.APP_META);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result?.value ?? null);
      };
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
};

export const setMetaInDB = async <T>(key: string, value: T): Promise<void> => {
  try {
    const db = await getDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORES.APP_META, 'readwrite');
      const store = transaction.objectStore(STORES.APP_META);
      store.put({ key, value, updated: Date.now() });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {}
};
