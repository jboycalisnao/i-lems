import { PropertyItem, PropertyStats, PropertyCondition, PropertyInventoryType } from '../types';
import { supabase } from '../supabaseClient';
import { LNHS_ACTUAL_PROPERTY_ITEMS } from '../data/lnhsActualEquipment';
import { rememberLocation } from './locationService';

const LOCAL_STORAGE_KEY = 'scilab_property_items';

export const PROPERTY_CATEGORIES = [
  // Science Laboratory Equipment (Items with Physical Property Stickers - PIS)
  'Science Lab - Apparatus & Instruments',
  'Science Lab - Balances & Measurement',
  'Science Lab - Electrical & Electronic Equipment',
  'Science Lab - Experimental Kits & Mechanics',
  'Science Lab - Earth & Space Science',
  'Science Laboratory Equipment (General)',

  // General School Property Categories
  'IT & Digital Equipment',
  'School Furniture & Fixtures',
  'Audio-Visual & Electronics',
  'Appliances & HVAC',
  'Sports & Physical Education',
  'Facility & Maintenance Tools',
  'Security & Safety Equipment',
  'Office & Administrative'
];

export const FUND_SOURCES = [
  'DepEd DCP (Computerization Program)',
  'School MOOE',
  'PTA Donation',
  'SEF (Special Education Fund)',
  'National GAA',
  'LGU / Municipal Donation',
  'Alumni / Private Donation'
];

