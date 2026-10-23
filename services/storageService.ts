
import { InventoryItem, BorrowRecord, AppSettings, Category, ItemCondition, BorrowRequest, RequestStatus, BorrowStatus } from '../types';
import { supabase } from '../supabaseClient';
import { SYSTEM_NAME } from '../branding';
import { LNHS_ACTUAL_LABORATORY_ITEMS } from '../data/lnhsActualEquipment';
import { rememberLocation } from './locationService';

const APP_ASSETS_BUCKET = 'app-assets';
const APP_LOGO_PATH = 'branding/app-logo';

// Remove hidden metadata comment blocks that may be appended to free-text fields
const stripMetadata = (text?: string) => {
    if (!text) return '';
    return text.replace(/<!--SYSTEM_META:.*?-->/g, '').trim();
};

const normalizeAppName = (name?: string) => {
    const value = name?.trim();
    if (!value || /scilab|\bste\b|science laboratory inventory system|science\s*(?:&|and|,)\s*technology/i.test(value)) {
        return SYSTEM_NAME;
    }
    return value;
};

const toNumber = (value: unknown, fallback = 0) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const readField = (data: any, ...keys: string[]) => {
    for (const key of keys) {
        if (data?.[key] !== undefined && data?.[key] !== null) return data[key];
    }
    return undefined;
};

const parseArray = <T>(value: unknown): T[] => {
    if (Array.isArray(value)) return value as T[];
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
        return [];
    }
};

const normalizeBorrowStatus = (value: unknown): BorrowStatus => {
    const status = String(value || '').trim().toLowerCase();
    if (status === 'returned') return 'Returned';
    if (status === 'overdue') return 'Overdue';
    return 'Borrowed';
};

const requestStatuses: RequestStatus[] = ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled', 'Released', 'Returned'];
const normalizeRequestStatus = (value: unknown): RequestStatus => {
    const status = String(value || '').trim().toLowerCase();
    return requestStatuses.find(candidate => candidate.toLowerCase() === status) || 'Pending';
};

// Helper to map DB row to InventoryItem type
const mapInventoryItem = (data: any): InventoryItem => {
    let attachments = parseArray<any>(readField(data, 'attachments'));
    if ((!attachments || attachments.length === 0) && data.id && typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem('ilems_item_attachments_' + data.id);
            if (cached) attachments = JSON.parse(cached);
        } catch {}
    }

    return {
        id: data.id,
        name: data.name,
        category: data.category,
        quantity: toNumber(data.quantity),
        borrowedQuantity: toNumber(readField(data, 'borrowedQuantity', 'borrowed_quantity', 'borrowedquantity')),
        unit: data.unit,
        location: data.location,
        condition: data.condition as ItemCondition,
        description: data.description || '',
        safetyNotes: data.safetyNotes || '',
        lastUpdated: data.lastUpdated,
        shortId: data.shortId,
        isConsumable: Boolean(readField(data, 'isConsumable', 'is_consumable', 'isconsumable')),
        maxBorrowable: readField(data, 'maxBorrowable', 'max_borrowable', 'maxborrowable') == null
            ? null
            : toNumber(readField(data, 'maxBorrowable', 'max_borrowable', 'maxborrowable')),
        boxes: parseArray(readField(data, 'boxes')),
        attachments: attachments || []
    };
};

const mapBorrowRecord = (data: any): BorrowRecord => ({
    id: String(data.id),
    itemId: String(readField(data, 'itemid', 'itemId', 'item_id') || ''),
    itemName: String(readField(data, 'itemName', 'item_name', 'itemname') || ''),
    itemCategory: String(readField(data, 'itemCategory', 'item_category', 'itemcategory') || ''),
    borrowerName: String(readField(data, 'borrowerName', 'borrower_name', 'borrowername') || ''),
    borrowerId: String(readField(data, 'borrowerId', 'borrower_id', 'borrowerid') || ''),
    borrowerEmail: readField(data, 'borrowerEmail', 'borrower_email', 'borroweremail'),
    quantity: toNumber(data.quantity),
    borrowDate: String(readField(data, 'borrowDate', 'borrow_date', 'borrowdate') || ''),
    dueDate: String(readField(data, 'dueDate', 'due_date', 'duedate') || ''),
    returnDate: readField(data, 'returnDate', 'return_date', 'returndate'),
    status: normalizeBorrowStatus(data.status),
    specificId: readField(data, 'specificId', 'specific_id', 'specificid')
});

const mapBorrowRequest = (data: any): BorrowRequest => ({
    id: String(data.id),
    referenceCode: String(readField(data, 'referenceCode', 'reference_code', 'referencecode') || ''),
    borrowerName: String(readField(data, 'borrowerName', 'borrower_name', 'borrowername') || ''),
    borrowerId: String(readField(data, 'borrowerId', 'borrower_id', 'borrowerid') || ''),
    borrowerEmail: readField(data, 'borrowerEmail', 'borrower_email', 'borroweremail'),
    instructorName: readField(data, 'instructorName', 'instructor_name', 'instructorname'),
    requestDate: String(readField(data, 'requestDate', 'request_date', 'requestdate') || ''),
    returnDate: String(readField(data, 'returnDate', 'return_date', 'returndate') || ''),
    status: normalizeRequestStatus(data.status),
    items: parseArray<any>(data.items).map(item => ({
        itemId: String(readField(item, 'itemId', 'item_id', 'itemid') || ''),
        itemName: String(readField(item, 'itemName', 'item_name', 'itemname') || ''),
        quantity: toNumber(item.quantity),
        linkedRecordId: readField(item, 'linkedRecordId', 'linked_record_id', 'linkedrecordid')
    })),
    adminNotes: readField(data, 'adminNotes', 'admin_notes', 'adminnotes'),
    reservationSlot: readField(data, 'reservationSlot', 'reservation_slot', 'reservationslot'),
    reservationDate: readField(data, 'reservationDate', 'reservation_date', 'reservationdate')
});

