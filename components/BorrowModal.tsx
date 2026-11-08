import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { InventoryItem, PropertyItem, BorrowRecord } from '../types';
import { X, HandPlatter, Search, Tag, Lock, Building2, MapPin, UserCheck } from 'lucide-react';
import { toast } from '../context/ToastContext';
import * as propertyStorage from '../services/propertyStorageService';

interface BorrowModalProps {
  availableItems: InventoryItem[];
  propertyItems?: PropertyItem[];
  borrowRecords?: BorrowRecord[];
  initialItem?: InventoryItem | PropertyItem;
  specificId?: string; // If set, we are borrowing a specific physical unit
  onConfirm: (
    item: InventoryItem | PropertyItem,
    borrowerName: string,
    borrowerId: string,
    quantity: number,
    dueDate: string,
    borrowerEmail?: string,
    specificId?: string
  ) => void;
  onCancel: () => void;
}

// Helper to determine if an item is a Property Inventory asset
export const isPropertyAsset = (item: any): item is PropertyItem => {
  return !!item && (
    typeof (item as PropertyItem).propertyNumber === 'string' ||
    typeof (item as PropertyItem).pisCode === 'string' ||
    Array.isArray((item as PropertyItem).pisCodes)
  );
};

export interface PropertyGroup {
  key: string;
  name: string;
  category: string;
  location?: string;
  custodian?: string;
  totalStock: number;
  availableStock: number;
  unborrowedUnits: PropertyItem[];
  representativeItem: PropertyItem;
}

