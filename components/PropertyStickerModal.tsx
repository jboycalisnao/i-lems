import React, { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import { PropertyItem } from '../types';
import { LEON_NHS_SEAL_DATA_URI } from '../services/schoolSeal';
import { X, Printer, Tag, ShieldCheck, Copy, Check, Grid, Cable } from 'lucide-react';

interface PropertyStickerModalProps {
  item: PropertyItem;
  onClose: () => void;
  onOpenBatchSheet?: () => void;
  onOpenCableTag?: () => void;
}

export const PropertyStickerModal: React.FC<PropertyStickerModalProps> = ({ item, onClose, onOpenBatchSheet, onOpenCableTag }) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const [copies, setCopies] = useState<number>(item.quantity > 1 ? Math.min(item.quantity, 12) : 1);
  const [copied, setCopied] = useState(false);
  const [department, setDepartment] = useState('SCIENCE DEPARTMENT');

  const pisCode = item.pisCode || `PIS-26-${item.propertyNumber.replace(/[^0-9]/g, '').slice(-5).padStart(5, '0')}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${origin}/?view_pis=${pisCode}`)}`;

  useEffect(() => {
    if (barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, pisCode, {
          format: 'CODE128',
          width: 1.85,
          height: 48,
          displayValue: true,
          fontSize: 12,
          font: 'monospace',
          textMargin: 2,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000'
        });
      } catch (err) {
        console.error('Failed to generate sticker barcode', err);
      }
    }
  }, [pisCode]);

  // Official Leon NHS Seal image: img/Leon NHS - Seal(Black  Outline).png
  const renderSchoolSealSvg = (size = 46) => (
    <img
      src={LEON_NHS_SEAL_DATA_URI}
      alt="Leon NHS Seal"
      style={{ width: `${size}px`, height: `${size}px` }}
      className="object-contain flex-shrink-0"
    />
  );

  const handlePrint = () => {
    const printWindow = window.open('', '', 'width=800,height=850');
    if (!printWindow) return;

    const barcodeSvgHtml = barcodeRef.current?.outerHTML || '';
    const sealImgHtml = `
      <img src="${LEON_NHS_SEAL_DATA_URI}" alt="Leon NHS Seal" class="school-seal" />
    `;

    const stickersHtml = Array.from({ length: copies }).map((_, idx) => `
      <div class="pis-sticker">
        <!-- Security Watermark under each sticker -->
        <div class="watermark-layer">
          <div class="watermark-inner">
            <div class="watermark-text">SCHOOL PROPERTY</div>
            <div class="watermark-sub">DO NOT REMOVE!</div>
          </div>
        </div>

        <div class="sticker-content">
          <div class="sticker-top">
            ${sealImgHtml}
            <div class="school-info">
              <div class="school-title">LEON NATIONAL HIGH SCHOOL</div>
              <div class="dept-title">${department}</div>
              <div class="pis-label">PROPERTY INVENTORY STICKER (PIS)</div>
            </div>
          </div>

          <div class="sticker-mid">
            <div class="prop-code-row">
              <span class="prop-code-lbl">Property Code:</span>
              <span class="prop-code-val">${item.propertyNumber}</span>
            </div>
          </div>

          <!-- Bottom Section: QR + Big Barcode (Full Width) -->
          <div class="sticker-bot">
            <div class="qr-col">
              <img src="${qrUrl}" alt="QR" class="qr-img" />
            </div>
            <div class="barcode-col">
              ${barcodeSvgHtml}
            </div>
          </div>
        </div>
      </div>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PIS Sticker - ${pisCode}</title>
  <style>
    @page {
      size: auto;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      height: auto !important;
      min-height: 0 !important;
    }
    .stickers-wrapper {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      justify-content: flex-start;
      padding: 10px;
      page-break-after: avoid !important;
      break-after: avoid !important;
    }
    .pis-sticker {
      width: 360px;
      height: 195px;
      background-color: #FFF000 !important;
      border: 2px solid #000000;
      border-radius: 4px;
      position: relative;
      overflow: hidden;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: auto;
      break-after: auto;
      margin-bottom: 12px;
    }
    .watermark-layer {
      position: absolute;
      inset: 0;
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
      font-size: 16pt;
      font-weight: 900;
      color: #D60000 !important;
      letter-spacing: 1px;
      text-transform: uppercase;
      white-space: nowrap;
    }
    .watermark-sub {
      font-size: 13.5pt;
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
      height: 100%;
    }
    .sticker-top {
      display: flex;
      align-items: center;
      padding: 8px 12px 6px 12px;
      border-bottom: 2px solid #000000;
      gap: 10px;
      background-color: #FFF000 !important;
    }
    .school-seal {
      width: 46px;
      height: 46px;
      flex-shrink: 0;
      object-fit: contain;
    }
    .school-info {
      flex: 1;
      min-width: 0;
    }
    .school-title {
      font-size: 12px;
      font-weight: 900;
      line-height: 1.1;
      text-transform: uppercase;
    }
    .dept-title {
      font-size: 9.5px;
      font-weight: 700;
      line-height: 1.2;
      text-transform: uppercase;
      border-bottom: 1px solid #000000;
      padding-bottom: 2px;
      margin-bottom: 2px;
    }
    .pis-label {
      font-size: 10.5px;
      font-weight: 900;
      line-height: 1.15;
      text-transform: uppercase;
    }
    .sticker-mid {
      padding: 8px 12px;
      border-bottom: 2px solid #000000;
      background: transparent !important;
      min-height: 48px;
      display: flex;
      align-items: center;
    }
    .prop-code-row {
      width: 100%;
    }
    .prop-code-lbl {
      font-size: 11.5px;
      font-weight: 800;
      display: block;
      margin-bottom: 2px;
    }
    .prop-code-val {
      display: block;
      width: 100%;
      font-size: 14px;
      font-weight: 900;
      font-family: monospace;
      border-bottom: 2px solid #000000;
      padding-bottom: 2px;
      color: #000000;
    }
    /* Bottom section: QR + Big Barcode (Full Width) */
    .sticker-bot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px 10px 12px;
      background: transparent !important;
      gap: 10px;
    }
    .qr-col {
      width: 48px;
      height: 48px;
      background: #ffffff;
      border: 1px solid #000000;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .barcode-col {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      min-width: 0;
    }
    .barcode-col svg {
      width: 100% !important;
      max-width: 100% !important;
      height: 50px !important;
    }
  </style>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</head>