export const INITIAL_PROPERTY_SEEDS: PropertyItem[] = [
  {
    id: 'prop-seed-001',
    propertyNumber: 'LNHS-DCP-2024-001',
    name: 'Acer TravelMate B3 Laptop 11.6"',
    category: 'IT & Digital Equipment',
    description: 'Intel Celeron N4020, 4GB RAM, 128GB eMMC, Windows 11 Pro Education. DepEd Computerization Package Batch 2024.',
    serialNumber: 'NXVMESG00312345678900',
    quantity: 25,
    unit: 'units',
    unitValue: 24500,
    totalValue: 612500,
    location: 'Computer Laboratory 1',
    custodian: 'Mary Jane Cruz (ICT Coordinator)',
    condition: 'Serviceable',
    acquisitionDate: '2024-03-15',
    sourceOfFund: 'DepEd DCP (Computerization Program)',
    inventoryType: 'Semi-Expendable',
    parNumber: 'PAR-2024-041',
    notes: 'Under 3-year DepEd manufacturer warranty.',
    lastInspected: '2026-09-10',
    shortId: 'PROP-001',
    pisCode: 'PIS-26-04928'
  },
  {
    id: 'prop-seed-002',
    propertyNumber: 'LNHS-PROP-2023-018',
    name: 'Samsung 65" UHD 4K Smart TV',
    category: 'Audio-Visual & Electronics',
    description: 'Model Crystal UHD 4K AU7000 with heavy-duty movable TV rolling cart and HDMI cable.',
    serialNumber: '08X13NLR700142K',
    quantity: 1,
    unit: 'unit',
    unitValue: 42000,
    totalValue: 42000,
    location: 'Audio-Visual Room (AVR)',
    custodian: 'Jeebs M. Sabidalas',
    condition: 'Serviceable',
    acquisitionDate: '2023-08-20',
    sourceOfFund: 'PTA Donation',
    inventoryType: 'Semi-Expendable',
    parNumber: 'PAR-2023-112',
    notes: 'Used for school assemblies and multimedia presentations.',
    lastInspected: '2026-10-01',
    shortId: 'PROP-002',
    pisCode: 'PIS-26-04929'
  },
  {
    id: 'prop-seed-003',
    propertyNumber: 'LNHS-FURN-2024-055',
    name: 'Non-Wood High School Armchairs',
    category: 'School Furniture & Fixtures',
    description: 'Polypropylene plastic seat & backrest with sturdy steel tubing frame, beige/blue color.',
    quantity: 90,
    unit: 'pcs',
    unitValue: 1850,
    totalValue: 166500,
    location: 'Grade 10 - Rizal & Bonifacio Rooms',
    custodian: 'Elena Santos (Grade Level Chair)',
    condition: 'Serviceable',
    acquisitionDate: '2024-01-10',
    sourceOfFund: 'DepEd National GAA',
    inventoryType: 'Semi-Expendable',
    parNumber: 'ICS-2024-088',
    notes: 'DepEd standardized student school armchairs.',
    lastInspected: '2026-08-15',
    shortId: 'PROP-003',
    pisCode: 'PIS-26-04930'
  },
  {
    id: 'prop-seed-004',
    propertyNumber: 'LNHS-HVAC-2022-004',
    name: 'Carrier 2.5 HP Split-Type Inverter Aircon',
    category: 'Appliances & HVAC',
    description: 'Wall-mounted inverter AC unit with outdoor compressor and wireless remote controller.',
    serialNumber: 'CAR-INV-883921-X',
    quantity: 2,
    unit: 'units',
    unitValue: 56000,
    totalValue: 112000,
    location: "Principal's Office & Faculty Room",
    custodian: 'Jeebs M. Sabidalas',
    condition: 'Serviceable',
    acquisitionDate: '2022-05-18',
    sourceOfFund: 'SEF (Special Education Fund)',
    inventoryType: 'Capital Outlay',
    parNumber: 'PAR-2022-019',
    notes: 'Quarterly maintenance cleaning done August 2026.',
    lastInspected: '2026-08-25',
    shortId: 'PROP-004',
    pisCode: 'PIS-26-04931'
  },
  {
    id: 'prop-seed-005',
    propertyNumber: 'LNHS-PROP-2023-089',
    name: 'Epson EB-E01 3LCD XGA Projector',
    category: 'Audio-Visual & Electronics',
    description: '3,300 lumens brightness, HDMI/VGA inputs, 3LCD technology with ceiling mounting bracket.',
    serialNumber: 'X7FK3800291',
    quantity: 3,
    unit: 'units',
    unitValue: 26500,
    totalValue: 79500,
    location: 'Science Laboratory & Faculty Room',
    custodian: 'Grace Mendoza (Science Dept Head)',
    condition: 'Needs Repair',
    acquisitionDate: '2023-11-04',
    sourceOfFund: 'School MOOE',
    inventoryType: 'Semi-Expendable',
    parNumber: 'PAR-2023-145',
    notes: '1 unit lamp blinking orange, scheduled for bulb replacement.',
    lastInspected: '2026-09-28',
    shortId: 'PROP-005',
    pisCode: 'PIS-26-04932'
  },
  {
    id: 'prop-seed-006',
    propertyNumber: 'LNHS-SAFE-2025-010',
    name: '10 lbs ABC Dry Chemical Fire Extinguisher',
    category: 'Security & Safety Equipment',
    description: 'Standard red cylinder with wall bracket, pressure gauge indicator, and safety pin tag.',
    quantity: 8,
    unit: 'units',
    unitValue: 3200,
    totalValue: 25600,
    location: 'Science Lab, Corridors & Canteen',
    custodian: 'Jeebs M. Sabidalas',
    condition: 'Serviceable',
    acquisitionDate: '2025-02-14',
    sourceOfFund: 'School MOOE',
    inventoryType: 'Semi-Expendable',
    parNumber: 'ICS-2025-012',
    notes: 'Refilled and pressure-tested for school year 2026.',
    lastInspected: '2026-10-05',
    shortId: 'PROP-006',
    pisCode: 'PIS-26-04933'
  },
  {
    id: 'prop-seed-007',
    propertyNumber: 'LNHS-FURN-2021-009',
    name: 'Heavy Duty 4-Drawer Steel Filing Cabinet',
    category: 'School Furniture & Fixtures',
    description: 'Gauge 20 cold-rolled steel, centralized locking mechanism, light gray powder-coated finish.',
    quantity: 4,
    unit: 'units',
    unitValue: 12500,
    totalValue: 50000,
    location: 'Registrar & Records Office',
    custodian: 'Carmen Villanueva (School Registrar)',
    condition: 'Serviceable',
    acquisitionDate: '2021-09-12',
    sourceOfFund: 'School MOOE',
    inventoryType: 'Capital Outlay',
    parNumber: 'PAR-2021-033',
    notes: 'Used for permanent student Form 137 records storage.',
    lastInspected: '2026-07-20',
    shortId: 'PROP-007',
    pisCode: 'PIS-26-04934'
  }
];

