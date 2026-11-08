import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BorrowRequest } from '../types';
import { X, Printer, FileText } from 'lucide-react';
import { SYSTEM_NAME } from '../branding';

interface BorrowerAgreementModalProps {
  request: BorrowRequest;
  onClose: () => void;
  appName: string;
  logoUrl?: string;
  labInCharge?: string;
  initialMode?: 'blank' | 'populated';
}

const BorrowerAgreementModal: React.FC<BorrowerAgreementModalProps> = ({ 
  request, 
  onClose, 
  appName, 
  logoUrl, 
  labInCharge,
  initialMode
}) => {
  // A5 Landscape is the default per specification
  const [paperFormat, setPaperFormat] = useState<'a5_landscape' | 'a4_portrait'>('a5_landscape');
  const [templateMode, setTemplateMode] = useState<'blank' | 'populated'>(
    initialMode || (request.id === 'blank' || request.referenceCode === 'BLANK-FORM' ? 'blank' : 'blank')
  );

  const qrUrl = useMemo(() => {
    const trackingUrl = `${window.location.origin}?ref=${request.referenceCode}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(trackingUrl)}`;
  }, [request.referenceCode]);

  const formattedRequestDate = useMemo(() => {
    try {
      return new Date(request.requestDate).toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return request.requestDate;
    }
  }, [request.requestDate]);

  const isA5 = paperFormat === 'a5_landscape';
  const isBlank = templateMode === 'blank';

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=900,width=1100');
    if (!printWindow) return;

    printWindow.document.write('<!DOCTYPE html><html><head>');
    printWindow.document.write(`<title>General Loan Agreement (${isA5 ? 'A5 Landscape' : 'A4'}) - ${isBlank ? 'Blank Template' : request.referenceCode}</title>`);
    printWindow.document.write(`
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        @page {
          size: ${isA5 ? 'A5 landscape' : 'A4 portrait'};
          margin: ${isA5 ? '5mm 7mm' : '10mm 12mm'};
        }
        
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          color: #111827; 
          line-height: ${isA5 ? '1.2' : '1.35'}; 
          font-size: ${isA5 ? '7pt' : '9pt'}; 
          margin: 0;
          padding: 0;
          background: #fff;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1.5px solid #111827;
          padding-bottom: ${isA5 ? '4px' : '8px'};
          margin-bottom: ${isA5 ? '6px' : '10px'};
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .header-logo {
          height: ${isA5 ? '34px' : '48px'};
          width: auto;
          object-fit: contain;
        }

        .header-title-block {
          text-align: center;
          flex: 1;
        }

        .doc-main-title {
          font-size: ${isA5 ? '10pt' : '13pt'};
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0;
          color: #0f172a;
        }

        .header-sub {
          font-size: ${isA5 ? '6.5pt' : '8pt'};
          color: #475569;
          font-weight: 600;
          margin: 1px 0 0;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .ref-box {
          border: 1.5px solid #111827;
          padding: ${isA5 ? '2px 8px' : '4px 10px'};
          text-align: right;
          background-color: #f8fafc;
          min-width: ${isA5 ? '110px' : '140px'};
        }

        .ref-box-label {
          font-size: ${isA5 ? '5.5pt' : '6.5pt'};
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          display: block;
        }

        .ref-box-val {
          font-size: ${isA5 ? '8pt' : '10pt'};
          font-weight: 800;
          font-family: monospace;
          color: #0f172a;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: ${isA5 ? '6px' : '10px'};
          margin-bottom: ${isA5 ? '6px' : '10px'};
        }

        .card {
          border: 1px solid #cbd5e1;
          border-radius: 3px;
          padding: ${isA5 ? '4px 6px' : '6px 8px'};
          background-color: #f8fafc;
        }

        .card-title {
          font-size: ${isA5 ? '6.5pt' : '7.5pt'};
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 2px;
          margin-bottom: ${isA5 ? '3px' : '5px'};
        }

        .field-row {
          display: flex;
          align-items: flex-end;
          padding: ${isA5 ? '1.5px 0' : '2.5px 0'};
          font-size: ${isA5 ? '6.8pt' : '8pt'};
        }

        .field-lbl {
          font-weight: 600;
          color: #475569;
          white-space: nowrap;
          padding-right: 4px;
        }

        .field-line {
          flex: 1;
          border-bottom: 1px dotted #94a3b8;
          min-height: ${isA5 ? '11px' : '14px'};
          padding-left: 4px;
          font-weight: 700;
          color: #0f172a;
        }

        .section-bar {
          font-size: ${isA5 ? '6.5pt' : '7.5pt'};
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #1e293b;
          border-bottom: 1px solid #111827;
          padding-bottom: 1px;
          margin: ${isA5 ? '4px 0 3px' : '8px 0 5px'};
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: ${isA5 ? '4px' : '8px'};
        }

        th, td {
          border: 1px solid #cbd5e1;
          padding: ${isA5 ? '2.5px 4px' : '4px 6px'};
          text-align: left;
          font-size: ${isA5 ? '6.5pt' : '8pt'};
        }

        th {
          background-color: #f1f5f9;
          font-weight: 700;
          text-transform: uppercase;
          font-size: ${isA5 ? '5.8pt' : '7pt'};
          color: #334155;
        }

        .terms-block {
          border: 1px solid #e2e8f0;
          background: #fafafa;
          padding: ${isA5 ? '3px 6px' : '6px 10px'};
          border-radius: 3px;
          margin-bottom: ${isA5 ? '4px' : '8px'};
          font-size: ${isA5 ? '5.8pt' : '7pt'};
          line-height: ${isA5 ? '1.15' : '1.3'};
          color: #334155;
        }

        .terms-list {
          margin: 0;
          padding-left: 12px;
        }

        .terms-list li {
          margin-bottom: 1px;
        }

        .cert-note {
          text-align: center;
          font-style: italic;
          font-weight: 600;
          font-size: ${isA5 ? '6pt' : '7.5pt'};
          color: #1e293b;
          margin: ${isA5 ? '3px 0' : '6px 0'};
        }

        .sigs-wrap {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: ${isA5 ? '6px' : '12px'};
          gap: 12px;
        }

        .sig-box {
          flex: 1;
          text-align: center;
        }

        .sig-rule {
          border-top: 1.5px solid #111827;
          padding-top: 2px;
          font-size: ${isA5 ? '6.8pt' : '8pt'};
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          min-height: ${isA5 ? '13px' : '16px'};
        }

        .sig-sub {
          font-size: ${isA5 ? '5.5pt' : '6.5pt'};
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }

        .footer {
          margin-top: ${isA5 ? '4px' : '8px'};
          border-top: 1px solid #e2e8f0;
          padding-top: 2px;
          font-size: ${isA5 ? '5pt' : '6.5pt'};
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
      </style>
    `);
    printWindow.document.write('</head><body>');

    printWindow.document.write(`
      <!-- Document Header -->
      <div class="header">
        <div class="header-brand">
          ${logoUrl ? `<img src="${logoUrl}" class="header-logo" alt="Logo" />` : ''}
          <div>
            <div style="font-size: ${isA5 ? '8pt' : '11pt'}; font-weight: 800; text-transform: uppercase; color: #0f172a; line-height: 1;">
              ${appName}
            </div>
            <div class="header-sub">Science Laboratory Management</div>
          </div>
        </div>

        <div class="header-title-block">
          <h1 class="doc-main-title">General Loan Agreement Form</h1>
          <div class="header-sub">
            ${isBlank ? 'Official Blank Equipment Requisition & Accountability Slip' : 'Equipment Requisition & Accountability Slip'} (${isA5 ? 'A5 Landscape' : 'A4 Sheet'})
          </div>
        </div>

        <div class="ref-box">
          <span class="ref-box-label">Reference No.</span>
          <span class="ref-box-val">${isBlank ? '________________' : request.referenceCode}</span>
        </div>
      </div>

      <!-- Information Grid: Borrower Info & Reference Info -->
      <div class="grid-2">
        <!-- Borrower Information -->
        <div class="card">
          <div class="card-title">Borrower Information</div>
          <div class="field-row">
            <span class="field-lbl">Full Name:</span>
            <span class="field-line">${isBlank ? '' : request.borrowerName}</span>
          </div>
          <div class="field-row">
            <span class="field-lbl">ID / Grade & Section:</span>
            <span class="field-line">${isBlank ? '' : request.borrowerId}</span>
          </div>
          <div class="field-row">
            <span class="field-lbl">Contact / Email:</span>
            <span class="field-line">${isBlank ? '' : (request.borrowerEmail || '—')}</span>
          </div>
          <div class="field-row">
            <span class="field-lbl">Supervising Instructor:</span>
            <span class="field-line">${isBlank ? '' : (request.instructorName || '—')}</span>
          </div>
        </div>

        <!-- Request Reference Information -->
        <div class="card">
          <div class="card-title">Request Reference Information</div>
          <div class="field-row">
            <span class="field-lbl">Control / Ref Code:</span>
            <span class="field-line" style="font-family: monospace;">${isBlank ? '' : request.referenceCode}</span>
          </div>
          <div class="field-row">
            <span class="field-lbl">Date of Utilization:</span>
            <span class="field-line">${isBlank ? '' : formattedRequestDate}</span>
          </div>
          <div class="field-row">
            <span class="field-lbl">Required Return Date:</span>
            <span class="field-line" style="${isBlank ? '' : 'color: #991b1b; font-weight: 800;'}">${isBlank ? '' : request.returnDate}</span>
          </div>
          <div class="field-row">
            <span class="field-lbl">Purpose / Schedule Slot:</span>
            <span class="field-line">${isBlank ? '' : (request.reservationSlot ? `Slot: ${request.reservationSlot}` : 'Standard Laboratory Session')}</span>
          </div>
        </div>
      </div>

      <!-- Equipment Record Table -->
      <div class="section-bar">I. Lent Equipment / Apparatus Record</div>
      <table>
        <thead>
          <tr>
            <th style="width: 20px; text-align: center;">#</th>
            <th>Description of Equipment / Apparatus</th>
            <th style="width: 45px; text-align: center;">Qty</th>
            <th style="width: 80px;">Tag / Unit ID</th>
            <th style="width: 85px;">Release State</th>
            <th style="width: 85px;">Return Inspection</th>
          </tr>
        </thead>
        <tbody>
          ${isBlank ? `
            <tr><td style="text-align: center;">1</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
            <tr><td style="text-align: center;">2</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
            <tr><td style="text-align: center;">3</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
            <tr><td style="text-align: center;">4</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
          ` : request.items.map((item, idx) => `
            <tr>
              <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
              <td style="font-weight: 600;">${item.itemName}</td>
              <td style="text-align: center; font-weight: 800; color: #2563eb;">${item.quantity}</td>
              <td>—</td>
              <td style="color: #15803d; font-weight: 600;">Verified Functional</td>
              <td></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- Binding Loan Terms -->
      <div class="section-bar">II. Binding Loan Terms & Accountability</div>
      <div class="terms-block">
        <ol class="terms-list">
          <li><strong>Custody & Safety:</strong> Borrower assumes absolute physical stewardship for the borrowed equipment until official return and custodian verification.</li>
          <li><strong>Pre-Use Inspection:</strong> Any discrepancies or defects must be noted immediately upon release prior to departure from the science laboratory.</li>
          <li><strong>Liability for Damage:</strong> Any loss, breakage, or damage due to negligence requires identical unit replacement or institutional restitution.</li>
          <li><strong>Timely Return:</strong> Equipment must be surrendered on or before the indicated return date to maintain active borrowing privileges.</li>
        </ol>
      </div>

      <div class="cert-note">
        "I hereby certify that I have received the listed equipment in good order and bind myself to the terms of this loan agreement."
      </div>

      <!-- Signatures Area -->
      <div class="sigs-wrap">
        <div class="sig-box">
          <div class="sig-rule">${isBlank ? '&nbsp;' : request.borrowerName}</div>
          <div class="sig-sub">Signature over Printed Name of Borrower</div>
        </div>

        <div class="sig-box">
          <div class="sig-rule">${labInCharge || 'Laboratory Custodian'}</div>
          <div class="sig-sub">Laboratory Custodian In-Charge</div>
        </div>

        <div class="sig-box">
          <div class="sig-rule">&nbsp;</div>
          <div class="sig-sub">Surrendered & Verified Return Date</div>
        </div>

        ${!isBlank ? `
          <div style="width: 44px; text-align: center;">
            <img src="${qrUrl}" style="width: 38px; height: 38px; border: 1px solid #cbd5e1; padding: 1px;" alt="QR" />
            <div style="font-size: 4.5pt; font-weight: 800; text-transform: uppercase; color: #64748b;">Verify</div>
          </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div class="footer">
        <div>${SYSTEM_NAME} • General Loan Agreement Template</div>
        <div>Format: ${isA5 ? 'A5 Landscape (210 × 148 mm)' : 'A4 Sheet'} • ${isBlank ? 'Blank Form Template' : `Ref: ${request.referenceCode}`}</div>
        <div>Single Page Slip • Page 1 of 1</div>
      </div>
    `);

    printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
  };

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-md shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh] animate-in zoom-in duration-300 border border-gray-200">
        
        {/* Modal Header with Clean Institutional Styling */}
        <div className="p-4 bg-white border-b border-gray-200 flex flex-wrap gap-3 justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-md">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight text-gray-900">General Loan Agreement Form</h3>
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">
                {isA5 ? 'Landscape A5 Sheet Paper (210 × 148 mm)' : 'Portrait A4 Sheet Paper (210 × 297 mm)'}
                {isBlank ? ' • Blank Form Template' : ' • Populated with Request'}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Template Mode: Blank vs Populated */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-md border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 px-1.5 uppercase tracking-wider">Mode:</span>
              <button
                type="button"
                onClick={() => setTemplateMode('blank')}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                  isBlank 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Blank Template
              </button>
              <button
                type="button"
                onClick={() => setTemplateMode('populated')}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                  !isBlank 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                Filled Slip
              </button>
            </div>

            {/* Paper Orientation Selector */}
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-md border border-gray-200">
              <span className="text-[11px] font-bold text-gray-500 px-1.5 uppercase tracking-wider">Sheet:</span>
              <button
                type="button"
                onClick={() => setPaperFormat('a5_landscape')}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                  isA5 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                A5 Landscape
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('a4_portrait')}
                className={`px-2.5 py-1 text-xs font-bold rounded transition-colors ${
                  !isA5 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                A4 Portrait
              </button>
            </div>

            <button 
              onClick={onClose} 
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* On-Screen Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-100/70 flex justify-center items-start">
          <div 
            className={`bg-white shadow-sm border border-gray-300 text-gray-900 font-sans leading-normal relative w-full transition-all ${
              isA5 
                ? 'max-w-[210mm] min-h-[148mm] p-6 text-xs' 
                : 'max-w-[210mm] min-h-[297mm] p-10 text-sm'
            }`}
          >
            {/* Document Header */}
            <div className="flex items-center justify-between border-b-2 border-gray-900 pb-2.5 mb-3">
              <div className="flex items-center gap-2.5">
                {logoUrl && (
                  <img 
                    src={logoUrl} 
                    alt="Logo" 
                    className={`object-contain ${isA5 ? 'h-9 w-auto' : 'h-12 w-auto'}`} 
                  />
                )}
                <div>
                  <h1 className={`font-black uppercase tracking-tight text-gray-900 ${isA5 ? 'text-sm' : 'text-lg'}`}>
                    {appName}
                  </h1>
                  <p className="font-semibold text-gray-500 uppercase tracking-wider text-[9px]">
                    Science Laboratory Management
                  </p>
                </div>
              </div>

              <div className="text-center">
                <h2 className={`font-black uppercase tracking-wide text-gray-900 ${isA5 ? 'text-xs md:text-sm' : 'text-base'}`}>
                  General Loan Agreement Form
                </h2>
                <p className="text-gray-500 font-semibold text-[9px]">
                  {isBlank ? 'Official Blank Equipment Requisition & Accountability Slip' : 'Equipment Requisition & Accountability Slip'} ({isA5 ? 'A5 Landscape' : 'A4 Sheet'})
                </p>
              </div>

              <div className="border border-gray-900 bg-gray-50 px-2.5 py-1 text-right min-w-[100px]">
                <span className="block text-[7.5px] font-bold text-gray-500 uppercase tracking-wider">Reference No.</span>
                <span className={`font-black font-mono text-gray-900 ${isA5 ? 'text-xs' : 'text-sm'}`}>
                  {isBlank ? '________________' : request.referenceCode}
                </span>
              </div>
            </div>

            {/* Information Grid: Borrower Info & Reference Info */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Borrower Information */}
              <div className="border border-gray-300 rounded p-2.5 bg-gray-50/50">
                <div className="font-black uppercase text-gray-800 text-[9.5px] tracking-wider border-b border-gray-200 pb-1 mb-1.5">
                  Borrower Information
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">Full Name:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[16px]">
                      {isBlank ? '' : request.borrowerName}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">ID / Grade & Section:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[16px]">
                      {isBlank ? '' : request.borrowerId}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">Contact / Email:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[16px]">
                      {isBlank ? '' : (request.borrowerEmail || '—')}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">Supervising Instructor:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[16px]">
                      {isBlank ? '' : (request.instructorName || '—')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Request Reference Information */}
              <div className="border border-gray-300 rounded p-2.5 bg-gray-50/50">
                <div className="font-black uppercase text-gray-800 text-[9.5px] tracking-wider border-b border-gray-200 pb-1 mb-1.5">
                  Request Reference Information
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">Control / Ref Code:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold font-mono text-gray-900 pl-1 min-h-[16px]">
                      {isBlank ? '' : request.referenceCode}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">Date of Utilization:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[16px]">
                      {isBlank ? '' : formattedRequestDate}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">Required Return Date:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-red-700 pl-1 min-h-[16px]">
                      {isBlank ? '' : request.returnDate}
                    </span>
                  </div>
                  <div className="flex items-end">
                    <span className="text-gray-500 font-semibold text-[10px] whitespace-nowrap pr-1.5">Purpose / Schedule Slot:</span>
                    <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[16px]">
                      {isBlank ? '' : (request.reservationSlot ? `Slot: ${request.reservationSlot}` : 'Standard Laboratory Session')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Lent Items Table */}
            <div className="mb-2.5">
              <span className="font-black uppercase text-[10px] border-b border-gray-900 block mb-1.5 px-0.5">
                I. Lent Equipment / Apparatus Record
              </span>
              <table className="w-full border-collapse border border-gray-300 text-[10px]">
                <thead>
                  <tr className="bg-gray-100 text-gray-700">
                    <th className="border border-gray-300 p-1 text-center w-8 uppercase text-[8.5px]">#</th>
                    <th className="border border-gray-300 p-1 text-left uppercase text-[8.5px]">Description of Equipment / Apparatus</th>
                    <th className="border border-gray-300 p-1 text-center w-12 uppercase text-[8.5px]">Qty</th>
                    <th className="border border-gray-300 p-1 text-left w-24 uppercase text-[8.5px]">Tag / Unit ID</th>
                    <th className="border border-gray-300 p-1 text-left w-24 uppercase text-[8.5px]">Release State</th>
                    <th className="border border-gray-300 p-1 text-left w-24 uppercase text-[8.5px]">Return Inspection</th>
                  </tr>
                </thead>
                <tbody>
                  {isBlank ? (
                    <>
                      <tr className="h-6">
                        <td className="border border-gray-300 p-1 text-center font-bold">1</td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1 text-center"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                      </tr>
                      <tr className="h-6">
                        <td className="border border-gray-300 p-1 text-center font-bold">2</td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1 text-center"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                      </tr>
                      <tr className="h-6">
                        <td className="border border-gray-300 p-1 text-center font-bold">3</td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1 text-center"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                      </tr>
                      <tr className="h-6">
                        <td className="border border-gray-300 p-1 text-center font-bold">4</td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1 text-center"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                        <td className="border border-gray-300 p-1"></td>
                      </tr>
                    </>
                  ) : (
                    request.items.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        <td className="border border-gray-300 p-1 text-center font-bold">{i + 1}</td>
                        <td className="border border-gray-300 p-1 font-bold text-gray-800">{item.itemName}</td>
                        <td className="border border-gray-300 p-1 text-center font-bold text-blue-700">{item.quantity}</td>
                        <td className="border border-gray-300 p-1 text-gray-400">—</td>
                        <td className="border border-gray-300 p-1 text-green-700 font-semibold">Verified Functional</td>
                        <td className="border border-gray-300 p-1"></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Terms & Conditions */}
            <div className="mb-2.5">
              <span className="font-black uppercase text-[10px] border-b border-gray-900 block mb-1 px-0.5">
                II. Binding Loan Terms & Accountability
              </span>
              <div className="border border-gray-200 rounded p-2 bg-gray-50/60 text-[9px] leading-relaxed text-gray-700">
                <ol className="list-decimal pl-3.5 space-y-0.5">
                  <li><strong>Custody & Safety:</strong> Borrower assumes absolute physical stewardship for the borrowed equipment until official return and custodian verification.</li>
                  <li><strong>Pre-Use Inspection:</strong> Any discrepancies or defects must be noted immediately upon release prior to departure from the science laboratory.</li>
                  <li><strong>Liability for Damage:</strong> Any loss, breakage, or damage due to negligence requires identical unit replacement or institutional restitution.</li>
                  <li><strong>Timely Return:</strong> Equipment must be surrendered on or before the indicated return date to maintain active borrowing privileges.</li>
                </ol>
              </div>
            </div>

            <div className="my-1.5 text-[9.5px] italic text-gray-700 font-semibold text-center">
              "I hereby certify that I have received the listed equipment in good order and bind myself to the terms of this loan agreement."
            </div>

            {/* Signatures Area */}
            <div className="flex justify-between items-end mt-4 pt-2 px-1 gap-4">
              <div className="flex-1 text-center">
                <div className="border-t-2 border-gray-900 pt-1 font-black uppercase text-xs min-h-[16px]">
                  {isBlank ? '' : request.borrowerName}
                </div>
                <div className="text-[8.5px] text-gray-500 uppercase font-bold tracking-tight">
                  Signature over Printed Name of Borrower
                </div>
              </div>

              <div className="flex-1 text-center">
                <div className="border-t-2 border-gray-900 pt-1 font-black uppercase text-xs min-h-[16px]">
                  {labInCharge || 'Laboratory Custodian'}
                </div>
                <div className="text-[8.5px] text-gray-500 uppercase font-bold tracking-tight">
                  Laboratory Custodian In-Charge
                </div>
              </div>

              <div className="flex-1 text-center">
                <div className="border-t-2 border-gray-900 pt-1 font-black uppercase text-xs min-h-[16px]">
                  &nbsp;
                </div>
                <div className="text-[8.5px] text-gray-500 uppercase font-bold tracking-tight">
                  Surrendered & Verified Return Date
                </div>
              </div>

              {!isBlank && (
                <div className="text-center pl-2">
                  <div className="p-0.5 border border-gray-300 rounded inline-block bg-white shadow-xs">
                    <img src={qrUrl} alt="Tracking QR" className="w-10 h-10" />
                  </div>
                  <span className="block text-[7px] font-black text-gray-500 uppercase tracking-wider">
                    Verify
                  </span>
                </div>
              )}
            </div>

            {/* System Footer Note */}
            <div className="mt-4 pt-1.5 border-t border-gray-200 text-[8.5px] text-gray-400 flex justify-between items-center italic">
              <div>${SYSTEM_NAME} • General Loan Agreement Template</div>
              <div>Sheet: {isA5 ? 'A5 Landscape (210 × 148 mm)' : 'A4 Sheet'} • {isBlank ? 'Blank Form Template' : `Ref: ${request.referenceCode}`}</div>
              <div>Single Page Slip • Page 1 of 1</div>
            </div>
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="p-4 bg-white border-t border-gray-200 flex justify-end items-center gap-3 flex-shrink-0">
          <button 
            type="button"
            onClick={onClose} 
            className="px-5 py-2.5 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-bold text-sm transition-all"
          >
            Close
          </button>
          <button 
            type="button"
            onClick={handlePrint} 
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-bold text-sm transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> 
            Print A5 Landscape Loan Agreement ({isBlank ? 'Blank Template' : 'Filled Slip'})
          </button>
        </div>

      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default BorrowerAgreementModal;
