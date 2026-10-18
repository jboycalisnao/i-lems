import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { PropertyItem } from '../types';
import { generateNextPISCode, getHighestPISSequence, recordPISSequenceUsed } from '../services/propertyStorageService';
import { LEON_NHS_SEAL_DATA_URI } from '../services/schoolSeal';
import { X, Printer, Sparkles, Layers, Sliders, CheckSquare, Grid, Eye } from 'lucide-react';

interface PISBatchGeneratorModalProps {
  properties?: PropertyItem[];
  onClose: () => void;
}

interface StickerData {
  pisCode: string;
  propertyCode: string;
  department: string;
  propertyName?: string;
  qrUrl: string;
}

export type PISLayoutDensity = '2x5' | '2x6' | '3x5' | '3x6';

export interface LayoutConfig {
  rows: number;
  cols: number;
  stickersPerPage: number;
  rowHeightMm: number;
  colWidthMm: number;
  label: string;
  sublabel: string;
  badge: string;
  isWide: boolean;
  fontSizeScale: number;
}

export const LAYOUT_CONFIGS: Record<PISLayoutDensity, LayoutConfig> = {
  '2x5': {
    rows: 5,
    cols: 2,
    stickersPerPage: 10,
    rowHeightMm: 53.0, // 5 * 53.0 = 265.0mm (total height with 12.7mm top margin is 277.7mm, safely under 297mm A4)
    colWidthMm: 92.30, // 2 * 92.30 = 184.6mm (consumes exactly 100% of 184.6mm printable width with 0.5" margins)
    label: '10 per sheet (2 × 5)',
    sublabel: 'Wide DepEd Size (92.3 × 53 mm)',
    badge: 'Wide / Recommended',
    isWide: true,
    fontSizeScale: 1.12
  },
  '2x6': {
    rows: 6,
    cols: 2,
    stickersPerPage: 12,
    rowHeightMm: 44.0, // 6 * 44.0 = 264.0mm
    colWidthMm: 92.30,
    label: '12 per sheet (2 × 6)',
    sublabel: 'Wide Compact (92.3 × 44 mm)',
    badge: 'Wide 12/Page',
    isWide: true,
    fontSizeScale: 1.02
  },
  '3x5': {
    rows: 5,
    cols: 3,
    stickersPerPage: 15,
    rowHeightMm: 53.0,
    colWidthMm: 61.53,
    label: '15 per sheet (3 × 5)',
    sublabel: '3-Column Standard (61.5 × 53 mm)',
    badge: '15/Page',
    isWide: false,
    fontSizeScale: 1.0
  },
  '3x6': {
    rows: 6,
    cols: 3,
    stickersPerPage: 18,
    rowHeightMm: 44.0,
    colWidthMm: 61.53,
    label: '18 per sheet (3 × 6)',
    sublabel: '3-Column Compact (61.5 × 44 mm)',
    badge: '18/Page',
    isWide: false,
    fontSizeScale: 0.92
  }
};