// Helper to normalize numbers safely
const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Map row or local object to PropertyItem
export const mapPropertyItem = (data: any): PropertyItem => {
  const quantity = Math.max(1, toNumber(data.quantity, 1));
  const unitValue = Math.max(0, toNumber(data.unitValue ?? data.unit_value, 0));
  const totalValue = data.totalValue !== undefined && data.totalValue !== null 
    ? toNumber(data.totalValue) 
    : (quantity * unitValue);

  // Extract pisCodes if stored as array or embedded in notes metadata
  let pisCodes: string[] | undefined = Array.isArray(data.pisCodes || data.pis_codes)
    ? (data.pisCodes || data.pis_codes).filter(Boolean).map(String)
    : undefined;

  let notes = String(data.notes || '');
  if (notes.includes('<!--SYSTEM_PIS_CODES:')) {
    const metaMatch = notes.match(/<!--SYSTEM_PIS_CODES:(.*?)-->/);
    if (metaMatch && metaMatch[1]) {
      try {
        const parsed = JSON.parse(metaMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          pisCodes = parsed.map(String);
        }
      } catch {}
    }
  }

  // Extract multi-unit propertyNumbers if stored as array or in notes metadata
  let propertyNumbers: string[] | undefined = Array.isArray(data.propertyNumbers || data.property_numbers)
    ? (data.propertyNumbers || data.property_numbers).filter(Boolean).map(String)
    : undefined;

  if (notes.includes('<!--SYSTEM_PROP_NUMS:')) {
    const metaMatch = notes.match(/<!--SYSTEM_PROP_NUMS:(.*?)-->/);
    if (metaMatch && metaMatch[1]) {
      try {
        const parsed = JSON.parse(metaMatch[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          propertyNumbers = parsed.map(String);
        }
      } catch {}
    }
  }

  const primaryPis = data.pisCode || data.pis_code || (pisCodes && pisCodes.length > 0 ? pisCodes[0] : undefined);
  const primaryPropNum = String(data.propertyNumber || data.property_number || (propertyNumbers && propertyNumbers.length > 0 ? propertyNumbers[0] : `LNHS-PROP-${Date.now().toString().slice(-4)}`));

  return {
    id: String(data.id || crypto.randomUUID()),
    propertyNumber: primaryPropNum,
    name: String(data.name || 'Untitled Property Asset'),
    category: String(data.category || 'General Property'),
    description: String(data.description || ''),
    serialNumber: data.serialNumber || data.serial_number || '',
    quantity,
    unit: String(data.unit || 'unit'),
    unitValue,
    totalValue,
    location: String(data.location || 'General Campus'),
    custodian: String(data.custodian || 'Property Custodian'),
    condition: (data.condition as PropertyCondition) || 'Serviceable',
    acquisitionDate: String(data.acquisitionDate || data.acquisition_date || new Date().toISOString().split('T')[0]),
    sourceOfFund: String(data.sourceOfFund || data.source_of_fund || 'School MOOE'),
    inventoryType: (data.inventoryType || data.inventory_type || (unitValue >= 50000 ? 'Capital Outlay' : 'Semi-Expendable')) as PropertyInventoryType,
    parNumber: data.parNumber || data.par_number || '',
    notes,
    lastInspected: data.lastInspected || data.last_inspected || '',
    shortId: data.shortId || data.short_id || '',
    pisCode: primaryPis,
    pisCodes: pisCodes && pisCodes.length > 0 ? pisCodes : (primaryPis ? [primaryPis] : undefined),
    propertyNumbers: propertyNumbers && propertyNumbers.length > 0 ? propertyNumbers : (primaryPropNum ? [primaryPropNum] : undefined)
  };
};

// In-Memory & Persistent Caching for Property Items
let memoryCachedPropertyItems: PropertyItem[] | null = null;
let lastPropertyFetchTimestamp = 0;
const PROPERTY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache lifetime

// Retrieve items from local storage cache (only real items, zero mock seeds)
export const loadLocalProperties = (): PropertyItem[] => {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Automatically purge any old mock seeds (id starts with 'prop-seed-')
    const realItems = parsed.filter(item => item && !String(item.id || '').startsWith('prop-seed-'));
    if (realItems.length !== parsed.length) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(realItems));
    }
    return realItems.map(mapPropertyItem);
  } catch (e) {
    console.warn('Failed to parse property items from localStorage', e);
    return [];
  }
};

export const saveLocalProperties = (items: PropertyItem[]) => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to write property items to localStorage', e);
  }
};

/**
 * Synchronously get cached property items for instant component hydration (0ms delay)
 */
export const getCachedPropertyItems = (): PropertyItem[] => {
  if (memoryCachedPropertyItems && memoryCachedPropertyItems.length > 0) {
    return memoryCachedPropertyItems;
  }
  const local = loadLocalProperties();
  if (local && local.length > 0) {
    memoryCachedPropertyItems = local;
    return local;
  }
  return [];
};

/**
 * Invalidate the property cache to force a fresh query on next request
 */
export const invalidatePropertyCache = (): void => {
  lastPropertyFetchTimestamp = 0;
  memoryCachedPropertyItems = null;
};

/**
 * Fetch all Property Items:
 * - Returns in-memory / local cache immediately if fresh (0ms delay)
 * - Only queries Supabase when cache is expired or forceRefresh is true
 */
