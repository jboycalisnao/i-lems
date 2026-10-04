export const SYSTEM_SHORT_NAME = 'I-LEMS';

export interface SmtpEmailPayload {
  to_email: string;
  subject: string;
  body: string;
  html_body?: string;
  action?: string;
}

export type Environment = Record<string, string | undefined>;

const cleanValue = (raw?: unknown) => {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().replace(/^["']|["']$/g, '');
};

const cleanPassword = (raw?: unknown) => {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim().replace(/^["']|["']$/g, '').replace(/\s/g, '');
};

const getEnv = (env: Environment, key: string, fallback = '') => {
  if (!env || typeof env !== 'object') return fallback;
  return cleanValue(env[key] ?? env[`VITE_${key}`]) || fallback;
};

export const getConfig = (env: Environment) => {
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
};

export const createTransport = async (env: Environment) => {
  const config = getConfig(env);
  const secure = config.security === 'tls' || config.port === 465;

  const mailerModule = await import('nodemailer');
  const createTransportFn =
    (mailerModule as any).createTransport ||
    (mailerModule as any).default?.createTransport ||
    (mailerModule as any).default;

  if (typeof createTransportFn !== 'function') {
    throw new Error('nodemailer transport engine is unavailable');
  }

  return {
    config,
    transporter: createTransportFn({
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
  const host = getEnv(env, 'SMTP_HOST', 'smtp.gmail.com');
  const port = Number(getEnv(env, 'SMTP_PORT', '465')) || 465;
  const security = (getEnv(env, 'SMTP_SECURITY', port === 465 ? 'TLS' : 'STARTTLS')).toUpperCase();
  const user = getEnv(env, 'SMTP_USER');
  const password = cleanPassword(env?.SMTP_PASSWORD ?? env?.VITE_SMTP_PASSWORD);
  const fromEmail = getEnv(env, 'SMTP_FROM_EMAIL', user);
  const fromName = getEnv(env, 'SMTP_FROM_NAME', SYSTEM_SHORT_NAME);

  const missing: string[] = [];
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
};

export const verifySmtpConnection = async (env: Environment) => {
  const { transporter } = await createTransport(env);
  await transporter.verify();
};

export const sendSmtpEmail = async (payload: SmtpEmailPayload, env: Environment) => {
  if (!payload.to_email?.trim() || !payload.subject?.trim() || !payload.body?.trim()) {
    throw new Error('Recipient, subject, and message body are required.');
  }

  if (payload.subject.length > 250 || payload.body.length > 50_000 || (payload.html_body?.length || 0) > 200_000) {
    throw new Error('Email payload exceeds the allowed size.');
  }

  const { config, transporter } = await createTransport(env);
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

const parseRequestBody = async (request: any): Promise<Record<string, unknown>> => {
  if (!request) return {};

  if (typeof request.json === 'function') {
    try {
      const data = await request.json();
      if (data && typeof data === 'object') return data;
    } catch {}
  }

  if (request.body) {
    if (typeof request.body === 'string') {
      try {
        return JSON.parse(request.body);
      } catch {
        return {};
      }
    }
    if (typeof request.body === 'object') {
      return request.body;
    }
  }

  try {
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 300_000) throw new Error('Request body too large.');
    }
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
};

const sendUniversalResponse = (response: any, status: number, data: object): Response | void => {
  if (response && typeof response.setHeader === 'function') {
    try {
      if (typeof response.status === 'function' && typeof response.json === 'function') {
        response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        response.status(status).json(data);
        return;
      }
    } catch {}

    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.end(JSON.stringify(data));
    return;
  }

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
    }
  });
};

export async function GET(request: any, response?: any) {
  try {
    const config = getPublicSmtpConfig(process.env);
    return sendUniversalResponse(response, 200, config);
  } catch (error) {
    console.error('SMTP GET failed:', error);
    return sendUniversalResponse(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to retrieve SMTP configuration'
    });
  }
}

export async function POST(request: any, response?: any) {
  try {
    const body = await parseRequestBody(request);
    if (body.action === 'verify') {
      await verifySmtpConnection(process.env);
    } else {
      await sendSmtpEmail(body as unknown as SmtpEmailPayload, process.env);
    }
    return sendUniversalResponse(response, 200, { success: true });
  } catch (error) {
    console.error('SMTP POST failed:', error);
    return sendUniversalResponse(response, 500, {
      error: error instanceof Error ? error.message : 'SMTP operation failed'
    });
  }
}

export default async function handler(request: any, response?: any) {
  const method = (request?.method || 'GET').toUpperCase();
  if (method === 'GET') {
    return GET(request, response);
  }
  if (method === 'POST') {
    return POST(request, response);
  }
  return sendUniversalResponse(response, 405, { error: 'Method not allowed' });
}
