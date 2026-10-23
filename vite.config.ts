
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import dns from 'node:dns';
if (typeof dns?.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {}
}
import { getPublicSmtpConfig, sendSmtpEmail, verifySmtpConnection, type SmtpEmailPayload } from './server/smtp';
import { ddownloadHandler } from './server/ddownload';

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

    server.middlewares.use('/api/ddownload', async (request, response) => {
      try {
        await ddownloadHandler(request, response);
      } catch (error) {
        if (!response.headersSent) {
          response.setHeader('Content-Type', 'application/json');
          response.statusCode = 200;
          response.end(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'DDownload server request failed'
          }));
        }
      }
    });
  }
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), smtpDevelopmentApi(env)],
    cacheDir: join(tmpdir(), 'ilems-vite-cache'),
    envPrefix: ['VITE_', 'SUPABASE_'],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || env.SUPABASE_URL || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '')
    },
    server: {
      host: '0.0.0.0',
      port: 3000
    }
  };
});
