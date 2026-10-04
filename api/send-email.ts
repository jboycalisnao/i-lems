import type { IncomingMessage, ServerResponse } from 'node:http';
import { getPublicSmtpConfig, sendSmtpEmail, verifySmtpConnection, type SmtpEmailPayload } from '../server/smtp';

interface ApiRequest extends IncomingMessage {
  body?: unknown;
}

const readBody = async (request: ApiRequest) => {
  if (request.body) {
    if (typeof request.body === 'string') {
      try {
        return JSON.parse(request.body) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    if (typeof request.body === 'object') {
      return request.body as Record<string, unknown>;
    }
  }

  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 300_000) throw new Error('Request body is too large.');
  }
  return JSON.parse(raw || '{}') as Record<string, unknown>;
};

const sendJson = (response: ServerResponse, status: number, data: object) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.end(JSON.stringify(data));
};

export default async function handler(request: ApiRequest, response: ServerResponse) {
  if (request.method === 'GET') {
    sendJson(response, 200, getPublicSmtpConfig(process.env));
    return;
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  try {
    const body = await readBody(request);
    if (body.action === 'verify') {
      await verifySmtpConnection(process.env);
    } else {
      await sendSmtpEmail(body as unknown as SmtpEmailPayload, process.env);
    }
    sendJson(response, 200, { success: true });
  } catch (error) {
    console.error('SMTP request failed:', error);
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'SMTP request failed.' });
  }
}