export const getPropertyItems = async (forceRefresh = false): Promise<PropertyItem[]> => {
  const now = Date.now();

  // 1. Return in-memory cache if valid and not forcing a refresh
  if (!forceRefresh && memoryCachedPropertyItems && memoryCachedPropertyItems.length > 0 && (now - lastPropertyFetchTimestamp < PROPERTY_CACHE_TTL)) {
    return memoryCachedPropertyItems;
  }

  // 2. Return local storage cache if available and not forcing refresh
  if (!forceRefresh && !memoryCachedPropertyItems) {
    const local = loadLocalProperties();
    if (local && local.length > 0) {
      memoryCachedPropertyItems = local;
      lastPropertyFetchTimestamp = now;
      return local;
    }
  }

  // 3. Query authoritative data from Supabase
  if (supabase && typeof supabase.from === 'function') {
    try {
      const { data, error } = await supabase
        .from('property_items')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const mapped = data.map(mapPropertyItem);
        memoryCachedPropertyItems = mapped;
        lastPropertyFetchTimestamp = Date.now();
        saveLocalProperties(mapped);
        return mapped;
      }
      if (error) {
        console.warn('Supabase property_items query notice:', error.message);
      }
    } catch (err) {
      console.warn('Could not query Supabase property_items:', err);
    }
  }

  const local = loadLocalProperties();
  memoryCachedPropertyItems = local;
  return local;
};

/**
 * Save / Update a Property Item in Cloud (Supabase):
 * Directly upserts to `property_items` in PostgreSQL.
 */
export const savePropertyItem = async (item: PropertyItem): Promise<{ success: boolean; item: PropertyItem; message?: string }> => {
  if (!item.id) item.id = crypto.randomUUID();
  if (!item.shortId) {
    item.shortId = item.propertyNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase() || `P-${Date.now().toString().slice(-4)}`;
  }
  item.totalValue = item.quantity * item.unitValue;

  // Ensure pisCode is set to first pisCodes element if available
  if (item.pisCodes && item.pisCodes.length > 0 && !item.pisCode) {
    item.pisCode = item.pisCodes[0];
  }

  // If item has multiple PIS codes, embed them in notes metadata
  let serializedNotes = item.notes?.trim() || '';
  if (item.pisCodes && item.pisCodes.length > 1) {
    const cleanNotes = serializedNotes.replace(/<!--SYSTEM_PIS_CODES:.*?-->/g, '').trim();
    const tag = `<!--SYSTEM_PIS_CODES:${JSON.stringify(item.pisCodes)}-->`;
    serializedNotes = cleanNotes ? `${cleanNotes}\n${tag}` : tag;
  }

  // If item has multiple Property Numbers, embed them in notes metadata
  if (item.propertyNumbers && item.propertyNumbers.length > 1) {
    const cleanNotes = serializedNotes.replace(/<!--SYSTEM_PROP_NUMS:.*?-->/g, '').trim();
    const tag = `<!--SYSTEM_PROP_NUMS:${JSON.stringify(item.propertyNumbers)}-->`;
    serializedNotes = cleanNotes ? `${cleanNotes}\n${tag}` : tag;
  }

  const dbPayload = {
    id: item.id,
    property_number: item.propertyNumber.trim(),
    pis_code: item.pisCode?.trim() || null,
    name: item.name.trim(),
    category: item.category,
    description: item.description?.trim() || '',
    serial_number: item.serialNumber?.trim() || null,
    quantity: item.quantity,
    unit: item.unit || 'unit',
    unit_value: item.unitValue,
    total_value: item.totalValue,
    location: item.location.trim(),
    custodian: item.custodian.trim(),
    condition: item.condition,
    acquisition_date: item.acquisitionDate || new Date().toISOString().split('T')[0],
    source_of_fund: item.sourceOfFund,
    inventory_type: item.inventoryType,
    par_number: item.parNumber?.trim() || null,
    notes: serializedNotes,
    last_inspected: item.lastInspected || null,
    short_id: item.shortId
  };

  // 1. Direct Cloud Database Upsert
  if (supabase && typeof supabase.from === 'function') {
    try {
      const { data, error } = await supabase
        .from('property_items')
        .upsert(dbPayload)
        .select()
        .single();

      if (error) {
        console.error('Supabase property_items upsert error:', error);
        return { success: false, item, message: `Cloud database error: ${error.message}` };
      }
      if (data) {
        item = mapPropertyItem(data);
      }
    } catch (err: any) {
      console.error('Supabase property_items exception:', err);
      return { success: false, item, message: `Cloud connection failed: ${err.message || err}` };
    }
  }

  // 2. Update local cache with real item
  const current = loadLocalProperties();
  const existingIndex = current.findIndex(p => p.id === item.id);
  let updatedList: PropertyItem[];
  if (existingIndex >= 0) {
    updatedList = [...current];
    updatedList[existingIndex] = item;
  } else {
    updatedList = [item, ...current];
  }
  saveLocalProperties(updatedList);
  memoryCachedPropertyItems = updatedList;
  lastPropertyFetchTimestamp = Date.now();
  if (item.location) {
    rememberLocation(item.location);
  }

  // 3. Track highest PIS code sequence persistently across all codes
  const allCodesToTrack = [item.pisCode, ...(item.pisCodes || [])].filter(Boolean) as string[];
  allCodesToTrack.forEach(code => {
    if (code.startsWith('PIS-')) {
      const parts = code.split('-');
      if (parts.length >= 3) {
        const yr = parts[1];
        const num = parseInt(parts[2], 10);
        if (!isNaN(num)) {
          recordPISSequenceUsed(num, yr);
        }
      }
    }
  });

  return { success: true, item };
};

