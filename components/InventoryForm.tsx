
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { InventoryItem, ItemCondition, Category, InventoryBox, ItemAttachment } from '../types';
import { 
  X, Box, Lock, Plus, PackageOpen, Trash2, Save, Cloud, FileText, 
  Upload, Download, ExternalLink, Loader2, Paperclip, Copy, Check, AlertCircle, Microscope 
} from 'lucide-react';
import { uploadItemDocumentToDDownload, formatBytes, getStoredDDownloadApiKey } from '../services/ddownloadService';
import LocationSearchSelect from './LocationSearchSelect';

interface InventoryFormProps {
  initialData?: InventoryItem;
  categories: Category[];
  onSubmit: (item: InventoryItem) => void;
  onCancel: () => void;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ initialData, categories, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<InventoryItem>>(
    initialData || {
      name: '',
      category: categories[0]?.name || 'General',
      quantity: 1,
      unit: 'pcs',
      location: '',
      condition: ItemCondition.Good,
      description: '',
      safetyNotes: '',
      borrowedQuantity: 0,
      shortId: undefined,
      isConsumable: false,
      maxBorrowable: undefined,
      boxes: [],
      attachments: []
    }
  );

  const [attachments, setAttachments] = useState<ItemAttachment[]>(initialData?.attachments || []);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docCategory, setDocCategory] = useState<ItemAttachment['category']>('Manual');
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const hasLimit = initialData?.maxBorrowable !== undefined && initialData?.maxBorrowable !== null;
  const [useBorrowLimit, setUseBorrowLimit] = useState<boolean>(hasLimit);

  const hasBoxes = initialData?.boxes && initialData.boxes.length > 0;
  const [enableBoxTracking, setEnableBoxTracking] = useState<boolean>(!!hasBoxes);
  const [newBoxCount, setNewBoxCount] = useState(1);
  const [qtyPerBox, setQtyPerBox] = useState(10);
  const [boxes, setBoxes] = useState<InventoryBox[]>(initialData?.boxes || []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value);
      setFormData(prev => ({ ...prev, maxBorrowable: isNaN(val) ? undefined : val }));
  };

  const handleAddBoxes = () => {
      const currentShortId = formData.shortId || formData.category?.substring(0, 3).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
      const newBoxesList: InventoryBox[] = [];
      const currentBoxCount = boxes.length;

      for (let i = 0; i < newBoxCount; i++) {
          newBoxesList.push({
              id: `${currentShortId}-BOX-${Date.now()}-${i}`,
              label: `Box ${currentBoxCount + i + 1}`,
              quantity: qtyPerBox,
              status: 'Sealed'
          });
      }

      setBoxes(prev => [...prev, ...newBoxesList]);
      const addedQuantity = newBoxCount * qtyPerBox;
      setFormData(prev => ({
          ...prev,
          quantity: (prev.quantity || 0) + addedQuantity
      }));
  };

  const handleRemoveBox = (boxId: string, boxQty: number) => {
      setBoxes(prev => prev.filter(b => b.id !== boxId));
      setFormData(prev => ({
          ...prev,
          quantity: Math.max(0, (prev.quantity || 0) - boxQty)
      }));
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setDocUploadError(null);

    try {
      const res = await uploadItemDocumentToDDownload(file, docCategory);
      if (!res.success || !res.attachment) {
        throw new Error(res.error || 'Upload to DDownload failed');
      }

      setAttachments(prev => [...prev, res.attachment!]);
      if (docInputRef.current) docInputRef.current.value = '';
    } catch (err: any) {
      setDocUploadError(err.message || 'Failed to upload document to DDownload.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleRemoveDoc = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleCopyDocLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedDocId(id);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.quantity || !formData.location) {
        alert("Please fill in all required fields.");
        return;
    }
    
    const finalData = { 
      ...formData, 
      boxes: enableBoxTracking ? boxes : [],
      attachments 
    };
    
    if (!useBorrowLimit) {
        finalData.maxBorrowable = null;
    } else if (finalData.maxBorrowable !== undefined && finalData.maxBorrowable !== null && finalData.quantity !== undefined) {
        if (finalData.maxBorrowable > finalData.quantity) {
             alert("Borrow limit cannot be higher than total quantity.");
             return;
        }
    }

    onSubmit(finalData as InventoryItem);
  };

  const modalContent = (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white/95 backdrop-blur-2xl rounded-md shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 flex justify-between items-center bg-gray-50/80 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-800">
            {initialData ? 'Edit Laboratory Item' : 'Add Laboratory Inventory Item'}
          </h2>
          <button type="button" onClick={onCancel} aria-label="Close equipment form" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="p-6 space-y-6 overflow-y-auto">
          {/* Informative Guidance */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-md flex items-start gap-2.5 text-xs text-blue-900">
            <Microscope className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Laboratory Inventory (Non-PIS):</span> For items that do not hold physical property stickers, such as glasswares, plastic containers, reagents, optics, and consumables.
              <span className="text-blue-700 block mt-0.5">Durable apparatus with physical property stickers (microscopes, triple beam balances, hot plates) belong in <strong>Property Inventory</strong>.</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
              <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400 shadow-sm bg-white"
                  placeholder="e.g. Beaker (250 mL), Safety Goggles, Filter Paper"
                  required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm bg-white"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.name} className="text-gray-900">{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Condition *</label>
                <select
                  name="condition"
                  value={formData.condition}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm bg-white"
                >
                  {Object.values(ItemCondition).map(cond => (
                    <option key={cond} value={cond} className="text-gray-900">{cond}</option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Box className="w-4 h-4 text-gray-500"/>
                    Total Quantity (Physical) *
                </label>
                <input
                  type="number"
                  name="quantity"
                  min="1"
                  value={formData.quantity}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 shadow-sm bg-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input
                  type="text"
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 shadow-sm bg-white"
                  placeholder="e.g. sets, pcs, boxes"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-3 bg-indigo-50 p-3 rounded-md border border-indigo-100 transition-all">
                <input
                    type="checkbox"
                    id="enableBoxTracking"
                    checked={enableBoxTracking}
                    onChange={(e) => setEnableBoxTracking(e.target.checked)}
                    className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <label htmlFor="enableBoxTracking" className="text-sm font-medium text-gray-700 cursor-pointer select-none flex items-center gap-2">
                    <PackageOpen className="w-4 h-4 text-indigo-600" />
                    Enable Boxed Stock Tracking
                </label>
            </div>

            {enableBoxTracking && (
                <div className="bg-white p-4 rounded-md border border-indigo-100 shadow-sm ml-4 border-l-4 border-l-indigo-400 animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 mb-3">
                        <PackageOpen className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-bold text-gray-800 text-sm">Boxed Stock Details</h3>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Number of Boxes</label>
                            <input 
                                type="number" 
                                min="1"
                                value={newBoxCount} 
                                onChange={(e) => setNewBoxCount(parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-1.5 text-sm border border-indigo-200 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Qty per Box</label>
                            <input 
                                type="number" 
                                min="1"
                                value={qtyPerBox} 
                                onChange={(e) => setQtyPerBox(parseInt(e.target.value) || 1)}
                                className="w-full px-3 py-1.5 text-sm border border-indigo-200 rounded-md"
                            />
                        </div>
                        <div className="flex items-end">
                            <button 
                                type="button" 
                                onClick={handleAddBoxes}
                                className="w-full px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 flex items-center justify-center gap-1 font-bold shadow-sm"
                            >
                                <Plus className="w-4 h-4" /> Add Boxes
                            </button>
                        </div>
                    </div>

                    {boxes.length > 0 ? (
                        <div className="mt-4 bg-white rounded-md border border-gray-200 max-h-40 overflow-y-auto p-2">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-[10px] uppercase text-gray-500 font-bold">
                                    <tr>
                                        <th className="px-2 py-1">Label</th>
                                        <th className="px-2 py-1">Qty</th>
                                        <th className="px-2 py-1">Status</th>
                                        <th className="px-2 py-1 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {boxes.map(box => (
                                        <tr key={box.id} className="border-b last:border-0 border-gray-100">
                                            <td className="px-2 py-1.5 font-medium">{box.label}</td>
                                            <td className="px-2 py-1.5">{box.quantity}</td>
                                            <td className="px-2 py-1.5">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${box.status === 'Sealed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                    {box.status}
                                                </span>
                                            </td>
                                            <td className="px-2 py-1.5 text-right">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveBox(box.id, box.quantity)}
                                                    className="text-red-400 hover:text-red-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-xs text-gray-400 text-center py-2">No boxes generated yet.</p>
                    )}
                </div>
            )}

            <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                <div className="flex items-center space-x-3 mb-2">
                    <input
                        type="checkbox"
                        id="useBorrowLimit"
                        checked={useBorrowLimit}
                        onChange={(e) => setUseBorrowLimit(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-blue-300 focus:ring-blue-500"
                    />
                    <label htmlFor="useBorrowLimit" className="text-sm font-bold text-gray-800 cursor-pointer select-none flex items-center gap-2">
                        <Lock className="w-4 h-4 text-blue-600" />
                        Set Borrowing Limit
                    </label>
                </div>
                
                {useBorrowLimit && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200 ml-7">
                        <p className="text-xs text-gray-600 mb-2">
                            Specify max quantity available for loan. Keep sealed boxes safe.
                        </p>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                name="maxBorrowable"
                                min="0"
                                max={formData.quantity}
                                value={formData.maxBorrowable ?? ''}
                                onChange={handleLimitChange}
                                className="w-32 px-3 py-1.5 border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                            />
                            <span className="text-sm text-gray-500">
                                units available for loan
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center space-x-3 bg-blue-50/60 p-3.5 rounded-md border border-blue-200">
                <input
                    type="checkbox"
                    id="isConsumable"
                    name="isConsumable"
                    checked={formData.isConsumable || false}
                    onChange={handleChange}
                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 flex-shrink-0"
                />
                <label htmlFor="isConsumable" className="text-sm font-semibold text-gray-800 cursor-pointer select-none">
                    Consumable / Depleted Laboratory Material 
                    <span className="block text-xs font-normal text-gray-600 mt-0.5">
                      Check for consumable supplies (gloves, filter paper, batteries, wires, blades, reagents) where quantities diminish through use.
                    </span>
                </label>
            </div>

            <div>
              <LocationSearchSelect
                label="Location / Cabinet"
                name="location"
                id="inv-location"
                value={formData.location || ''}
                onChange={(newLoc) => setFormData(prev => ({ ...prev, location: newLoc }))}
                placeholder="Search or enter location (e.g. Cabinet 1, Cabinet 2)..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400 shadow-sm bg-white"
                placeholder="Technical specifications..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Safety Notes</label>
              <textarea
                name="safetyNotes"
                value={formData.safetyNotes}
                onChange={handleChange}
                rows={2}
                className="w-full px-4 py-2 border border-red-200 bg-red-50/50 rounded-md focus:ring-2 focus:ring-red-500 text-gray-900 placeholder-gray-400 shadow-sm"
                placeholder="Handling precautions..."
              />
            </div>

            {/* DDownload Laboratory Documents Section */}
            <div className="border border-blue-200 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30 rounded-xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    Laboratory Documents & DDownload Files
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Attach manuals, safety data sheets (MSDS), or calibration certificates via DDownload cloud storage.
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                  {attachments.length} attached
                </span>
              </div>

              {/* Upload Feedback */}
              {docUploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{docUploadError}</span>
                </div>
              )}

              {/* List of Attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((doc) => {
                    const isCopied = copiedDocId === doc.id;
                    return (
                      <div 
                        key={doc.id}
                        className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-xs hover:border-blue-200 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-gray-800 truncate max-w-[200px] sm:max-w-xs" title={doc.name}>
                                {doc.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-blue-50 text-blue-700 border border-blue-100">
                                {doc.category || 'Manual'}
                              </span>
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {formatBytes(doc.size)} • Code: {doc.fileCode}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyDocLink(doc.downloadUrl, doc.id)}
                            className="p-1 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded"
                            title="Copy link"
                          >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <a
                            href={doc.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                            title="Download / View"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc(doc.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Upload Input */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="sm:col-span-1">
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="Manual">Manual</option>
                    <option value="MSDS">MSDS / Safety</option>
                    <option value="Calibration">Calibration</option>
                    <option value="Warranty">Warranty</option>
                    <option value="Datasheet">Datasheet</option>
                    <option value="Guide">Guide</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <input
                    ref={docInputRef}
                    type="file"
                    onChange={handleUploadDoc}
                    disabled={isUploadingDoc}
                    className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer border border-gray-300 rounded-lg bg-white p-1"
                  />
                  {isUploadingDoc && (
                    <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-lg whitespace-nowrap">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/80 flex-shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 bg-white rounded-md text-gray-700 hover:bg-gray-100 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-8 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-bold shadow-md flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {initialData ? 'Update Equipment' : 'Save Equipment'}
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

export default InventoryForm;
