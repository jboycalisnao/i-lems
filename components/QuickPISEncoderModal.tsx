import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PropertyItem, PropertyCondition } from '../types';
import { PROPERTY_CATEGORIES, FUND_SOURCES, generateNextPropertyNumber, getPropertyByPIS } from '../services/propertyStorageService';
import { X, Search, CheckCircle2, ArrowRight, Building2, Tag, Save, Sparkles, AlertCircle } from 'lucide-react';
import LocationSearchSelect from './LocationSearchSelect';

interface QuickPISEncoderModalProps {
  existingItems: PropertyItem[];
  onSaveItem: (item: PropertyItem) => void;
  onEditExisting: (item: PropertyItem) => void;
  onClose: () => void;
}

export const QuickPISEncoderModal: React.FC<QuickPISEncoderModalProps> = ({
  existingItems,
  onSaveItem,
  onEditExisting,
  onClose
}) => {
  const [pisInput, setPisInput] = useState('');
  const [searchedCode, setSearchedCode] = useState('');
  const [foundItem, setFoundItem] = useState<PropertyItem | null>(null);
  const [isNew, setIsNew] = useState(false);

  // New property form state linked to this PIS code
  const [newProp, setNewProp] = useState<Partial<PropertyItem>>({
    propertyNumber: '',
    name: '',
    category: PROPERTY_CATEGORIES[0],
    description: '',
    serialNumber: '',
    quantity: 1,
    unit: 'unit',
    unitValue: 0,
    location: 'Science Laboratory',
    custodian: 'Jeebs M. Sabidalas',
    condition: 'Serviceable',
    acquisitionDate: new Date().toISOString().split('T')[0],
    sourceOfFund: FUND_SOURCES[1],
    inventoryType: 'Semi-Expendable'
  });

  const handleLookup = (codeToLookup?: string) => {
    const target = (codeToLookup || pisInput).trim().toUpperCase();
    if (!target) return;

    setSearchedCode(target);
    const match = getPropertyByPIS(existingItems, target);

    if (match) {
      setFoundItem(match);
      setIsNew(false);
    } else {
      setFoundItem(null);
      setIsNew(true);
      // Auto-generate the corresponding property code
      const nextPropCode = generateNextPropertyNumber(existingItems);
      setNewProp(prev => ({
        ...prev,
        pisCode: target,
        propertyNumber: nextPropCode
      }));
    }
  };

  const handleSaveNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.name?.trim()) {
      alert('Please enter the Article / Property Name.');
      return;
    }
    if (!newProp.propertyNumber?.trim()) {
      alert('Property Number is required.');
      return;
    }

    const qty = Math.max(1, newProp.quantity || 1);
    const unitCost = Math.max(0, newProp.unitValue || 0);

    const completeItem: PropertyItem = {
      id: crypto.randomUUID(),
      pisCode: searchedCode,
      propertyNumber: newProp.propertyNumber.trim(),
      name: newProp.name.trim(),
      category: newProp.category || 'General Property',
      description: newProp.description?.trim() || '',
      serialNumber: newProp.serialNumber?.trim() || '',
      quantity: qty,
      unit: newProp.unit || 'unit',
      unitValue: unitCost,
      totalValue: qty * unitCost,
      location: newProp.location?.trim() || 'General Campus',
      custodian: newProp.custodian?.trim() || 'Property Custodian',
      condition: (newProp.condition as PropertyCondition) || 'Serviceable',
      acquisitionDate: newProp.acquisitionDate || new Date().toISOString().split('T')[0],
      sourceOfFund: newProp.sourceOfFund || 'School MOOE',
      inventoryType: unitCost >= 50000 ? 'Capital Outlay' : 'Semi-Expendable',
      shortId: searchedCode.replace(/[^a-zA-Z0-9]/g, '').slice(-6)
    };

    onSaveItem(completeItem);
  };

  const modalContent = (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-md shadow-2xl max-w-2xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-yellow-500 text-gray-950 flex justify-between items-center flex-shrink-0 border-b border-yellow-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-black/10 rounded-sm backdrop-blur-md">
              <Tag className="w-5 h-5 text-gray-950" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg leading-tight">
                Quick PIS Sticker Encoder & Linker
              </h3>
              <p className="text-xs font-semibold text-gray-800">
                Scan or enter the PIS Code from a physical sticker to link and index school property
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-900 hover:text-black p-1.5 rounded-sm hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-gray-50/50">
          {/* PIS Code Scanner / Input Box */}
          <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm space-y-3">
            <label className="block text-xs font-black text-gray-700 uppercase tracking-wide">
              Step 1: Enter or Scan PIS Code from Sticker
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={pisInput}
                  onChange={(e) => setPisInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                  placeholder="e.g. PIS-26-04928"
                  autoFocus
                  className="w-full pl-4 pr-10 py-3 text-base font-mono font-black border-2 border-amber-400 bg-amber-50/50 rounded-md text-blue-950 focus:ring-2 focus:ring-amber-500 focus:outline-none tracking-wider"
                />
              </div>
              <button
                type="button"
                onClick={() => handleLookup()}
                className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-gray-950 font-black rounded-sm text-sm shadow transition-colors flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                <span>Lookup Tag</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Tip: You can use a USB or Bluetooth 1D barcode scanner to scan the barcode directly into this box!
            </p>
          </div>

          {/* Result 1: Already Linked Property */}
          {foundItem && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-md p-5 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-3">
                <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span>Sticker {searchedCode} is already linked & indexed!</span>
                </div>
                <span className="font-mono text-xs font-black bg-white px-2.5 py-1 rounded-sm border border-emerald-300 text-emerald-900">
                  {foundItem.propertyNumber}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] font-bold uppercase">Article Name</span>
                  <span className="font-bold text-gray-900 text-sm">{foundItem.name}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-bold uppercase">Category</span>
                  <span className="font-semibold text-gray-800">{foundItem.category}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-bold uppercase">Location / Room</span>
                  <span className="font-medium text-gray-800">{foundItem.location}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-bold uppercase">Accountable Custodian</span>
                  <span className="font-bold text-gray-900">{foundItem.custodian}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-bold uppercase">Condition</span>
                  <span className="font-bold text-emerald-700">{foundItem.condition}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] font-bold uppercase">Acquisition Cost</span>
                  <span className="font-black text-emerald-800">₱ {foundItem.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditExisting(foundItem);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm text-xs shadow flex items-center gap-1.5 transition-colors"
                >
                  <span>Edit / Update This Record</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Result 2: New Unlinked Sticker - Encode Now Form */}
          {isNew && (
            <form onSubmit={handleSaveNew} className="bg-white border-2 border-blue-600 rounded-md p-5 space-y-4 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-[#FFF000] border border-black rounded-sm flex items-center justify-center font-mono font-black text-xs text-black">
                    PIS
                  </div>
                  <div>
                    <span className="font-black text-blue-900 text-sm">Step 2: Encode Property Details for {searchedCode}</span>
                    <p className="text-[11px] text-gray-500">Sticker is unlinked. Indexing this property will generate its official Property Code.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Generated Property Code *</label>
                  <input
                    type="text"
                    value={newProp.propertyNumber || ''}
                    onChange={(e) => setNewProp(prev => ({ ...prev, propertyNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono font-black text-blue-900 bg-gray-50 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Category *</label>
                  <select
                    value={newProp.category}
                    onChange={(e) => setNewProp(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  >
                    {PROPERTY_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-gray-700 mb-1">Article / Property Name *</label>
                  <input
                    type="text"
                    value={newProp.name || ''}
                    onChange={(e) => setNewProp(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Acer TravelMate B3 Laptop 11.6&quot;"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <LocationSearchSelect
                    label="Location / Room"
                    name="location"
                    id="quick-location"
                    value={newProp.location || ''}
                    onChange={(newLoc) => setNewProp(prev => ({ ...prev, location: newLoc }))}
                    placeholder="Search or enter location (e.g. Cabinet 1, Cabinet 3)..."
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Accountable Custodian *</label>
                  <input
                    type="text"
                    value={newProp.custodian || ''}
                    onChange={(e) => setNewProp(prev => ({ ...prev, custodian: e.target.value }))}
                    placeholder="e.g. Mary Jane Cruz (ICT Coord)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Serial Number (if applicable)</label>
                  <input
                    type="text"
                    value={newProp.serialNumber || ''}
                    onChange={(e) => setNewProp(prev => ({ ...prev, serialNumber: e.target.value }))}
                    placeholder="e.g. SN-9938210"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Unit Value (₱ PHP)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProp.unitValue || 0}
                    onChange={(e) => setNewProp(prev => ({ ...prev, unitValue: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md font-bold text-emerald-800 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-200 flex justify-end space-x-3">
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-sm text-xs md:text-sm shadow-md transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Index & Link to {searchedCode}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default QuickPISEncoderModal;