<body><div class="stickers-wrapper">${stickersHtml}</div></body>
</html>`);
    printWindow.document.close();
  };

  const copyPISCode = () => {
    navigator.clipboard.writeText(pisCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-md shadow-2xl max-w-lg w-full overflow-hidden border border-gray-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-yellow-500 text-gray-950 flex justify-between items-center flex-shrink-0 border-b border-yellow-600">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-black/10 rounded-sm backdrop-blur-md">
              <Tag className="w-5 h-5 text-gray-950" />
            </div>
            <div>
              <h3 className="font-black text-base leading-tight">Property Inventory Sticker (PIS)</h3>
              <p className="text-xs font-semibold text-gray-800">{item.name}</p>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Authentic PIS Yellow Sticker Preview with Security Watermark */}
          <div className="border-2 border-black rounded-md bg-[#FFF000] text-black shadow-lg overflow-hidden relative flex flex-col justify-between" style={{ minHeight: '205px' }}>
            {/* Background Security Watermark */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
              <div className="transform -rotate-10 text-center opacity-15 leading-tight">
                <div className="font-black text-red-600 tracking-wider uppercase text-2xl">
                  SCHOOL PROPERTY
                </div>
                <div className="font-black text-red-600 tracking-widest uppercase text-xl">
                  DO NOT REMOVE!
                </div>
              </div>
            </div>

            {/* Sticker Content (z-10) */}
            <div className="relative z-10 flex flex-col justify-between h-full">
              {/* Top section */}
              <div className="p-3 flex items-center gap-2.5 border-b-2 border-black bg-[#FFF000]">
                {renderSchoolSealSvg(46)}
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black tracking-tight leading-tight uppercase">
                    LEON NATIONAL HIGH SCHOOL
                  </div>
                  <div className="text-[10px] font-bold tracking-tight leading-snug uppercase border-b border-black pb-0.5">
                    {department}
                  </div>
                  <div className="text-[10.5px] font-black tracking-tight leading-tight uppercase mt-0.5">
                    PROPERTY INVENTORY STICKER (PIS)
                  </div>
                </div>
              </div>

              {/* Middle section: Property Code */}
              <div className="px-4 py-2.5 border-b-2 border-black bg-transparent">
                <div className="text-xs font-black">Property Code:</div>
                <div className="text-sm font-mono font-black border-b-2 border-black min-h-[22px] flex items-center pt-0.5 text-black">
                  {item.propertyNumber}
                </div>
              </div>

              {/* Bottom section: QR + Big Barcode (Full Width!) */}
              <div className="p-2.5 flex items-center justify-between gap-3 bg-transparent">
                <div className="w-12 h-12 bg-white border border-black p-0.5 flex-shrink-0 flex items-center justify-center">
                  <img
                    src={qrUrl}
                    alt="QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 text-center min-w-0 flex justify-center items-center">
                  <svg ref={barcodeRef} className="mx-auto w-full max-w-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Sticker Details & Linker info */}
          <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900">Unique PIS Code (Tag ID):</span>
              <div className="flex items-center gap-1.5 font-mono font-black text-blue-950 bg-white px-2 py-0.5 rounded-sm border border-amber-300">
                <span>{pisCode}</span>
                <button onClick={copyPISCode} className="text-gray-400 hover:text-black">
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Linked Property Code:</span>
              <span className="font-mono font-bold text-gray-900">{item.propertyNumber}</span>
            </div>
            <div className="flex items-center justify-between text-gray-600">
              <span>Accountable Custodian:</span>
              <span className="font-bold text-gray-900">{item.custodian}</span>
            </div>
          </div>

          {/* Department customizer */}
          <div className="flex items-center justify-between text-xs bg-gray-50 p-3 rounded-md border border-gray-200">
            <label className="font-bold text-gray-700">Department Label:</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value.toUpperCase())}
              className="px-2.5 py-1 text-xs border border-gray-300 rounded-md font-bold uppercase w-48 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Print Copies Control & A4 Batch Switcher */}
          <div className="bg-gray-50 p-3.5 rounded-md border border-gray-200 flex items-center justify-between">
            <div>
              <label className="text-xs font-bold text-gray-700 block">Number of Copies</label>
              <p className="text-[11px] text-gray-500">For units in this batch ({item.quantity} {item.unit})</p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max={Math.max(item.quantity, 50)}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2.5 py-1 text-sm border border-gray-300 rounded-md font-semibold text-center focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <span className="text-xs text-gray-600 font-medium">labels</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {onOpenBatchSheet && (
              <button
                onClick={() => {
                  onClose();
                  onOpenBatchSheet();
                }}
                className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1"
              >
                <Grid className="w-4 h-4" />
                <span>Full A4 Sheet Generator</span>
              </button>
            )}
            {onOpenCableTag && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCableTag();
                }}
                className="text-xs text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 bg-yellow-100 hover:bg-yellow-200 px-2 py-1 rounded-sm border border-yellow-300 transition-colors"
              >
                <Cable className="w-3.5 h-3.5" />
                <span>Print Cable Wrap Tag</span>
              </button>
            )}
          </div>

          <div className="flex space-x-3 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-sm text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-950 font-black rounded-sm text-sm shadow-md hover:shadow transition-all flex items-center space-x-2 border border-yellow-600"
            >
              <Printer className="w-4 h-4 text-black" />
              <span>Print {copies} PIS Sticker{copies > 1 ? 's' : ''}</span>
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

export default PropertyStickerModal;