// --- Cache Keys & In-Memory Store ---
const INVENTORY_CACHE_KEY = 'scilab_cached_inventory_items';
const BORROW_RECORDS_CACHE_KEY = 'scilab_cached_borrow_records';
const CATEGORIES_CACHE_KEY = 'scilab_cached_categories';
const BORROW_REQUESTS_CACHE_KEY = 'scilab_cached_borrow_requests';
const SETTINGS_CACHE_KEY = 'scilab_cached_settings';

const INVENTORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime

let memoryInventorySnapshot: { items: InventoryItem[]; borrowRecords: BorrowRecord[] } | null = null;
let lastInventoryFetchTime = 0;

let memoryCachedCategories: Category[] | null = null;
let lastCategoriesFetchTime = 0;

let memoryCachedRequests: BorrowRequest[] | null = null;
let lastRequestsFetchTime = 0;

let memoryCachedSettings: AppSettings | null = null;
let lastSettingsFetchTime = 0;

export const loadLocalInventoryItems = (): InventoryItem[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(INVENTORY_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(mapInventoryItem) : [];
    } catch {
        return [];
    }
};

export const saveLocalInventoryItems = (items: InventoryItem[]): void => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(INVENTORY_CACHE_KEY, JSON.stringify(items));
    } catch (e) {
        console.warn('Failed to cache inventory items in localStorage', e);
    }
};

export const loadLocalBorrowRecords = (): BorrowRecord[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(BORROW_RECORDS_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(mapBorrowRecord) : [];
    } catch {
        return [];
    }
};

export const saveLocalBorrowRecords = (records: BorrowRecord[]): void => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(BORROW_RECORDS_CACHE_KEY, JSON.stringify(records));
    } catch (e) {
        console.warn('Failed to cache borrow records in localStorage', e);
    }
};

export const loadLocalCategories = (): Category[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(CATEGORIES_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

export const saveLocalCategories = (categories: Category[]): void => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(categories));
    } catch (e) {
        console.warn('Failed to cache categories in localStorage', e);
    }
};

export const loadLocalBorrowRequests = (): BorrowRequest[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(BORROW_REQUESTS_CACHE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(mapBorrowRequest) : [];
    } catch {
        return [];
    }
};

export const saveLocalBorrowRequests = (requests: BorrowRequest[]): void => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(BORROW_REQUESTS_CACHE_KEY, JSON.stringify(requests));
    } catch (e) {
        console.warn('Failed to cache borrow requests in localStorage', e);
    }
};

export const loadLocalSettings = (): AppSettings | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

export const saveLocalSettings = (settings: AppSettings): void => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.warn('Failed to cache settings in localStorage', e);
    }
};

/**
 * Synchronous getters for instant (0ms delay) component hydration
 */
export const getCachedItems = (): InventoryItem[] => {
    if (memoryInventorySnapshot && memoryInventorySnapshot.items.length > 0) {
        return memoryInventorySnapshot.items;
    }
    const local = loadLocalInventoryItems();
    if (local.length > 0) {
        const records = loadLocalBorrowRecords();
        memoryInventorySnapshot = { items: local, borrowRecords: records };
        return local;
    }
    return [];
};

export const getCachedBorrowRecords = (): BorrowRecord[] => {
    if (memoryInventorySnapshot && memoryInventorySnapshot.borrowRecords.length > 0) {
        return memoryInventorySnapshot.borrowRecords;
    }
    const local = loadLocalBorrowRecords();
    if (local.length > 0) {
        return local;
    }
    return [];
};

export const getCachedCategories = (): Category[] => {
    if (memoryCachedCategories && memoryCachedCategories.length > 0) {
        return memoryCachedCategories;
    }
    const local = loadLocalCategories();
    if (local.length > 0) {
        memoryCachedCategories = local;
        return local;
    }
    return [];
};

export const getCachedBorrowRequests = (): BorrowRequest[] => {
    if (memoryCachedRequests && memoryCachedRequests.length > 0) {
        return memoryCachedRequests;
    }
    const local = loadLocalBorrowRequests();
    if (local.length > 0) {
        memoryCachedRequests = local;
        return local;
    }
    return [];
};

export const getCachedSettings = (): AppSettings | null => {
    if (memoryCachedSettings) {
        return memoryCachedSettings;
    }
    const local = loadLocalSettings();
    if (local) {
        memoryCachedSettings = local;
        return local;
    }
    return null;
};

export const invalidateInventoryCache = (): void => {
    lastInventoryFetchTime = 0;
    memoryInventorySnapshot = null;
};

export const invalidateCategoriesCache = (): void => {
    lastCategoriesFetchTime = 0;
    memoryCachedCategories = null;
};

export const invalidateBorrowRequestsCache = (): void => {
    lastRequestsFetchTime = 0;
    memoryCachedRequests = null;
};