export const groupPropertyItems = (
  items: PropertyItem[],
  records: BorrowRecord[]
): PropertyGroup[] => {
  const groupsMap = new Map<string, PropertyGroup>();

  items.forEach(p => {
    const rawName = p.name ? p.name.trim() : '';
    if (!rawName) return;
    const normKey = rawName.toLowerCase();

    // Check if this specific physical unit is borrowed
    const isBorrowed = records.some(r => {
      if (r.status !== 'Borrowed' && r.status !== 'Overdue') return false;
      if (r.itemId === p.id) return true;
      if (r.specificId) {
        const parts = r.specificId.split(',').map(s => s.trim().toUpperCase());
        if (p.pisCode && parts.includes(p.pisCode.toUpperCase())) return true;
        if (p.propertyNumber && parts.includes(p.propertyNumber.toUpperCase())) return true;
      }
      return false;
    });

    const rowQty = Math.max(1, Number(p.quantity) || 1);
    const availableQty = isBorrowed ? 0 : rowQty;

    const existing = groupsMap.get(normKey);
    if (!existing) {
      groupsMap.set(normKey, {
        key: `prop_group:${normKey}`,
        name: rawName,
        category: p.category || 'Science Lab - Property & Apparatus',
        location: p.location,
        custodian: p.custodian,
        totalStock: rowQty,
        availableStock: availableQty,
        unborrowedUnits: availableQty > 0 ? [p] : [],
        representativeItem: p
      });
    } else {
      existing.totalStock += rowQty;
      existing.availableStock += availableQty;
      if (availableQty > 0) {
        existing.unborrowedUnits.push(p);
      }
      if (!existing.location && p.location) {
        existing.location = p.location;
      }
      if (!existing.custodian && p.custodian) {
        existing.custodian = p.custodian;
      }
    }
  });

  return Array.from(groupsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
};

const BorrowModal: React.FC<BorrowModalProps> = ({
  availableItems = [],
  propertyItems = [],
  borrowRecords = [],
  initialItem,
  specificId,
  onConfirm,
  onCancel
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    if (!initialItem) return '';
    if (isPropertyAsset(initialItem) && !specificId) {
      return `prop_group:${initialItem.name.trim().toLowerCase()}`;
    }
    return initialItem.id;
  });
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [borrowerEmail, setBorrowerEmail] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState('');

  // Fallback internal property items to ensure properties are ALWAYS available even if parent hasn't finished loading
  const [internalPropItems, setInternalPropItems] = useState<PropertyItem[]>(() => {
    if (propertyItems && propertyItems.length > 0) return propertyItems;
    return propertyStorage.getCachedPropertyItems();
  });

  useEffect(() => {
    if (propertyItems && propertyItems.length > 0) {
      setInternalPropItems(propertyItems);
    } else {
      propertyStorage.getPropertyItems().then(fetched => {
        if (Array.isArray(fetched) && fetched.length > 0) {
          setInternalPropItems(fetched);
        }
      }).catch(err => {
        console.warn('Could not load property items in BorrowModal:', err);
      });
    }
  }, [propertyItems]);

  useEffect(() => {
    if (initialItem) {
      if (isPropertyAsset(initialItem) && !specificId) {
        setSelectedItemId(`prop_group:${initialItem.name.trim().toLowerCase()}`);
      } else {
        setSelectedItemId(initialItem.id);
      }
    }
  }, [initialItem, specificId]);

  const allPropertyItems = internalPropItems.length > 0 ? internalPropItems : propertyItems;

  // Build property groups consolidated by equipment name
  const propertyGroups = React.useMemo(() => {
    return groupPropertyItems(allPropertyItems, borrowRecords);
  }, [allPropertyItems, borrowRecords]);

  // Check if selectedItemId matches a property group
  const selectedPropGroup = propertyGroups.find(
    g => g.key === selectedItemId || (initialItem && isPropertyAsset(initialItem) && !specificId && g.name.toLowerCase() === initialItem.name.trim().toLowerCase())
  );

  // Check if selectedItemId matches a lab item
  const selectedLabItem = availableItems.find(i => i.id === selectedItemId);

  // Check if selectedItemId matches a specific single property item (e.g. from USB scanner or explicit unit ID)
  const selectedPropItem = allPropertyItems.find(p => p.id === selectedItemId);

  const isPropGroup = !specificId && !!selectedPropGroup;
  const isPropSingle = !isPropGroup && (!!specificId || (!!selectedPropItem && isPropertyAsset(selectedPropItem)) || (!!initialItem && isPropertyAsset(initialItem)));
  const isProp = isPropGroup || isPropSingle;

  const activeGroup: PropertyGroup | undefined = isPropGroup ? selectedPropGroup : undefined;
  const activePropertyItem: PropertyItem | undefined = isPropSingle
    ? (selectedPropItem || (initialItem as PropertyItem) || selectedPropGroup?.representativeItem)
    : (activeGroup?.representativeItem);

  const selectedItem: InventoryItem | PropertyItem | undefined =
    selectedLabItem || (activeGroup?.unborrowedUnits[0] || activeGroup?.representativeItem) || activePropertyItem || initialItem;

  // If specific ID is provided or single physical unit, lock quantity to 1
  useEffect(() => {
    if (specificId || (isPropSingle && activePropertyItem && (Number(activePropertyItem.quantity) || 1) === 1)) {
      setQuantity(1);
    }
  }, [specificId, isPropSingle, activePropertyItem]);

  // Lab item availability calculation
  const hasLabLimit =
    selectedLabItem &&
    selectedLabItem.maxBorrowable !== undefined &&
    selectedLabItem.maxBorrowable !== null;
  const labBorrowLimit = selectedLabItem
    ? (hasLabLimit ? selectedLabItem.maxBorrowable! : selectedLabItem.quantity)
    : 0;
  const labAvailable = selectedLabItem
    ? Math.max(0, labBorrowLimit - (selectedLabItem.borrowedQuantity || 0))
    : 0;
  const isRestricted = hasLabLimit && selectedLabItem && labBorrowLimit < selectedLabItem.quantity;

  // Property item availability calculation
  let propAvailable = 0;
  let propTotalQty = 0;

  if (activeGroup) {
    propAvailable = activeGroup.availableStock;
    propTotalQty = activeGroup.totalStock;
  } else if (activePropertyItem) {
    const borrowed = borrowRecords
      .filter(r => r.itemId === activePropertyItem.id && (r.status === 'Borrowed' || r.status === 'Overdue'))
      .reduce((sum, r) => sum + (r.quantity || 1), 0);
    propTotalQty = Math.max(1, Number(activePropertyItem.quantity) || 1);
    propAvailable = Math.max(0, propTotalQty - borrowed);
  }

  // Final available & total count
  const available = isProp ? propAvailable : labAvailable;
  const totalStock = isProp ? propTotalQty : (selectedLabItem?.quantity || 0);

  // Parse specific PIS tags for the selected quantity
  const allocatedUnits = activeGroup
    ? activeGroup.unborrowedUnits.slice(0, quantity)
    : (activePropertyItem ? [activePropertyItem] : []);

  const parsedPISCodes = allocatedUnits
    .map(u => u.pisCode || u.propertyNumber)
    .filter(Boolean);

  const effectiveSpecificId = specificId
    ? specificId
    : parsedPISCodes.length > 0
      ? parsedPISCodes.join(', ')
      : (activePropertyItem
          ? (activePropertyItem.pisCode || activePropertyItem.propertyNumber)
          : undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const itemToBorrow = activeGroup
      ? (activeGroup.unborrowedUnits[0] || activeGroup.representativeItem)
      : (selectedLabItem || activePropertyItem || initialItem);

    if (!itemToBorrow) {
      toast.error('Please select an item to borrow.', 'Item Required');
      return;
    }
    if (available <= 0) {
      toast.error('No units available for loan at this time.', 'Stock Unavailable');
      return;
    }
    if (quantity > available) {
      toast.error('Quantity exceeds available loan stock.', 'Stock Limit Exceeded');
      return;
    }

    onConfirm(
      itemToBorrow,
      borrowerName,
      borrowerId,
      quantity,
      dueDate,
      borrowerEmail.trim() || undefined,
      effectiveSpecificId
    );
  };

  // Filter lab items that have stock
  const stockLabItems = availableItems.filter(i => {
    const hLimit = i.maxBorrowable !== undefined && i.maxBorrowable !== null;
    const limit = hLimit ? i.maxBorrowable! : i.quantity;
    return limit - (i.borrowedQuantity || 0) > 0;
  });

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg relative border border-gray-200 flex flex-col overflow-hidden">
        {/* Header - Clean Light Institutional Surfaces */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-md border border-blue-200">
              <HandPlatter className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                {initialItem
                  ? isProp
                    ? 'Borrow Property Asset'
                    : 'Borrow Laboratory Equipment'
                  : 'New Equipment Loan'}
              </h3>
              <p className="text-xs text-gray-500">
                Records laboratory lending and accountable property sign-outs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[82vh]">
          {/* Equipment Selection or Preselected Card */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Equipment / Asset to Borrow *
            </label>

            {initialItem ? (
              <div
                className={`p-4 rounded-md border ${
                  isProp
                    ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                    : 'bg-blue-50/50 border-blue-200 text-blue-950'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
                      {isProp ? 'Property Asset (PIS Tagged)' : 'Laboratory Inventory'}
                    </span>
                    <h4 className="font-bold text-sm sm:text-base text-gray-900">
                      {activeGroup ? activeGroup.name : initialItem.name}
                    </h4>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-700 flex-shrink-0">
                    {activeGroup ? activeGroup.category : initialItem.category}
                  </span>
                </div>

                {isProp && (activeGroup || activePropertyItem) && (
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-amber-200/70 pt-2.5 text-gray-700">
                    {(activeGroup?.location || activePropertyItem?.location) && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span>{activeGroup?.location || activePropertyItem?.location}</span>
                      </div>
                    )}
                    {(activeGroup?.custodian || activePropertyItem?.custodian) && (
                      <div className="col-span-2 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <span>Custodian: {activeGroup?.custodian || activePropertyItem?.custodian}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-gray-200/60 pt-2 text-xs">
                  <span className="text-gray-600 flex items-center gap-1">
                    {isRestricted && <Lock className="w-3.5 h-3.5 text-blue-600" />}
                    Total Stock: <strong>{totalStock}</strong>
                  </span>
                  <span className="font-bold text-blue-800">
                    Available for loan: {available}
                  </span>
                </div>

                {effectiveSpecificId && (
                  <div className="mt-2.5 p-2 bg-white rounded border border-amber-300 text-xs text-gray-800">
                    <div className="flex items-center gap-1.5 font-bold text-gray-700 mb-1">
                      <Tag className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>
                        {parsedPISCodes.length > 1
                          ? `Allocated PIS Units (${parsedPISCodes.length} units auto-assigned):`
                          : 'Tracked Unit / PIS Sticker:'}
                      </span>
                    </div>
                    <div className="font-mono text-[11px] text-amber-950 break-words font-semibold bg-amber-50/70 p-1.5 rounded border border-amber-200/70">
                      {parsedPISCodes.length > 5
                        ? `${parsedPISCodes.slice(0, 4).join(', ')} ... (+${parsedPISCodes.length - 4} more)`
                        : effectiveSpecificId}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <select
                    value={selectedItemId}
                    onChange={(e) => {
                      setSelectedItemId(e.target.value);
                      setQuantity(1);
                    }}
                    required
                    disabled={!!specificId}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 appearance-none shadow-xs bg-white disabled:bg-gray-100 text-sm"
                  >
                    <option value="" disabled className="text-gray-500">
                      Select Laboratory Equipment or Property Asset...
                    </option>

                    {propertyGroups.filter(g => g.availableStock > 0).length > 0 && (
                      <optgroup label="Property Inventory (PIS Tagged Assets)">
                        {propertyGroups
                          .filter(g => g.availableStock > 0)
                          .map(group => (
                            <option key={group.key} value={group.key} className="text-gray-900">
                              {group.name} ({group.availableStock} available)
                            </option>
                          ))}
                      </optgroup>
                    )}

                    {stockLabItems.length > 0 && (
                      <optgroup label="Laboratory Inventory (Apparatus & Reagents)">
                        {stockLabItems.map(item => {
                          const hL = item.maxBorrowable !== undefined && item.maxBorrowable !== null;
                          const limit = hL ? item.maxBorrowable! : item.quantity;
                          const avail = Math.max(0, limit - (item.borrowedQuantity || 0));
                          return (
                            <option key={item.id} value={item.id} className="text-gray-900">
                              {item.name} ({avail} available)
                            </option>
                          );
                        })}
                      </optgroup>
                    )}
                  </select>

                  {!specificId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                      <Search className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {selectedItem && (
                  <div className={`p-3.5 rounded-md border text-xs space-y-2.5 ${
                    isProp ? 'bg-amber-50/50 border-amber-200 text-amber-950' : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-gray-900 text-sm">
                        {activeGroup ? activeGroup.name : selectedItem.name}
                      </div>
                      <span className="text-blue-700 font-bold">
                        {available} units available
                      </span>
                    </div>

                    {isProp ? (
                      <>
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-200/70 text-gray-700">
                          {(activeGroup?.location || activePropertyItem?.location) && (
                            <div className="col-span-2 flex items-center gap-1 text-gray-600">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              <span>{activeGroup?.location || activePropertyItem?.location}</span>
                            </div>
                          )}
                          {(activeGroup?.custodian || activePropertyItem?.custodian) && (
                            <div className="col-span-2 flex items-center gap-1 text-gray-600">
                              <UserCheck className="w-3.5 h-3.5 text-gray-400" />
                              <span>Custodian: {activeGroup?.custodian || activePropertyItem?.custodian}</span>
                            </div>
                          )}
                        </div>

                        {effectiveSpecificId && (
                          <div className="mt-2 p-2 bg-white rounded border border-amber-300 text-xs text-gray-800">
                            <div className="flex items-center gap-1.5 font-bold text-gray-700 mb-1">
                              <Tag className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                              <span>
                                {parsedPISCodes.length > 1
                                  ? `Allocated PIS Units (${parsedPISCodes.length} units auto-assigned):`
                                  : 'Tracked Unit / PIS Sticker:'}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] text-amber-950 break-words font-semibold bg-amber-50/70 p-1.5 rounded border border-amber-200/70">
                              {parsedPISCodes.length > 5
                                ? `${parsedPISCodes.slice(0, 4).join(', ')} ... (+${parsedPISCodes.length - 4} more)`
                                : effectiveSpecificId}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-xs text-gray-600">
                        <span>Total Quantity: <strong>{totalStock}</strong></span>
                        <span className="font-bold text-blue-700">Available: {available}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Borrower Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Borrower Full Name *
            </label>
            <input
              type="text"
              required
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white shadow-xs text-sm"
              placeholder="e.g. Maria Santos / Teacher Juan"
            />
          </div>

          {/* ID Number / Section */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              ID Number / Grade & Section *
            </label>
            <input
              type="text"
              required
              value={borrowerId}
              onChange={(e) => setBorrowerId(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white shadow-xs text-sm"
              placeholder="e.g. Grade 10 - Einstein / Teacher ID 2024-001"
            />
          </div>

          {/* Borrower Email */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              Borrower Email (Optional for Due Reminder Notifications)
            </label>
            <input
              type="email"
              value={borrowerEmail}
              onChange={(e) => setBorrowerEmail(e.target.value)}
              className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white shadow-xs text-sm"
              placeholder="e.g. teacher.borrower@deped.gov.ph"
            />
          </div>

          {/* Quantity & Due Date */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Loan Quantity *
              </label>
              <input
                type="number"
                min="1"
                max={Math.max(1, available)}
                required
                disabled={!selectedItem || !!effectiveSpecificId}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white shadow-xs disabled:bg-gray-100 disabled:text-gray-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Return Due Date *
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white shadow-xs text-sm"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex space-x-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedItem || available === 0}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
            >
              Confirm Loan Sign-Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default BorrowModal;
