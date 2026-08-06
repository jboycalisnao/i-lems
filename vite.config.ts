
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getPublicSmtpConfig, sendSmtpEmail, verifySmtpConnection, type SmtpEmailPayload } from './server/smtp';

const smtpDevelopmentApi = (env: Record<string, string>) => ({
  name: 'smtp-development-api',
  configureServer(server: { middlewares: { use: (path: string, handler: (request: IncomingMessage, response: ServerResponse) => void) => void } }) {
    server.middlewares.use('/api/send-email', async (request, response) => {
      response.setHeader('Content-Type', 'application/json');

      if (request.method === 'GET') {
        response.end(JSON.stringify(getPublicSmtpConfig(env)));
        return;
      }

      if (request.method !== 'POST') {
        response.statusCode = 405;
        response.end(JSON.stringify({ error: 'Method not allowed.' }));
        return;
      }

      try {
        let raw = '';
        for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw || '{}') as SmtpEmailPayload & { action?: string };
        if (body.action === 'verify') await verifySmtpConnection(env);
        else await sendSmtpEmail(body, env);
        response.end(JSON.stringify({ success: true }));
      } catch (error) {
        response.statusCode = 500;
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'SMTP request failed.' }));
      }
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), smtpDevelopmentApi(env)],
    cacheDir: join(tmpdir(), 'ilems-vite-cache'),
    server: {
      host: '0.0.0.0',
      port: 3000
    }
  };
});