export const invalidateSettingsCache = (): void => {
    lastSettingsFetchTime = 0;
    memoryCachedSettings = null;
};

const loadBorrowRecords = async (): Promise<BorrowRecord[]> => {
    const { data, error } = await supabase.from('borrow_records').select('*');
    if (error) throw error;
    return (data || []).map(mapBorrowRecord);
};

const applyActiveLoanQuantities = (items: InventoryItem[], records: BorrowRecord[]) => {
    const activeByItem = new Map<string, number>();
    records.forEach(record => {
        if (record.status !== 'Borrowed' && record.status !== 'Overdue') return;
        activeByItem.set(record.itemId, (activeByItem.get(record.itemId) || 0) + record.quantity);
    });

    return items.map(item => ({ ...item, borrowedQuantity: activeByItem.get(item.id) || 0 }));
};

// --- Inventory Management ---

export const getInventorySnapshot = async (forceRefresh = false): Promise<{ items: InventoryItem[]; borrowRecords: BorrowRecord[] }> => {
    const now = Date.now();

    // 1. Return in-memory cache immediately if fresh and not forcing refresh (0ms delay)
    if (!forceRefresh && memoryInventorySnapshot && (now - lastInventoryFetchTime < INVENTORY_CACHE_TTL)) {
        return memoryInventorySnapshot;
    }

    // 2. Return local storage cache if available and not forcing refresh
    if (!forceRefresh && !memoryInventorySnapshot) {
        const localItems = loadLocalInventoryItems();
        if (localItems.length > 0) {
            const localRecords = loadLocalBorrowRecords();
            memoryInventorySnapshot = { items: localItems, borrowRecords: localRecords };
            lastInventoryFetchTime = now;
            return memoryInventorySnapshot;
        }
    }

    // 3. Query authoritative data from Supabase
    const [inventoryResult, rawRecords, rawRequests] = await Promise.all([
        supabase.from('inventory_items').select('*'),
        loadBorrowRecords(),
        supabase.from('borrow_requests').select('*')
    ]);
    if (inventoryResult.error) throw inventoryResult.error;

    const dbItems = (inventoryResult.data || []).map(mapInventoryItem);
    const borrowRecords = [...rawRecords];
    const borrowRequests = (rawRequests.data || []).map(mapBorrowRequest);

    // Reconcile approved & released requests so each item is guaranteed to appear under lending & count as on loans
    const existingRecordIds = new Set(borrowRecords.map(r => r.id));
    const pendingInserts: Record<string, any>[] = [];

    borrowRequests.forEach(req => {
        if (req.status !== 'Approved' && req.status !== 'Released') return;

        req.items.forEach(reqItem => {
            const hasExisting = (reqItem.linkedRecordId && existingRecordIds.has(reqItem.linkedRecordId)) ||
                borrowRecords.some(r => 
                    r.itemId === reqItem.itemId && 
                    r.borrowerName === req.borrowerName && 
                    (r.status === 'Borrowed' || r.status === 'Overdue')
                );

            if (!hasExisting) {
                const invItem = dbItems.find(i => i.id === reqItem.itemId || (i.name && reqItem.itemName && i.name.trim().toLowerCase() === reqItem.itemName.trim().toLowerCase()));
                const recordId = reqItem.linkedRecordId || crypto.randomUUID();
                reqItem.linkedRecordId = recordId;

                const synthRecord: BorrowRecord = {
                    id: recordId,
                    itemId: invItem?.id || reqItem.itemId,
                    itemName: invItem?.name || reqItem.itemName,
                    itemCategory: invItem?.category || 'General',
                    borrowerName: req.borrowerName,
                    borrowerId: req.borrowerId,
                    borrowerEmail: req.borrowerEmail,
                    quantity: toNumber(reqItem.quantity, 1),
                    borrowDate: (req.requestDate ? req.requestDate.split('T')[0] : new Date().toISOString().split('T')[0]),
                    dueDate: req.returnDate || new Date().toISOString().split('T')[0],
                    status: 'Borrowed'
                };

                borrowRecords.push(synthRecord);
                existingRecordIds.add(recordId);

                pendingInserts.push({
                    id: recordId,
                    itemid: synthRecord.itemId,
                    itemName: synthRecord.itemName,
                    itemCategory: synthRecord.itemCategory,
                    borrowerName: synthRecord.borrowerName,
                    borrowerId: synthRecord.borrowerId,
                    borrowerEmail: synthRecord.borrowerEmail,
                    quantity: synthRecord.quantity,
                    borrowDate: synthRecord.borrowDate,
                    dueDate: synthRecord.dueDate,
                    status: 'Borrowed'
                });
            }
        });
    });

    if (pendingInserts.length > 0) {
        (async () => {
            for (const payload of pendingInserts) {
                let { error } = await supabase.from('borrow_records').insert(payload);
                if (error && (error.message?.includes('borrowerEmail') || error.message?.includes('schema cache'))) {
                    const { borrowerEmail: _, ...fallback } = payload;
                    await supabase.from('borrow_records').insert(fallback);
                }
            }
        })().catch(console.error);
    }

    const items = applyActiveLoanQuantities(dbItems, borrowRecords);

    // Update in-memory snapshot and localStorage
    memoryInventorySnapshot = { items, borrowRecords };
    lastInventoryFetchTime = Date.now();
    saveLocalInventoryItems(items);
    saveLocalBorrowRecords(borrowRecords);

    return memoryInventorySnapshot;
};

