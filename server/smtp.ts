export interface SmtpEmailPayload {
  to_email: string;
  subject: string;
  body: string;
  html_body?: string;
  action?: string;
}

export type Environment = Record<string, string | undefined>;

const api = require('../api/send-email.js');

export const getPublicSmtpConfig = api.getPublicSmtpConfig;
export const verifySmtpConnection = api.verifySmtpConnection;
export const sendSmtpEmail = api.sendSmtpEmail;
export const SYSTEM_SHORT_NAME = api.SYSTEM_SHORT_NAME;
export default api;
