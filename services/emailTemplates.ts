// Email templates for I-LEMS (Integrated Laboratory Equipment Management System)
// Professional, accessible, light institutional styling with school logo branding.

const DEFAULT_SCHOOL_LOGO = 'https://lab.leonnhs.edu.ph/img/leon-nhs-seal.png';

export const renderEmailHeader = ({
  logoUrl,
  appName,
  categoryTitle,
  mainTitle,
  subtitle,
  accentColor = '#2563eb'
}: {
  logoUrl?: string;
  appName: string;
  categoryTitle?: string;
  mainTitle: string;
  subtitle?: string;
  accentColor?: string;
}) => {
  const resolvedLogo = logoUrl && !logoUrl.startsWith('data:') ? logoUrl : DEFAULT_SCHOOL_LOGO;

  return `
    <div style="background-color: #ffffff; border-bottom: 2px solid #e2e8f0; border-top: 4px solid ${accentColor}; padding: 26px 20px 20px; text-align: center;">
      <div style="margin-bottom: 12px; text-align: center;">
        <img src="${resolvedLogo}" alt="${appName} Logo" style="height: 60px; width: auto; max-width: 140px; display: inline-block; object-fit: contain; margin: 0 auto; border: 0;" />
      </div>
      <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px;">
        ${appName}
      </div>
      ${categoryTitle ? `<div style="font-size: 9.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;">${categoryTitle}</div>` : ''}
      <h1 style="margin: 0; font-size: 21px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; line-height: 1.25;">
        ${mainTitle}
      </h1>
      ${subtitle ? `<p style="margin: 5px 0 0; font-size: 12.5px; color: #64748b; font-weight: 500;">${subtitle}</p>` : ''}
    </div>
  `;
};

const renderEmailFooter = (appName: string) => `
  <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 18px 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.5;">
    <div>Sent automatically by <strong>${appName}</strong></div>
    <div>Leon National High School • Science Laboratory Management</div>
  </div>
`;

/**
 * 1. Admin Notification: New Borrow Request
 */
export const getBorrowRequestTemplate = (data: {
  borrowerName: string;
  borrowerId: string;
  referenceCode: string;
  returnDate: string;
  items: { name: string; qty: number }[];
  appName: string;
  logoUrl?: string;
}) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Borrow Request</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px 12px; color: #334155;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
    ${renderEmailHeader({
      logoUrl: data.logoUrl,
      appName: data.appName,
      categoryTitle: 'Laboratory Equipment Requisition',
      mainTitle: 'New Equipment Borrow Request',
      subtitle: 'A new borrow request requires custodian review and approval.',
      accentColor: '#4f46e5'
    })}
    <div style="padding: 26px 24px;">
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px; margin-bottom: 22px; text-align: center;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #1e40af; letter-spacing: 0.08em;">Request Reference Code</div>
        <div style="font-size: 24px; font-weight: 800; color: #1e3a8a; margin-top: 4px; font-family: monospace;">${data.referenceCode}</div>
      </div>

      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 22px; background-color: #f8fafc;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Borrower Name:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #0f172a;">${data.borrowerName}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">ID / Grade & Section:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #0f172a;">${data.borrowerId}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Date Requested:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #0f172a;">${new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Required Return Date:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 800; color: #991b1b;">${data.returnDate}</td>
          </tr>
        </table>
      </div>

      <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #475569; letter-spacing: 0.05em; margin-bottom: 8px;">
        Requested Equipment (${data.items.length} ${data.items.length === 1 ? 'item' : 'items'})
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700;">Item Description</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; width: 60px;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((i, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfd'}; border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 14px; font-weight: 600; color: #1e293b;">${i.name}</td>
              <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #2563eb;">${i.qty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.4;">
        Please log in to the administrator portal to review and manage this request.
      </p>
    </div>
    ${renderEmailFooter(data.appName)}
  </div>