/**
 * Bulk save property items (e.g. creating individual records with distinct PIS stickers)
 */
export const savePropertyItemsBulk = async (newItems: PropertyItem[]): Promise<{ success: boolean; count: number; message?: string }> => {
  if (!newItems || newItems.length === 0) return { success: true, count: 0 };
  let count = 0;
  for (const it of newItems) {
    const res = await savePropertyItem(it);
    if (res.success) count++;
  }
  return { success: count > 0, count };
};

/**
 * Delete a Property Item from Cloud (Supabase)
 */
export const deletePropertyItem = async (id: string): Promise<{ success: boolean; message?: string }> => {
  if (supabase && typeof supabase.from === 'function') {
    try {
      const { error } = await supabase.from('property_items').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete property item in cloud:', error);
        return { success: false, message: error.message };
      }
    } catch (err: any) {
      console.error('Failed to delete property item:', err);
      return { success: false, message: err.message || 'Network error' };
    }
  }

  const current = loadLocalProperties();
  const filtered = current.filter(p => p.id !== id);
  saveLocalProperties(filtered);
  memoryCachedPropertyItems = filtered;
  lastPropertyFetchTimestamp = Date.now();

  return { success: true };
};

/**
 * Bulk Delete Property Items from Cloud (Supabase)
 */
export const deletePropertyItemsBulk = async (ids: string[]): Promise<{ success: boolean; message?: string }> => {
  if (ids.length === 0) return { success: true };

  if (supabase && typeof supabase.from === 'function') {
    try {
      const { error } = await supabase.from('property_items').delete().in('id', ids);
      if (error) {
        console.error('Failed to bulk delete property items in cloud:', error);
        return { success: false, message: error.message };
      }
    } catch (err: any) {
      console.error('Failed to bulk delete property items:', err);
      return { success: false, message: err.message || 'Network error' };
    }
  }

  const idSet = new Set(ids);
  const current = loadLocalProperties();
  const filtered = current.filter(p => !idSet.has(p.id));
  saveLocalProperties(filtered);
  memoryCachedPropertyItems = filtered;
  lastPropertyFetchTimestamp = Date.now();

  return { success: true };
};

/**
 * Compute Property Analytics and Financial Valuation
 */
export const calculatePropertyStats = (items: PropertyItem[]): PropertyStats => {
  const totalAssets = items.length;
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValuation = items.reduce((sum, item) => sum + (item.totalValue || item.quantity * item.unitValue), 0);

  const serviceableCount = items.filter(i => i.condition === 'Serviceable').length;
  const repairCount = items.filter(i => i.condition === 'Needs Repair').length;
  const unserviceableCount = items.filter(i => i.condition === 'Unserviceable').length;
  const condemnedCount = items.filter(i => i.condition === 'For Condemnation' || i.condition === 'Disposed').length;

  const capitalOutlayCount = items.filter(i => i.inventoryType === 'Capital Outlay').length;
  const semiExpendableCount = items.filter(i => i.inventoryType === 'Semi-Expendable').length;

  // By Category
  const catMap: Record<string, number> = {};
  items.forEach(i => {
    catMap[i.category] = (catMap[i.category] || 0) + (i.totalValue || i.quantity * i.unitValue);
  });
  const valueByCategory = Object.entries(catMap).map(([name, value]) => ({ name, value }));

  // By Condition
  const condMap: Record<string, number> = {};
  items.forEach(i => {
    condMap[i.condition] = (condMap[i.condition] || 0) + 1;
  });
  const countByCondition = Object.entries(condMap).map(([name, value]) => ({ name, value }));

  // By Fund Source
  const fundMap: Record<string, number> = {};
  items.forEach(i => {
    const fund = i.sourceOfFund || 'Other';
    fundMap[fund] = (fundMap[fund] || 0) + (i.totalValue || i.quantity * i.unitValue);
  });
  const valueByFundSource = Object.entries(fundMap).map(([name, value]) => ({ name, value }));

  return {
    totalAssets,
    totalQuantity,
    totalValuation,
    serviceableCount,
    repairCount,
    unserviceableCount,
    condemnedCount,
    capitalOutlayCount,
    semiExpendableCount,
    valueByCategory,
    countByCondition,
    valueByFundSource
  };
};

