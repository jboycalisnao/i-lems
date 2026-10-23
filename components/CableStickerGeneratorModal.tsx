import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { PropertyItem } from '../types';
import { getHighestPISSequence, recordPISSequenceUsed } from '../services/propertyStorageService';
import { LEON_NHS_SEAL_DATA_URI } from '../services/schoolSeal';
import { X, Printer, Cable, Eye, RotateCw } from 'lucide-react';

interface CableStickerGeneratorModalProps {
  properties?: PropertyItem[];
  onClose: () => void;
  defaultPropertyCode?: string;
}

interface CableStickerData {
  pisCode: string;
  propertyCode: string;
  department: string;
}

export const CableStickerGeneratorModal: React.FC<CableStickerGeneratorModalProps> = ({
  properties = [],
  onClose,
  defaultPropertyCode = ''
}) => {
  // Exact layout from user reference: 22 stickers per A4 page (11 columns × 2 standing stickers)
  const stickersPerPage = 22;
  const cols = 11;
  const rows = 2;

  const [sheetCount, setSheetCount] = useState<number>(1);
  const [yearPrefix, setYearPrefix] = useState('26');
  const [sequenceOffset, setSequenceOffset] = useState<number>(0);
  const [tagMode, setTagMode] = useState<'blank' | 'specific'>(defaultPropertyCode ? 'specific' : 'blank');
  const [selectedPropertyCode, setSelectedPropertyCode] = useState(defaultPropertyCode);
  const [isFoldPreview, setIsFoldPreview] = useState(false);

  // Auto-calculated starting sequence: highest sequence in database & memory + 1 + offset
  const autoStartingSequence = useMemo(() => {
    return getHighestPISSequence(properties, yearPrefix) + 1 + sequenceOffset;
  }, [properties, yearPrefix, sequenceOffset]);

  const [previewStickers, setPreviewStickers] = useState<CableStickerData[]>([]);

  // Generate queue of cable stickers for the sheets
  useEffect(() => {
    const list: CableStickerData[] = [];
    const totalStickers = Math.max(1, sheetCount) * stickersPerPage;
    let seqNum = autoStartingSequence;

    for (let i = 0; i < totalStickers; i++) {
      const pis = `PIS-${yearPrefix}-${seqNum.toString().padStart(5, '0')}`;
      seqNum++;
      list.push({
        pisCode: pis,
        propertyCode: tagMode === 'specific' ? selectedPropertyCode : '',
        department: 'LEON NATIONAL HIGH SCHOOL'
      });
    }

    setPreviewStickers(list);
  }, [sheetCount, autoStartingSequence, yearPrefix, tagMode, selectedPropertyCode]);

  // Generate clean Code128 barcode SVG string
  const generateBarcodeSvg = (code: string): string => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, code, {
        format: 'CODE128',
        width: 1.05,
        height: 22,
        displayValue: true,
        fontSize: 9,
        font: 'monospace',
        textMargin: 1,
        margin: 0,
        background: '#ffffff',
        lineColor: '#000000'
      });
      return svg.outerHTML;
    } catch {
      return '';
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=950,height=900');
    if (!printWindow) {
      alert('Please allow popups to print cable peripheral stickers.');
      return;
    }

    // Split stickers into pages of exact sheet capacity (22 stickers per A4 page)
    const pages: CableStickerData[][] = [];
    for (let i = 0; i < previewStickers.length; i += stickersPerPage) {
      pages.push(previewStickers.slice(i, i + stickersPerPage));
    }

    const sealImgHtml = `
      <img src="${LEON_NHS_SEAL_DATA_URI}" alt="Leon NHS Seal" class="cable-seal-img" />
    `;

    const pagesHtml = pages.map((pageStickers) => `
      <div class="a4-page">
        <div class="standing-sheet-grid">
          ${pageStickers.map(st => {
            const barcodeSvg = generateBarcodeSvg(st.pisCode);
            return `
              <div class="standing-cell">
                <div class="barbell-tag">
                  <!-- Left Flag (Becomes Bottom when rotated -90deg): Warning & Barcode -->
                  <div class="flag-part flag-left">
                    <div class="warning-text-col">
                      <span class="warning-l1">School Property</span>
                      <span class="warning-l2">DO NOT REMOVE!</span>
                    </div>
                    <div class="barcode-box">
                      ${barcodeSvg}
                    </div>
                  </div>

                  <!-- Middle Neck / Wrap Bridge -->
                  <div class="neck-part"></div>

                  <!-- Right Flag (Becomes Top when rotated -90deg): Seal & Property Code -->
                  <div class="flag-part flag-right">
                    <div class="seal-container">
                      ${sealImgHtml}
                    </div>
                    <div class="prop-code-col">
                      <div class="prop-code-title">Property Code:</div>
                      <div class="prop-code-line ${st.propertyCode ? 'has-code' : 'blank-line'}">
                        ${st.propertyCode ? `<span class="code-val">${st.propertyCode}</span>` : '&nbsp;'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Cable Peripheral Stickers (PIS) - Leon National High School</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: Arial, Helvetica, sans-serif;
      width: 210mm !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: visible !important;
    }
    .a4-page {
      width: 210mm !important;
      max-width: 210mm !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      padding: 13.0mm 12.85mm 0 12.85mm !important;
      margin: 0 auto !important;
      background: #ffffff !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      position: relative !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .a4-page + .a4-page {
      page-break-before: always !important;
      break-before: page !important;
    }
    .a4-page:last-child {
      page-break-after: avoid !important;
      break-after: avoid !important;
      margin-bottom: 0 !important;
    }
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        width: 210mm !important;
        height: auto !important;
        min-height: 0 !important;
        overflow: visible !important;
      }
      .a4-page {
        width: 210mm !important;
        max-width: 210mm !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        padding: 13.0mm 12.85mm 0 12.85mm !important;
        margin: 0 !important;
        background: #ffffff !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      .a4-page + .a4-page {
        page-break-before: always !important;
        break-before: page !important;
      }
      .a4-page:last-child {
        page-break-after: avoid !important;
        break-after: avoid !important;
        margin-bottom: 0 !important;
      }
    }

    /* 11 Columns × 2 Rows with ZERO spaces in between stickers */
    .standing-sheet-grid {
      display: grid;
      width: 184.25mm;
      height: 271.0mm;
      grid-template-columns: repeat(11, 16.75mm);
      grid-template-rows: repeat(2, 135.5mm);
      gap: 0 !important;
      margin: 0 auto;
      box-sizing: border-box;
      outline: 0.5px solid #000000;
    }

    .standing-cell {
      width: 16.75mm;
      height: 135.5mm;
      position: relative;
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: visible;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Rotated Barbell Tag: 135.5mm long × 16.75mm tall rotated -90deg */
    .barbell-tag {
      width: 135.5mm;
      height: 16.75mm;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-90deg);
      transform-origin: center center;
      display: flex;
      align-items: center;
      box-sizing: border-box;
    }

    /* Left & Right Flag Sections */
    .flag-part {
      width: 56.0mm;
      height: 16.75mm;
      background-color: #FFF000 !important;
      border: 1.1px solid #000000;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      position: relative;
      z-index: 1;
      padding: 1mm 1.5mm;
    }

    /* Left Flag: Warning Text + Barcode Box */
    .flag-left {
      justify-content: space-between;
      gap: 1.5mm;
    }
    .warning-text-col {
      display: flex;
      flex-direction: column;
      justify-content: center;
      flex-shrink: 0;
      line-height: 1.05;
      padding-left: 0.5mm;
    }
    .warning-l1 {
      font-size: 5.6pt;
      font-weight: 800;
      color: #D60000 !important;
      letter-spacing: -0.2px;
      white-space: nowrap;
    }
    .warning-l2 {
      font-size: 6.2pt;
      font-weight: 900;
      color: #D60000 !important;
      letter-spacing: -0.2px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .barcode-box {
      width: 29.5mm;
      height: 14.5mm;
      background: #ffffff !important;
      border: 0.8px solid #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.4mm;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .barcode-box svg {
      width: 100% !important;
      height: 100% !important;
      max-height: 100% !important;
      display: block;
    }

    /* Middle Neck / Wrap Bridge */
    .neck-part {
      width: 23.5mm;
      height: 8.5mm;
      background-color: #FFF000 !important;
      border-top: 1.1px solid #000000;
      border-bottom: 1.1px solid #000000;
      border-left: none;
      border-right: none;
      margin-left: -1.1px;
      margin-right: -1.1px;
      box-sizing: border-box;
      z-index: 2;
      flex-shrink: 0;
    }

    /* Right Flag: Seal + Property Code */
    .flag-right {
      gap: 1.8mm;
    }
    .seal-container {
      width: 13.5mm;
      height: 13.5mm;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .cable-seal-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .prop-code-col {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 100%;
      padding-right: 0.8mm;
    }
    .prop-code-title {
      font-size: 6.5pt;
      font-weight: 900;
      color: #000000 !important;
      line-height: 1.1;
      margin-bottom: 0.8mm;
      white-space: nowrap;
    }
    .prop-code-line {
      width: 100%;
      border-bottom: 1.1px solid #000000;
      min-height: 4.8mm;
      display: flex;
      align-items: flex-end;
      padding-bottom: 0.3mm;
    }
    .code-val {
      font-family: monospace;
      font-size: 6.5pt;
      font-weight: 900;
      color: #000000 !important;
      letter-spacing: -0.2px;
      white-space: nowrap;
    }
  </style>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 400);
    };
  </script>