</body>
</html>
`;

/**
 * 2. Requester Confirmation Copy
 */
export const getRequestCopyTemplate = (data: {
  borrowerName: string;
  borrowerId: string;
  referenceCode: string;
  returnDate: string;
  items: { name: string; qty: number }[];
  appName: string;
  reservationDate?: string;
  reservationSlot?: string;
  logoUrl?: string;
}) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Request Copy</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px 12px; color: #334155;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
    ${renderEmailHeader({
      logoUrl: data.logoUrl,
      appName: data.appName,
      categoryTitle: 'Requester Official Copy',
      mainTitle: 'Borrow Request Submitted',
      subtitle: 'Your request has been successfully queued for approval.',
      accentColor: '#2563eb'
    })}
    <div style="padding: 26px 24px;">
      <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.5;">
        Dear <strong>${data.borrowerName}</strong>,
      </p>
      <p style="margin: 0 0 20px; font-size: 13.5px; color: #475569; line-height: 1.5;">
        This serves as your official copy of the laboratory equipment utilization request submitted to the Science Laboratory.
      </p>

      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px; margin-bottom: 22px; text-align: center;">
        <div style="font-size: 10px; font-weight: 800; color: #1e40af; text-transform: uppercase; letter-spacing: 0.08em;">Tracking Reference Code</div>
        <div style="font-family: monospace; font-size: 24px; font-weight: 800; color: #1e3a8a; margin-top: 4px;">${data.referenceCode}</div>
      </div>

      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 22px; background-color: #f8fafc;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">ID / Grade & Section:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #0f172a;">${data.borrowerId}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Required Return Date:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 800; color: #991b1b;">${data.returnDate}</td>
          </tr>
          ${data.reservationDate ? `
            <tr>
              <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Lab Reservation:</td>
              <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #0f172a;">${data.reservationDate}${data.reservationSlot ? ` (${data.reservationSlot})` : ''}</td>
            </tr>
          ` : ''}
        </table>
      </div>

      <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
        Requested Equipment
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 20px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
            <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700;">Item</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; color: #475569; font-weight: 700; width: 60px;">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((item, idx) => `
            <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#fcfcfd'}; border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 10px 14px; color: #1e293b; font-weight: 600;">${item.name}</td>
              <td style="padding: 10px 14px; text-align: right; font-weight: 800; color: #2563eb;">x${item.qty}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <p style="font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.4;">
        Please save this email. You can present this tracking reference code at the laboratory counter to claim your equipment once approved.
      </p>
    </div>
    ${renderEmailFooter(data.appName)}
  </div>
</body>
</html>
`;

/**
 * 3. Password Reset Template
 */
export const getPasswordResetTemplate = (data: {
  code: string;
  appName: string;
  logoUrl?: string;
}) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Password Reset</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px 12px; color: #334155;">
  <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
    ${renderEmailHeader({
      logoUrl: data.logoUrl,
      appName: data.appName,
      categoryTitle: 'Account Security Verification',
      mainTitle: 'Password Reset Code',
      subtitle: 'Use the verification code below to reset your portal password.',
      accentColor: '#3b82f6'
    })}
    <div style="padding: 28px 24px; text-align: center;">
      <p style="font-size: 14px; color: #475569; margin: 0 0 20px; line-height: 1.5;">
        A password reset request was initiated for your account. Enter the verification code below to complete the process:
      </p>

      <div style="font-family: monospace; font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #1e3a8a; background-color: #f8fafc; padding: 18px 24px; border-radius: 6px; border: 1.5px dashed #cbd5e1; display: inline-block; margin-bottom: 22px;">
        ${data.code}
      </div>

      <p style="font-size: 12.5px; color: #94a3b8; margin: 0; line-height: 1.4;">
        If you did not request this password reset, you can safely ignore this email. Your credentials will remain unchanged.
      </p>
    </div>
    ${renderEmailFooter(data.appName)}
  </div>
</body>
</html>
`;

/**
 * 4. Overdue Notice Template
 */
