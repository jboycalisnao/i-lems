import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PropertyItem, PropertyCondition, PropertyInventoryType } from '../types';
import { PROPERTY_CATEGORIES, FUND_SOURCES, generateNextPropertyNumber, generateNextPISCode, generateNextPISCodes } from '../services/propertyStorageService';
import { X, Save, Sparkles, Building2, Layers, DollarSign, User, MapPin, Tag, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
import LocationSearchSelect from './LocationSearchSelect';
import PropertyNameSearchSelect from './PropertyNameSearchSelect';

interface PropertyFormModalProps {
  initialData?: PropertyItem;
  existingItems: PropertyItem[];
  initialPISCode?: string;
  onSubmit: (item: PropertyItem) => void;
  onSubmitBulk?: (items: PropertyItem[]) => void;
  onCancel: () => void;
}

export const PropertyFormModal: React.FC<PropertyFormModalProps> = ({
  initialData,
  existingItems,
  initialPISCode,
  onSubmit,
  onSubmitBulk,
  onCancel
}) => {
  const isEditing = Boolean(initialData?.id);

  const [formData, setFormData] = useState<Partial<PropertyItem>>(() => {
    if (initialData) return { ...initialData };
    return {
      pisCode: initialPISCode || generateNextPISCode(existingItems),
      propertyNumber: generateNextPropertyNumber(existingItems),
      name: '',
      category: PROPERTY_CATEGORIES[0],
      description: '',
      serialNumber: '',
      quantity: 1,
      unit: 'unit',
      unitValue: 0,
      totalValue: 0,
      location: 'Science Laboratory',
      custodian: 'Jeebs M. Sabidalas',
      condition: 'Serviceable',
      acquisitionDate: new Date().toISOString().split('T')[0],
      sourceOfFund: FUND_SOURCES[1], // School MOOE
      inventoryType: 'Semi-Expendable',
      parNumber: '',
      notes: '',
      lastInspected: new Date().toISOString().split('T')[0]
    };
  });

  const [copiedTemplateName, setCopiedTemplateName] = useState<string | null>(null);
  const [createSeparateRecords, setCreateSeparateRecords] = useState<boolean>(false);
  const [showAllUnitPIS, setShowAllUnitPIS] = useState<boolean>(false);

  // Maintain individual PIS codes for all physical units
  const [unitPisCodes, setUnitPisCodes] = useState<string[]>(() => {
    if (initialData?.pisCodes && initialData.pisCodes.length > 0) {
      return [...initialData.pisCodes];
    }
    const initialCode = initialData?.pisCode || initialPISCode || generateNextPISCode(existingItems);
    const qty = initialData?.quantity || 1;
    if (qty > 1) {
      return generateNextPISCodes(existingItems, qty);
    }
    return [initialCode];
  });

  const [errorMsg, setErrorMsg] = useState('');

  // Synchronize unit PIS codes array when quantity changes
  useEffect(() => {
    const qty = Math.max(1, formData.quantity || 1);
    setUnitPisCodes(prev => {
      if (prev.length === qty) return prev;
      if (prev.length > qty) {
        return prev.slice(0, qty);
      }
      // Expand with sequential codes
      const needed = qty - prev.length;
      const additional = generateNextPISCodes(existingItems, needed);
      return [...prev, ...additional];
    });
  }, [formData.quantity, existingItems]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
      const numVal = Math.max(0, parseFloat(value) || 0);
      setFormData(prev => {
        const next = { ...prev, [name]: numVal };
        // Auto calculate total value if unitValue or quantity changed
        const qty = name === 'quantity' ? numVal : (prev.quantity || 1);
        const cost = name === 'unitValue' ? numVal : (prev.unitValue || 0);
        next.totalValue = qty * cost;
        // Auto suggest classification based on DepEd threshold (₱50,000)
        if (name === 'unitValue' && prev.inventoryType !== 'Donated') {
          next.inventoryType = cost >= 50000 ? 'Capital Outlay' : 'Semi-Expendable';
        }
        return next;
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleGenerateNumber = () => {
    let prefix = 'LNHS-PROP';
    if (formData.category?.includes('Science') || formData.category?.includes('Lab')) prefix = 'LNHS-SCI';
    else if (formData.category?.includes('IT')) prefix = 'LNHS-DCP';
    else if (formData.category?.includes('Furniture')) prefix = 'LNHS-FURN';
    else if (formData.category?.includes('HVAC')) prefix = 'LNHS-HVAC';
    else if (formData.category?.includes('Safety')) prefix = 'LNHS-SAFE';

    const generated = generateNextPropertyNumber(existingItems, prefix);
    setFormData(prev => ({ ...prev, propertyNumber: generated }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.propertyNumber?.trim()) {
      setErrorMsg('Property Number is required.');
      return;
    }
    if (!formData.name?.trim()) {
      setErrorMsg('Property / Article Name is required.');
      return;
    }
    if (!formData.location?.trim()) {
      setErrorMsg('Location / Room is required.');
      return;
    }
    if (!formData.custodian?.trim()) {
      setErrorMsg('Accountable Officer / Custodian is required.');
      return;
    }

    const qty = Math.max(1, formData.quantity || 1);
    const unitVal = Math.max(0, formData.unitValue || 0);
    const totalVal = qty * unitVal;

    // Ensure unitPisCodes has length == qty
    let finalUnitPis = [...unitPisCodes];
    if (finalUnitPis.length < qty) {
      const generated = generateNextPISCodes(existingItems, qty);
      finalUnitPis = generated;
    } else if (finalUnitPis.length > qty) {
      finalUnitPis = finalUnitPis.slice(0, qty);
    }

    // Option A: Batch create individual records for each unit with identical information but distinct PIS stickers
    if (qty > 1 && createSeparateRecords && onSubmitBulk) {
      const bulkItems: PropertyItem[] = finalUnitPis.map((code, index) => {
        const propNum = index === 0 
          ? formData.propertyNumber!.trim() 
          : `${formData.propertyNumber!.trim()}-${String(index + 1).padStart(2, '0')}`;
        return {
          id: crypto.randomUUID(),
          propertyNumber: propNum,
          name: formData.name!.trim(),
          category: formData.category || 'General Property',
          description: formData.description?.trim() || '',
          serialNumber: formData.serialNumber?.trim() || '',
          quantity: 1,
          unit: formData.unit?.trim() || 'unit',
          unitValue: unitVal,
          totalValue: unitVal,
          location: formData.location!.trim(),
          custodian: formData.custodian!.trim(),
          condition: (formData.condition as PropertyCondition) || 'Serviceable',
          acquisitionDate: formData.acquisitionDate || new Date().toISOString().split('T')[0],
          sourceOfFund: formData.sourceOfFund || 'School MOOE',
          inventoryType: (formData.inventoryType as PropertyInventoryType) || (unitVal >= 50000 ? 'Capital Outlay' : 'Semi-Expendable'),
          parNumber: formData.parNumber?.trim() || '',
          notes: formData.notes?.trim() || '',
          lastInspected: formData.lastInspected || '',
          shortId: propNum.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase(),
          pisCode: code.trim(),
          pisCodes: [code.trim()]
        };
      });
      onSubmitBulk(bulkItems);
      return;
    }

    // Option B: Grouped under 1 asset record with all linked unit PIS codes
    const finalItem: PropertyItem = {
      id: formData.id || crypto.randomUUID(),
      propertyNumber: formData.propertyNumber.trim(),
      name: formData.name.trim(),
      category: formData.category || 'General Property',
      description: formData.description?.trim() || '',
      serialNumber: formData.serialNumber?.trim() || '',
      quantity: qty,
      unit: formData.unit?.trim() || 'unit',
      unitValue: unitVal,
      totalValue: totalVal,
      location: formData.location.trim(),
      custodian: formData.custodian.trim(),
      condition: (formData.condition as PropertyCondition) || 'Serviceable',
      acquisitionDate: formData.acquisitionDate || new Date().toISOString().split('T')[0],
      sourceOfFund: formData.sourceOfFund || 'School MOOE',
      inventoryType: (formData.inventoryType as PropertyInventoryType) || (unitVal >= 50000 ? 'Capital Outlay' : 'Semi-Expendable'),
      parNumber: formData.parNumber?.trim() || '',
      notes: formData.notes?.trim() || '',
      lastInspected: formData.lastInspected || '',
      shortId: formData.shortId || formData.propertyNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase(),
      pisCode: finalUnitPis[0]?.trim() || formData.pisCode?.trim() || undefined,
      pisCodes: qty > 1 ? finalUnitPis.map(c => c.trim()) : (formData.pisCode ? [formData.pisCode.trim()] : undefined)
    };

    onSubmit(finalItem);
  };

  const modalContent = (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-md shadow-2xl max-w-4xl lg:max-w-5xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-blue-900 text-white flex justify-between items-center flex-shrink-0 border-b border-blue-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-950/50 rounded-sm border border-blue-800">
              <Building2 className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <h3 className="font-bold text-base md:text-lg leading-tight">
                {isEditing ? 'Edit Property Record' : 'Register New School Property'}
              </h3>
              <p className="text-xs text-blue-200">Leon National High School Property & Plant Registry</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-white/80 hover:text-white p-1 rounded-sm hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          {/* Section 1: Property Identification & PIS Sticker Linker */}
          <div className="bg-gray-50/70 p-4 rounded-md border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-200 pb-2">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Property Identification & Sticker Linkage
              </h4>
            </div>

            {/* PIS Code Linker Banner */}
            <div className="bg-amber-50 border-2 border-amber-300 rounded-md p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-sm bg-[#FFF000] border-2 border-black flex items-center justify-center font-black text-xs text-black shadow-sm flex-shrink-0">
                    PIS
                  </div>
                  <div>
                    <label className="block text-xs font-black text-amber-950 uppercase tracking-wide">
                      Property Inventory Sticker (PIS) Code
                    </label>
                    <p className="text-[11px] text-amber-800">
                      {(formData.quantity || 1) > 1 
                        ? `${formData.quantity} physical units detected. Each unit gets its own unique PIS sticker.`
                        : 'Unique sticker code attached to this physical property.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {(formData.quantity || 1) === 1 ? (
                    <>
                      <input
                        type="text"
                        name="pisCode"
                        value={unitPisCodes[0] || formData.pisCode || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, pisCode: val }));
                          setUnitPisCodes([val]);
                        }}
                        placeholder="e.g. PIS-26-04928"
                        className="px-3 py-1.5 text-sm border-2 border-amber-400 bg-white rounded-md font-mono font-black text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none w-full sm:w-44 text-center"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const nextCode = generateNextPISCode(existingItems);
                          setFormData(prev => ({ ...prev, pisCode: nextCode }));
                          setUnitPisCodes([nextCode]);
                        }}
                        title="Generate next sequential PIS Code"
                        className="px-3 py-1.5 bg-amber-300 hover:bg-amber-400 text-amber-950 rounded-sm text-xs font-bold transition-colors whitespace-nowrap shadow-sm border border-amber-400"
                      >
                        Next PIS
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const newCodes = generateNextPISCodes(existingItems, formData.quantity || 1);
                        setUnitPisCodes(newCodes);
                        setFormData(prev => ({ ...prev, pisCode: newCodes[0] }));
                      }}
                      className="px-3 py-1.5 bg-amber-300 hover:bg-amber-400 text-amber-950 rounded-sm text-xs font-black transition-colors whitespace-nowrap shadow-sm border border-amber-400 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto-Sequence All {formData.quantity} PIS
                    </button>
                  )}
                </div>
              </div>

              {/* Multi-Unit Details & PIS List when quantity > 1 */}
              {(formData.quantity || 1) > 1 && (
                <div className="pt-2 border-t border-amber-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-amber-950">
                      Assigned Stickers: {unitPisCodes.slice(0, formData.quantity).filter(Boolean).length} of {formData.quantity} Units
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-amber-950 font-bold">
                        <input
                          type="checkbox"
                          checked={createSeparateRecords}
                          onChange={(e) => setCreateSeparateRecords(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Create as separate inventory rows</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAllUnitPIS(prev => !prev)}
                        className="text-amber-800 hover:text-amber-950 font-bold underline text-[11px] flex items-center gap-0.5"
                      >
                        {showAllUnitPIS ? 'Collapse Unit List' : 'View / Edit Each Unit PIS'}
                        {showAllUnitPIS ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Summary preview tags */}
                  {!showAllUnitPIS && (
                    <div className="flex flex-wrap gap-1.5">
                      {unitPisCodes.slice(0, Math.min(8, formData.quantity || 1)).map((code, idx) => (
                        <span key={idx} className="font-mono text-[11px] font-bold px-2 py-0.5 bg-white border border-amber-300 rounded text-amber-900 shadow-2xs">
                          Unit #{idx + 1}: {code || 'Unassigned'}
                        </span>
                      ))}
                      {(formData.quantity || 1) > 8 && (
                        <span className="text-[11px] font-semibold text-amber-800 self-center">
                          +{ (formData.quantity || 1) - 8 } more units
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expandable unit-by-unit PIS code editor */}
                  {showAllUnitPIS && (
                    <div className="bg-white/90 p-3 rounded-md border border-amber-300 max-h-52 overflow-y-auto divide-y divide-amber-100 text-xs">
                      {Array.from({ length: formData.quantity || 1 }).map((_, idx) => (
                        <div key={idx} className="py-1.5 flex items-center justify-between gap-2">
                          <span className="font-bold text-gray-700 w-16">Unit #{idx + 1}</span>
                          <input
                            type="text"
                            value={unitPisCodes[idx] || ''}
                            onChange={(e) => {
                              const next = [...unitPisCodes];
                              next[idx] = e.target.value;
                              setUnitPisCodes(next);
                              if (idx === 0) setFormData(prev => ({ ...prev, pisCode: e.target.value }));
                            }}
                            placeholder={`PIS-26-${String(idx + 1).padStart(5, '0')}`}
                            className="flex-1 px-2.5 py-1 text-xs border border-amber-300 rounded font-mono font-bold text-amber-950 bg-amber-50/30 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Property Number / Asset Tag <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="propertyNumber"
                    value={formData.propertyNumber || ''}
                    onChange={handleChange}
                    placeholder="e.g. LNHS-PROP-2026-001"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleGenerateNumber}
                    title="Auto-Generate next Tag"
                    className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-sm text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Classification <span className="text-red-500">*</span>
                </label>
                <select
                  name="inventoryType"
                  value={formData.inventoryType || 'Semi-Expendable'}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="Semi-Expendable">Semi-Expendable (&lt; ₱50,000)</option>
                  <option value="Capital Outlay">Capital Outlay (≥ ₱50,000)</option>
                  <option value="Donated">Donated Property</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Article / Property Name <span className="text-red-500">*</span></span>
                  {copiedTemplateName && (
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 animate-in fade-in">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      Synced details from: {copiedTemplateName}
                    </span>
                  )}
                </label>
                <PropertyNameSearchSelect
                  value={formData.name || ''}
                  existingItems={existingItems}
                  onChange={(newName, template) => {
                    if (template) {
                      setCopiedTemplateName(template.name);
                      setFormData(prev => ({
                        ...prev,
                        name: newName,
                        category: template.category || prev.category,
                        description: template.description || prev.description,
                        unit: template.unit || prev.unit,
                        unitValue: template.unitValue !== undefined ? template.unitValue : prev.unitValue,
                        totalValue: (prev.quantity || 1) * (template.unitValue || 0),
                        location: template.location || prev.location,
                        custodian: template.custodian || prev.custodian,
                        condition: template.condition || prev.condition,
                        sourceOfFund: template.sourceOfFund || prev.sourceOfFund,
                        inventoryType: template.inventoryType || prev.inventoryType,
                        parNumber: template.parNumber || prev.parNumber
                      }));
                    } else {
                      setCopiedTemplateName(null);
                      setFormData(prev => ({ ...prev, name: newName }));
                    }
                  }}
                  placeholder="Search existing property or type new name..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="category"
                  value={formData.category || PROPERTY_CATEGORIES[0]}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  {PROPERTY_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Description / Technical Specifications
                </label>
                <textarea
                  name="description"
                  rows={2}
                  value={formData.description || ''}
                  onChange={handleChange}
                  placeholder="Brand, model, specs, color, dimensions, processor, storage capacity..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-normal focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Serial Number / Engine No.
                </label>
                <input
                  type="text"
                  name="serialNumber"
                  value={formData.serialNumber || ''}
                  onChange={handleChange}
                  placeholder="e.g. SN-883921820"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  PAR / ICS Slip Number
                </label>
                <input
                  type="text"
                  name="parNumber"
                  value={formData.parNumber || ''}
                  onChange={handleChange}
                  placeholder="e.g. PAR-2024-041 or ICS-01"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-mono focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Source of Fund
                </label>
                <select
                  name="sourceOfFund"
                  value={formData.sourceOfFund || FUND_SOURCES[1]}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  {FUND_SOURCES.map(source => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Financial Valuation & Quantity */}
          <div className="bg-gray-50/70 p-4 rounded-md border border-gray-200 space-y-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Quantity & Financial Valuation
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  value={formData.quantity ?? 1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-bold text-gray-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Unit of Measure
                </label>
                <select
                  name="unit"
                  value={formData.unit || 'unit'}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="unit">unit</option>
                  <option value="units">units</option>
                  <option value="pcs">pcs</option>
                  <option value="set">set</option>
                  <option value="sets">sets</option>
                  <option value="lot">lot</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Unit Value (₱ PHP) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="unitValue"
                  step="0.01"
                  min="0"
                  value={formData.unitValue ?? 0}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-bold text-emerald-700 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Total Valuation (₱)
                </label>
                <div className="w-full px-3 py-2 text-sm bg-emerald-50 border border-emerald-200 rounded-md font-black text-emerald-800">
                  ₱ {((formData.quantity || 1) * (formData.unitValue || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Custody, Location & Condition */}
          <div className="bg-gray-50/70 p-5 rounded-md border border-gray-200 space-y-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-indigo-600" />
              Custodianship & Current Status
            </h4>

            {/* Row 1: Location & Custodian (Generous 2-column layout to prevent truncation) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <LocationSearchSelect
                  label="Location / Room / Office"
                  name="location"
                  id="prop-location"
                  value={formData.location || ''}
                  onChange={(newLoc) => setFormData(prev => ({ ...prev, location: newLoc }))}
                  placeholder="Search or enter location (e.g. Cabinet 1, Cabinet 3)..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Accountable Officer / Custodian <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="custodian"
                  value={formData.custodian || ''}
                  onChange={handleChange}
                  placeholder="e.g. Jeebs M. Sabidalas (Property Custodian)"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  required
                />
              </div>
            </div>

            {/* Row 2: Condition & Inspection Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Property Condition <span className="text-red-500">*</span>
                </label>
                <select
                  name="condition"
                  value={formData.condition || 'Serviceable'}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                >
                  <option value="Serviceable">Serviceable (Working / Good)</option>
                  <option value="Needs Repair">Needs Repair (Minor issue)</option>
                  <option value="Unserviceable">Unserviceable (Non-functional)</option>
                  <option value="For Condemnation">For Condemnation / Disposal</option>
                  <option value="Disposed">Disposed / Dropped</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Date Acquired / Delivered
                </label>
                <input
                  type="date"
                  name="acquisitionDate"
                  value={formData.acquisitionDate || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Date of Last Physical Count
                </label>
                <input
                  type="date"
                  name="lastInspected"
                  value={formData.lastInspected || ''}
                  onChange={handleChange}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Row 3: Additional Notes / Remarks / Warranty (Dedicated full-width row) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Additional Notes / Warranty / Remarks
              </label>
              <input
                type="text"
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                placeholder="Warranty details, supplier contact, remarks, maintenance schedule..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md font-normal focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
              />
            </div>
          </div>

          {/* Footer Submit Buttons */}
          <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 border border-gray-300 rounded-sm text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-sm font-bold shadow-md hover:shadow transition-all flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{isEditing ? 'Save Changes' : 'Register Property'}</span>
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

export default PropertyFormModal;
