
import { InventoryItem, BorrowRecord, AppSettings, Category, ItemCondition, BorrowRequest, RequestStatus, BorrowStatus } from '../types';
import { supabase } from '../supabaseClient';
import { SYSTEM_NAME } from '../branding';

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
const mapInventoryItem = (data: any): InventoryItem => ({
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
    boxes: parseArray(readField(data, 'boxes'))
});

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

export const getInventorySnapshot = async (): Promise<{ items: InventoryItem[]; borrowRecords: BorrowRecord[] }> => {
    const [inventoryResult, borrowRecords] = await Promise.all([
        supabase.from('inventory_items').select('*'),
        loadBorrowRecords()
    ]);
    if (inventoryResult.error) throw inventoryResult.error;

    const items = applyActiveLoanQuantities((inventoryResult.data || []).map(mapInventoryItem), borrowRecords);
    return { items, borrowRecords };
};

export const getInventory = async (): Promise<InventoryItem[]> => {
    const snapshot = await getInventorySnapshot();
    return snapshot.items;
};

export const getInventoryItem = async (id: string): Promise<InventoryItem | null> => {
    const snapshot = await getInventorySnapshot();
    return snapshot.items.find(item => item.id === id) || null;
};

export const saveItem = async (item: InventoryItem): Promise<{ success: boolean; message?: string }> => {
    if (!item.id) item.id = crypto.randomUUID();
    
    const payload = {
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
        boxes: item.boxes || []
    };

    const { error } = await supabase.from('inventory_items').upsert(payload);
    if (error) return { success: false, message: error.message };
    return { success: true };
};

export const deleteItem = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('inventory_items').delete().eq('id', id);
    if (error) throw error;
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

export const getSettings = async (): Promise<AppSettings> => {
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (error || !data) throw error || new Error("Settings unreachable");
    
    return {
        appName: normalizeAppName(data.appName),
        logoUrl: data.logoUrl,
        customFooterText: stripMetadata(data.customFooterText),
        adminUsername: data.adminUsername,
        adminPassword: data.adminPassword,
        recoveryEmail: data.recoveryEmail,
        notificationEmails: data.notificationEmails,
        labInCharge: data.labInCharge
    };
};

export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
    if (settings.logoUrl?.startsWith('data:')) {
        throw new Error('Base64 logos are no longer supported. Upload the logo to storage first.');
    }

    const payload = {
        id: 1,
        appName: normalizeAppName(settings.appName),
        logoUrl: settings.logoUrl,
        customFooterText: stripMetadata(settings.customFooterText),
        adminUsername: settings.adminUsername,
        adminPassword: settings.adminPassword,
        recoveryEmail: settings.recoveryEmail,
        notificationEmails: settings.notificationEmails,
        labInCharge: settings.labInCharge
    };
    const { error } = await supabase.from('app_settings').upsert(payload);
    return !error;
};

// --- Borrowing Logic ---

export const getBorrowRecords = async (): Promise<BorrowRecord[]> => {
    return loadBorrowRecords();
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

    return { updated: updatedRecords };
};

export const borrowItem = async (itemId: string, borrowerName: string, borrowerId: string, quantity: number, dueDate: string, borrowerEmail?: string, specificId?: string) => {
    const { data: item, error: itemError } = await supabase.from('inventory_items').select('*').eq('id', itemId).single();
    if (itemError || !item) return { success: false, message: "Equipment record not found." };

    const newBorrowed = toNumber(item.borrowedQuantity) + toNumber(quantity);

    const { error: updateError } = await supabase.from('inventory_items').update({ borrowedQuantity: newBorrowed }).eq('id', itemId);
    if (updateError) return { success: false, message: updateError.message };

    const { error: recordError } = await supabase.from('borrow_records').insert({
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
    });

    if (recordError) return { success: false, message: recordError.message };
    return { success: true };
};

export const returnItem = async (recordId: string, details: { good: number; defective: number; disposed: number }) => {
    const { data: record, error: recError } = await supabase.from('borrow_records').select('*').eq('id', recordId).single();
    if (recError || !record) return { success: false, message: "Borrowing record not found." };

    const { data: item, error: itemError } = await supabase.from('inventory_items').select('*').eq('id', record.itemid).single();
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
    return { success: true };
};

export const deleteBorrowRecord = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('borrow_records').delete().eq('id', id);
    if (error) throw error;
    return true;
};

// --- Categories ---

export const getCategories = async (): Promise<Category[]> => {
    const { data, error } = await supabase.from('categories').select('*');
    if (error) throw error;
    return data || [];
};

export const addCategory = async (name: string) => {
    await supabase.from('categories').insert({ id: crypto.randomUUID(), name });
};

export const deleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id);
};

// --- Borrow Requests ---

export const getBorrowRequests = async (): Promise<BorrowRequest[]> => {
    const { data, error } = await supabase.from('borrow_requests').select('*');
    if (error) throw error;
    return (data || []).map(mapBorrowRequest);
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

    return mapBorrowRequest(data);
};

export const getBorrowRequestByCode = async (code: string) => {
    const { data, error } = await supabase.from('borrow_requests').select('*').eq('referenceCode', code).single();
    if (error || !data) return null;
    return mapBorrowRequest(data);
};

export const updateBorrowRequestStatus = async (id: string, status: RequestStatus) => {
    await supabase.from('borrow_requests').update({ status }).eq('id', id);
};

export const deleteBorrowRequest = async (id: string) => {
    await supabase.from('borrow_requests').delete().eq('id', id);
};

export const processApprovedRequest = async (request: BorrowRequest) => {
    try {
        for (const reqItem of request.items) {
            const { data: item, error: itemError } = await supabase.from('inventory_items').select('*').eq('id', reqItem.itemId).single();
            if (itemError || !item) throw new Error(`Item ${reqItem.itemName} missing.`);

            const newBorrowed = toNumber(item.borrowedQuantity) + toNumber(reqItem.quantity);
            await supabase.from('inventory_items').update({ borrowedQuantity: newBorrowed }).eq('id', item.id);

            const recordId = crypto.randomUUID();
            await supabase.from('borrow_records').insert({
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
            });

            reqItem.linkedRecordId = recordId;
        }

        await supabase.from('borrow_requests').update({ status: 'Approved', items: request.items }).eq('id', request.id);
        return { success: true };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
};
