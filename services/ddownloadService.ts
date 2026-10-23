import { ItemAttachment } from '../types';

export interface DDownloadAccountInfo {
  email: string;
  storage_left: number | string;
  storage_used: number | string;
  traffic_left: number | string;
  prem_until?: string;
}

const STORAGE_KEY = 'ilems_ddownload_api_key';

export function getStoredDDownloadApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredDDownloadApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}

/**
 * Format bytes into readable string (e.g., 2.4 MB, 10.5 GB)
 */
export function formatBytes(bytes: number | string | undefined, decimals = 1): string {
  if (bytes === undefined || bytes === null || bytes === '') return '0 B';
  const num = typeof bytes === 'number' ? bytes : Number(bytes);
  if (isNaN(num) || num <= 0) return '0 B';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(num) / Math.log(k));

  return `${parseFloat((num / Math.pow(k, i)).toFixed(dm))} ${sizes[i] || 'B'}`;
}

/**
 * Extract clean file_code from a DDownload link or code string
 * Example: "https://ddownload.com/gi4o0tlro01u/manual.pdf" -> "gi4o0tlro01u"
 * Example: "gi4o0tlro01u" -> "gi4o0tlro01u"
 */
export function extractDDownloadCode(input: string): string {
  if (!input) return '';
  const trimmed = input.trim();
  const match = trimmed.match(/ddownload\.com\/([a-zA-Z0-9]+)/i);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Fetch DDownload account info using proxy /api/ddownload
 */
export async function getDDownloadAccountInfo(apiKey?: string): Promise<{ success: boolean; data?: DDownloadAccountInfo; error?: string }> {
  const key = apiKey?.trim() || getStoredDDownloadApiKey();
  if (!key) {
    return { success: false, error: 'No DDownload API key provided.' };
  }

  try {
    const res = await fetch(`/api/ddownload?action=account-info&key=${encodeURIComponent(key)}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to connect to DDownload API.' };
    }
    return { success: true, data: json.result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error communicating with DDownload proxy.'
    };
  }
}

/**
 * Query metadata for an existing file code on DDownload
 */
export async function getDDownloadFileInfo(fileCode: string, apiKey?: string): Promise<{ success: boolean; data?: any; error?: string }> {
  const key = apiKey?.trim() || getStoredDDownloadApiKey();
  const cleanCode = extractDDownloadCode(fileCode);
  if (!cleanCode) {
    return { success: false, error: 'Invalid file code or URL.' };
  }

  try {
    const res = await fetch(`/api/ddownload?action=file-info&file_code=${encodeURIComponent(cleanCode)}&key=${encodeURIComponent(key)}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to inspect file on DDownload.' };
    }
    return { success: true, data: json.result };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error verifying file.'
    };
  }
}

/**
 * Upload a laboratory equipment document directly to DDownload via proxy
 */
export async function uploadItemDocumentToDDownload(
  file: File,
  category: ItemAttachment['category'] = 'Manual',
  apiKey?: string
): Promise<{ success: boolean; attachment?: ItemAttachment; error?: string }> {
  const key = apiKey?.trim() || getStoredDDownloadApiKey();
  if (!key) {
    return {
      success: false,
      error: 'DDownload API key is not configured. Please add your key in Settings > DDownload Cloud Storage.'
    };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('key', key);
    formData.append('action', 'upload');

    const res = await fetch('/api/ddownload', {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    if (!res.ok || !json.success || !json.file) {
      return {
        success: false,
        error: json.error || 'Upload failed. Please check your DDownload API key and quota.'
      };
    }

    const attachment: ItemAttachment = {
      id: crypto.randomUUID(),
      name: file.name || json.file.name,
      size: file.size || json.file.size || 0,
      fileCode: json.file.fileCode,
      downloadUrl: json.file.downloadUrl || `https://ddownload.com/${json.file.fileCode}`,
      uploadedAt: new Date().toISOString(),
      category: category || 'Manual'
    };

    return { success: true, attachment };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to upload document to DDownload.'
    };
  }
}
