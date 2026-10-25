import { InventoryItem, PropertyItem, BorrowRecord, InventoryBox } from '../types';
import * as propertyStorage from './propertyStorageService';

export interface ScannedLookupResult {
  rawCode: string;
  cleanedCode: string;
  matchType: 'lab_item' | 'property_item' | 'none';
  labItem?: InventoryItem;
  propertyItem?: PropertyItem;
  specificUnitId?: string;
  matchedBox?: InventoryBox;
  activeLoans?: BorrowRecord[];
}

/**
 * Extracts raw identifier from QR codes, URLs or encoded queries
 */
export const parseScannedBarcode = (code: string): string => {
  if (!code) return '';
  const trimmed = code.trim();

  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('view_item=') || trimmed.includes('view_pis=') || trimmed.includes('leonnhs.edu.ph')) {
      const safeUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
      const url = new URL(safeUrl);
      const viewPis = url.searchParams.get('view_pis');
      if (viewPis) return viewPis.trim();
      const viewItem = url.searchParams.get('view_item');
      if (viewItem) return viewItem.trim();
    }
  } catch (e) {
    // Not a valid URL, proceed with raw string
  }

  return trimmed;
};

/**
 * Resolves a scanned barcode against both Laboratory Inventory and Property Inventory
 */
export const lookupScannedBarcode = async (
  rawBarcode: string,
  labItems: InventoryItem[],
  borrowRecords: BorrowRecord[],
  cachedPropertyItems?: PropertyItem[]
): Promise<ScannedLookupResult> => {
  const cleanedCode = parseScannedBarcode(rawBarcode);
  const upperCode = cleanedCode.toUpperCase();

  // 1. Check Property Inventory items (PIS Stickers, Property Numbers, Serial Numbers)
  let propertyItems = cachedPropertyItems;
  if (!propertyItems || propertyItems.length === 0) {
    propertyItems = propertyStorage.getCachedPropertyItems();
    if (propertyItems.length === 0) {
      try {
        propertyItems = await propertyStorage.getPropertyItems(false);
      } catch (e) {
        propertyItems = [];
      }
    }
  }

  // Look for exact PIS sticker match (e.g. "PIS-26-0042") in primary or multi-unit codes
  let matchedUnitPIS: string | undefined;
  let matchedProperty = propertyItems.find(p => {
    if ((p.pisCode || '').trim().toUpperCase() === upperCode) {
      matchedUnitPIS = upperCode;
      return true;
    }
    if (p.pisCodes && p.pisCodes.some(c => c && c.trim().toUpperCase() === upperCode)) {
      matchedUnitPIS = upperCode;
      return true;
    }
    return false;
  });

  // Look for exact Property Number match in primary or multi-unit propertyNumbers (e.g. "LNHS-SE-SCI-2026-001")
  if (!matchedProperty) {
    matchedProperty = propertyItems.find(p => {
      if ((p.propertyNumber || '').trim().toUpperCase() === upperCode) {
        matchedUnitPIS = upperCode;
        return true;
      }
      if (p.propertyNumbers && p.propertyNumbers.some(pn => pn && pn.trim().toUpperCase() === upperCode)) {
        matchedUnitPIS = upperCode;
        return true;
      }
      return false;
    });
  }

  // Look for Serial Number match
  if (!matchedProperty) {
    matchedProperty = propertyItems.find(p => (p.serialNumber || '').trim().toUpperCase() === upperCode);
  }

  // Look for shortId match in property
  if (!matchedProperty) {
    matchedProperty = propertyItems.find(p => (p.shortId || '').trim().toUpperCase() === upperCode);
  }

  if (matchedProperty) {
    return {
      rawCode: rawBarcode,
      cleanedCode,
      matchType: 'property_item',
      propertyItem: matchedProperty,
      specificUnitId: matchedUnitPIS
    };
  }

  // 2. Check Laboratory Inventory items
  let matchedLabItem: InventoryItem | undefined;
  let matchedBox: InventoryBox | undefined;

  // Check box IDs
  for (const inv of labItems) {
    if (inv.boxes) {
      const box = inv.boxes.find(b => b.id.toUpperCase() === upperCode);
      if (box) {
        matchedLabItem = inv;
        matchedBox = box;
        break;
      }
    }
  }

  // Check exact ID (UUID or shortId e.g. "LNHS-001")
  if (!matchedLabItem) {
    matchedLabItem = labItems.find(i => i.id.toUpperCase() === upperCode || (i.shortId && i.shortId.toUpperCase() === upperCode));
  }

  // Check sequence barcode (e.g. "LNHS-001-003")
  let specificUnitId: string | undefined;
  if (!matchedLabItem && upperCode.includes('-')) {
    const parts = upperCode.split('-');
    if (parts.length >= 3) {
      const potentialShortId = parts.slice(0, parts.length - 1).join('-');
      matchedLabItem = labItems.find(i => i.shortId && i.shortId.toUpperCase() === potentialShortId);
      if (matchedLabItem) {
        specificUnitId = upperCode;
      }
    }
  }

  // Check partial name if query is reasonably long
  if (!matchedLabItem && cleanedCode.length >= 4) {
    matchedLabItem = labItems.find(i => i.name.toLowerCase().includes(cleanedCode.toLowerCase()));
  }

  if (matchedLabItem) {
    const activeLoans = borrowRecords.filter(r => r.itemId === matchedLabItem!.id && (r.status === 'Borrowed' || r.status === 'Overdue'));
    return {
      rawCode: rawBarcode,
      cleanedCode,
      matchType: 'lab_item',
      labItem: matchedLabItem,
      specificUnitId,
      matchedBox,
      activeLoans
    };
  }

  // No match found
  return {
    rawCode: rawBarcode,
    cleanedCode,
    matchType: 'none'
  };
};
