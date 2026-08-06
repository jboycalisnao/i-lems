

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { InventoryItem, BorrowRecord, InventoryBox } from '../types';
import { Scan, Search, Camera, X, Box, MapPin, Activity, HandPlatter, RotateCcw, AlertTriangle, Tag, CheckCircle, ClipboardList, FileText, Printer, ChevronRight, PackageOpen } from 'lucide-react';
import { getCategoryIcon, getCategoryColor } from '../constants';
import { getBarcodeBaseId, getUnitBarcode } from '../utils/barcode';

interface ScannerProps {
  items: InventoryItem[];
  borrowRecords: BorrowRecord[];
  onBorrow: (item: InventoryItem, specificId?: string) => void;
  onReturn: (recordId: string) => void;
  onUnbox?: (item: InventoryItem, boxId: string) => void;
}

const Scanner: React.FC<ScannerProps> = ({ items, borrowRecords, onBorrow, onReturn, onUnbox }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.split('/').filter(Boolean)[1];
  const mode: 'search' | 'audit' = routeTab === 'audit' ? 'audit' : 'search';
  
  // Shared Scanner State
  const [scanMethod, setScanMethod] = useState<'manual' | 'camera'>('manual');
  const [inputVal, setInputVal] = useState('');
  const scannerRef = useRef<any>(null);
  
  // Feedback State (To replace alerts)
  const [scanFeedback, setScanFeedback] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // --- Search Mode State ---
  const [foundItem, setFoundItem] = useState<InventoryItem | null>(null);
  const [scannedUniqueId, setScannedUniqueId] = useState<string>('');
  const [relatedRecords, setRelatedRecords] = useState<BorrowRecord[]>([]);
  const [foundBox, setFoundBox] = useState<InventoryBox | null>(null);

  // --- Audit Mode State ---
  const [auditSelectedItemId, setAuditSelectedItemId] = useState<string>('');
  const [auditScannedIds, setAuditScannedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (routeTab !== 'search' && routeTab !== 'audit') {
      navigate('/scanner/search', { replace: true });
    }
  }, [navigate, routeTab]);
  
  // Auto-focus input on mount
  useEffect(() => {
    if (scanMethod === 'manual') {
      const input = document.getElementById('scanner-input');
      input?.focus();
    }
  }, [scanMethod, foundItem, mode, auditSelectedItemId]);

  // Clean up scanner
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
            scannerRef.current.clear().catch((e: any) => console.warn("Failed to clear scanner", e));
        } catch (e) {
            // ignore
        }
        scannerRef.current = null;
      }
    };
  }, [scanMethod, mode]);

  // Clear feedback after 3 seconds
  useEffect(() => {
    if (scanFeedback) {
        const timer = setTimeout(() => setScanFeedback(null), 3000);
        return () => clearTimeout(timer);
    }
  }, [scanFeedback]);

  // --- Logic Shared ---
  
  const startCamera = () => {
    setScanMethod('camera');
    setTimeout(() => {
        try {
            const html5QrcodeScanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 250 } },
                false
            );
            
            html5QrcodeScanner.render((decodedText: string) => {
                handleScan(decodedText);
                // In search mode, stop after one successful scan
                if (mode === 'search') {
                     html5QrcodeScanner.clear().catch((e: any) => console.error("Failed to clear", e));
                     setScanMethod('manual');
                }
            }, (errorMessage: string) => {
                // ignore errors during scanning
            });
            scannerRef.current = html5QrcodeScanner;
        } catch (e) {
            console.error("Camera Init Error", e);
            setScanFeedback({ message: "Failed to initialize camera.", type: 'error' });
            setScanMethod('manual');
        }
    }, 100);
  };

  const stopCamera = () => {
      if (scannerRef.current) {
          try {
            scannerRef.current.clear().catch((e: any) => console.warn("Clear error", e));
          } catch(e) {}
      }
      setScanMethod('manual');
  };

  const parseScannedCode = (code: string) => {
      try {
          // Check if it's a URL (e.g. from the QR Code Modal)
          if (code.startsWith('http') || code.includes('view_item=')) {
              const url = new URL(code);
              const viewItem = url.searchParams.get('view_item');
              if (viewItem) return viewItem;
          }
      } catch (e) {
          // not a url, ignore
      }
      return code;
  };

  const handleScan = (code: string) => {
      const parsedCode = parseScannedCode(code);
      // Update the manual input so user sees what was scanned
      setInputVal(parsedCode);

      if (mode === 'search') {
          handleSearch(parsedCode);
      } else {
          handleAuditScan(parsedCode);
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        handleScan(inputVal);
    }
  };

  // --- Search Mode Logic ---

  const handleSearch = (query: string) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    const upperQuery = trimmedQuery.toUpperCase();

    let item: InventoryItem | undefined;
    let box: InventoryBox | undefined | null = null;
    
    // Check if it matches a Box ID first
    for (const inv of items) {
        if (inv.boxes) {
            const match = inv.boxes.find(b => b.id === upperQuery);
            if (match) {
                item = inv;
                box = match;
                break;
            }
        }
    }

    if (!item) {
        // 1. Exact ID match (ShortID or UUID)
        item = items.find(i => i.id === upperQuery || i.shortId === upperQuery);
        
        // 2. Name match (Partial) if no ID match found
        if (!item) {
            // Find best match for name
            item = items.find(i => i.name.toLowerCase().includes(trimmedQuery.toLowerCase()));
        }

        // 3. Sequence match (PREFIX-NUM-SEQ)
        if (!item && upperQuery.includes('-')) {
            const parts = upperQuery.split('-');
            if (parts.length >= 3) {
                const potentialShortId = parts.slice(0, parts.length - 1).join('-');
                item = items.find(i => i.shortId === potentialShortId);
            }
        }
    }

    if (item) {
        setFoundItem(item);
        setFoundBox(box || null);
        setScanFeedback(null); // Clear errors
        
        // If query was just a name, don't set unique ID. If it looked like a specific barcode, set it.
        const isSpecificFormat = /^[A-Z]{3,}-\d{4}-\d{3}$/.test(upperQuery);
        setScannedUniqueId((isSpecificFormat && !box) ? upperQuery : '');
        
        const activeRecs = borrowRecords.filter(r => r.itemId === item!.id && r.status === 'Borrowed');
        setRelatedRecords(activeRecs);
    } else {
        setFoundItem(null);
        setFoundBox(null);
        setRelatedRecords([]);
        setScanFeedback({ message: `Item not found: "${query}"`, type: 'error' });
    }
  };

  const isSpecificUnit = foundItem && scannedUniqueId && scannedUniqueId !== foundItem.shortId && scannedUniqueId !== foundItem.id;
  const specificUnitRecord = isSpecificUnit 
    ? relatedRecords.find(r => r.specificId === scannedUniqueId)
    : undefined;


  // --- Audit Mode Logic ---

  const auditItem = useMemo(() => items.find(i => i.id === auditSelectedItemId), [items, auditSelectedItemId]);

  // Generate Expected IDs
  const auditGrid = useMemo(() => {
      if (!auditItem) return [];
      
      const grid = [];
      for (let i = 1; i <= auditItem.quantity; i++) {
          const seq = String(i).padStart(3, '0');
          const uniqueId = getUnitBarcode(auditItem, i);
          
          // Check Status
          let status: 'missing' | 'present' | 'borrowed' = 'missing';
          
          // Is it borrowed?
          const isBorrowed = borrowRecords.some(r => r.specificId === uniqueId && (r.status === 'Borrowed' || r.status === 'Overdue'));
          
          if (auditScannedIds.has(uniqueId)) {
              status = 'present';
          } else if (isBorrowed) {
              status = 'borrowed';
          }

          grid.push({ uniqueId, status, seq });
      }
      return grid;
  }, [auditItem, auditScannedIds, borrowRecords]);

  const handleAuditScan = (code: string) => {
      const trimmed = code.trim().toUpperCase();
      if (!auditItem) {
          setScanFeedback({ message: 'Select equipment before scanning.', type: 'error' });
          return;
      }

      if (auditGrid.some(unit => unit.uniqueId === trimmed)) {
          setAuditScannedIds(prev => {
              const newSet = new Set(prev);
              newSet.add(trimmed);
              return newSet;
          });
          setScanFeedback({ message: `Verified: ${trimmed}`, type: 'success' });
      } else {
          setScanFeedback({ message: `Invalid unit ID for ${getBarcodeBaseId(auditItem)}.`, type: 'error' });
      }
      setInputVal('');
  };

  const auditStats = useMemo(() => ({
      present: auditGrid.filter(unit => unit.status === 'present').length,
      borrowed: auditGrid.filter(unit => unit.status === 'borrowed').length,
      missing: auditGrid.filter(unit => unit.status === 'missing').length
  }), [auditGrid]);

  const selectAuditItem = (itemId: string) => {
      setAuditSelectedItemId(itemId);
      setAuditScannedIds(new Set());
      setInputVal('');
      setScanFeedback(null);
  };

  const handlePrintReport = () => {
      if (!auditItem) return;
      const reportWindow = window.open('', '', 'height=800,width=900');
      if (!reportWindow) {
          setScanFeedback({ message: 'Allow pop-ups to print the audit report.', type: 'error' });
          return;
      }

      const { document } = reportWindow;
      document.title = `Inventory Audit - ${auditItem.name}`;

      const style = document.createElement('style');
      style.textContent = `
        body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
        h1 { margin: 0 0 4px; font-size: 24px; }
        .meta { color: #4b5563; margin-bottom: 24px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
        .summary div { border: 1px solid #d1d5db; padding: 12px; text-align: center; }
        .summary strong { display: block; font-size: 22px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 7px; text-align: left; }
        th { background: #f3f4f6; }
        @media print { body { margin: 12mm; } }
      `;
      document.head.appendChild(style);

      const title = document.createElement('h1');
      title.textContent = 'Inventory Audit Report';
      document.body.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'meta';
      meta.textContent = `${auditItem.name} (${getBarcodeBaseId(auditItem)}) | ${new Date().toLocaleString()}`;
      document.body.appendChild(meta);

      const summary = document.createElement('div');
      summary.className = 'summary';
      [
          ['Expected', auditGrid.length],
          ['Present', auditStats.present],
          ['On Loan', auditStats.borrowed],
          ['Missing', auditStats.missing]
      ].forEach(([label, value]) => {
          const cell = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = String(value);
          cell.append(strong, String(label));
          summary.appendChild(cell);
      });
      document.body.appendChild(summary);

      const table = document.createElement('table');
      const head = table.createTHead().insertRow();
      ['Sequence', 'Unit ID', 'Status'].forEach(label => {
          const th = document.createElement('th');
          th.textContent = label;
          head.appendChild(th);
      });
      const body = table.createTBody();
      auditGrid.forEach(unit => {
          const row = body.insertRow();
          [unit.seq, unit.uniqueId, unit.status.toUpperCase()].forEach(value => {
              const cell = row.insertCell();
              cell.textContent = value;
          });
      });
      document.body.appendChild(table);
      reportWindow.focus();
      reportWindow.print();
  };

  const CardGlass = "bg-white/70 backdrop-blur-xl border border-white/50 rounded-md shadow-sm";

  return (
    <div className="space-y-6">
      
      {/* Mode Toggle Header */}
      <div className="grid grid-cols-2 gap-2 max-w-md mx-auto mb-4">
        <button
            onClick={() => navigate('/scanner/search')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${mode === 'search' ? 'bg-blue-600 text-white shadow-md' : 'bg-white/50 text-gray-600 hover:bg-white/70'}`}
        >
            <div className="flex items-center space-x-2">
                <Search className="w-4 h-4" />
                <span>Search & Action</span>
            </div>
        </button>
        <button
            onClick={() => navigate('/scanner/audit')}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${mode === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white/50 text-gray-600 hover:bg-white/70'}`}
        >
             <div className="flex items-center space-x-2">
                <ClipboardList className="w-4 h-4" />
                <span>Inventory Audit</span>
            </div>
        </button>
      </div>
      
      {/* Feedback Toast */}
      {scanFeedback && (
          <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-lg font-bold backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300 ${scanFeedback.type === 'success' ? 'bg-green-100/90 text-green-700 border border-green-200' : 'bg-red-100/90 text-red-700 border border-red-200'}`}>
              {scanFeedback.message}
          </div>
      )}

      {mode === 'search' ? (
        // --- SEARCH MODE UI ---
        <div className="space-y-6">
            <div className={`${CardGlass} p-8 flex flex-col items-center justify-center space-y-6`}>
                <div className="bg-blue-100/50 p-4 rounded-full text-blue-600 mb-2">
                    <Scan className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">Scan or Search Equipment</h2>
                
                {scanMethod === 'manual' ? (
                    <div className="w-full max-w-lg">
                        <div className="relative">
                            <div className="relative">
                                <input
                                    id="scanner-input"
                                    type="text"
                                    value={inputVal}
                                    onChange={(e) => setInputVal(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Scan barcode, Box ID, or type item name..."
                                    className="w-full pl-12 pr-4 py-4 text-lg border border-white/60 bg-white/50 rounded-md focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none backdrop-blur-sm shadow-inner transition-all text-gray-900 placeholder-gray-500"
                                    autoComplete="off"
                                />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Search className="text-gray-500 w-6 h-6" />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-center mt-6 space-x-4">
                            <button onClick={() => handleScan(inputVal)} className="px-6 py-2 bg-blue-600 text-white rounded-md shadow-md">Find Item</button>
                            <button onClick={startCamera} className="px-6 py-2 bg-gray-800 text-white rounded-md shadow-md flex items-center gap-2"><Camera className="w-4 h-4"/> Camera</button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-lg flex flex-col items-center">
                        <div id="reader" className="w-full overflow-hidden rounded-md border-2 border-dashed border-gray-300"></div>
                        <button onClick={stopCamera} className="mt-4 px-6 py-2 bg-red-100 text-red-600 rounded-md flex items-center gap-2"><X className="w-4 h-4"/> Cancel</button>
                    </div>
                )}
            </div>

            {/* Search Result Card */}
            {foundItem && (
                 <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className={`${CardGlass} overflow-hidden`}>
                        <div className="bg-white/40 p-6 border-b border-white/40 flex justify-between items-start">
                            <div>
                                <div className="flex items-center space-x-2 mb-2">
                                    <span className="px-2 py-1 bg-white/60 rounded text-xs font-bold text-gray-600 border border-white/40">{foundItem.shortId}</span>
                                    <span className="px-2 py-1 bg-blue-100/50 text-blue-700 rounded text-xs font-medium border border-blue-200/50">{foundItem.category}</span>
                                </div>
                                <h3 className="text-3xl font-bold text-gray-900">{foundItem.name}</h3>
                            </div>
                            <div className="p-3 bg-white/60 rounded-md shadow-sm border border-white/50">
                                <div style={{ color: getCategoryColor(foundItem.category) }}>{getCategoryIcon(foundItem.category)}</div>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-4">
                                <div className="flex items-start space-x-3">
                                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div><p className="text-sm font-medium text-gray-500">Location</p><p className="text-lg text-gray-800">{foundItem.location}</p></div>
                                </div>
                                <div className="flex items-start space-x-3">
                                    <Activity className="w-5 h-5 text-gray-400 mt-0.5" />
                                    <div><p className="text-sm font-medium text-gray-500">Condition</p><p className="text-lg text-gray-800">{foundItem.condition}</p></div>
                                </div>
                            </div>

                            <div className="col-span-1 md:col-span-2 space-y-4">
                                {/* Box Found Logic */}
                                {foundBox && (
                                     <div className={`p-5 rounded-md border ${foundBox.status === 'Sealed' ? 'bg-indigo-50/70 border-indigo-200' : 'bg-gray-50/70 border-gray-200'} backdrop-blur-sm shadow-sm`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className={`text-lg font-bold flex items-center gap-2 ${foundBox.status === 'Sealed' ? 'text-indigo-800' : 'text-gray-800'}`}>
                                                <PackageOpen className="w-5 h-5" /> {foundBox.label} ({foundBox.quantity} items)
                                            </h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${foundBox.status === 'Sealed' ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-200 text-gray-600'}`}>
                                                {foundBox.status}
                                            </span>
                                        </div>
                                        {foundBox.status === 'Sealed' ? (
                                             <div className="space-y-4">
                                                <p className="text-sm text-indigo-700">This box is currently sealed. You can unbox it to track it as opened stock.</p>
                                                <button 
                                                    onClick={() => onUnbox && onUnbox(foundItem, foundBox!.id)} 
                                                    className="w-full py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-bold shadow-md flex justify-center gap-2"
                                                >
                                                    <PackageOpen className="w-5 h-5" /> Confirm Unbox
                                                </button>
                                             </div>
                                        ) : (
                                            <div className="text-gray-500 italic text-sm text-center py-2">
                                                This box has already been unboxed.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!foundBox && isSpecificUnit && (
                                    <div className={`p-5 rounded-md border ${specificUnitRecord ? 'bg-orange-50/70 border-orange-200' : 'bg-green-50/70 border-green-200'} backdrop-blur-sm shadow-sm`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className={`text-lg font-bold flex items-center gap-2 ${specificUnitRecord ? 'text-orange-800' : 'text-green-800'}`}>
                                                <Tag className="w-5 h-5" /> Unit: {scannedUniqueId}
                                            </h4>
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${specificUnitRecord ? 'bg-orange-200 text-orange-800' : 'bg-green-200 text-green-800'}`}>
                                                {specificUnitRecord ? 'Borrowed' : 'Available'}
                                            </span>
                                        </div>
                                        {specificUnitRecord ? (
                                             <div className="space-y-4">
                                                <div className="bg-white/60 p-4 rounded-md border border-orange-100/50">
                                                    <p className="text-xs text-orange-600 uppercase font-bold mb-1">Borrower</p>
                                                    <p className="font-medium text-gray-900">{specificUnitRecord.borrowerName} ({specificUnitRecord.borrowerId})</p>
                                                </div>
                                                <button onClick={() => onReturn(specificUnitRecord.id)} className="w-full py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-bold shadow-md flex justify-center gap-2"><RotateCcw className="w-5 h-5" /> Return Unit</button>
                                             </div>
                                        ) : (
                                            <button onClick={() => onBorrow(foundItem, scannedUniqueId)} className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold shadow-md flex justify-center gap-2"><HandPlatter className="w-5 h-5" /> Borrow Unit</button>
                                        )}
                                    </div>
                                )}

                                {!foundBox && !isSpecificUnit && (
                                    <div className="bg-white/40 rounded-md p-5 border border-white/40">
                                        <p className="text-sm font-medium text-gray-500 mb-2">General Stock</p>
                                        <div className="flex items-end space-x-2"><span className="text-4xl font-bold text-gray-900">{foundItem.quantity - (foundItem.borrowedQuantity || 0)}</span><span className="text-gray-500 mb-1">/ {foundItem.quantity} {foundItem.unit}</span></div>
                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-3"><div className="bg-blue-500 h-2 rounded-full" style={{ width: `${((foundItem.quantity - (foundItem.borrowedQuantity || 0)) / foundItem.quantity) * 100}%` }}></div></div>
                                        <div className="mt-6"><button onClick={() => onBorrow(foundItem)} className="w-full py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold shadow-md flex justify-center gap-2"><HandPlatter className="w-5 h-5" /> Borrow Item</button></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                 </div>
            )}
        </div>
      ) : (
          <div className="space-y-6">
              <div className={`${CardGlass} p-6`}>
                  <label htmlFor="audit-item" className="block text-sm font-bold text-gray-700 mb-2">Equipment to audit</label>
                  <select
                      id="audit-item"
                      value={auditSelectedItemId}
                      onChange={(event) => selectAuditItem(event.target.value)}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                      <option value="">Select equipment</option>
                      {items.map(item => (
                          <option key={item.id} value={item.id}>
                              {item.name} ({getBarcodeBaseId(item)}) - {item.quantity} {item.unit}
                          </option>
                      ))}
                  </select>
              </div>

              {auditItem ? (
                  <>
                      <div className={`${CardGlass} overflow-hidden`}>
                          <div className="p-6 border-b border-gray-200 bg-white/60 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                              <div className="min-w-0">
                                  <p className="text-xs font-bold uppercase text-indigo-600">{getBarcodeBaseId(auditItem)}</p>
                                  <h2 className="text-xl font-bold text-gray-900 truncate">{auditItem.name}</h2>
                                  <p className="text-sm text-gray-500">{auditItem.location}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  <button
                                      type="button"
                                      onClick={() => {
                                          setAuditScannedIds(new Set());
                                          setInputVal('');
                                      }}
                                      className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                      <RotateCcw className="w-4 h-4" /> Reset
                                  </button>
                                  <button
                                      type="button"
                                      onClick={handlePrintReport}
                                      className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-bold hover:bg-indigo-700 flex items-center gap-2"
                                  >
                                      <Printer className="w-4 h-4" /> Print Report
                                  </button>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-gray-200 bg-white">
                              {[
                                  { label: 'Expected', value: auditGrid.length, color: 'text-gray-900' },
                                  { label: 'Present', value: auditStats.present, color: 'text-green-700' },
                                  { label: 'On Loan', value: auditStats.borrowed, color: 'text-blue-700' },
                                  { label: 'Missing', value: auditStats.missing, color: 'text-red-700' }
                              ].map(stat => (
                                  <div key={stat.label} className="p-4 text-center border-r border-b lg:border-b-0 last:border-r-0 border-gray-100">
                                      <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                                      <div className="text-xs font-semibold uppercase text-gray-500 mt-1">{stat.label}</div>
                                  </div>
                              ))}
                          </div>

                          <div className="p-6 bg-gray-50/70">
                              {scanMethod === 'manual' ? (
                                  <div className="max-w-xl mx-auto">
                                      <div className="relative">
                                          <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                          <input
                                              id="scanner-input"
                                              type="text"
                                              value={inputVal}
                                              onChange={(event) => setInputVal(event.target.value)}
                                              onKeyDown={handleKeyDown}
                                              placeholder={`Scan ${getBarcodeBaseId(auditItem)} unit barcode`}
                                              autoComplete="off"
                                              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                          />
                                      </div>
                                      <div className="flex justify-center gap-3 mt-4">
                                          <button type="button" onClick={() => handleScan(inputVal)} className="px-5 py-2 bg-indigo-600 text-white rounded-md font-bold">Verify Unit</button>
                                          <button type="button" onClick={startCamera} className="px-5 py-2 bg-gray-800 text-white rounded-md font-bold flex items-center gap-2"><Camera className="w-4 h-4" /> Camera</button>
                                      </div>
                                  </div>
                              ) : (
                                  <div className="max-w-xl mx-auto flex flex-col items-center">
                                      <div id="reader" className="w-full overflow-hidden rounded-md border border-gray-300 bg-white"></div>
                                      <button type="button" onClick={stopCamera} className="mt-4 px-5 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md font-bold flex items-center gap-2"><X className="w-4 h-4" /> Stop Camera</button>
                                  </div>
                              )}
                          </div>
                      </div>

                      <div className={`${CardGlass} overflow-hidden`}>
                          <div className="px-6 py-4 bg-white/60 border-b border-gray-200 flex items-center justify-between gap-4">
                              <div>
                                  <h3 className="font-bold text-gray-900">Unit Verification</h3>
                                  <p className="text-sm text-gray-500">Scanned units are marked present; active loans are accounted for automatically.</p>
                              </div>
                              <span className="text-sm font-bold text-indigo-700 whitespace-nowrap">{auditStats.present + auditStats.borrowed} / {auditGrid.length}</span>
                          </div>
                          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-[420px] overflow-y-auto bg-white">
                              {auditGrid.map(unit => (
                                  <div
                                      key={unit.uniqueId}
                                      className={`h-20 p-3 rounded-md border flex flex-col justify-between ${
                                          unit.status === 'present'
                                              ? 'bg-green-50 border-green-200 text-green-800'
                                              : unit.status === 'borrowed'
                                                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                                                  : 'bg-red-50 border-red-200 text-red-800'
                                      }`}
                                  >
                                      <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold">#{unit.seq}</span>
                                          {unit.status === 'present' ? <CheckCircle className="w-4 h-4" /> : unit.status === 'borrowed' ? <Box className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                      </div>
                                      <span className="text-[10px] font-mono truncate" title={unit.uniqueId}>{unit.uniqueId}</span>
                                  </div>
                              ))}
                          </div>
                      </div>
                  </>
              ) : (
                  <div className={`${CardGlass} p-12 text-center`}>
                      <ClipboardList className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <h2 className="text-lg font-bold text-gray-800">Select equipment to begin</h2>
                      <p className="text-sm text-gray-500 mt-1">The expected unit list will appear here.</p>
                  </div>
              )}
          </div>
      )}
    </div>
  );
};

export default Scanner;
