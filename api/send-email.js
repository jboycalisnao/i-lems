const nodemailer = require('nodemailer');

const SYSTEM_SHORT_NAME = 'I-LEMS';

function cleanValue(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().replace(/^["']|["']$/g, '');
}

function cleanPassword(raw) {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().replace(/^["']|["']$/g, '').replace(/\s/g, '');
}

function getEnv(env, key, fallback = '') {
  if (!env || typeof env !== 'object') return fallback;
  return cleanValue(env[key] ?? env[`VITE_${key}`]) || fallback;
}

function getConfig(env) {
  const host = getEnv(env, 'SMTP_HOST', 'smtp.gmail.com');
  const port = Number(getEnv(env, 'SMTP_PORT', '465')) || 465;
  const security = (getEnv(env, 'SMTP_SECURITY', port === 465 ? 'tls' : 'starttls')).toLowerCase();
  const user = getEnv(env, 'SMTP_USER');
  const password = cleanPassword(env?.SMTP_PASSWORD ?? env?.VITE_SMTP_PASSWORD);
  const fromEmail = getEnv(env, 'SMTP_FROM_EMAIL', user);
  const fromName = getEnv(env, 'SMTP_FROM_NAME', SYSTEM_SHORT_NAME);

  if (!user || !password || !fromEmail) {
    throw new Error('SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_EMAIL must be configured on the server.');
  }

  return { host, port, security, user, password, fromEmail, fromName };
}

function createTransport(env) {
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
}

function getPublicSmtpConfig(env) {
  const host = getEnv(env, 'SMTP_HOST', 'smtp.gmail.com');
  const port = Number(getEnv(env, 'SMTP_PORT', '465')) || 465;
  const security = (getEnv(env, 'SMTP_SECURITY', port === 465 ? 'TLS' : 'STARTTLS')).toUpperCase();
  const user = getEnv(env, 'SMTP_USER');
  const password = cleanPassword(env?.SMTP_PASSWORD ?? env?.VITE_SMTP_PASSWORD);
  const fromEmail = getEnv(env, 'SMTP_FROM_EMAIL', user);
  const fromName = getEnv(env, 'SMTP_FROM_NAME', SYSTEM_SHORT_NAME);

  const missing = [];
  if (!user) missing.push('SMTP_USER');
  if (!password) missing.push('SMTP_PASSWORD');
  if (!fromEmail) missing.push('SMTP_FROM_EMAIL');

  return {
    configured: Boolean(user && password && fromEmail),
    host,
    port,
    security,
    username: user,
    fromName,
    fromEmail,
    hasPassword: Boolean(password),
    missing
  };
}

async function verifySmtpConnection(env) {
  const { transporter } = createTransport(env);
  await transporter.verify();
}

async function sendSmtpEmail(payload, env) {
  if (!payload.to_email?.trim() || !payload.subject?.trim() || !payload.body?.trim()) {
    throw new Error('Recipient, subject, and message body are required.');
  }

  if (payload.subject.length > 250 || payload.body.length > 50000 || (payload.html_body?.length || 0) > 200000) {
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
}

async function readBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    if (typeof req.body === 'object') return req.body;
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || '{}');
}

function sendJson(res, status, data) {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  if (res && typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  if (res && typeof res.end === 'function') {
    res.statusCode = status;
    return res.end(JSON.stringify(data));
  }
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const config = getPublicSmtpConfig(process.env);
      return sendJson(res, 200, config);
    }

    if (req.method !== 'POST') {
      if (res && typeof res.setHeader === 'function') res.setHeader('Allow', 'GET, POST');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const body = await readBody(req);
    if (body.action === 'verify') {
      await verifySmtpConnection(process.env);
    } else {
      await sendSmtpEmail(body, process.env);
    }
    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error('SMTP handler error:', error);
    return sendJson(res, 500, {
      error: error && error.message ? error.message : 'SMTP request failed'
    });
  }
}

module.exports = handler;
module.exports.default = handler;
module.exports.getPublicSmtpConfig = getPublicSmtpConfig;
module.exports.verifySmtpConnection = verifySmtpConnection;
module.exports.sendSmtpEmail = sendSmtpEmail;
module.exports.SYSTEM_SHORT_NAME = SYSTEM_SHORT_NAME;
