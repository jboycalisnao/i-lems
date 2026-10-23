// Serverless / Node HTTP handler for DDownload Cloud Storage API
// Documentation: https://ddownload.com/api

const dns = require('node:dns');
if (dns && typeof dns.setDefaultResultOrder === 'function') {
  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {}
}

const DDOWNLOAD_API_BASE = 'https://api-v2.ddownload.com/api';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};

function cleanValue(raw) {
  if (raw === undefined || raw === null) return '';
  let str = String(raw).trim().replace(/^["']|["']$/g, '');
  // If the user copied and pasted the entire URL from DDownload dashboard:
  // e.g. https://api-v2.ddownload.com/api/account/info?key=507988y2akd8lwsiu54m5e
  const match = str.match(/[?&]key=([a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return str;
}

function getApiKey(rawKey, env = process.env) {
  const key = cleanValue(rawKey) || cleanValue(env.DDOWNLOAD_API_KEY) || cleanValue(env.VITE_DDOWNLOAD_API_KEY);
  return key;
}

function sendJson(res, status, data) {
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DDownload-Key');
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

async function getAccountInfo(apiKey) {
  if (!apiKey) {
    return { success: false, error: 'DDownload API key is required. Please configure it in Settings.' };
  }
  try {
    const url = `${DDOWNLOAD_API_BASE}/account/info?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, { headers: DEFAULT_HEADERS });
    const data = await resp.json();
    if (data.status !== 200) {
      if (data.msg === 'Wrong auth' || data.status === 403) {
        return {
          success: false,
          error: 'DDownload returned "Wrong auth" (Status 403). Please click the blue "Regenerate Key" button on your DDownload account dashboard and confirm your account email.'
        };
      }
      return { success: false, error: data.msg || `DDownload API response: status ${data.status}` };
    }
    return { success: true, result: data.result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to reach DDownload server.' };
  }
}

async function getUploadServer(apiKey) {
  if (!apiKey) {
    return { success: false, error: 'DDownload API key is required.' };
  }
  try {
    const url = `${DDOWNLOAD_API_BASE}/upload/server?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url, { headers: DEFAULT_HEADERS });
    const data = await resp.json();
    if (data.status !== 200) {
      return { success: false, error: data.msg || `Failed to fetch upload server (status ${data.status})` };
    }
    return {
      success: true,
      result: {
        uploadUrl: data.result,
        sessId: data.sess_id
      }
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not contact DDownload upload server.' };
  }
}

async function getFileInfo(apiKey, fileCode) {
  if (!apiKey) {
    return { success: false, error: 'DDownload API key is required.' };
  }
  if (!fileCode) {
    return { success: false, error: 'File code is required.' };
  }
  try {
    const url = `${DDOWNLOAD_API_BASE}/file/info?key=${encodeURIComponent(apiKey)}&file_code=${encodeURIComponent(fileCode)}`;
    const resp = await fetch(url, { headers: DEFAULT_HEADERS });
    const data = await resp.json();
    if (data.status !== 200) {
      return { success: false, error: data.msg || `Failed to inspect file (status ${data.status})` };
    }
    const info = Array.isArray(data.result) ? data.result[0] : data.result;
    return { success: true, result: info };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not retrieve file information.' };
  }
}

async function uploadFileToDDownload(apiKey, fileBlob, fileName) {
  if (!apiKey) {
    return { success: false, error: 'DDownload API key is required for upload.' };
  }
  if (!fileBlob) {
    return { success: false, error: 'No file provided for upload.' };
  }

  // Step 1: Obtain upload server and session ID
  const serverRes = await getUploadServer(apiKey);
  if (!serverRes.success || !serverRes.result?.uploadUrl || !serverRes.result?.sessId) {
    return { success: false, error: serverRes.error || 'Could not retrieve DDownload upload target.' };
  }

  const { uploadUrl, sessId } = serverRes.result;

  // Step 2: Build multipart payload for DDownload
  const outgoingFormData = new FormData();
  outgoingFormData.append('sess_id', sessId);
  outgoingFormData.append('file', fileBlob, fileName || 'document');

  // Step 3: POST to the assigned upload server
  try {
    const uploadResp = await fetch(uploadUrl, {
      method: 'POST',
      body: outgoingFormData,
      headers: {
        'User-Agent': DEFAULT_HEADERS['User-Agent']
      }
    });

    const rawText = await uploadResp.text();
    let uploadResult;
    try {
      uploadResult = JSON.parse(rawText);
    } catch (err) {
      return { success: false, error: `Upload server returned non-JSON response: ${rawText.slice(0, 150)}` };
    }

    const fileEntry = Array.isArray(uploadResult) ? uploadResult[0] : uploadResult;
    if (!fileEntry || (!fileEntry.file_code && !fileEntry.filecode)) {
      return { success: false, error: `Upload failed: ${rawText}` };
    }

    const fileCode = fileEntry.file_code || fileEntry.filecode;
    const status = fileEntry.file_status || fileEntry.filestatus || 'OK';

    return {
      success: true,
      file: {
        fileCode,
        status,
        name: fileName || fileEntry.file_name || 'file',
        size: fileBlob.size || Number(fileEntry.file_size) || 0,
        downloadUrl: `https://ddownload.com/${fileCode}`
      }
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error transferring file to DDownload storage.' };
  }
}

async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    if (res && typeof res.setHeader === 'function') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-DDownload-Key');
    }
    if (res && typeof res.status === 'function') return res.status(204).end();
    if (res && typeof res.end === 'function') {
      res.statusCode = 204;
      return res.end();
    }
    return;
  }

  try {
    const rawUrl = req.url || '/';
    const normalizedUrl = rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl;
    const parsedUrl = new URL(normalizedUrl, 'http://localhost');
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    // GET Requests
    if (req.method === 'GET') {
      const action = query.action || 'ping';
      const key = getApiKey(query.key || req.headers?.['x-ddownload-key']);

      if (action === 'ping') {
        return sendJson(res, 200, { success: true, message: 'DDownload API Proxy is active.' });
      }

      if (action === 'account-info') {
        const infoRes = await getAccountInfo(key);
        return sendJson(res, 200, infoRes);
      }

      if (action === 'get-upload-server') {
        const serverRes = await getUploadServer(key);
        return sendJson(res, 200, serverRes);
      }

      if (action === 'file-info') {
        const fileCode = query.file_code || query.fileCode;
        const infoRes = await getFileInfo(key, fileCode);
        return sendJson(res, 200, infoRes);
      }

      return sendJson(res, 200, { success: false, error: `Unknown GET action: ${action}` });
    }

    // POST Requests
    if (req.method === 'POST') {
      const contentType = req.headers?.['content-type'] || '';
      let key = getApiKey(query.key || req.headers?.['x-ddownload-key']);
      let action = query.action;

      // Handle multipart form upload
      if (contentType.includes('multipart/form-data')) {
        const webReq = new Request('http://localhost' + normalizedUrl, {
          method: req.method,
          headers: req.headers,
          body: req,
          duplex: 'half'
        });

        const formData = await webReq.formData();
        const formKey = formData.get('key');
        if (formKey) key = cleanValue(formKey);
        const formAction = formData.get('action');
        if (formAction) action = String(formAction);

        const file = formData.get('file');
        if (!file || typeof file === 'string') {
          return sendJson(res, 200, { success: false, error: 'No file found in multipart upload.' });
        }

        const fileName = file.name || 'document';
        const uploadRes = await uploadFileToDDownload(key, file, fileName);

        return sendJson(res, 200, uploadRes);
      }

      // Handle JSON body
      let raw = '';
      for await (const chunk of req) raw += chunk;
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch (e) {
        body = {};
      }

      if (body.key) key = cleanValue(body.key);
      action = body.action || action || 'account-info';

      if (action === 'account-info') {
        const infoRes = await getAccountInfo(key);
        return sendJson(res, 200, infoRes);
      }

      if (action === 'file-info') {
        const fileCode = body.file_code || body.fileCode || query.file_code;
        const infoRes = await getFileInfo(key, fileCode);
        return sendJson(res, 200, infoRes);
      }

      if (action === 'get-upload-server') {
        const serverRes = await getUploadServer(key);
        return sendJson(res, 200, serverRes);
      }

      return sendJson(res, 200, { success: false, error: `Unsupported POST action: ${action}` });
    }

    return sendJson(res, 200, { success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('DDownload handler error:', error);
    return sendJson(res, 200, {
      success: false,
      error: error instanceof Error ? error.message : 'DDownload request failed'
    });
  }
}

module.exports = handler;
module.exports.default = handler;
module.exports.getAccountInfo = getAccountInfo;
module.exports.getUploadServer = getUploadServer;
module.exports.getFileInfo = getFileInfo;
module.exports.uploadFileToDDownload = uploadFileToDDownload;
