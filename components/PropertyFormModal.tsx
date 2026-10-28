import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PropertyItem, PropertyCondition, PropertyInventoryType } from '../types';
import { 
  PROPERTY_CATEGORIES, 
  FUND_SOURCES, 
  generateNextPropertyNumber, 
  generateNextPropertyNumbers, 
  getPropertyNumberPrefix,
  generateNextPISCode, 
  generateNextPISCodes 
} from '../services/propertyStorageService';
import { 
  X, Save, Sparkles, Building2, Layers, DollarSign, User, MapPin, Tag, 
  CheckSquare, ChevronDown, ChevronUp, RefreshCw, Camera, Upload, Trash2, 
  Cloud, ExternalLink, Loader2, Check 
} from 'lucide-react';
import { uploadItemPictureWithDDownload, deleteDDownloadFile } from '../services/ddownloadService';
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

  // Maintain individual sequential Property Numbers for all physical units
  const [unitPropertyNumbers, setUnitPropertyNumbers] = useState<string[]>(() => {
    if (initialData?.propertyNumbers && initialData.propertyNumbers.length > 0) {
      return [...initialData.propertyNumbers];
    }
    const qty = initialData?.quantity || 1;
    const initialClass = (initialData?.inventoryType as PropertyInventoryType) || 'Semi-Expendable';
    const initialCat = initialData?.category || PROPERTY_CATEGORIES[0];
    if (initialData?.propertyNumber) {
      if (qty > 1) {
        return generateNextPropertyNumbers(existingItems, qty, initialClass, initialCat);
      }
      return [initialData.propertyNumber];
    }
    return generateNextPropertyNumbers(existingItems, qty, initialClass, initialCat);
  });

  const [formData, setFormData] = useState<Partial<PropertyItem>>(() => {
    if (initialData) return { ...initialData };
    const defaultClass = 'Semi-Expendable';
    const defaultCat = PROPERTY_CATEGORIES[0];
    const initialPropNum = generateNextPropertyNumber(existingItems, defaultClass, defaultCat);

    return {
      pisCode: initialPISCode || generateNextPISCode(existingItems),
      propertyNumber: initialPropNum,
      name: '',
      category: defaultCat,
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
      inventoryType: defaultClass,
      parNumber: '',
      notes: '',
      lastInspected: new Date().toISOString().split('T')[0],
      imageUrl: '',
      imageFileCode: '',
      imageDDownloadUrl: ''
    };
  });

  const [copiedTemplateName, setCopiedTemplateName] = useState<string | null>(null);
  const [createSeparateRecords, setCreateSeparateRecords] = useState<boolean>(!isEditing && (initialData?.quantity || 1) > 1);
  const [showAllUnitPIS, setShowAllUnitPIS] = useState<boolean>(false);

  // Asset Profile Picture State
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadStatus, setImageUploadStatus] = useState<string | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const handleRemovePicture = async () => {
    if (formData.imageFileCode) {
      deleteDDownloadFile(formData.imageFileCode).catch(err => {
        console.warn('DDownload asset image removal warning:', err);
      });
    }
    setFormData(prev => ({ ...prev, imageUrl: '', imageFileCode: '', imageDDownloadUrl: '' }));
    setImageUploadStatus(null);
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const oldFileCode = formData.imageFileCode;

    setIsUploadingImage(true);
    setImageUploadStatus(null);
    try {
      const res = await uploadItemPictureWithDDownload(file);
      if (res.success) {
        setFormData(prev => ({
          ...prev,
          imageUrl: res.imageUrl,
          imageFileCode: res.fileCode || prev.imageFileCode,
          imageDDownloadUrl: res.downloadUrl || prev.imageDDownloadUrl
        }));

        // Clean up previously replaced picture on DDownload
        if (oldFileCode && res.fileCode && oldFileCode !== res.fileCode) {
          deleteDDownloadFile(oldFileCode).catch(err => {
            console.warn('DDownload replaced asset image cleanup warning:', err);
          });
        }

        if (res.fileCode) {
          setImageUploadStatus(`Backed up to DDownload (${res.fileCode})`);
        } else if (res.warning) {
          setImageUploadStatus(res.warning);
        } else {
          setImageUploadStatus('Picture updated successfully');
        }
      } else {
        alert(res.error || 'Failed to process image file.');
      }
    } catch (err: any) {
      alert(err.message || 'Image upload error.');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

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

  // Helper to re-sequence both Property Codes and PIS Codes collision-free
  const regenerateSequentialCodes = (
    qty: number, 
    classification: PropertyInventoryType = (formData.inventoryType as PropertyInventoryType) || 'Semi-Expendable', 
    category: string = formData.category || PROPERTY_CATEGORIES[0]
  ) => {
    const validQty = Math.max(1, qty);
    const propCodes = generateNextPropertyNumbers(existingItems, validQty, classification, category);
    const pisCodes = generateNextPISCodes(existingItems, validQty);
    setUnitPropertyNumbers(propCodes);
    setUnitPisCodes(pisCodes);
    setFormData(prev => ({
      ...prev,
      propertyNumber: propCodes[0],
      pisCode: pisCodes[0]
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'number') {
      const numVal = Math.max(0, parseFloat(value) || 0);
      setFormData(prev => {
        const next = { ...prev, [name]: numVal };
        const qty = name === 'quantity' ? Math.max(1, Math.round(numVal)) : (prev.quantity || 1);
        const cost = name === 'unitValue' ? numVal : (prev.unitValue || 0);
        next.totalValue = qty * cost;

        // Auto suggest classification based on DepEd threshold (₱50,000)
        let effectiveClass = (prev.inventoryType as PropertyInventoryType) || 'Semi-Expendable';
        if (name === 'unitValue' && prev.inventoryType !== 'Donated') {
          effectiveClass = cost >= 50000 ? 'Capital Outlay' : 'Semi-Expendable';
          next.inventoryType = effectiveClass;
        }

        // When quantity changes, automatically re-sequence individual codes for each unit
        if (name === 'quantity') {
          const propCodes = generateNextPropertyNumbers(existingItems, qty, effectiveClass, prev.category || PROPERTY_CATEGORIES[0]);
          const pisCodes = generateNextPISCodes(existingItems, qty);
          setUnitPropertyNumbers(propCodes);
          setUnitPisCodes(pisCodes);
          if (!isEditing) {
            next.propertyNumber = propCodes[0];
            next.pisCode = pisCodes[0];
            if (qty > 1) {
              setCreateSeparateRecords(true);
            }
          }
        } else if (name === 'unitValue' && effectiveClass !== prev.inventoryType && !isEditing) {
          // If cost changed classification (crossing ₱50,000 threshold), auto-update property codes to new prefix
          const propCodes = generateNextPropertyNumbers(existingItems, qty, effectiveClass, prev.category || PROPERTY_CATEGORIES[0]);
          setUnitPropertyNumbers(propCodes);
          next.propertyNumber = propCodes[0];
        }

        return next;
      });
    } else {
      setFormData(prev => {
        const next = { ...prev, [name]: value };

        // When category or classification changes, auto-regenerate sequential property codes in real-time
        if (!isEditing && (name === 'category' || name === 'inventoryType')) {
          const targetCategory = name === 'category' ? value : (prev.category || PROPERTY_CATEGORIES[0]);
          const targetClass = name === 'inventoryType' ? (value as PropertyInventoryType) : ((prev.inventoryType as PropertyInventoryType) || 'Semi-Expendable');
          const qty = prev.quantity || 1;
          const propCodes = generateNextPropertyNumbers(existingItems, qty, targetClass, targetCategory);
          next.propertyNumber = propCodes[0];
          setUnitPropertyNumbers(propCodes);
        }

        return next;
      });
    }
  };

  const handleGenerateNumber = () => {
    regenerateSequentialCodes(
      formData.quantity || 1, 
      (formData.inventoryType as PropertyInventoryType) || 'Semi-Expendable', 
      formData.category || PROPERTY_CATEGORIES[0]
    );
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

    // Ensure unit Property Numbers has length == qty
    let finalUnitPropNums = [...unitPropertyNumbers];
    if (finalUnitPropNums.length < qty) {
      const generated = generateNextPropertyNumbers(
        existingItems, 
        qty, 
        (formData.inventoryType as PropertyInventoryType) || 'Semi-Expendable', 
        formData.category || PROPERTY_CATEGORIES[0]
      );
      finalUnitPropNums = generated;
    } else if (finalUnitPropNums.length > qty) {
      finalUnitPropNums = finalUnitPropNums.slice(0, qty);
    }

    // Ensure unitPisCodes has length == qty
    let finalUnitPis = [...unitPisCodes];
    if (finalUnitPis.length < qty) {
      const generated = generateNextPISCodes(existingItems, qty);
      finalUnitPis = generated;
    } else if (finalUnitPis.length > qty) {
      finalUnitPis = finalUnitPis.slice(0, qty);
    }

    // Option A: Batch create individual records for each unit with its own unique Property Code & PIS sticker
    if (qty > 1 && createSeparateRecords && onSubmitBulk) {
      const bulkItems: PropertyItem[] = finalUnitPropNums.map((propNum, index) => {
        const pis = finalUnitPis[index] || finalUnitPis[0] || '';
        return {
          id: crypto.randomUUID(),
          propertyNumber: propNum.trim(),
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
          pisCode: pis.trim(),
          pisCodes: [pis.trim()],
          propertyNumbers: [propNum.trim()],
          imageUrl: formData.imageUrl || '',
          imageFileCode: formData.imageFileCode || '',
          imageDDownloadUrl: formData.imageDDownloadUrl || ''
        };
      });
      onSubmitBulk(bulkItems);
      return;
    }

    // Option B: Grouped under 1 asset record with all linked unit sequential Property Codes & PIS codes
    const finalItem: PropertyItem = {
      id: formData.id || crypto.randomUUID(),
      propertyNumber: finalUnitPropNums[0]?.trim() || formData.propertyNumber.trim(),
      propertyNumbers: qty > 1 ? finalUnitPropNums.map(p => p.trim()) : [formData.propertyNumber.trim()],
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
      pisCodes: qty > 1 ? finalUnitPis.map(c => c.trim()) : (formData.pisCode ? [formData.pisCode.trim()] : undefined),
      imageUrl: formData.imageUrl || '',
      imageFileCode: formData.imageFileCode || '',
      imageDDownloadUrl: formData.imageDDownloadUrl || ''
    };

    onSubmit(finalItem);
  };

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
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

          {/* Property Asset Picture / Avatar Card */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md flex flex-col sm:flex-row items-center gap-4">
            <div className="relative group w-24 h-24 rounded-md border border-gray-300 bg-white overflow-hidden flex items-center justify-center flex-shrink-0 shadow-xs">
              {formData.imageUrl ? (
                <img src={formData.imageUrl} alt={formData.name || 'Property Asset'} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 p-2 text-center">
                  <Camera className="w-7 h-7 mb-1 text-gray-400" />
                  <span className="text-[10px] font-medium leading-tight">No Picture</span>
                </div>
              )}
              {isUploadingImage && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              )}
            </div>
            
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Property Asset Picture (Profile Avatar)</h3>
                <p className="text-xs text-gray-500">Upload a photograph to identify this physical asset across inventory ledgers, PIS stickers, and property tables. Backed up directly to DDownload cloud storage.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                <input 
                  type="file" 
                  ref={imageInputRef} 
                  onChange={handleImageFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs disabled:opacity-50 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {formData.imageUrl ? 'Change Picture' : 'Upload via DDownload'}
                </button>

                {formData.imageUrl && (
                  <button
                    type="button"
                    onClick={handleRemovePicture}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-300 hover:bg-red-50 hover:text-red-600 text-gray-600 rounded-md text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}

                {formData.imageDDownloadUrl && (
                  <a
                    href={formData.imageDDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium border border-gray-300 transition-colors"
                    title="Open master file on DDownload"
                  >
                    <Cloud className="w-3.5 h-3.5 text-blue-600" />
                    <span>DDownload File</span>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>
                )}
              </div>

              {imageUploadStatus && (
                <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1 justify-center sm:justify-start">
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>{imageUploadStatus}</span>
                </div>
              )}
            </div>
          </div>

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
                      onClick={() => regenerateSequentialCodes(formData.quantity || 1)}
                      className="px-3 py-1.5 bg-amber-300 hover:bg-amber-400 text-amber-950 rounded-sm text-xs font-black transition-colors whitespace-nowrap shadow-sm border border-amber-400 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto-Sequence All {formData.quantity} Codes
                    </button>
                  )}
                </div>
              </div>

              {/* Multi-Unit Details: Sequential Property Codes & PIS Stickers when quantity > 1 */}
              {(formData.quantity || 1) > 1 && (
                <div className="pt-2 border-t border-amber-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <span className="font-bold text-amber-950 block">
                        Assigned Individual Codes: {Math.min(unitPropertyNumbers.length, unitPisCodes.length, formData.quantity || 1)} of {formData.quantity} Units
                      </span>
                      <span className="text-[10px] text-amber-800">
                        Sequential Property Codes: {unitPropertyNumbers[0]} to {unitPropertyNumbers[(formData.quantity || 1) - 1] || unitPropertyNumbers[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 cursor-pointer text-amber-950 font-bold bg-amber-100/70 px-2 py-1 rounded-sm border border-amber-300">
                        <input
                          type="checkbox"
                          checked={createSeparateRecords}
                          onChange={(e) => setCreateSeparateRecords(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Save as separate inventory rows</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAllUnitPIS(prev => !prev)}
                        className="text-amber-800 hover:text-amber-950 font-bold underline text-[11px] flex items-center gap-0.5"
                      >
                        {showAllUnitPIS ? 'Collapse Unit List' : 'View / Edit Each Unit Codes'}
                        {showAllUnitPIS ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Summary preview tags */}
                  {!showAllUnitPIS && (
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: Math.min(6, formData.quantity || 1) }).map((_, idx) => (
                        <div key={idx} className="font-mono text-[10.5px] px-2 py-1 bg-white border border-amber-300 rounded shadow-2xs flex items-center gap-1.5">
                          <span className="font-bold text-gray-500 text-[9px]">#{idx + 1}</span>
                          <span className="font-bold text-blue-900">{unitPropertyNumbers[idx] || 'Pending'}</span>
                          <span className="text-gray-300">•</span>
                          <span className="font-bold text-amber-900 bg-amber-50 px-1 rounded text-[10px]">{unitPisCodes[idx] || 'Pending'}</span>
                        </div>
                      ))}
                      {(formData.quantity || 1) > 6 && (
                        <span className="text-[11px] font-semibold text-amber-800 self-center">
                          +{ (formData.quantity || 1) - 6 } more units
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expandable unit-by-unit Property & PIS code editor */}
                  {showAllUnitPIS && (
                    <div className="bg-white/90 p-3 rounded-md border border-amber-300 max-h-56 overflow-y-auto divide-y divide-amber-100 text-xs">
                      {Array.from({ length: formData.quantity || 1 }).map((_, idx) => (
                        <div key={idx} className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="font-bold text-gray-700 w-16 text-xs">Unit #{idx + 1}</span>
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 font-bold uppercase w-14">Prop:</span>
                              <input
                                type="text"
                                value={unitPropertyNumbers[idx] || ''}
                                onChange={(e) => {
                                  const next = [...unitPropertyNumbers];
                                  next[idx] = e.target.value;
                                  setUnitPropertyNumbers(next);
                                  if (idx === 0) setFormData(prev => ({ ...prev, propertyNumber: e.target.value }));
                                }}
                                placeholder="Property Code"
                                className="flex-1 px-2.5 py-1 text-xs border border-blue-300 rounded font-mono font-bold text-blue-900 bg-blue-50/20 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500 font-bold uppercase w-14">PIS:</span>
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
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1 flex items-center justify-between">
                  <span>Property Number / Asset Tag <span className="text-red-500">*</span></span>
                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Prefix: {getPropertyNumberPrefix((formData.inventoryType as PropertyInventoryType) || 'Semi-Expendable', formData.category || PROPERTY_CATEGORIES[0])}
                  </span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="propertyNumber"
                    value={formData.propertyNumber || ''}
                    onChange={handleChange}
                    placeholder="e.g. LNHS-SE-SCI-2026-001"
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md font-mono font-bold text-blue-900 focus:ring-2 focus:ring-blue-600 focus:outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleGenerateNumber}
                    title="Auto-generate next sequential code based on classification and category"
                    className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-sm text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Auto-Sync</span>
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Auto-generates sequential, collision-free codes based on Classification and Category.
                </p>
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
