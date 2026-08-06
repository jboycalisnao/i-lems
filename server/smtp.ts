import nodemailer from 'nodemailer';
import { SYSTEM_SHORT_NAME } from '../branding';

export interface SmtpEmailPayload {
  to_email: string;
  subject: string;
  body: string;
  html_body?: string;
}

type Environment = Record<string, string | undefined>;

const getConfig = (env: Environment) => {
  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(env.SMTP_PORT || 465);
  const security = (env.SMTP_SECURITY || (port === 465 ? 'tls' : 'starttls')).toLowerCase();
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD?.replace(/\s/g, '');
  const fromEmail = env.SMTP_FROM_EMAIL?.trim() || user;
  const fromName = env.SMTP_FROM_NAME?.trim() || SYSTEM_SHORT_NAME;

  if (!user || !password || !fromEmail) {
    throw new Error('SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_EMAIL must be configured on the server.');
  }

  return { host, port, security, user, password, fromEmail, fromName };
};

const createTransport = (env: Environment) => {
  const config = getConfig(env);
  const secure = config.security === 'tls' || config.port === 465;

  return {
    config,
    transporter: nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure,
      requireTLS: config.security === 'starttls',
      auth: {
        user: config.user,
        pass: config.password
      }
    })
  };
};

export const getPublicSmtpConfig = (env: Environment) => {
  const host = env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(env.SMTP_PORT || 465);
  const security = (env.SMTP_SECURITY || (port === 465 ? 'TLS' : 'STARTTLS')).toUpperCase();
  const user = env.SMTP_USER?.trim() || '';
  const fromEmail = env.SMTP_FROM_EMAIL?.trim() || user;
  const fromName = env.SMTP_FROM_NAME?.trim() || SYSTEM_SHORT_NAME;

  return {
    configured: Boolean(user && env.SMTP_PASSWORD && fromEmail),
    host,
    port,
    security,
    username: user,
    fromName,
    fromEmail
  };
};

export const verifySmtpConnection = async (env: Environment) => {
  const { transporter } = createTransport(env);
  await transporter.verify();
};

export const sendSmtpEmail = async (payload: SmtpEmailPayload, env: Environment) => {
  if (!payload.to_email?.trim() || !payload.subject?.trim() || !payload.body?.trim()) {
    throw new Error('Recipient, subject, and message body are required.');
  }

  if (payload.subject.length > 250 || payload.body.length > 50_000 || (payload.html_body?.length || 0) > 200_000) {
    throw new Error('Email payload exceeds the allowed size.');
  }

  const { config, transporter } = createTransport(env);
  await transporter.sendMail({
    from: {
      name: config.fromName,
      address: config.fromEmail
    },
    to: payload.to_email,
    subject: payload.subject,
    text: payload.body,
    html: payload.html_body
  });
};
