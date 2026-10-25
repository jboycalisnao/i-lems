import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { InventoryItem, ItemAttachment } from '../types';
import { 
  X, Upload, FileText, Download, Trash2, ExternalLink, Copy, Check, 
  Cloud, Loader2, Plus, AlertCircle, Link as LinkIcon, ShieldCheck, 
  FileCheck, HelpCircle, HardDrive
} from 'lucide-react';
import { 
  uploadItemDocumentToDDownload, 
  getDDownloadFileInfo, 
  extractDDownloadCode, 
  formatBytes,
  getStoredDDownloadApiKey
} from '../services/ddownloadService';

interface ItemFileManagerModalProps {
  item: InventoryItem;
  onClose: () => void;
  onSaveAttachments: (updatedItem: InventoryItem) => Promise<boolean | void> | void;
  apiKey?: string;
}

const CATEGORY_OPTIONS: ItemAttachment['category'][] = [
  'Manual',
  'MSDS',
  'Calibration',
  'Warranty',
  'Datasheet',
  'Guide',
  'Other'
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Manual: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  MSDS: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Calibration: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Warranty: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  Datasheet: { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  Guide: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  Other: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' }
};

export const ItemFileManagerModal: React.FC<ItemFileManagerModalProps> = ({
  item,
  onClose,
  onSaveAttachments,
  apiKey
}) => {
  const [attachments, setAttachments] = useState<ItemAttachment[]>(item.attachments || []);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ItemAttachment['category']>('Manual');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Link existing DDownload file mode
  const [linkInput, setLinkInput] = useState('');
  const [linkCategory, setLinkCategory] = useState<ItemAttachment['category']>('Manual');
  const [linkCustomName, setLinkCustomName] = useState('');
  const [isVerifyingLink, setIsVerifyingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveApiKey = apiKey || getStoredDDownloadApiKey();

  const handleCopyLink = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await uploadItemDocumentToDDownload(file, selectedCategory, effectiveApiKey);
      if (!res.success || !res.attachment) {
        throw new Error(res.error || 'Upload failed');
      }

      const updated = [...attachments, res.attachment];
      setAttachments(updated);
      setUploadSuccess(`Successfully uploaded "${file.name}" to DDownload!`);

      // Persist changes
      const updatedItem: InventoryItem = { ...item, attachments: updated };
      await onSaveAttachments(updatedItem);

      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLinkExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = extractDDownloadCode(linkInput);
    if (!cleanCode) {
      setLinkError('Please provide a valid DDownload URL or file code.');
      return;
    }

    setIsVerifyingLink(true);
    setLinkError(null);

    try {
      let fileName = linkCustomName.trim();
      let fileSize = 0;

      // Try fetching metadata from DDownload
      if (effectiveApiKey) {
        const infoRes = await getDDownloadFileInfo(cleanCode, effectiveApiKey);
        if (infoRes.success && infoRes.data) {
          fileName = fileName || infoRes.data.file_name || `ddownload_${cleanCode}`;
          fileSize = Number(infoRes.data.file_size) || 0;
        }
      }

      if (!fileName) {
        fileName = `DDownload File (${cleanCode})`;
      }

      const newAttachment: ItemAttachment = {
        id: crypto.randomUUID(),
        name: fileName,
        size: fileSize,
        fileCode: cleanCode,
        downloadUrl: `https://ddownload.com/${cleanCode}`,
        uploadedAt: new Date().toISOString(),
        category: linkCategory
      };

      const updated = [...attachments, newAttachment];
      setAttachments(updated);
      setLinkInput('');
      setLinkCustomName('');
      setUploadSuccess(`Linked DDownload file code "${cleanCode}" successfully!`);

      // Persist
      const updatedItem: InventoryItem = { ...item, attachments: updated };
      await onSaveAttachments(updatedItem);
    } catch (err: any) {
      setLinkError(err.message || 'Could not verify DDownload file.');
    } finally {
      setIsVerifyingLink(false);
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    if (!window.confirm('Are you sure you want to detach this file from this equipment? The file will remain on DDownload.')) {
      return;
    }

    const updated = attachments.filter(a => a.id !== attachmentId);
    setAttachments(updated);
    setUploadSuccess('File detached.');

    const updatedItem: InventoryItem = { ...item, attachments: updated };
    await onSaveAttachments(updatedItem);
  };

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-gray-200 flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        
        {/* Header - Solid Blue, No Gradient */}
        <div className="px-6 py-5 bg-blue-900 text-white flex justify-between items-start flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/20 text-white backdrop-blur-sm border border-white/20 flex items-center gap-1">
                <Cloud className="w-3.5 h-3.5" /> DDownload Cloud Service
              </span>
              {item.shortId && (
                <span className="font-mono text-xs bg-black/25 px-2 py-0.5 rounded text-cyan-200 font-bold">
                  {item.shortId}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold tracking-tight">{item.name}</h2>
            <p className="text-xs text-blue-100 mt-0.5">
              Category: <span className="font-semibold text-white">{item.category}</span> • Location: {item.location}
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
          
          {/* Status Feedback */}
          {uploadError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
              <button type="button" onClick={() => setUploadError(null)} className="text-red-500 hover:text-red-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {uploadSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>{uploadSuccess}</span>
              </div>
              <button type="button" onClick={() => setUploadSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* DDownload API Key Warning if not configured */}
          {!effectiveApiKey && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">DDownload API Key Not Detected</p>
                <p>
                  To upload files directly to your DDownload account, please configure your API key in <span className="font-semibold">Settings &gt; SMTP & Sync Automation &gt; DDownload Cloud Service</span>.
                  You can also paste existing DDownload URLs directly below.
                </p>
              </div>
            </div>
          )}

          {/* Current Attachments List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                Attached Documents ({attachments.length})
              </h3>
              <span className="text-xs text-gray-500">
                Directly hosted on DDownload.com
              </span>
            </div>

            {attachments.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center bg-gray-50/60">
                <Cloud className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">No documents attached yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                  Upload user manuals, Material Safety Data Sheets (MSDS), calibration records, or spec sheets to DDownload for safe cloud storage.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {attachments.map((file) => {
                  const catStyle = CATEGORY_COLORS[file.category || 'Manual'] || CATEGORY_COLORS.Other;
                  const isCopied = copiedId === file.id;

                  return (
                    <div 
                      key={file.id}
                      className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold text-xs uppercase border border-blue-100">
                          {file.name.split('.').pop()?.slice(0, 4) || 'DOC'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm truncate max-w-xs sm:max-w-md" title={file.name}>
                              {file.name}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                              {file.category || 'Manual'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                            <span>{formatBytes(file.size)}</span>
                            <span>•</span>
                            <span className="font-mono text-[11px] text-gray-500">Code: {file.fileCode}</span>
                            <span>•</span>
                            <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(file.downloadUrl, file.id)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 transition-colors"
                          title="Copy direct DDownload link"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                          {isCopied ? 'Copied' : 'Link'}
                        </button>

                        <a
                          href={file.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                          <ExternalLink className="w-3 h-3 opacity-60" />
                        </a>

                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(file.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-1"
                          title="Detach file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upload New File Section */}
          <div className="border border-gray-200 rounded-xl p-5 bg-gray-50 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                Upload New Document to DDownload
              </h4>
              <span className="text-[11px] text-gray-500 font-medium">
                PDF, Docs, Images, ZIP
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Document Type
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  Choose File to Upload
                </label>
                <div className="flex gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer border border-gray-300 rounded-lg bg-white p-1"
                  />
                  {isUploading && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold whitespace-nowrap">
                      <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Link Existing DDownload File by Code/URL */}
          <form onSubmit={handleLinkExisting} className="border border-gray-200 rounded-xl p-5 bg-white space-y-3">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-indigo-600" />
              Link Existing DDownload File
            </h4>
            <p className="text-xs text-gray-500">
              Already uploaded to DDownload? Paste the link or file code to attach it directly.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://ddownload.com/gi4o0tlro01u or file code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="sm:col-span-1">
                <select
                  value={linkCategory}
                  onChange={(e) => setLinkCategory(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 items-center justify-between pt-1">
              <input
                type="text"
                value={linkCustomName}
                onChange={(e) => setLinkCustomName(e.target.value)}
                placeholder="Optional friendly document title (e.g. Microscope User Guide 2026)"
                className="w-full sm:w-2/3 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={isVerifyingLink || !linkInput.trim()}
                className="w-full sm:w-auto px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isVerifyingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Attach Existing Link
              </button>
            </div>
            {linkError && <p className="text-xs text-red-600 font-medium">{linkError}</p>}
          </form>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <HardDrive className="w-4 h-4 text-gray-400" />
            <span>Files hosted externally via DDownload API</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default ItemFileManagerModal;