/**
 * Category Code mapping for DepEd Property numbering
 */
export const getCategoryCode = (category: string = ''): string => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('science') || cat.includes('lab')) return 'SCI';
  if (cat.includes('it &') || cat.includes('digital') || cat.includes('dcp') || cat.includes('computer')) return 'DCP';
  if (cat.includes('furniture') || cat.includes('fixture')) return 'FURN';
  if (cat.includes('audio') || cat.includes('visual') || cat.includes('avr') || cat.includes('electronic')) return 'AVR';
  if (cat.includes('appliance') || cat.includes('hvac') || cat.includes('aircon')) return 'HVAC';
  if (cat.includes('sport') || cat.includes('pe')) return 'SPORTS';
  if (cat.includes('tool') || cat.includes('maintenance') || cat.includes('facility')) return 'TOOL';
  if (cat.includes('safe') || cat.includes('security') || cat.includes('disaster')) return 'SAFE';
  if (cat.includes('office') || cat.includes('admin')) return 'ADMIN';
  if (cat.includes('book') || cat.includes('learning')) return 'LRM';
  return 'PROP';
};

/**
 * Classification Code mapping for DepEd Property numbering:
 * - Capital Outlay (≥ ₱50,000, PPE / PAR) -> PPE
 * - Semi-Expendable (< ₱50,000, ICS) -> SE
 * - Donated -> DON
 */
export const getClassificationCode = (classification: PropertyInventoryType = 'Semi-Expendable'): string => {
  switch (classification) {
    case 'Capital Outlay':
      return 'PPE';
    case 'Semi-Expendable':
      return 'SE';
    case 'Donated':
      return 'DON';
    default:
      return 'SE';
  }
};

/**
 * Generate standard prefix based on Classification and Category:
 * Example:
 * - Semi-Expendable + Science -> LNHS-SE-SCI
 * - Capital Outlay + IT DCP -> LNHS-PPE-DCP
 * - Donated + Furniture -> LNHS-DON-FURN
 */
export const getPropertyNumberPrefix = (
  classification: PropertyInventoryType = 'Semi-Expendable',
  category: string = 'General Property'
): string => {
  const classCode = getClassificationCode(classification);
  const catCode = getCategoryCode(category);
  return `LNHS-${classCode}-${catCode}`;
};

/**
 * Generate Next N Sequential Property Numbers (Collision-Free & Duplicate-Safe)
 * Checks all existing property codes and propertyNumbers in the database,
 * detects the highest sequence used for this classification, category, and year,
 * and generates consecutive unique codes.
 */
export const generateNextPropertyNumbers = (
  items: PropertyItem[] = [],
  count: number = 1,
  classification: PropertyInventoryType = 'Semi-Expendable',
  category: string = 'General Property',
  year: number = new Date().getFullYear()
): string[] => {
  const prefix = getPropertyNumberPrefix(classification, category);
  const catCode = getCategoryCode(category);

  // Set of all property codes across all existing items to guarantee zero duplicate
  const existingSet = new Set<string>();
  items.forEach(it => {
    if (it.propertyNumber) existingSet.add(it.propertyNumber.trim().toUpperCase());
    if (it.propertyNumbers && Array.isArray(it.propertyNumbers)) {
      it.propertyNumbers.forEach(pn => pn && existingSet.add(pn.trim().toUpperCase()));
    }
  });

  // Find highest sequence number among existing items
  let maxSeq = 0;
  const regexes = [
    // Standard exact prefix: LNHS-SE-SCI-2026-001
    new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i'),
    // Any classification for same category & year: LNHS-(?:SE|PPE|CO|DON)-${catCode}-${year}-(\\d+)$
    new RegExp(`^LNHS-(?:SE|PPE|CO|DON)-${catCode}-${year}-(\\d+)$`, 'i'),
    // Legacy without classification: LNHS-${catCode}-${year}-(\\d+)$
    new RegExp(`^LNHS-${catCode}-${year}-(\\d+)$`, 'i'),
    // Legacy general: LNHS-PROP-${year}-(\\d+)$
    new RegExp(`^LNHS-PROP-${year}-(\\d+)$`, 'i')
  ];

  existingSet.forEach(num => {
    for (const rx of regexes) {
      const match = num.match(rx);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val;
        }
        break;
      }
    }
  });

  const result: string[] = [];
  let currSeq = maxSeq + 1;
  const total = Math.max(1, count);

  for (let i = 0; i < total; i++) {
    let candidate = `${prefix}-${year}-${currSeq.toString().padStart(3, '0')}`;
    while (existingSet.has(candidate.toUpperCase())) {
      currSeq++;
      candidate = `${prefix}-${year}-${currSeq.toString().padStart(3, '0')}`;
    }
    existingSet.add(candidate.toUpperCase());
    result.push(candidate);
    currSeq++;
  }

  return result;
};