export const getInventory = async (forceRefresh = false): Promise<InventoryItem[]> => {
    const snapshot = await getInventorySnapshot(forceRefresh);
    return snapshot.items;
};

export const getInventoryItem = async (id: string): Promise<InventoryItem | null> => {
    const cached = getCachedItems();
    const found = cached.find(item => item.id === id);
    if (found) return found;
    const snapshot = await getInventorySnapshot();
    return snapshot.items.find(item => item.id === id) || null;
};

export const saveItem = async (item: InventoryItem): Promise<{ success: boolean; message?: string }> => {
    if (!item.id) item.id = crypto.randomUUID();
    
    if (item.attachments) {
        try {
            localStorage.setItem('ilems_item_attachments_' + item.id, JSON.stringify(item.attachments));
        } catch {}
    }

    const payload: Record<string, any> = {
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: toNumber(item.quantity),
        borrowedQuantity: toNumber(item.borrowedQuantity),
        unit: item.unit,
        location: item.location,
        condition: item.condition,
        description: item.description,
        safetyNotes: item.safetyNotes,
        lastUpdated: new Date().toISOString(),
        shortId: item.shortId,
        isConsumable: item.isConsumable,
        maxBorrowable: item.maxBorrowable,
        boxes: item.boxes || [],
        attachments: item.attachments || []
    };

    let error: any = null;
    const res = await supabase.from('inventory_items').upsert(payload);
    if (res.error && (res.error.message?.includes('attachments') || res.error.message?.includes('schema cache'))) {
        // Fallback: If table does not yet have 'attachments' column, save other fields to DB while retaining localStorage cache
        const { attachments: _, ...fallbackPayload } = payload;
        const retryRes = await supabase.from('inventory_items').upsert(fallbackPayload);
        error = retryRes.error;
    } else {
        error = res.error;
    }

    if (error) return { success: false, message: error.message };
    if (item.location) {
        rememberLocation(item.location);
    }

    // Synchronize cache in-memory & localStorage immediately
    if (memoryInventorySnapshot) {
        const idx = memoryInventorySnapshot.items.findIndex(i => i.id === item.id);
        if (idx >= 0) {
            memoryInventorySnapshot.items[idx] = { ...item };
        } else {
            memoryInventorySnapshot.items.unshift({ ...item });
        }
        saveLocalInventoryItems(memoryInventorySnapshot.items);
    } else {
        const local = loadLocalInventoryItems();
        const idx = local.findIndex(i => i.id === item.id);
        if (idx >= 0) {
            local[idx] = { ...item };
        } else {
            local.unshift({ ...item });
        }
        saveLocalInventoryItems(local);
    }

    return { success: true };
};

export const deleteItem = async (id: string): Promise<boolean> => {
    if (typeof window !== 'undefined') {
        try {
            localStorage.removeItem('ilems_item_attachments_' + id);
        } catch {}
    }
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw error;

    // Remove from cache in-memory & localStorage immediately
    if (memoryInventorySnapshot) {
        memoryInventorySnapshot.items = memoryInventorySnapshot.items.filter(i => i.id !== id);
        saveLocalInventoryItems(memoryInventorySnapshot.items);
    } else {
        const local = loadLocalInventoryItems().filter(i => i.id !== id);
        saveLocalInventoryItems(local);
    }

    return true;
};

// --- App Settings ---

export const uploadAppLogo = async (file: File): Promise<string> => {
    const { error } = await supabase.storage
        .from(APP_ASSETS_BUCKET)
        .upload(APP_LOGO_PATH, file, {
            cacheControl: '3600',
            contentType: file.type,
            upsert: true
        });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from(APP_ASSETS_BUCKET).getPublicUrl(APP_LOGO_PATH);
    if (!data.publicUrl) throw new Error('Supabase did not return a public logo URL.');

    return `${data.publicUrl}?v=${Date.now()}`;
};

export const getSettings = async (forceRefresh = false): Promise<AppSettings> => {
    const now = Date.now();
    if (!forceRefresh && memoryCachedSettings && (now - lastSettingsFetchTime < INVENTORY_CACHE_TTL)) {
        return memoryCachedSettings;
    }
    if (!forceRefresh && !memoryCachedSettings) {
        const local = loadLocalSettings();
        if (local) {
            memoryCachedSettings = local;
            lastSettingsFetchTime = now;
            return memoryCachedSettings;
        }
    }

    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (error || !data) throw error || new Error("Settings unreachable");
    
    let localDDownloadKey = '';
    if (typeof window !== 'undefined') {
        try {
            localDDownloadKey = localStorage.getItem('ilems_ddownload_api_key') || '';
        } catch {}
    }

    const loadedSettings: AppSettings = {
        appName: normalizeAppName(data.appName),
        logoUrl: data.logoUrl,
        customFooterText: stripMetadata(data.customFooterText),
        adminUsername: data.adminUsername,
        adminPassword: data.adminPassword,
        recoveryEmail: data.recoveryEmail,
        notificationEmails: data.notificationEmails,
        labInCharge: data.labInCharge,
        ddownloadApiKey: readField(data, 'ddownloadApiKey', 'ddownload_api_key') || localDDownloadKey || ''
    };

    memoryCachedSettings = loadedSettings;
    lastSettingsFetchTime = Date.now();
    saveLocalSettings(loadedSettings);
    return loadedSettings;
};