export const getOverdueNoticeTemplate = (data: {
  borrowerName: string;
  dueDate: string;
  items: { name: string; qty: number }[];
  appName: string;
  logoUrl?: string;
}) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Overdue Notice</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #fef2f2; margin: 0; padding: 24px 12px; color: #334155;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #fecdd3; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
    ${renderEmailHeader({
      logoUrl: data.logoUrl,
      appName: data.appName,
      categoryTitle: 'Laboratory Accountability Notice',
      mainTitle: 'Overdue Equipment Notice',
      subtitle: 'Immediate return required for overdue laboratory apparatus.',
      accentColor: '#dc2626'
    })}
    <div style="padding: 26px 24px;">
      <p style="margin: 0 0 14px; font-size: 14px;">
        Dear <strong>${data.borrowerName}</strong>,
      </p>
      <p style="margin: 0 0 18px; font-size: 13.5px; color: #475569; line-height: 1.5;">
        This is an official advisory from the Science Laboratory Custodian. The equipment listed below is past its required return date:
      </p>

      <div style="background-color: #fff1f2; border: 1px solid #fecdd3; border-radius: 6px; padding: 12px; margin-bottom: 20px; text-align: center; color: #991b1b; font-weight: 700; font-size: 13.5px;">
        SCHEDULED DUE DATE: ${data.dueDate}
      </div>

      <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
        Unreturned Equipment
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px;">
        ${data.items.map(i => `
          <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
            <span style="font-weight: 600; color: #1e293b;">${i.name}</span>
            <span style="font-weight: 800; color: #dc2626;">x${i.qty}</span>
          </div>
        `).join('')}
      </div>

      <p style="font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.4;">
        Please return the equipment to the laboratory custodian immediately to avoid utilization penalties. If you have already surrendered the items, please coordinate with the custodian to verify your clearance.
      </p>
    </div>
    ${renderEmailFooter(data.appName)}
  </div>
</body>
</html>
`;

/**
 * 5. User Status Update (Approved, Released, Rejected, Returned)
 */
export const getUserStatusUpdateTemplate = (data: {
  borrowerName: string;
  referenceCode: string;
  status: 'Approved' | 'Released' | 'Rejected' | 'Returned';
  returnDate: string;
  appName: string;
  items: { name: string; qty: number }[];
  logoUrl?: string;
}) => {
  let title = 'Request Update';
  let message = `Your request ${data.referenceCode} has been updated.`;
  let accentColor = '#2563eb';

  switch (data.status) {
    case 'Approved':
      title = 'Request Approved';
      message = 'Your borrow request has been approved. Please proceed to the laboratory counter with your ID to collect your equipment.';
      accentColor = '#059669';
      break;
    case 'Released':
      title = 'Equipment Released';
      message = 'Your equipment has been officially released to you. Please ensure all items are handled safely and returned on or before the due date.';
      accentColor = '#4f46e5';
      break;
    case 'Rejected':
      title = 'Request Disapproved';
      message = 'Your borrow request has been declined. Please coordinate directly with the laboratory administrator or your instructor for details.';
      accentColor = '#dc2626';
      break;
    case 'Returned':
      title = 'Equipment Returned & Cleared';
      message = 'Thank you! The returned equipment has been verified by the laboratory custodian. Your account is clear.';
      accentColor = '#0d9488';
      break;
  }

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 24px 12px; color: #334155;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">
    ${renderEmailHeader({
      logoUrl: data.logoUrl,
      appName: data.appName,
      categoryTitle: 'Utilization Status Update',
      mainTitle: title,
      subtitle: `Reference Slip: ${data.referenceCode}`,
      accentColor
    })}
    <div style="padding: 26px 24px;">
      <p style="margin: 0 0 14px; font-size: 14px;">
        Dear <strong>${data.borrowerName}</strong>,
      </p>
      <p style="margin: 0 0 20px; font-size: 13.5px; color: #475569; line-height: 1.5;">
        ${message}
      </p>

      <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 20px; background-color: #f8fafc;">
        <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Reference Code:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 800; font-family: monospace; color: #0f172a;">${data.referenceCode}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Current Status:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 800; color: ${accentColor};">${data.status}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; color: #64748b; font-weight: 600;">Required Return:</td>
            <td style="padding: 5px 0; text-align: right; font-weight: 700; color: #991b1b;">${data.returnDate}</td>
          </tr>
        </table>
      </div>

      <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
        Items Involved
      </div>
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; margin-bottom: 20px;">
        ${data.items.map(i => `
          <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
            <span style="font-weight: 600; color: #1e293b;">${i.name}</span>
            <span style="font-weight: 800; color: #2563eb;">x${i.qty}</span>
          </div>
        `).join('')}
      </div>

      <p style="font-size: 12.5px; color: #64748b; margin: 0; line-height: 1.4;">
        For questions or clarifications, please coordinate with the Science Laboratory staff.
      </p>
    </div>
    ${renderEmailFooter(data.appName)}
  </div>
</body>
</html>
  `;
};