/**
 * Generate Next Single Property Number Suggestion
 * Supports both (items, classification, category) and legacy (items, prefix)
 */
export const generateNextPropertyNumber = (
  items: PropertyItem[] = [],
  classificationOrPrefix: PropertyInventoryType | string = 'Semi-Expendable',
  category: string = 'General Property'
): string => {
  // If an explicit prefix string was passed (e.g. 'LNHS-PROP' or 'LNHS-SCI')
  if (typeof classificationOrPrefix === 'string' && classificationOrPrefix.startsWith('LNHS-')) {
    const year = new Date().getFullYear();
    const existingSet = new Set<string>();
    let maxSeq = 0;
    const rx = new RegExp(`^${classificationOrPrefix}-${year}-(\\d+)$`, 'i');

    items.forEach(it => {
      if (it.propertyNumber) {
        existingSet.add(it.propertyNumber.trim().toUpperCase());
        const m = it.propertyNumber.match(rx);
        if (m && m[1]) {
          const val = parseInt(m[1], 10);
          if (!isNaN(val) && val > maxSeq) maxSeq = val;
        }
      }
      if (it.propertyNumbers && Array.isArray(it.propertyNumbers)) {
        it.propertyNumbers.forEach(pn => pn && existingSet.add(pn.trim().toUpperCase()));
      }
    });

    let seq = maxSeq + 1;
    let candidate = `${classificationOrPrefix}-${year}-${seq.toString().padStart(3, '0')}`;
    while (existingSet.has(candidate.toUpperCase())) {
      seq++;
      candidate = `${classificationOrPrefix}-${year}-${seq.toString().padStart(3, '0')}`;
    }
    return candidate;
  }

  const classification = (classificationOrPrefix as PropertyInventoryType) || 'Semi-Expendable';
  return generateNextPropertyNumbers(items, 1, classification, category)[0];
};

const PIS_SEQUENCE_STORAGE_PREFIX = 'stelab_pis_seq_';

/**
 * Retrieve the highest recorded sequence number for a given year prefix.
 * Considers both persistent local storage memory and all items currently in the database.
 */
export const getHighestPISSequence = (items: PropertyItem[] = [], yearPrefix = '26'): number => {
  let maxSeq = 4927; // Baseline: next code will be 04928 matching DepEd standard

  // 1. Check local persistent sequence memory
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`${PIS_SEQUENCE_STORAGE_PREFIX}${yearPrefix}`);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed > maxSeq) {
          maxSeq = parsed;
        }
      }
    } catch {
      // storage unavailable
    }
  }

  // 2. Scan all existing items from the database/registry
  if (Array.isArray(items)) {
    items.forEach(it => {
      const allCodes = [it.pisCode, ...(it.pisCodes || [])].filter(Boolean) as string[];
      allCodes.forEach(code => {
        if (code.startsWith(`PIS-${yearPrefix}-`)) {
          const parts = code.split('-');
          if (parts.length >= 3) {
            const num = parseInt(parts[2], 10);
            if (!isNaN(num) && num > maxSeq) {
              maxSeq = num;
            }
          }
        }
      });
    });
  }

  return maxSeq;
};

/**
 * Record that a PIS sequence number has been generated/used so subsequent batches never repeat it.
 */
export const recordPISSequenceUsed = (highestSeq: number, yearPrefix = '26'): void => {
  if (typeof window === 'undefined' || !highestSeq || isNaN(highestSeq)) return;
  try {
    const current = getHighestPISSequence([], yearPrefix);
    if (highestSeq > current) {
      localStorage.setItem(`${PIS_SEQUENCE_STORAGE_PREFIX}${yearPrefix}`, highestSeq.toString());
    }
  } catch {
    // storage unavailable
  }
};

