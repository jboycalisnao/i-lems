
import { AppSettings, BorrowRequest, BorrowRecord } from '../types';
import { getBorrowRequestTemplate, getRequestCopyTemplate, getUserStatusUpdateTemplate, getOverdueNoticeTemplate } from './emailTemplates';

/**
 * Sends an email notification through the server-side SMTP endpoint.
 */
export const sendEmail = async (settings: AppSettings, payload: {
    to_email: string;
    subject: string;
    body: string;
    html_body?: string;
}) => {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const result = await response.json().catch(() => ({}));
            throw new Error(result.error || 'SMTP server rejected the request.');
        }
        return true;
    } catch (e) {
        console.error("Failed to send notification:", e);
        return false;
    }
};

/**
 * Notifies admins of a new incoming borrow request.
 */
export const notifyAdminsOfNewRequest = async (settings: AppSettings, request: BorrowRequest) => {
    if (!settings.notificationEmails) return;

    const htmlBody = getBorrowRequestTemplate({
        borrowerName: request.borrowerName,
        borrowerId: request.borrowerId,
        referenceCode: request.referenceCode,
        returnDate: request.returnDate,
        items: request.items.map(i => ({ name: i.itemName, qty: i.quantity })),
        appName: settings.appName
    });

    return sendEmail(settings, {
        to_email: settings.notificationEmails,
        subject: `New Lab Request: ${request.referenceCode} - ${request.borrowerName}`,
        body: `A new request has been submitted by ${request.borrowerName}. Ref: ${request.referenceCode}`,
        html_body: htmlBody
    });
};

/**
 * Sends the requester a copy immediately after a successful submission.
 */
export const notifyBorrowerOfRequestCopy = async (settings: AppSettings, request: BorrowRequest) => {
    if (!request.borrowerEmail) return false;

    const htmlBody = getRequestCopyTemplate({
        borrowerName: request.borrowerName,
        borrowerId: request.borrowerId,
        referenceCode: request.referenceCode,
        returnDate: request.returnDate,
        items: request.items.map(item => ({ name: item.itemName, qty: item.quantity })),
        appName: settings.appName,
        reservationDate: request.reservationDate,
        reservationSlot: request.reservationSlot
    });

    return sendEmail(settings, {
        to_email: request.borrowerEmail,
        subject: `Request Copy: ${request.referenceCode} - ${settings.appName}`,
        body: `Your request ${request.referenceCode} was submitted successfully and is awaiting approval.`,
        html_body: htmlBody
    });
};

/**
 * Notifies a borrower of a status change (Approved, Released, Rejected).
 */
export const notifyBorrowerOfStatusChange = async (settings: AppSettings, request: BorrowRequest, status: 'Approved' | 'Released' | 'Rejected' | 'Returned') => {
    if (!request.borrowerEmail) return;

    const htmlBody = getUserStatusUpdateTemplate({
        borrowerName: request.borrowerName,
        referenceCode: request.referenceCode,
        status,
        returnDate: request.returnDate,
        appName: settings.appName,
        items: request.items.map(i => ({ name: i.itemName, qty: i.quantity }))
    });

    return sendEmail(settings, {
        to_email: request.borrowerEmail,
        subject: `Request ${status}: ${request.referenceCode} - ${settings.appName}`,
        body: `Your lab request status is now: ${status}.`,
        html_body: htmlBody
    });
};

/**
 * Notifies a borrower that their equipment is overdue.
 */
export const notifyBorrowerOfOverdue = async (settings: AppSettings, record: BorrowRecord) => {
    if (!record.borrowerEmail) return;

    const htmlBody = getOverdueNoticeTemplate({
        borrowerName: record.borrowerName,
        dueDate: record.dueDate,
        items: [{ name: record.itemName, qty: record.quantity }],
        appName: settings.appName
    });

    return sendEmail(settings, {
        to_email: record.borrowerEmail,
        subject: `OVERDUE EQUIPMENT: ${record.itemName} - ${settings.appName}`,
        body: `Urgent: Your borrowed equipment is past its due date (${record.dueDate}). Please return it immediately.`,
        html_body: htmlBody
    });
};