</head>
<body>${pagesHtml}</body>
</html>`);
    printWindow.document.close();

    // Auto-record the highest sequence number used across this printed batch to prevent reuse
    let maxBatchSeq = 0;
    previewStickers.forEach(st => {
      const parts = st.pisCode.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[2], 10);
        if (!isNaN(num) && num > maxBatchSeq) maxBatchSeq = num;
      }
    });
    if (maxBatchSeq > 0) {
      recordPISSequenceUsed(maxBatchSeq, yearPrefix);
      setSequenceOffset(prev => prev + previewStickers.length);
    }
  };

  const totalPages = Math.ceil(previewStickers.length / stickersPerPage);

  const modalContent = (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-md shadow-2xl max-w-5xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[92vh]">
        {/* Header - Solid Yellow Header (No gradients) */}
        <div className="px-6 py-4 bg-yellow-500 text-gray-950 flex justify-between items-center flex-shrink-0 border-b border-yellow-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-black/10 rounded-sm backdrop-blur-md">
              <Cable className="w-5 h-5 text-gray-950" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg leading-tight">
                Vertical Standing Cable Peripheral Sticker Generator (PIS)
              </h3>
              <p className="text-xs font-semibold text-gray-800">
                11 Columns × 2 Standing Stickers (22 Tags / A4 Sheet) • Zero Spaces In Between Stickers
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50/50">
          {/* Controls Panel */}
          <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm space-y-4">
            {/* Row 1: Mode & Target Property Code */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-yellow-100 text-yellow-950 border border-yellow-300 rounded-sm text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Cable className="w-3.5 h-3.5 text-yellow-900" />
                  22 Standing Tags per A4 Sheet
                </span>
                <span className="text-xs text-gray-500 hidden sm:inline">
                  11 columns side-by-side with 2 standing stickers per column and zero spaces in between
                </span>
              </div>

              {/* Tag Mode Selector */}
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-sm border border-gray-200 text-xs">
                <button
                  type="button"
                  onClick={() => setTagMode('blank')}
                  className={`px-3 py-1 font-bold rounded-sm transition-all ${
                    tagMode === 'blank'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Pre-Print Blank Underline
                </button>
                <button
                  type="button"
                  onClick={() => setTagMode('specific')}
                  className={`px-3 py-1 font-bold rounded-sm transition-all ${
                    tagMode === 'specific'
                      ? 'bg-white text-gray-900 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Specific Property Code
                </button>
              </div>
            </div>

            {/* Optional Specific Property Selection */}
            {tagMode === 'specific' && (
              <div className="p-3 bg-amber-50/80 rounded-sm border border-amber-200 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
                <span className="font-bold text-amber-950 uppercase tracking-wider">
                  Target Equipment:
                </span>
                <div className="flex-1 min-w-[240px]">
                  <select
                    value={selectedPropertyCode}
                    onChange={(e) => setSelectedPropertyCode(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-gray-300 rounded-sm font-mono text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="">-- Enter / Select Property Code --</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.propertyNumber}>
                        {p.propertyNumber} — {p.name} ({p.category})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 font-semibold">Or Custom:</span>
                  <input
                    type="text"
                    value={selectedPropertyCode}
                    onChange={(e) => setSelectedPropertyCode(e.target.value.toUpperCase())}
                    placeholder="e.g. LNHS-ICT-2024-001"
                    className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-sm font-mono text-xs font-bold text-gray-800 w-44 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>
            )}

            {/* Sequence & Sheet count controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Year Prefix</label>
                <div className="flex items-center">
                  <span className="px-2.5 py-1.5 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md font-mono font-bold text-gray-600">
                    PIS-
                  </span>
                  <input
                    type="text"
                    value={yearPrefix}
                    onChange={(e) => setYearPrefix(e.target.value)}
                    maxLength={2}
                    className="w-16 px-2.5 py-1.5 border border-gray-300 rounded-r-md font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-gray-700">Starting Sequence Number</label>
                  <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-sm border border-emerald-300 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Auto-Generated
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={autoStartingSequence.toString().padStart(5, '0')}
                    className="w-full px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-md font-mono font-bold text-gray-800 cursor-not-allowed select-all focus:outline-none"
                  />
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">
                    Unique
                  </div>
                </div>
                <span className="text-[10.5px] text-gray-500 mt-1 block">
                  Guaranteed unique. Automatically increments to prevent duplicates.
                </span>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">A4 Sheets to Print</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={sheetCount}
                    onChange={(e) => setSheetCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-md font-bold text-center focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                  <span className="text-gray-500 font-semibold">= {sheetCount * stickersPerPage} standing tags (22/sheet)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Cable Tag Preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-600" />
                Live Preview (11 Columns × 2 Standing Stickers)
              </h4>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsFoldPreview(!isFoldPreview)}
                  className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-sm border border-blue-200 transition-colors flex items-center gap-1"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>{isFoldPreview ? 'Show Sheet View' : 'Show Folded Cable Wrap'}</span>
                </button>
                <span className="text-xs font-semibold text-gray-500">
                  Total stickers queued: <strong>{previewStickers.length}</strong> ({totalPages} A4 page{totalPages > 1 ? 's' : ''})
                </span>
              </div>
            </div>

            {previewStickers.length > 0 && (
              <div className="bg-amber-50/70 p-5 rounded-md border border-amber-200 flex flex-col items-center justify-center min-h-[380px]">
                {!isFoldPreview ? (
                  /* Full A4 Sheet Zero-Gap Layout Preview Matching Screenshot */
                  <div className="flex flex-col items-center max-w-full">
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                      <span>11 Columns Across</span>
                      <span>•</span>
                      <span className="text-amber-800">2 Standing Stickers per Column</span>
                      <span>•</span>
                      <span>Zero Space in Between</span>
                    </div>

                    {/* Miniature A4 Sheet Representation */}
                    <div className="bg-white border-2 border-black p-1 shadow-xl rounded-none overflow-x-auto max-w-full">
                      <div className="grid grid-cols-11 gap-0 border border-black bg-white" style={{ width: '640px', height: '350px' }}>
                        {Array.from({ length: 22 }).map((_, idx) => {
                          const st = previewStickers[idx % previewStickers.length];
                          const isTopRow = idx < 11;
                          return (
                            <div
                              key={idx}
                              className={`border-r border-black relative overflow-hidden bg-[#FFF000] flex flex-col justify-between p-1 ${
                                isTopRow ? 'border-b border-black' : ''
                              }`}
                            >
                              {/* Top Part: Seal & Property Code */}
                              <div className="flex flex-col items-center pt-0.5">
                                <span className="text-[6.5px] font-black text-black leading-tight text-center">
                                  Property Code:
                                </span>
                                <div className="w-full border-b border-black my-0.5 min-h-[6px] flex items-end justify-center">
                                  <span className="font-mono text-[6px] font-bold text-black truncate">
                                    {st?.propertyCode || ''}
                                  </span>
                                </div>
                                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                                  <img
                                    src={LEON_NHS_SEAL_DATA_URI}
                                    alt="Seal"
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                              </div>

                              {/* Middle Narrow Neck */}
                              <div className="w-2.5 h-4 bg-[#FFF000] border-l border-r border-black mx-auto my-0.5 flex-shrink-0"></div>

                              {/* Bottom Part: Red Warning & Barcode */}
                              <div className="flex flex-col items-center pb-0.5">
                                <div className="w-full bg-white border border-black p-0.5 flex flex-col items-center justify-center">
                                  <div className="w-full h-3 bg-black/10 flex items-center justify-center text-[5.5px] font-mono font-bold">
                                    ||||||||||||
                                  </div>
                                  <span className="text-[5px] font-mono font-black text-black">
                                    {st?.pisCode || 'PIS-26-XXXXX'}
                                  </span>
                                </div>
                                <div className="text-center leading-none mt-0.5">
                                  <span className="text-[5.5px] font-black text-red-600 block">
                                    School Property
                                  </span>
                                  <span className="text-[5.5px] font-black text-red-600 block uppercase">
                                    DO NOT REMOVE!
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-500 font-medium text-center mt-3">
                      Prints <strong>22 standing stickers per sheet</strong> (11 columns × 2 rows) with zero space in between stickers, exactly matching your sheet layout.
                    </p>
                  </div>
                ) : (
                  /* Folded Cable Wrap 3D Simulation */
                  <div className="flex flex-col items-center animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                      Cable Wrap Simulation (Folded Around Wire)
                    </div>

                    <div className="relative flex items-center justify-center p-6 bg-slate-900/5 rounded-md border border-gray-200">
                      {/* Simulated Wire */}
                      <div className="absolute top-0 bottom-0 w-6 bg-gradient-to-r from-gray-700 via-gray-900 to-gray-700 rounded-full shadow-inner z-0"></div>

                      {/* Folded Tag */}
                      <div className="relative z-10 flex items-center pl-4">
                        {/* Loop around wire */}
                        <div className="w-8 h-12 bg-[#FFF000] border-t-[1.5px] border-b-[1.5px] border-l-[1.5px] border-black rounded-l-md -mr-1 flex-shrink-0"></div>

                        {/* Back-to-back flags */}
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 w-16">Side 1:</span>
                            <div className="w-60 h-14 bg-[#FFF000] border-[1.5px] border-black p-1.5 flex items-center justify-between shadow-sm">
                              <div className="leading-tight">
                                <div className="text-[8.5px] font-black text-red-600">School Property</div>
                                <div className="text-[9px] font-black text-red-600 uppercase">DO NOT REMOVE!</div>
                              </div>
                              <div className="bg-white border border-black p-0.5 h-full flex items-center justify-center w-32">
                                <div
                                  className="w-full h-full flex items-center justify-center"
                                  dangerouslySetInnerHTML={{
                                    __html: generateBarcodeSvg(previewStickers[0].pisCode)
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 w-16">Side 2:</span>
                            <div className="w-60 h-14 bg-[#FFF000] border-[1.5px] border-black p-1.5 flex items-center gap-2.5 shadow-sm">
                              <img
                                src={LEON_NHS_SEAL_DATA_URI}
                                alt="Leon NHS Seal"
                                className="w-9 h-9 object-contain"
                              />
                              <div className="flex-1">
                                <div className="text-[9px] font-black text-black">Property Code:</div>
                                <div className="border-b-[1.5px] border-black text-xs font-mono font-black">
                                  {previewStickers[0].propertyCode || '________________________'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-500 mt-2">
                      When wrapped around any cable cord, it creates a dual-sided identification flag.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-600">
            Layout: <strong>11 Columns × 2 Rows (22 Tags / Sheet, Zero Gaps)</strong> • Total: <strong>{totalPages} Page{totalPages > 1 ? 's' : ''}</strong>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-sm text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={previewStickers.length === 0}
              className={`px-6 py-2.5 font-black rounded-sm text-xs md:text-sm shadow-md transition-all flex items-center space-x-2 border ${
                previewStickers.length === 0
                  ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed shadow-none'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-gray-950 border-yellow-600 hover:shadow'
              }`}
            >
              <Printer className="w-4 h-4 text-black" />
              <span>Print {previewStickers.length} Tags ({totalPages} A4 Sheet{totalPages > 1 ? 's' : ''})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default CableStickerGeneratorModal;