/**
 * Generate Next Unique Property Inventory Sticker (PIS) Code
 * Format: PIS-YY-XXXXX (e.g. PIS-26-04928)
 * Auto-generated and guaranteed unique across all batches and records.
 */
export const generateNextPISCode = (items: PropertyItem[] = [], yearPrefix = '26'): string => {
  const highest = getHighestPISSequence(items, yearPrefix);
  const nextNum = (highest + 1).toString().padStart(5, '0');
  return `PIS-${yearPrefix}-${nextNum}`;
};

/**
 * Generate Multiple Unique Sequential Property Inventory Sticker (PIS) Codes
 */
export const generateNextPISCodes = (items: PropertyItem[] = [], count = 1, yearPrefix = '26'): string[] => {
  const highest = getHighestPISSequence(items, yearPrefix);
  const codes: string[] = [];
  for (let i = 1; i <= count; i++) {
    const nextNum = (highest + i).toString().padStart(5, '0');
    codes.push(`PIS-${yearPrefix}-${nextNum}`);
  }
  return codes;
};

/**
 * Find Property by its unique PIS Sticker Code (searches primary pisCode and unit pisCodes)
 */
export const getPropertyByPIS = (items: PropertyItem[], pisCode: string): PropertyItem | undefined => {
  const clean = pisCode.trim().toUpperCase();
  return items.find(i => 
    (i.pisCode && i.pisCode.trim().toUpperCase() === clean) ||
    (i.pisCodes && i.pisCodes.some(c => c && c.trim().toUpperCase() === clean))
  );
};

/**
 * Export Property Inventory to CSV (Excel / DepEd compatible)
 */
export const exportPropertyCSV = (items: PropertyItem[]) => {
  const headers = [
    'PIS Code (Sticker)',
    'Property Number',
    'Article / Item Name',
    'Category',
    'Description / Specs',
    'Serial Number',
    'Quantity',
    'Unit',
    'Unit Cost (PHP)',
    'Total Cost (PHP)',
    'Location / Room',
    'Accountable Officer / Custodian',
    'Condition',
    'Date Acquired',
    'Fund Source',
    'Inventory Classification',
    'PAR / ICS No.',
    'Remarks'
  ];

  const rows = items.map(item => [
    `"${(item.pisCode || 'UNLINKED').replace(/"/g, '""')}"`,
    `"${item.propertyNumber.replace(/"/g, '""')}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.category.replace(/"/g, '""')}"`,
    `"${(item.description || '').replace(/"/g, '""')}"`,
    `"${(item.serialNumber || 'N/A').replace(/"/g, '""')}"`,
    item.quantity,
    `"${item.unit}"`,
    item.unitValue.toFixed(2),
    (item.totalValue || item.quantity * item.unitValue).toFixed(2),
    `"${item.location.replace(/"/g, '""')}"`,
    `"${item.custodian.replace(/"/g, '""')}"`,
    `"${item.condition}"`,
    `"${item.acquisitionDate}"`,
    `"${item.sourceOfFund.replace(/"/g, '""')}"`,
    `"${item.inventoryType}"`,
    `"${(item.parNumber || '').replace(/"/g, '""')}"`,
    `"${(item.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `LNHS_Property_Inventory_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Sync Actual LNHS Science Laboratory Property Items from the verified DepEd Excel catalog
 */
export const syncLNHSPropertyItems = async (): Promise<{ added: number; updated: number; total: number }> => {
  const existing = await getPropertyItems();
  let added = 0;
  let updated = 0;

  for (const itemDef of LNHS_ACTUAL_PROPERTY_ITEMS) {
    const found = existing.find(e => 
      e.name.toLowerCase().trim() === itemDef.name.toLowerCase().trim() ||
      e.propertyNumber === itemDef.propertyNumber ||
      (e.pisCode && itemDef.pisCode && e.pisCode === itemDef.pisCode)
    );

    if (found) {
      await savePropertyItem({
        ...found,
        category: itemDef.category,
        quantity: itemDef.quantity,
        location: itemDef.location,
        custodian: itemDef.custodian || found.custodian,
        description: itemDef.description || found.description,
        notes: itemDef.notes || found.notes
      });
      updated++;
    } else {
      const newItem: PropertyItem = {
        id: crypto.randomUUID(),
        ...itemDef
      };
      await savePropertyItem(newItem);
      added++;
    }
  }

  return { added, updated, total: LNHS_ACTUAL_PROPERTY_ITEMS.length };
};
