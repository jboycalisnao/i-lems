import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { BorrowRequest } from '../types';
import { X, Printer, FileText, Scissors } from 'lucide-react';
import { SYSTEM_NAME } from '../branding';

export type PaperFormat = 'half_letter' | 'half_a4' | 'dual_sheet' | 'full_portrait';

interface BorrowerAgreementModalProps {
  request: BorrowRequest;
  onClose: () => void;
  appName: string;
  logoUrl?: string;
  labInCharge?: string;
  initialMode?: 'blank' | 'populated';
  initialFormat?: PaperFormat;
}

const BorrowerAgreementModal: React.FC<BorrowerAgreementModalProps> = ({ 
  request, 
  onClose, 
  appName, 
  logoUrl, 
  labInCharge,
  initialMode,
  initialFormat
}) => {
  // Default to 2-in-1 Dual Slips (prints 2 identical half-sheets on 1 full Letter/A4 bondpaper)
  const [paperFormat, setPaperFormat] = useState<PaperFormat>(initialFormat || 'dual_sheet');
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

  const isBlank = templateMode === 'blank';
  const isCompact = paperFormat !== 'full_portrait';

  const getFormatLabel = (fmt: PaperFormat) => {
    switch (fmt) {
      case 'half_letter': return 'Half Letter (8.5" × 5.5")';
      case 'half_a4': return 'Half A4 / A5 (210 × 148 mm)';
      case 'dual_sheet': return '2 Slips on 1 Sheet (A4 / Letter)';
      case 'full_portrait': return 'Full Page (A4 / Letter)';
    }
  };

  const getFormatSubTitle = (fmt: PaperFormat, copyTag?: string) => {
    switch (fmt) {
      case 'half_letter': return 'Half Letter Sheet • 8.5" × 5.5"';
      case 'half_a4': return 'Half A4 / A5 Sheet • 210 × 148 mm';
      case 'dual_sheet': return `2-in-1 Dual Slips • ${copyTag || 'Bondpaper Sheet'}`;
      case 'full_portrait': return 'Full Sheet • A4 / Letter';
    }
  };

  // Generate slip HTML for printing
  const generateSlipHtml = (copyTag?: string) => {
    const formatSubText = getFormatSubTitle(paperFormat, copyTag);
    const docSubtitle = isBlank
      ? `Official Blank Equipment Requisition & Accountability Slip (${formatSubText})`
      : `Equipment Requisition & Accountability Slip (${formatSubText})`;

    return `
      <div class="slip-container">
        <!-- Top Section: Header & Reference -->
        <div>
          <div class="header">
            <div class="header-brand">
              ${logoUrl ? `<img src="${logoUrl}" class="header-logo" alt="Logo" />` : ''}
              <div>
                <div class="header-title">${appName}</div>
                <div class="header-sub">Science Laboratory Management</div>
              </div>
            </div>

            <div class="header-title-block">
              <h1 class="doc-main-title">General Loan Agreement Form</h1>
              <div class="header-sub">${docSubtitle}</div>
            </div>

            <div class="ref-box">
              <span class="ref-box-label">Reference No.</span>
              <span class="ref-box-val">${isBlank ? '________________' : request.referenceCode}</span>
              ${copyTag ? `<span class="copy-tag-pill">${copyTag}</span>` : ''}
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
                <span class="field-line font-mono">${isBlank ? '' : request.referenceCode}</span>
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
                <th style="width: 24px; text-align: center;">#</th>
                <th>Description of Equipment / Apparatus</th>
                <th style="width: 45px; text-align: center;">Qty</th>
                <th style="width: 85px;">Tag / Unit ID</th>
                <th style="width: 90px;">Release State</th>
                <th style="width: 90px;">Return Inspection</th>
              </tr>
            </thead>
            <tbody>
              ${isBlank ? `
                <tr><td style="text-align: center; font-weight: 700;">1</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                <tr><td style="text-align: center; font-weight: 700;">2</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                <tr><td style="text-align: center; font-weight: 700;">3</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
                <tr><td style="text-align: center; font-weight: 700;">4</td><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>
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
        </div>

        <!-- Bottom Section: Signatures & Footer -->
        <div>
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
              <div style="width: 38px; text-align: center;">
                <img src="${qrUrl}" style="width: 32px; height: 32px; border: 1px solid #cbd5e1; padding: 1px;" alt="QR" />
                <div style="font-size: 5pt; font-weight: 800; text-transform: uppercase; color: #64748b;">Verify</div>
              </div>
            ` : ''}
          </div>

          <!-- Footer -->
          <div class="footer">
            <div>${appName || SYSTEM_NAME} • General Loan Agreement Template</div>
            <div>Format: ${formatSubText} • ${isBlank ? 'Blank Form Template' : `Ref: ${request.referenceCode}`}</div>
            <div>${paperFormat === 'dual_sheet' ? `${copyTag || 'Dual Slip'} • Page 1 of 1` : 'Single Page Slip • Page 1 of 1'}</div>
          </div>
        </div>
      </div>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '', 'height=900,width=1100');
    if (!printWindow) return;

    // Determine @page size directive and container height
    let pageDirective = 'size: auto; margin: 5mm 6mm;';
    let slipHeight = '128mm';

    if (paperFormat === 'half_letter') {
      pageDirective = 'size: 8.5in 5.5in landscape; margin: 4mm 6mm;';
      slipHeight = '127mm';
    } else if (paperFormat === 'half_a4') {
      pageDirective = 'size: A5 landscape; margin: 5mm 6mm;';
      slipHeight = '130mm';
    } else if (paperFormat === 'dual_sheet') {
      // Standard Letter is 279.4mm, A4 is 297mm.
      // Top slip 128mm + cut guide 8mm + bottom slip 128mm = 264mm total.
      // With 5mm top/bottom margin, fits in 274mm, leaving breathing room on Letter (279.4mm) and A4 (297mm).
      pageDirective = 'size: portrait; margin: 5mm 7mm;';
      slipHeight = '128mm';
    } else {
      pageDirective = 'size: portrait; margin: 10mm 12mm;';
      slipHeight = 'auto';
    }

    printWindow.document.write('<!DOCTYPE html><html><head>');
    printWindow.document.write(`<title>Loan Agreement Form (${getFormatLabel(paperFormat)}) - ${isBlank ? 'Blank' : request.referenceCode}</title>`);
    printWindow.document.write(`
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        @page {
          ${pageDirective}
        }
        
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: #fff;
        }

        body { 
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          color: #111827; 
          line-height: ${isCompact ? '1.2' : '1.35'}; 
          font-size: ${isCompact ? '7.2pt' : '9pt'}; 
        }

        .slip-container {
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
          ${slipHeight !== 'auto' ? `height: ${slipHeight}; max-height: ${slipHeight}; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden;` : ''}
        }

        .cut-divider {
          height: 8mm;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #475569;
          font-size: 6pt;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cut-line {
          flex: 1;
          border-top: 1px dashed #64748b;
        }

        .cut-label {
          white-space: nowrap;
          padding: 0 4px;
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1.5px solid #111827;
          padding-bottom: ${isCompact ? '3.5px' : '8px'};
          margin-bottom: ${isCompact ? '4.5px' : '10px'};
        }

        .header-brand {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .header-logo {
          height: ${isCompact ? '32px' : '44px'};
          width: auto;
          object-fit: contain;
        }

        .header-title {
          font-size: ${isCompact ? '8.5pt' : '11pt'};
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          line-height: 1.1;
        }

        .header-title-block {
          text-align: center;
          flex: 1;
          padding: 0 10px;
        }

        .doc-main-title {
          font-size: ${isCompact ? '10pt' : '13pt'};
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 0;
          color: #0f172a;
          line-height: 1.1;
        }

        .header-sub {
          font-size: ${isCompact ? '6pt' : '8pt'};
          color: #475569;
          font-weight: 600;
          margin: 1px 0 0;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .ref-box {
          border: 1px solid #111827;
          padding: ${isCompact ? '2.5px 7px' : '4px 10px'};
          text-align: right;
          background-color: #f8fafc;
          min-width: ${isCompact ? '105px' : '140px'};
        }

        .ref-box-label {
          font-size: ${isCompact ? '5.5pt' : '6.5pt'};
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          display: block;
        }

        .ref-box-val {
          font-size: ${isCompact ? '8pt' : '10pt'};
          font-weight: 800;
          font-family: monospace;
          color: #0f172a;
          line-height: 1.1;
        }

        .copy-tag-pill {
          display: block;
          margin-top: 1.5px;
          font-size: 5pt;
          font-weight: 800;
          text-transform: uppercase;
          color: #1e3a8a;
          background: #dbeafe;
          padding: 0.5px 3px;
          border-radius: 2px;
          text-align: center;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: ${isCompact ? '6px' : '10px'};
          margin-bottom: ${isCompact ? '4.5px' : '10px'};
        }

        .card {
          border: 1px solid #cbd5e1;
          border-radius: 2px;
          padding: ${isCompact ? '3.5px 6px' : '6px 8px'};
          background-color: #f8fafc;
        }

        .card-title {
          font-size: ${isCompact ? '6.5pt' : '7.5pt'};
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 1.5px;
          margin-bottom: ${isCompact ? '3px' : '5px'};
        }

        .field-row {
          display: flex;
          align-items: flex-end;
          padding: ${isCompact ? '1.5px 0' : '2.5px 0'};
          font-size: ${isCompact ? '6.8pt' : '8pt'};
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
          min-height: ${isCompact ? '12px' : '14px'};
          padding-left: 3px;
          font-weight: 700;
          color: #0f172a;
        }

        .font-mono {
          font-family: monospace;
        }

        .section-bar {
          font-size: ${isCompact ? '6.5pt' : '7.5pt'};
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: #1e293b;
          border-bottom: 1px solid #111827;
          padding-bottom: 1px;
          margin: ${isCompact ? '4px 0 2.5px' : '8px 0 5px'};
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: ${isCompact ? '4px' : '8px'};
        }

        th, td {
          border: 1px solid #cbd5e1;
          padding: ${isCompact ? '2px 4px' : '4px 6px'};
          text-align: left;
          font-size: ${isCompact ? '6.5pt' : '8pt'};
        }

        th {
          background-color: #f1f5f9;
          font-weight: 700;
          text-transform: uppercase;
          font-size: ${isCompact ? '5.8pt' : '7pt'};
          color: #334155;
        }

        .terms-block {
          border: 1px solid #e2e8f0;
          background: #fafafa;
          padding: ${isCompact ? '3px 6px' : '6px 10px'};
          border-radius: 2px;
          margin-bottom: ${isCompact ? '3px' : '8px'};
          font-size: ${isCompact ? '5.8pt' : '7pt'};
          line-height: ${isCompact ? '1.18' : '1.3'};
          color: #334155;
        }

        .terms-list {
          margin: 0;
          padding-left: 11px;
        }

        .terms-list li {
          margin-bottom: 0.5px;
        }

        .cert-note {
          text-align: center;
          font-style: italic;
          font-weight: 600;
          font-size: ${isCompact ? '6pt' : '7.5pt'};
          color: #1e293b;
          margin: ${isCompact ? '2.5px 0' : '6px 0'};
        }

        .sigs-wrap {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: ${isCompact ? '4.5px' : '12px'};
          gap: 12px;
        }

        .sig-box {
          flex: 1;
          text-align: center;
        }

        .sig-rule {
          border-top: 1px solid #111827;
          padding-top: 2px;
          font-size: ${isCompact ? '7pt' : '8pt'};
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          min-height: ${isCompact ? '13px' : '16px'};
        }

        .sig-sub {
          font-size: ${isCompact ? '5.2pt' : '6.5pt'};
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }

        .footer {
          margin-top: ${isCompact ? '3.5px' : '8px'};
          border-top: 1px solid #e2e8f0;
          padding-top: 2px;
          font-size: ${isCompact ? '5.2pt' : '6.5pt'};
          color: #94a3b8;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
      </style>
    `);
    printWindow.document.write('</head><body>');

    if (paperFormat === 'dual_sheet') {
      // Print two full-height slips on one sheet with a cut guide
      printWindow.document.write(generateSlipHtml('Borrower Copy'));
      printWindow.document.write(`
        <div class="cut-divider">
          <div class="cut-line"></div>
          <div class="cut-label">✂ CUT ALONG LINE / GUPITIN DITO (HALF SHEET DIVIDER) ✂</div>
          <div class="cut-line"></div>
        </div>
      `);
      printWindow.document.write(generateSlipHtml('Laboratory Custodian Copy'));
    } else {
      // Print single slip
      printWindow.document.write(generateSlipHtml());
    }

    printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
    printWindow.document.write('</body></html>');
    printWindow.document.close();
  };

  // Reusable sub-component for on-screen preview
  const renderPreviewSlip = (copyTag?: string) => {
    const formatSubText = getFormatSubTitle(paperFormat, copyTag);
    const docSubtitle = isBlank
      ? `Official Blank Equipment Requisition & Accountability Slip (${formatSubText})`
      : `Equipment Requisition & Accountability Slip (${formatSubText})`;

    return (
      <div className={`bg-white text-gray-900 font-sans leading-normal relative w-full border border-gray-300 rounded p-4 text-[10px] flex flex-col justify-between ${
        paperFormat === 'full_portrait' 
          ? 'min-h-[260mm]' 
          : paperFormat === 'half_a4'
            ? 'h-[130mm] max-h-[130mm]'
            : 'h-[128mm] max-h-[128mm]'
      }`}>
        {/* Top Section */}
        <div>
          {/* Document Header */}
          <div className="flex items-center justify-between border-b-2 border-gray-900 pb-2 mb-2">
            <div className="flex items-center gap-2">
              {logoUrl && (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className={`object-contain ${isCompact ? 'h-8 w-auto' : 'h-11 w-auto'}`} 
                />
              )}
              <div>
                <h1 className={`font-black uppercase tracking-tight text-gray-900 leading-tight ${isCompact ? 'text-xs' : 'text-base'}`}>
                  {appName}
                </h1>
                <p className="font-semibold text-gray-500 uppercase tracking-wider text-[8px] mt-0.5">
                  Science Laboratory Management
                </p>
              </div>
            </div>

            <div className="text-center px-2">
              <h2 className={`font-black uppercase tracking-wide text-gray-900 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                General Loan Agreement Form
              </h2>
              <p className="text-gray-500 font-semibold text-[8px]">
                {docSubtitle}
              </p>
            </div>

            <div className="border border-gray-900 bg-gray-50 px-2 py-0.5 text-right min-w-[95px]">
              <span className="block text-[7px] font-bold text-gray-500 uppercase tracking-wider">Reference No.</span>
              <span className={`font-black font-mono text-gray-900 ${isCompact ? 'text-xs' : 'text-sm'}`}>
                {isBlank ? '________________' : request.referenceCode}
              </span>
              {copyTag && (
                <span className="block mt-0.5 text-[7px] font-black uppercase text-blue-900 bg-blue-100 px-1 rounded text-center">
                  {copyTag}
                </span>
              )}
            </div>
          </div>

          {/* Information Grid */}
          <div className="grid grid-cols-2 gap-2.5 mb-2">
            {/* Borrower Information */}
            <div className="border border-gray-300 rounded p-2 bg-gray-50/50">
              <div className="font-black uppercase text-gray-800 text-[8.5px] tracking-wider border-b border-gray-200 pb-0.5 mb-1">
                Borrower Information
              </div>
              <div className="space-y-0.5 text-[9.5px]">
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">Full Name:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[14px]">
                    {isBlank ? '' : request.borrowerName}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">ID / Grade & Section:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[14px]">
                    {isBlank ? '' : request.borrowerId}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">Contact / Email:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[14px]">
                    {isBlank ? '' : (request.borrowerEmail || '—')}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">Supervising Instructor:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[14px]">
                    {isBlank ? '' : (request.instructorName || '—')}
                  </span>
                </div>
              </div>
            </div>

            {/* Request Reference Information */}
            <div className="border border-gray-300 rounded p-2 bg-gray-50/50">
              <div className="font-black uppercase text-gray-800 text-[8.5px] tracking-wider border-b border-gray-200 pb-0.5 mb-1">
                Request Reference Information
              </div>
              <div className="space-y-0.5 text-[9.5px]">
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">Control / Ref Code:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold font-mono text-gray-900 pl-1 min-h-[14px]">
                    {isBlank ? '' : request.referenceCode}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">Date of Utilization:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[14px]">
                    {isBlank ? '' : formattedRequestDate}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">Required Return Date:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-red-700 pl-1 min-h-[14px]">
                    {isBlank ? '' : request.returnDate}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="text-gray-500 font-semibold text-[8.5px] whitespace-nowrap pr-1.5">Purpose / Schedule Slot:</span>
                  <span className="flex-1 border-b border-dotted border-gray-400 font-bold text-gray-900 pl-1 min-h-[14px]">
                    {isBlank ? '' : (request.reservationSlot ? `Slot: ${request.reservationSlot}` : 'Standard Laboratory Session')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Lent Items Table */}
          <div className="mb-2">
            <span className="font-black uppercase text-[9px] border-b border-gray-900 block mb-1">
              I. Lent Equipment / Apparatus Record
            </span>
            <table className="w-full border-collapse border border-gray-300 text-[9px]">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="border border-gray-300 p-1 text-center w-7 uppercase text-[8px]">#</th>
                  <th className="border border-gray-300 p-1 text-left uppercase text-[8px]">Description of Equipment / Apparatus</th>
                  <th className="border border-gray-300 p-1 text-center w-11 uppercase text-[8px]">Qty</th>
                  <th className="border border-gray-300 p-1 text-left w-22 uppercase text-[8px]">Tag / Unit ID</th>
                  <th className="border border-gray-300 p-1 text-left w-22 uppercase text-[8px]">Release State</th>
                  <th className="border border-gray-300 p-1 text-left w-22 uppercase text-[8px]">Return Inspection</th>
                </tr>
              </thead>
              <tbody>
                {isBlank ? (
                  <>
                    <tr className="h-5">
                      <td className="border border-gray-300 p-0.5 text-center font-bold">1</td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5 text-center"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                    </tr>
                    <tr className="h-5">
                      <td className="border border-gray-300 p-0.5 text-center font-bold">2</td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5 text-center"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                    </tr>
                    <tr className="h-5">
                      <td className="border border-gray-300 p-0.5 text-center font-bold">3</td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5 text-center"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                    </tr>
                    <tr className="h-5">
                      <td className="border border-gray-300 p-0.5 text-center font-bold">4</td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5 text-center"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                      <td className="border border-gray-300 p-0.5"></td>
                    </tr>
                  </>
                ) : (
                  request.items.map((item, i) => (
                    <tr key={i} className="hover:bg-gray-50/50">
                      <td className="border border-gray-300 p-0.5 text-center font-bold">{i + 1}</td>
                      <td className="border border-gray-300 p-0.5 font-bold text-gray-800">{item.itemName}</td>
                      <td className="border border-gray-300 p-0.5 text-center font-bold text-blue-700">{item.quantity}</td>
                      <td className="border border-gray-300 p-0.5 text-gray-400">—</td>
                      <td className="border border-gray-300 p-0.5 text-green-700 font-semibold">Verified Functional</td>
                      <td className="border border-gray-300 p-0.5"></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Terms & Conditions */}
          <div className="mb-1.5">
            <span className="font-black uppercase text-[9px] border-b border-gray-900 block mb-0.5">
              II. Binding Loan Terms & Accountability
            </span>
            <div className="border border-gray-200 rounded p-1.5 bg-gray-50/60 text-[8px] leading-snug text-gray-700">
              <ol className="list-decimal pl-3 space-y-0.5">
                <li><strong>Custody & Safety:</strong> Borrower assumes absolute physical stewardship for the borrowed equipment until official return and custodian verification.</li>
                <li><strong>Pre-Use Inspection:</strong> Any discrepancies or defects must be noted immediately upon release prior to departure from the science laboratory.</li>
                <li><strong>Liability for Damage:</strong> Any loss, breakage, or damage due to negligence requires identical unit replacement or institutional restitution.</li>
                <li><strong>Timely Return:</strong> Equipment must be surrendered on or before the indicated return date to maintain active borrowing privileges.</li>
              </ol>
            </div>
          </div>

          <div className="my-1 text-[8.5px] italic text-gray-700 font-semibold text-center">
            "I hereby certify that I have received the listed equipment in good order and bind myself to the terms of this loan agreement."
          </div>
        </div>

        {/* Bottom Section: Signatures & Footer */}
        <div>
          {/* Signatures Area */}
          <div className="flex justify-between items-end mt-2 pt-1 gap-3">
            <div className="flex-1 text-center">
              <div className="border-t border-gray-900 pt-0.5 font-black uppercase text-[9.5px] min-h-[14px]">
                {isBlank ? '' : request.borrowerName}
              </div>
              <div className="text-[7.5px] text-gray-500 uppercase font-bold tracking-tight">
                Signature over Printed Name of Borrower
              </div>
            </div>

            <div className="flex-1 text-center">
              <div className="border-t border-gray-900 pt-0.5 font-black uppercase text-[9.5px] min-h-[14px]">
                {labInCharge || 'Laboratory Custodian'}
              </div>
              <div className="text-[7.5px] text-gray-500 uppercase font-bold tracking-tight">
                Laboratory Custodian In-Charge
              </div>
            </div>

            <div className="flex-1 text-center">
              <div className="border-t border-gray-900 pt-0.5 font-black uppercase text-[9.5px] min-h-[14px]">
                &nbsp;
              </div>
              <div className="text-[7.5px] text-gray-500 uppercase font-bold tracking-tight">
                Surrendered & Verified Return Date
              </div>
            </div>

            {!isBlank && (
              <div className="text-center pl-1">
                <div className="p-0.5 border border-gray-300 rounded inline-block bg-white shadow-2xs">
                  <img src={qrUrl} alt="Tracking QR" className="w-7 h-7" />
                </div>
                <span className="block text-[6.5px] font-black text-gray-500 uppercase tracking-wider">
                  Verify
                </span>
              </div>
            )}
          </div>

          {/* Footer Note */}
          <div className="mt-2 pt-1 border-t border-gray-200 text-[7.5px] text-gray-400 flex justify-between items-center italic">
            <div>${appName || SYSTEM_NAME} • General Loan Agreement Template</div>
            <div>Format: ${formatSubText} • ${isBlank ? 'Blank Form Template' : `Ref: ${request.referenceCode}`}</div>
            <div>${paperFormat === 'dual_sheet' ? `${copyTag || 'Dual Slip'} • Page 1 of 1` : 'Single Page Slip • Page 1 of 1'}</div>
          </div>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200">
        
        {/* Modal Header with Clean Institutional Styling */}
        <div className="p-4 bg-white border-b border-gray-200 flex flex-wrap gap-3 justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-md">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight text-gray-900">General Loan Agreement Form</h3>
              <p className="text-[11px] text-gray-500 font-medium">
                {getFormatLabel(paperFormat)} • {isBlank ? 'Official Blank Form Template' : 'Filled Requisition Slip'}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Mode: Blank vs Filled */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-md border border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => setTemplateMode('blank')}
                className={`px-2.5 py-1 font-bold rounded transition-colors ${
                  isBlank 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Blank Form
              </button>
              <button
                type="button"
                onClick={() => setTemplateMode('populated')}
                className={`px-2.5 py-1 font-bold rounded transition-colors ${
                  !isBlank 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Filled Slip
              </button>
            </div>

            {/* Paper Format Selector */}
            <div className="flex items-center bg-gray-100 p-0.5 rounded-md border border-gray-200 text-xs">
              <button
                type="button"
                onClick={() => setPaperFormat('dual_sheet')}
                title="2 Slips on 1 Sheet (A4 or Letter) - Prints 2 copies filling both halves of a single bondpaper with a center cut guide line"
                className={`px-2.5 py-1 font-bold rounded transition-colors flex items-center gap-1.5 ${
                  paperFormat === 'dual_sheet' 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>2 Slips on 1 Sheet</span>
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('half_letter')}
                title="Half Letter Size (8.5 × 5.5 inches) - Standard DepEd Short Bondpaper cut horizontally"
                className={`px-2 py-1 font-bold rounded transition-colors ${
                  paperFormat === 'half_letter' 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Half Letter (8.5×5.5")
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('half_a4')}
                title="Half A4 Size / A5 (210 × 148 mm) - A4 Bondpaper cut horizontally"
                className={`px-2 py-1 font-bold rounded transition-colors ${
                  paperFormat === 'half_a4' 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Half A4 (A5)
              </button>
              <button
                type="button"
                onClick={() => setPaperFormat('full_portrait')}
                title="Full Page (A4 or Letter Portrait)"
                className={`px-2 py-1 font-bold rounded transition-colors ${
                  paperFormat === 'full_portrait' 
                    ? 'bg-white text-indigo-700 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Full Page
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-100/70 flex justify-center items-start">
          <div className={`w-full transition-all ${
            paperFormat === 'half_letter' 
              ? 'max-w-[216mm]' 
              : paperFormat === 'half_a4'
                ? 'max-w-[210mm]'
                : paperFormat === 'dual_sheet'
                  ? 'max-w-[216mm]'
                  : 'max-w-[210mm]'
          }`}>
            {paperFormat === 'dual_sheet' ? (
              <div className="space-y-2">
                {renderPreviewSlip('Borrower / Student Copy')}
                
                {/* Center Cutting Guide Line */}
                <div className="flex items-center justify-center gap-2 text-gray-500 font-mono text-[10px] my-1 select-none">
                  <div className="flex-1 border-t border-dashed border-gray-400"></div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-300 rounded shadow-2xs font-bold text-gray-700 uppercase tracking-wider text-[9px]">
                    <Scissors className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Cut along line / Gupitin dito (Half Sheet Divider)</span>
                  </div>
                  <div className="flex-1 border-t border-dashed border-gray-400"></div>
                </div>

                {renderPreviewSlip('Laboratory Custodian Copy')}
              </div>
            ) : (
              renderPreviewSlip()
            )}
          </div>
        </div>

        {/* Modal Action Bar */}
        <div className="p-3.5 bg-white border-t border-gray-200 flex justify-between items-center gap-3 flex-shrink-0">
          <div className="text-xs text-gray-500 hidden sm:block">
            {paperFormat === 'dual_sheet' && 'Prints 2 identical slips filling the top and bottom halves of a single A4 or Letter bondpaper.'}
            {paperFormat === 'half_letter' && 'Sized to fill 8.5" × 5.5" (Half Letter bondpaper).'}
            {paperFormat === 'half_a4' && 'Sized to fill 210 × 148 mm (Half A4 / A5 bondpaper).'}
            {paperFormat === 'full_portrait' && 'Full single sheet portrait format.'}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button 
              type="button"
              onClick={onClose} 
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 font-bold text-xs transition-all cursor-pointer"
            >
              Close
            </button>
            <button 
              type="button"
              onClick={handlePrint} 
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-bold text-xs transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" /> 
              <span>
                {paperFormat === 'dual_sheet' && `Print 2 Slips on 1 Sheet (${isBlank ? 'Blank' : 'Filled'})`}
                {paperFormat === 'half_letter' && `Print Half Letter Slip (${isBlank ? 'Blank' : 'Filled'})`}
                {paperFormat === 'half_a4' && `Print Half A4 Slip (${isBlank ? 'Blank' : 'Filled'})`}
                {paperFormat === 'full_portrait' && `Print Full Page Slip (${isBlank ? 'Blank' : 'Filled'})`}
              </span>
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

export default BorrowerAgreementModal;