export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
    if (settings.logoUrl?.startsWith('data:')) {
        throw new Error('Base64 logos are no longer supported. Upload the logo to storage first.');
    }

    if (settings.ddownloadApiKey !== undefined && typeof window !== 'undefined') {
        try {
            if (settings.ddownloadApiKey.trim()) {
                localStorage.setItem('ilems_ddownload_api_key', settings.ddownloadApiKey.trim());
            } else {
                localStorage.removeItem('ilems_ddownload_api_key');
            }
        } catch {}
    }

    const payload: Record<string, any> = {
        id: 1,
        appName: normalizeAppName(settings.appName),
        logoUrl: settings.logoUrl,
        customFooterText: stripMetadata(settings.customFooterText),
        adminUsername: settings.adminUsername,
        adminPassword: settings.adminPassword,
        recoveryEmail: settings.recoveryEmail,
        notificationEmails: settings.notificationEmails,
        labInCharge: settings.labInCharge,
        ddownload_api_key: settings.ddownloadApiKey?.trim() || ''
    };

    let { error } = await supabase.from('app_settings').upsert(payload);
    if (error && (error.message?.includes('ddownload_api_key') || error.message?.includes('schema cache'))) {
        const { ddownload_api_key: _, ...fallbackPayload } = payload;
        const res = await supabase.from('app_settings').upsert(fallbackPayload);
        if (res.error) return false;
    } else if (error) {
        return false;
    }

    memoryCachedSettings = { ...settings, appName: normalizeAppName(settings.appName) };
    lastSettingsFetchTime = Date.now();
    saveLocalSettings(memoryCachedSettings);
    return true;
};

// --- Borrowing Logic ---

export const getBorrowRecords = async (forceRefresh = false): Promise<BorrowRecord[]> => {
    const snapshot = await getInventorySnapshot(forceRefresh);
    return snapshot.borrowRecords;
};

export const syncOverdueStatus = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('borrow_records')
        .update({ status: 'Overdue' })
        .eq('status', 'Borrowed')
        .lt('dueDate', today)
        .select();
    if (error) throw error;
    
    const updatedRecords: BorrowRecord[] = (data || []).map(mapBorrowRecord);

    if (updatedRecords.length > 0 && memoryInventorySnapshot) {
        const updatedIds = new Set(updatedRecords.map(r => r.id));
        memoryInventorySnapshot.borrowRecords = memoryInventorySnapshot.borrowRecords.map(r => 
            updatedIds.has(r.id) ? { ...r, status: 'Overdue' } : r
        );
        saveLocalBorrowRecords(memoryInventorySnapshot.borrowRecords);
    }

    return { updated: updatedRecords };
};

export const borrowItem = async (itemId: string, borrowerName: string, borrowerId: string, quantity: number, dueDate: string, borrowerEmail?: string, specificId?: string) => {
    const { data: item, error: itemError } = await supabase.from('inventory_items').select('*').eq('id', itemId).single();
    if (itemError || !item) return { success: false, message: "Equipment record not found." };

    const newBorrowed = toNumber(item.borrowedQuantity) + toNumber(quantity);

    const { error: updateError } = await supabase.from('inventory_items').update({ borrowedQuantity: newBorrowed }).eq('id', itemId);
    if (updateError) return { success: false, message: updateError.message };

    const recordPayload: Record<string, any> = {
        id: crypto.randomUUID(),
        itemid: itemId,
        itemName: item.name,
        itemCategory: item.category,
        borrowerName: borrowerName,
        borrowerId: borrowerId,
        borrowerEmail: borrowerEmail, 
        quantity: toNumber(quantity),
        borrowDate: new Date().toISOString().split('T')[0],
        dueDate: dueDate,
        status: 'Borrowed',
        specificId: specificId
    };

    let { error: recordError } = await supabase.from('borrow_records').insert(recordPayload);
    if (recordError && (recordError.message?.includes('borrowerEmail') || recordError.message?.includes('schema cache'))) {
        const { borrowerEmail: _, ...fallbackPayload } = recordPayload;
        const retry = await supabase.from('borrow_records').insert(fallbackPayload);
        recordError = retry.error;
    }
    if (recordError && (recordError.message?.includes('specificId') || recordError.message?.includes('specific_id'))) {
        const altPayload = { ...recordPayload };
        delete altPayload.specificId;
        if (specificId) altPayload.specific_id = specificId;
        const retryAlt = await supabase.from('borrow_records').insert(altPayload);
        if (!retryAlt.error) {
            recordError = null;
        } else {
            delete altPayload.specific_id;
            const retryNone = await supabase.from('borrow_records').insert(altPayload);
            recordError = retryNone.error;
        }
    }

    if (recordError) return { success: false, message: recordError.message };

    // Update in-memory snapshot and localStorage
    if (memoryInventorySnapshot) {
        const itemIdx = memoryInventorySnapshot.items.findIndex(i => i.id === itemId);
        if (itemIdx >= 0) {
            memoryInventorySnapshot.items[itemIdx].borrowedQuantity = newBorrowed;
        }
        memoryInventorySnapshot.borrowRecords.unshift(mapBorrowRecord(recordPayload));
        saveLocalInventoryItems(memoryInventorySnapshot.items);
        saveLocalBorrowRecords(memoryInventorySnapshot.borrowRecords);
    }

    return { success: true };
};

