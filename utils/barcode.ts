import { InventoryItem } from '../types';

export const getBarcodeBaseId = (item: InventoryItem) =>
  (item.shortId || item.id.substring(0, 8)).trim().toUpperCase();

export const getUnitBarcode = (item: InventoryItem, sequence: number) =>
  `${getBarcodeBaseId(item)}-${String(sequence).padStart(3, '0')}`;