export const PISBatchGeneratorModal: React.FC<PISBatchGeneratorModalProps> = ({
  properties = [],
  onClose
}) => {
  // Generator options - Default to Wide 2x5 layout as requested for wider stickers & big barcode
  const [layout, setLayout] = useState<PISLayoutDensity>('2x5');
  const activeConfig = LAYOUT_CONFIGS[layout];
  const stickersPerPage = activeConfig.stickersPerPage;

  const [sheetCount, setSheetCount] = useState<number>(1);
  const [department, setDepartment] = useState('SCIENCE DEPARTMENT');
  const [yearPrefix, setYearPrefix] = useState('26');
  const [sequenceOffset, setSequenceOffset] = useState<number>(0);

  // Auto-calculated starting sequence: highest sequence in database & memory + 1 + offset
  const autoStartingSequence = useMemo(() => {
    return getHighestPISSequence(properties, yearPrefix) + 1 + sequenceOffset;
  }, [properties, yearPrefix, sequenceOffset]);

  const [previewStickers, setPreviewStickers] = useState<StickerData[]>([]);

  // Generate blank physical sticker sheets with auto-incrementing barcodes & QR codes
  useEffect(() => {
    const list: StickerData[] = [];
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const totalStickers = Math.max(1, sheetCount) * stickersPerPage;
    let seqNum = autoStartingSequence;

    for (let i = 0; i < totalStickers; i++) {
      const pis = `PIS-${yearPrefix}-${seqNum.toString().padStart(5, '0')}`;
      seqNum++;
      list.push({
        pisCode: pis,
        propertyCode: '', // Blank underline for handwriting upon tagging!
        department: department,
        qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${origin}/?view_pis=${pis}`)}`
      });
    }

    setPreviewStickers(list);
  }, [sheetCount, department, autoStartingSequence, yearPrefix, layout, stickersPerPage]);

  // Official School Seal image: img/Leon NHS - Seal(Black  Outline).png
  const renderSchoolSealSvg = (size = 46) => (
    <img
      src={LEON_NHS_SEAL_DATA_URI}
      alt="Leon NHS Seal"
      style={{ width: `${size}px`, height: `${size}px` }}
      className="object-contain flex-shrink-0"
    />
  );

  // Helper to generate barcode SVG string via hidden element (wider bars & taller barcode)
  const generateBarcodeSvg = (code: string, scale = 1.0, isWide = false): string => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    try {
      JsBarcode(svg, code, {
        format: 'CODE128',
        width: isWide ? 1.85 : 1.45,
        height: Math.round((isWide ? 46 : 38) * scale),
        displayValue: true,
        fontSize: Math.round((isWide ? 11.5 : 10) * scale),
        font: 'monospace',
        textMargin: 2,
        margin: 0,
        background: 'transparent',
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
      alert('Please allow popups to print PIS stickers.');
      return;
    }

    const currentLayout = LAYOUT_CONFIGS[layout];
    const perPage = currentLayout.stickersPerPage;
    const rows = currentLayout.rows;
    const cols = currentLayout.cols;
    const rowHeightMm = currentLayout.rowHeightMm;
    const colWidthMm = currentLayout.colWidthMm;
    const isWide = currentLayout.isWide;

    // Split stickers into pages of exact sheet capacity
    const pages: StickerData[][] = [];
    for (let i = 0; i < previewStickers.length; i += perPage) {
      pages.push(previewStickers.slice(i, i + perPage));
    }

    const sealImgHtml = `
      <img src="${LEON_NHS_SEAL_DATA_URI}" alt="Leon NHS Seal" class="school-seal" />
    `;

    const pagesHtml = pages.map((pageStickers) => `<div class="a4-page"><div class="sticker-grid">${pageStickers.map(st => {
      const barcodeSvg = generateBarcodeSvg(st.pisCode, currentLayout.fontSizeScale, isWide);

      return `<div class="pis-sticker"><div class="watermark-layer"><div class="watermark-inner"><div class="watermark-text">SCHOOL PROPERTY</div><div class="watermark-sub">DO NOT REMOVE!</div></div></div><div class="sticker-content"><div class="sticker-top">${sealImgHtml}<div class="school-info"><div class="school-title">LEON NATIONAL HIGH SCHOOL</div><div class="dept-title">${st.department}</div><div class="pis-label">PROPERTY INVENTORY STICKER (PIS)</div></div></div><div class="sticker-mid"><div class="prop-code-row"><span class="prop-code-lbl">Property Code:</span><span class="prop-code-val ${st.propertyCode ? 'has-code' : 'blank-line'}">${st.propertyCode || '&nbsp;'}</span></div></div><div class="sticker-bot"><div class="qr-col"><img src="${st.qrUrl}" alt="QR" class="qr-img" /></div><div class="barcode-col">${barcodeSvg}</div></div></div></div>`;
    }).join('')}</div></div>`).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PIS Stickers - Leon National High School</title>
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
      padding: 12.7mm 12.7mm 0 12.7mm !important;
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
        padding: 12.7mm 12.7mm 0 12.7mm !important;
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
    .sticker-grid {
      display: grid;
      grid-template-columns: repeat(${cols}, ${colWidthMm}mm);
      grid-template-rows: repeat(${rows}, ${rowHeightMm}mm);
      gap: 0;
      width: 184.6mm;
      height: ${rows * rowHeightMm}mm;
      max-height: ${rows * rowHeightMm}mm;
      border-top: 1px solid #000000;
      border-left: 1px solid #000000;
      box-sizing: border-box;
      margin: 0 auto;
    }
    .pis-sticker {
      background-color: #FFF000 !important;
      border-right: 1px solid #000000;
      border-bottom: 1px solid #000000;
      border-top: none;
      border-left: none;
      border-radius: 0;
      position: relative;
      width: ${colWidthMm}mm;
      height: ${rowHeightMm}mm;
      box-sizing: border-box;
      padding: 0;
      overflow: hidden;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    /* Watermark Under Each Sticker */
    .watermark-layer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
      overflow: hidden;
      user-select: none;
    }
    .watermark-inner {
      transform: rotate(-10deg);
      text-align: center;
      line-height: 1.15;
      opacity: 0.15;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .watermark-text {
      font-size: ${isWide ? '14pt' : '10.5pt'};
      font-weight: 900;
      color: #D60000 !important;
      letter-spacing: 1px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .watermark-sub {
      font-size: ${isWide ? '12.5pt' : '9pt'};
      font-weight: 900;
      color: #D60000 !important;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .sticker-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      width: 100%;
      height: 100%;
    }
    .sticker-top {
      display: flex;
      align-items: center;
      padding: ${isWide ? '1.2mm 2.5mm' : '1mm 1.8mm'};
      border-bottom: 1px solid #000000;
      gap: ${isWide ? '2.2mm' : '1.6mm'};
      background-color: #FFF000 !important;
      height: ${rows === 5 ? '14mm' : '12.5mm'};
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .school-seal {
      width: ${isWide ? '12.5mm' : '11mm'};
      height: ${isWide ? '12.5mm' : '11mm'};
      flex-shrink: 0;
      object-fit: contain;
    }
    .school-info {
      flex: 1;
      min-width: 0;
    }
    .school-title {
      font-size: ${isWide ? '8.5pt' : (rows === 5 ? '7.2pt' : '6.6pt')};
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -0.2px;
      text-transform: uppercase;
    }
    .dept-title {
      font-size: ${isWide ? '7pt' : (rows === 5 ? '5.8pt' : '5.2pt')};
      font-weight: 700;
      line-height: 1.15;
      text-transform: uppercase;
      border-bottom: 0.8px solid #000000;
      padding-bottom: 0.5px;
      margin-bottom: 0.5px;
    }
    .pis-label {
      font-size: ${isWide ? '7.5pt' : (rows === 5 ? '6.4pt' : '5.8pt')};
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: 0.1px;
      text-transform: uppercase;
    }
    /* Middle: Property Code */
    .sticker-mid {
      padding: ${isWide ? '2mm 3mm 1.5mm 3mm' : '1.8mm 2.2mm 1.2mm 2.2mm'};
      border-bottom: 1px solid #000000;
      background: transparent !important;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      flex: 1;
      box-sizing: border-box;
      min-height: 0;
    }
    .prop-code-row {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .prop-code-lbl {
      font-size: ${isWide ? '8.5pt' : '7.5pt'};
      font-weight: 800;
      display: block;
      margin-bottom: 0.8mm;
    }
    .prop-code-val {
      display: flex;
      align-items: flex-end;
      width: 100%;
      font-size: ${isWide ? '11pt' : '9.5pt'};
      font-weight: 900;
      font-family: monospace;
      border-bottom: 1.5px solid #000000;
      min-height: ${rows === 5 ? '6.5mm' : '5.5mm'};
      line-height: 1.2;
      color: #000000;
      padding-bottom: 0.5mm;
    }
    /* Bottom row: QR + Big Barcode (Full Width) */
    .sticker-bot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${isWide ? '1.2mm 2.5mm' : '1mm 1.8mm'};
      background: transparent !important;
      gap: ${isWide ? '2.5mm' : '1.8mm'};
      height: ${rows === 5 ? '17mm' : '15mm'};
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .qr-col {
      flex-shrink: 0;
      width: ${isWide ? '15mm' : '13mm'};
      height: ${isWide ? '15mm' : '13mm'};
      background: #ffffff;
      border: 1px solid #000000;
      padding: 0.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .barcode-col {
      flex: 1;
      min-width: 0;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .barcode-col svg {
      width: 100% !important;
      max-width: 100% !important;
      height: ${rows === 5 ? (isWide ? '15.5mm' : '14mm') : (isWide ? '14mm' : '13mm')} !important;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-md shadow-2xl max-w-5xl w-full overflow-hidden border border-gray-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-yellow-500 text-gray-950 flex justify-between items-center flex-shrink-0 border-b border-yellow-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-black/10 rounded-sm backdrop-blur-md">
              <Grid className="w-5 h-5 text-gray-950" />
            </div>
            <div>
              <h3 className="font-black text-base md:text-lg leading-tight">
                Property Inventory Sticker (PIS) Generator
              </h3>
              <p className="text-xs font-semibold text-gray-800">
                Official DepEd Yellow Sticker Sheet Layout • Maximum A4 Full-Page Consumption (0.5" Margins)
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

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-gray-50/50">
          {/* Controls Bar */}
          <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              {/* Generator Info */}
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-yellow-100 text-yellow-950 border border-yellow-300 rounded-sm text-xs font-black uppercase tracking-wider">
                  Blank Sticker Sheet Generator
                </span>
                <span className="text-xs text-gray-500 hidden sm:inline">
                  Pre-print batches for tagging equipment with writeable Property Code lines
                </span>
              </div>

              {/* Department customizer */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500 uppercase">Department:</span>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value.toUpperCase())}
                  className="px-3 py-1 text-xs border border-gray-300 rounded-md font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none w-48"
                  placeholder="e.g. SCIENCE DEPARTMENT"
                />
              </div>
            </div>


            {/* Sticker Width & Sheet Layout Selector */}
            <div className="border-b border-gray-100 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-gray-800 uppercase tracking-wider block">
                    Sticker Width & Sheet Capacity:
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Warning text is placed as a security watermark under each sticker, giving maximum width to the barcode.
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(Object.keys(LAYOUT_CONFIGS) as PISLayoutDensity[]).map((key) => {
                    const cfg = LAYOUT_CONFIGS[key];
                    const isSelected = layout === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLayout(key)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-sm border transition-all flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-yellow-400 border-black text-gray-950 shadow-sm font-black'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span>{cfg.label}</span>
                        <span
                          className={`text-[9.5px] px-1.5 py-0.5 rounded-sm font-semibold ${
                            isSelected ? 'bg-black text-yellow-300' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {cfg.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

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
                    className="w-16 px-2.5 py-1.5 border border-gray-300 rounded-r-md font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                    className="w-20 px-3 py-1.5 border border-gray-300 rounded-md font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <span className="text-gray-500 font-semibold">= {sheetCount * stickersPerPage} stickers</span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Sample Sticker (with Security Watermark and Huge Barcode) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-600" />
                Live Single Sticker Preview ({activeConfig.label})
              </h4>
              <span className="text-xs font-semibold text-gray-500">
                Total stickers queued: <strong>{previewStickers.length}</strong> ({totalPages} A4 page{totalPages > 1 ? 's' : ''})
              </span>
            </div>

            {previewStickers.length > 0 && (
              <div className="max-w-2xl mx-auto bg-amber-50/70 p-4 rounded-md border border-amber-200 flex justify-center">
                {/* Authentic PIS Sticker Container with Security Watermark */}
                <div
                  className={`border border-black rounded-sm bg-[#FFF000] text-black shadow-lg overflow-hidden relative flex flex-col justify-between transition-all ${
                    activeConfig.isWide ? 'w-[480px] max-w-full' : 'w-[360px]'
                  }`}
                  style={{ minHeight: `${activeConfig.rows === 5 ? 200 : 175}px` }}
                >
                  {/* Background Security Watermark */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
                    <div className="transform -rotate-10 text-center opacity-15 leading-tight">
                      <div className={`font-black text-red-600 tracking-wider uppercase ${activeConfig.isWide ? 'text-2xl' : 'text-lg'}`}>
                        SCHOOL PROPERTY
                      </div>
                      <div className={`font-black text-red-600 tracking-widest uppercase ${activeConfig.isWide ? 'text-xl' : 'text-base'}`}>
                        DO NOT REMOVE!
                      </div>
                    </div>
                  </div>

                  {/* Sticker Content (z-10) */}
                  <div className="relative z-10 flex flex-col justify-between h-full">
                    {/* Top section */}
                    <div className="p-2.5 flex items-center gap-2.5 border-b border-black bg-[#FFF000]">
                      {renderSchoolSealSvg(activeConfig.isWide ? 46 : 40)}
                      <div className="flex-1 min-w-0">
                        <div className={`font-black tracking-tight leading-tight uppercase ${activeConfig.isWide ? 'text-[13.5px]' : 'text-[12px]'}`}>
                          LEON NATIONAL HIGH SCHOOL
                        </div>
                        <div className={`font-bold tracking-tight leading-snug uppercase border-b border-black pb-0.5 ${activeConfig.isWide ? 'text-[11px]' : 'text-[10px]'}`}>
                          {department}
                        </div>
                        <div className={`font-black tracking-tight leading-tight uppercase mt-0.5 ${activeConfig.isWide ? 'text-[11.5px]' : 'text-[10.5px]'}`}>
                          PROPERTY INVENTORY STICKER (PIS)
                        </div>
                      </div>
                    </div>

                    {/* Middle section: Property Code */}
                    <div className="px-3.5 py-2.5 border-b border-black bg-transparent flex-1 flex flex-col justify-between">
                      <div className={`font-black ${activeConfig.isWide ? 'text-sm' : 'text-xs'}`}>Property Code:</div>
                      <div className={`font-mono font-black border-b border-black flex items-center pt-1 ${activeConfig.isWide ? 'text-base min-h-[26px]' : 'text-sm min-h-[22px]'}`}>
                        {previewStickers[0].propertyCode || <span className="text-gray-400 font-normal italic text-[11px]">(Will be written/encoded upon tagging)</span>}
                      </div>
                    </div>

                    {/* Bottom section: QR + Big Barcode (Full Width!) */}
                    <div className="p-2.5 flex items-center justify-between gap-3 bg-transparent">
                      <div className={`bg-white border border-black p-0.5 flex-shrink-0 flex items-center justify-center ${activeConfig.isWide ? 'w-14 h-14' : 'w-12 h-12'}`}>
                        <img
                          src={previewStickers[0].qrUrl}
                          alt="QR Code"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 text-center min-w-0 flex justify-center items-center">
                        <div
                          className="w-full flex justify-center"
                          dangerouslySetInnerHTML={{ __html: generateBarcodeSvg(previewStickers[0].pisCode, activeConfig.fontSizeScale, activeConfig.isWide) }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>


        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-600">
            Layout: <strong>{activeConfig.label} ({activeConfig.sublabel})</strong> • Total: <strong>{totalPages} Page{totalPages > 1 ? 's' : ''}</strong>
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
              <span>Print {previewStickers.length} Stickers ({totalPages} A4 Sheet{totalPages > 1 ? 's' : ''})</span>
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

export default PISBatchGeneratorModal;