export const returnItem = async (recordId: string, details: { good: number; defective: number; disposed: number }) => {
    const { data: record, error: recError } = await supabase.from('borrow_records').select('*').eq('id', recordId).single();
    if (recError || !record) return { success: false, message: "Borrowing record not found." };

    const itemId = readField(record, 'itemid', 'itemId', 'item_id') || record.itemid;
    const { data: item, error: itemError } = await supabase.from('inventory_items').select('*').eq('id', itemId).single();
    if (itemError || !item) return { success: false, message: "Inventory record not found." };

    const newBorrowed = Math.max(0, toNumber(item.borrowedQuantity) - toNumber(record.quantity));
    const newTotal = Math.max(0, toNumber(item.quantity) - (toNumber(details.defective) + toNumber(details.disposed)));

    const { error: itemUpdateError } = await supabase.from('inventory_items').update({
        quantity: newTotal,
        borrowedQuantity: newBorrowed
    }).eq('id', item.id);

    if (itemUpdateError) return { success: false, message: itemUpdateError.message };

    const { error: recordUpdateError } = await supabase.from('borrow_records').update({
        status: 'Returned',
        returnDate: new Date().toISOString().split('T')[0]
    }).eq('id', recordId);

    if (recordUpdateError) return { success: false, message: recordUpdateError.message };

    // Update in-memory snapshot and localStorage
    if (memoryInventorySnapshot) {
        const itemIdx = memoryInventorySnapshot.items.findIndex(i => i.id === item.id);
        if (itemIdx >= 0) {
            memoryInventorySnapshot.items[itemIdx].quantity = newTotal;
            memoryInventorySnapshot.items[itemIdx].borrowedQuantity = newBorrowed;
        }
        const recIdx = memoryInventorySnapshot.borrowRecords.findIndex(r => r.id === recordId);
        if (recIdx >= 0) {
            memoryInventorySnapshot.borrowRecords[recIdx].status = 'Returned';
            memoryInventorySnapshot.borrowRecords[recIdx].returnDate = new Date().toISOString().split('T')[0];
        }
        saveLocalInventoryItems(memoryInventorySnapshot.items);
        saveLocalBorrowRecords(memoryInventorySnapshot.borrowRecords);
    }

    // Check if this record is linked to a borrow request and update the request if all items are returned
    try {
        const { data: rawRequests } = await supabase.from('borrow_requests').select('*');
        if (rawRequests) {
            for (const row of rawRequests) {
                const itemsList = parseArray<any>(row.items);
                const hasItem = itemsList.some(it => it.linkedRecordId === recordId);
                if (hasItem) {
                    const linkedIds = itemsList.map(it => it.linkedRecordId).filter(Boolean);
                    if (linkedIds.length > 0) {
                        const { data: recs } = await supabase.from('borrow_records').select('id, status').in('id', linkedIds);
                        const allReturned = (recs || []).every(r => r.status === 'Returned' || r.id === recordId);
                        if (allReturned && (row.status === 'Approved' || row.status === 'Released')) {
                            await supabase.from('borrow_requests').update({ status: 'Returned' }).eq('id', row.id);
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Failed to update linked request status on return:", e);
    }

    return { success: true };
};

export const deleteBorrowRecord = async (id: string): Promise<boolean> => {
    const { data: record } = await supabase.from('borrow_records').select('*').eq('id', id).single();
    const { error } = await supabase.from('borrow_records').delete().eq('id', id);
    if (error) throw error;
    if (record && (record.status === 'Borrowed' || record.status === 'Overdue')) {
        const itemId = readField(record, 'itemid', 'itemId', 'item_id');
        if (itemId) {
            const { data: item } = await supabase.from('inventory_items').select('*').eq('id', itemId).single();
            if (item) {
                const newBorrowed = Math.max(0, toNumber(item.borrowedQuantity) - toNumber(record.quantity));
                await supabase.from('inventory_items').update({ borrowedQuantity: newBorrowed }).eq('id', itemId);
                if (memoryInventorySnapshot) {
                    const itemIdx = memoryInventorySnapshot.items.findIndex(i => i.id === itemId);
                    if (itemIdx >= 0) {
                        memoryInventorySnapshot.items[itemIdx].borrowedQuantity = newBorrowed;
                    }
                }
            }
        }
    }

    if (memoryInventorySnapshot) {
        memoryInventorySnapshot.borrowRecords = memoryInventorySnapshot.borrowRecords.filter(r => r.id !== id);
        saveLocalInventoryItems(memoryInventorySnapshot.items);
        saveLocalBorrowRecords(memoryInventorySnapshot.borrowRecords);
    }
    return true;
};

// --- Categories ---

export const getCategories = async (forceRefresh = false): Promise<Category[]> => {
    const now = Date.now();
    if (!forceRefresh && memoryCachedCategories && (now - lastCategoriesFetchTime < INVENTORY_CACHE_TTL)) {
        return memoryCachedCategories;
    }
    if (!forceRefresh && !memoryCachedCategories) {
        const local = loadLocalCategories();
        if (local.length > 0) {
            memoryCachedCategories = local;
            lastCategoriesFetchTime = now;
            return memoryCachedCategories;
        }
    }

    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error) throw error;
    const cats: Category[] = (data || []).map((c: any) => ({
        id: String(c.id),
        name: String(c.name || ''),
        isDefault: Boolean(readField(c, 'isDefault', 'is_default', 'isdefault')) || c.name === 'General'
    }));

    memoryCachedCategories = cats;
    lastCategoriesFetchTime = Date.now();
    saveLocalCategories(cats);
    return cats;
};

export const addCategory = async (name: string): Promise<Category> => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Category name cannot be empty.');

    // Check for existing category with same name (case-insensitive)
    const { data: existing, error: checkError } = await supabase
        .from('categories')
        .select('*')
        .ilike('name', trimmed);

    if (checkError) throw checkError;
    if (existing && existing.length > 0) {
        throw new Error(`A category named "${trimmed}" already exists.`);
    }

    const newCategory: Category = {
        id: crypto.randomUUID(),
        name: trimmed,
        isDefault: trimmed.toLowerCase() === 'general'
    };

    const { error: insertError } = await supabase.from('categories').insert({
        id: newCategory.id,
        name: newCategory.name
    });
    if (insertError) throw insertError;

    if (memoryCachedCategories) {
        memoryCachedCategories.push(newCategory);
        memoryCachedCategories.sort((a, b) => a.name.localeCompare(b.name));
        saveLocalCategories(memoryCachedCategories);
    } else {
        const local = loadLocalCategories();
        local.push(newCategory);
        local.sort((a, b) => a.name.localeCompare(b.name));
        saveLocalCategories(local);
    }

    return newCategory;
};

export const updateCategory = async (id: string, newName: string, oldName?: string): Promise<{ success: boolean; message?: string }> => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Category name cannot be empty.');

    // Check if another category already has this name
    const { data: existing, error: checkError } = await supabase
        .from('categories')
        .select('*')
        .ilike('name', trimmed)
        .neq('id', id);

    if (checkError) throw checkError;
    if (existing && existing.length > 0) {
        throw new Error(`Another category named "${trimmed}" already exists.`);
    }

    const { error: updateError } = await supabase
        .from('categories')
        .update({ name: trimmed })
        .eq('id', id);

    if (updateError) throw updateError;

    // Cascade name change to inventory items and borrow records
    if (oldName && oldName.trim() !== trimmed) {
        const prev = oldName.trim();
        await supabase.from('inventory_items').update({ category: trimmed }).eq('category', prev);
        await supabase.from('borrow_records').update({ itemCategory: trimmed }).eq('itemCategory', prev);

        if (memoryInventorySnapshot) {
            memoryInventorySnapshot.items.forEach(i => {
                if (i.category === prev) i.category = trimmed;
            });
            memoryInventorySnapshot.borrowRecords.forEach(r => {
                if (r.itemCategory === prev) r.itemCategory = trimmed;
            });
            saveLocalInventoryItems(memoryInventorySnapshot.items);
            saveLocalBorrowRecords(memoryInventorySnapshot.borrowRecords);
        }
    }

    if (memoryCachedCategories) {
        const idx = memoryCachedCategories.findIndex(c => c.id === id);
        if (idx >= 0) {
            memoryCachedCategories[idx].name = trimmed;
            memoryCachedCategories.sort((a, b) => a.name.localeCompare(b.name));
            saveLocalCategories(memoryCachedCategories);
        }
    }

    return { success: true };
};

export const deleteCategory = async (id: string, categoryName?: string, reassignTo: string = 'General'): Promise<{ success: boolean; message?: string }> => {
    if (categoryName?.toLowerCase() === 'general') {
        throw new Error('The default "General" category cannot be deleted.');
    }

    // Reassign inventory items and borrow records if categoryName is provided
    if (categoryName) {
        const prev = categoryName.trim();
        await supabase.from('inventory_items').update({ category: reassignTo }).eq('category', prev);
        await supabase.from('borrow_records').update({ itemCategory: reassignTo }).eq('itemCategory', prev);

        if (memoryInventorySnapshot) {
            memoryInventorySnapshot.items.forEach(i => {
                if (i.category === prev) i.category = reassignTo;
            });
            memoryInventorySnapshot.borrowRecords.forEach(r => {
                if (r.itemCategory === prev) r.itemCategory = reassignTo;
            });
            saveLocalInventoryItems(memoryInventorySnapshot.items);
            saveLocalBorrowRecords(memoryInventorySnapshot.borrowRecords);
        }
    }

    const { error: deleteError } = await supabase.from('categories').delete().eq('id', id);
    if (deleteError) throw deleteError;

    if (memoryCachedCategories) {
        memoryCachedCategories = memoryCachedCategories.filter(c => c.id !== id);
        saveLocalCategories(memoryCachedCategories);
    }

    return { success: true };
};

// --- Borrow Requests ---

export const getBorrowRequests = async (forceRefresh = false): Promise<BorrowRequest[]> => {
    const now = Date.now();
    if (!forceRefresh && memoryCachedRequests && (now - lastRequestsFetchTime < INVENTORY_CACHE_TTL)) {
        return memoryCachedRequests;
    }
    if (!forceRefresh && !memoryCachedRequests) {
        const local = loadLocalBorrowRequests();
        if (local.length > 0) {
            memoryCachedRequests = local;
            lastRequestsFetchTime = now;
            return memoryCachedRequests;
        }
    }

    const { data, error } = await supabase.from('borrow_requests').select('*');
    if (error) throw error;
    const mapped = (data || []).map(mapBorrowRequest);

    memoryCachedRequests = mapped;
    lastRequestsFetchTime = Date.now();
    saveLocalBorrowRequests(mapped);
    return mapped;
};

export const createBorrowRequest = async (req: Partial<BorrowRequest>) => {
    const { data, error } = await supabase.from('borrow_requests').insert({
        id: crypto.randomUUID(),
        referenceCode: req.referenceCode,
        borrowerName: req.borrowerName,
        borrowerId: req.borrowerId,
        borrowerEmail: req.borrowerEmail,
        instructorName: req.instructorName,
        returnDate: req.returnDate,
        requestDate: req.requestDate || new Date().toISOString(),
        items: req.items,
        status: 'Pending',
        reservationSlot: req.reservationSlot,
        reservationDate: req.reservationDate
    }).select().single();
    
    if (error) {
        console.error("Supabase Request Creation Error:", error.message, error.details);
        return null;
    }

    const mapped = mapBorrowRequest(data);
    if (memoryCachedRequests) {
        memoryCachedRequests.unshift(mapped);
        saveLocalBorrowRequests(memoryCachedRequests);
    }
    return mapped;
};

export const getBorrowRequestByCode = async (code: string) => {
    const { data, error } = await supabase.from('borrow_requests').select('*').eq('referenceCode', code).single();
    if (error || !data) return null;
    return mapBorrowRequest(data);
};

export const updateBorrowRequestStatus = async (id: string, status: RequestStatus) => {
    await supabase.from('borrow_requests').update({ status }).eq('id', id);
    if (memoryCachedRequests) {
        const idx = memoryCachedRequests.findIndex(r => r.id === id);
        if (idx >= 0) {
            memoryCachedRequests[idx].status = status;
            saveLocalBorrowRequests(memoryCachedRequests);
        }
    }
};

export const deleteBorrowRequest = async (id: string) => {
    await supabase.from('borrow_requests').delete().eq('id', id);
    if (memoryCachedRequests) {
        memoryCachedRequests = memoryCachedRequests.filter(r => r.id !== id);
        saveLocalBorrowRequests(memoryCachedRequests);
    }
};

export const processApprovedRequest = async (request: BorrowRequest) => {
    try {
        for (const reqItem of request.items) {
            let item: any = null;
            if (reqItem.itemId) {
                const { data } = await supabase.from('inventory_items').select('*').eq('id', reqItem.itemId).single();
                item = data;
            }
            if (!item && reqItem.itemName) {
                const { data } = await supabase.from('inventory_items').select('*').ilike('name', reqItem.itemName).limit(1).single();
                item = data;
            }
            if (!item) {
                const { data: allItems } = await supabase.from('inventory_items').select('*');
                item = (allItems || []).find(i => i.id === reqItem.itemId || (i.name && reqItem.itemName && i.name.trim().toLowerCase() === reqItem.itemName.trim().toLowerCase()));
            }

            if (!item) throw new Error(`Item "${reqItem.itemName}" not found in inventory.`);

            const newBorrowed = toNumber(item.borrowedQuantity) + toNumber(reqItem.quantity);
            await supabase.from('inventory_items').update({ borrowedQuantity: newBorrowed }).eq('id', item.id);

            const recordId = reqItem.linkedRecordId || crypto.randomUUID();
            const recordPayload: Record<string, any> = {
                id: recordId,
                itemid: item.id,
                itemName: item.name,
                itemCategory: item.category,
                borrowerName: request.borrowerName,
                borrowerId: request.borrowerId,
                borrowerEmail: request.borrowerEmail, 
                quantity: toNumber(reqItem.quantity),
                borrowDate: new Date().toISOString().split('T')[0],
                dueDate: request.returnDate,
                status: 'Borrowed'
            };

            let { error: insertError } = await supabase.from('borrow_records').insert(recordPayload);
            if (insertError && (insertError.message?.includes('borrowerEmail') || insertError.message?.includes('schema cache'))) {
                const { borrowerEmail: _, ...fallbackPayload } = recordPayload;
                const retry = await supabase.from('borrow_records').insert(fallbackPayload);
                insertError = retry.error;
            }

            if (insertError) {
                console.error("Failed to insert borrow record during approval:", insertError);
            }

            reqItem.linkedRecordId = recordId;
        }

        await supabase.from('borrow_requests').update({ status: 'Approved', items: request.items }).eq('id', request.id);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};

/**
 * Sync Actual LNHS Science Laboratory Inventory Items (Non-PIS glassware, plasticware, consumables, optics)
 */
export const syncLNHSLaboratoryItems = async (): Promise<{ added: number; updated: number; total: number }> => {
    const existing = await getInventory();
    let added = 0;
    let updated = 0;

    for (const itemDef of LNHS_ACTUAL_LABORATORY_ITEMS) {
        const found = existing.find(e => 
            e.name.toLowerCase().trim() === itemDef.name.toLowerCase().trim() ||
            (e.shortId && itemDef.shortId && e.shortId === itemDef.shortId)
        );

        if (found) {
            await saveItem({
                ...found,
                category: itemDef.category,
                quantity: itemDef.quantity,
                unit: itemDef.unit || found.unit,
                location: itemDef.location || found.location,
                description: itemDef.description || found.description,
                safetyNotes: itemDef.safetyNotes || found.safetyNotes,
                isConsumable: itemDef.isConsumable !== undefined ? itemDef.isConsumable : found.isConsumable
            });
            updated++;
        } else {
            const newItem: InventoryItem = {
                id: crypto.randomUUID(),
                ...itemDef
            };
            await saveItem(newItem);
            added++;
        }
    }

    return { added, updated, total: LNHS_ACTUAL_LABORATORY_ITEMS.length };
};
