import React, { useEffect } from 'react';
import { 
  X, MapPin, Tag, Building2, FlaskConical, HandPlatter, RotateCcw, 
  Printer, QrCode, Cable, ExternalLink, Activity, User, Calendar, 
  AlertTriangle, CheckCircle2, Package, Layers, Info
} from 'lucide-react';
import { InventoryItem, PropertyItem, BorrowRecord } from '../types';
import { getCategoryIcon, getCategoryColor } from '../constants';
import { ScannedLookupResult } from '../services/scannerLookupService';

interface ScannedRecordModalProps {
  result: ScannedLookupResult | null;
  onClose: () => void;
  onBorrow?: (item: InventoryItem, specificId?: string) => void;
  onReturn?: (recordId: string) => void;
  onNavigate?: (path: string) => void;
  onPrintSticker?: (item: PropertyItem) => void;
  onPrintCableTag?: (propertyNumber: string) => void;
}

export const ScannedRecordModal: React.FC<ScannedRecordModalProps> = ({
  result,
  onClose,
  onBorrow,
  onReturn,
  onNavigate,
  onPrintSticker,
  onPrintCableTag
}) => {
  useEffect(() => {
    if (!result) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, onClose]);

  if (!result) return null;

  const { matchType, labItem, propertyItem, specificUnitId, activeLoans = [], cleanedCode } = result;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className={`px-5 py-4 text-white flex items-center justify-between flex-shrink-0 ${
          matchType === 'property_item' 
            ? 'bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900' 
            : matchType === 'lab_item'
              ? 'bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900'
              : 'bg-gradient-to-r from-gray-800 to-gray-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-md border border-white/20">
              {matchType === 'property_item' ? (
                <Building2 className="w-5 h-5 text-amber-200" />
              ) : matchType === 'lab_item' ? (
                <FlaskConical className="w-5 h-5 text-blue-200" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-300" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  {matchType === 'property_item'
                    ? 'Property Asset Record (PIS Tagged)'
                    : matchType === 'lab_item'
                      ? 'Laboratory Equipment Record'
                      : 'Unrecognized Barcode Scan'}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded font-bold bg-white/20 text-white border border-white/30">
                  {cleanedCode}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                Pulled up instantly via USB Barcode Scanner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-gray-50/70">
          {/* CASE 1: LABORATORY INVENTORY ITEM */}
          {matchType === 'lab_item' && labItem && (() => {
            const catColor = getCategoryColor(labItem.category);
            const availableQty = labItem.quantity - (labItem.borrowedQuantity || 0);
            const specificLoan = specificUnitId 
              ? activeLoans.find(r => r.specificId?.trim().toUpperCase() === specificUnitId.trim().toUpperCase())
              : undefined;

            return (
              <div className="space-y-4">
                {/* Title & Category */}
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-xs flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span 
                        className="px-2.5 py-0.5 rounded text-xs font-bold border flex items-center gap-1.5"
                        style={{ backgroundColor: `${catColor}15`, borderColor: `${catColor}40`, color: catColor }}
                      >
                        {getCategoryIcon(labItem.category)}
                        {labItem.category}
                      </span>
                      {labItem.shortId && (
                        <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                          {labItem.shortId}
                        </span>
                      )}
                      {specificUnitId && (
                        <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Unit #{specificUnitId}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-extrabold text-gray-900 leading-tight">
                      {labItem.name}
                    </h2>
                    {labItem.description && (
                      <p className="text-xs text-gray-500 mt-1">
                        {labItem.description.replace(/<!--SYSTEM_META:.*?-->/g, '').trim()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Storage Location & Cabinet (Bold Highlight Card) */}
                <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-200 rounded-md shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 text-white rounded-md flex-shrink-0 shadow-xs">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                        Assigned Laboratory Cabinet / Storage Location
                      </span>
                      <span className="text-base sm:text-lg font-black text-blue-950">
                        {labItem.location || 'General Science Storage / Shelf'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stock & Availability Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="bg-white p-3.5 rounded-md border border-gray-200 text-center">
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Available Now</span>
                    <span className="text-2xl font-black text-blue-700 block mt-0.5">{availableQty}</span>
                    <span className="text-[10px] text-gray-400">of {labItem.quantity} {labItem.unit || 'units'}</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-md border border-gray-200 text-center">
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Currently on Loan</span>
                    <span className="text-2xl font-black text-indigo-700 block mt-0.5">{labItem.borrowedQuantity || 0}</span>
                    <span className="text-[10px] text-gray-400">borrowed by teachers/students</span>
                  </div>

                  <div className="bg-white p-3.5 rounded-md border border-gray-200 text-center col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold uppercase text-gray-500 block">Equipment Condition</span>
                    <span className="text-base font-extrabold text-gray-800 block mt-1.5">{labItem.condition}</span>
                    <span className="text-[10px] text-gray-400">Regular status</span>
                  </div>
                </div>

                {/* Active Loans Section (if on loan) */}
                {activeLoans.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-md p-4 space-y-2">
                    <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-blue-700" />
                      Active Borrower Loans ({activeLoans.length})
                    </h4>
                    <div className="divide-y divide-gray-100 text-xs">
                      {activeLoans.map(loan => (
                        <div key={loan.id} className="py-2 flex items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-gray-900">{loan.borrowerName}</span>
                            <span className="text-gray-500 ml-1.5">({loan.borrowerId})</span>
                            {loan.specificId && (
                              <span className="ml-2 font-mono text-[10px] bg-blue-50 text-blue-700 px-1 rounded border border-blue-200">
                                {loan.specificId}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 text-[11px]">Due: {loan.dueDate}</span>
                            {onReturn && (
                              <button
                                onClick={() => {
                                  onReturn(loan.id);
                                  onClose();
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 rounded text-[11px] transition-colors"
                              >
                                Return
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    onClick={() => {
                      onNavigate?.(`/inventory/list?search=${encodeURIComponent(labItem.name)}`);
                      onClose();
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View in Lab Inventory</span>
                  </button>

                  {specificLoan ? (
                    <button
                      onClick={() => {
                        onReturn?.(specificLoan.id);
                        onClose();
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Return Unit #{specificUnitId}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        onBorrow?.(labItem, specificUnitId);
                        onClose();
                      }}
                      disabled={availableQty <= 0}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-md text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <HandPlatter className="w-4 h-4" />
                      <span>Borrow Equipment {specificUnitId ? `(#${specificUnitId})` : ''}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* CASE 2: PROPERTY INVENTORY ITEM (PIS TAGGED ASSET) */}
          {matchType === 'property_item' && propertyItem && (() => {
            return (
              <div className="space-y-4">
                {/* Title & Tags */}
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-xs space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {propertyItem.pisCode && (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-sm font-mono font-black text-xs bg-[#FFF000] text-black border border-black shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-red-600 inline-block animate-pulse"></span>
                        {propertyItem.pisCode}
                      </span>
                    )}
                    <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                      {propertyItem.propertyNumber}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {propertyItem.category}
                    </span>
                  </div>

                  <h2 className="text-xl font-extrabold text-gray-900 leading-tight">
                    {propertyItem.name}
                  </h2>
                  {propertyItem.description && (
                    <p className="text-xs text-gray-600">
                      {propertyItem.description}
                    </p>
                  )}
                  {propertyItem.serialNumber && (
                    <p className="text-xs font-mono text-gray-500">
                      Serial No: <strong>{propertyItem.serialNumber}</strong>
                    </p>
                  )}
                </div>

                {/* Storage Location & Cabinet (Bold Highlight Card) */}
                <div className="p-4 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50 border-2 border-amber-200 rounded-md shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-700 text-white rounded-md flex-shrink-0 shadow-xs">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
                        Assigned Storage Location / Cabinet
                      </span>
                      <span className="text-base sm:text-lg font-black text-amber-950">
                        {propertyItem.location || 'Science Laboratory / Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Property Metadata Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white p-3 rounded-md border border-gray-200">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Condition</span>
                    <span className="font-bold text-gray-900 block mt-0.5">{propertyItem.condition}</span>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-gray-200">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Physical Qty</span>
                    <span className="font-bold text-gray-900 block mt-0.5">{propertyItem.quantity} {propertyItem.unit}</span>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-gray-200">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Accountable Officer</span>
                    <span className="font-bold text-gray-900 block mt-0.5 truncate" title={propertyItem.custodian}>
                      {propertyItem.custodian}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-md border border-gray-200">
                    <span className="text-[10px] font-bold uppercase text-gray-400 block">Fund Source</span>
                    <span className="font-bold text-gray-900 block mt-0.5 truncate" title={propertyItem.sourceOfFund}>
                      {propertyItem.sourceOfFund.split('(')[0]}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
                  <button
                    onClick={() => {
                      onNavigate?.(`/property/list?search=${encodeURIComponent(propertyItem.propertyNumber)}`);
                      onClose();
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View in Property Registry</span>
                  </button>

                  {onPrintCableTag && (
                    <button
                      onClick={() => {
                        onPrintCableTag(propertyItem.propertyNumber);
                        onClose();
                      }}
                      className="px-3.5 py-2 bg-[#FFF000] hover:bg-yellow-400 text-black border border-black rounded-md text-xs font-black transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Cable className="w-3.5 h-3.5 text-black" />
                      <span>Cable Tag</span>
                    </button>
                  )}

                  {onPrintSticker && (
                    <button
                      onClick={() => {
                        onPrintSticker(propertyItem);
                        onClose();
                      }}
                      className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>Print PIS Sticker</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* CASE 3: NO MATCH FOUND */}
          {matchType === 'none' && (
            <div className="bg-white p-8 rounded-md border border-gray-200 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  No Matching Record Found
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  The scanned code <strong className="font-mono text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">{cleanedCode}</strong> is not yet indexed in Laboratory Inventory or Property Assets.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => {
                    onNavigate?.('/inventory/list');
                    onClose();
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
                >
                  Register in Lab Inventory
                </button>
                <button
                  onClick={() => {
                    onNavigate?.('/property/list');
                    onClose();
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold transition-colors shadow-xs"
                >
                  Register as Property Asset
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-100 border-t border-gray-200 flex items-center justify-between flex-shrink-0 text-xs text-gray-500">
          <span>Ready for next scan with USB dongle.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScannedRecordModal;
