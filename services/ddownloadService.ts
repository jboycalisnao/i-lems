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
 * Check if DDownload is configured on the backend server or locally
 */
export async function checkDDownloadConfigStatus(): Promise<{ configured: boolean; message?: string }> {
  try {
    const res = await fetch('/api/ddownload?action=config-status');
    const json = await res.json();
    return { configured: Boolean(json.configured), message: json.message };
  } catch {
    return { configured: false };
  }
}

/**
 * Fetch DDownload account info using proxy /api/ddownload.
 * Relies on Vercel environment variable (DDOWNLOAD_API_KEY) if no client key is provided.
 */
export async function getDDownloadAccountInfo(apiKey?: string): Promise<{ success: boolean; data?: DDownloadAccountInfo; error?: string }> {
  const key = apiKey?.trim() || getStoredDDownloadApiKey();
  const queryParam = key ? `&key=${encodeURIComponent(key)}` : '';

  try {
    const res = await fetch(`/api/ddownload?action=account-info${queryParam}`);
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

  const queryParam = key ? `&key=${encodeURIComponent(key)}` : '';

  try {
    const res = await fetch(`/api/ddownload?action=file-info&file_code=${encodeURIComponent(cleanCode)}${queryParam}`);
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
 * Upload a laboratory equipment document directly to DDownload via proxy.
 * Relies on Vercel environment variable (DDOWNLOAD_API_KEY) if no key is entered in Settings.
 */
export async function uploadItemDocumentToDDownload(
  file: File,
  category: ItemAttachment['category'] = 'Manual',
  apiKey?: string
): Promise<{ success: boolean; attachment?: ItemAttachment; error?: string }> {
  const key = apiKey?.trim() || getStoredDDownloadApiKey();

  try {
    const formData = new FormData();
    formData.append('file', file);
    if (key) {
      formData.append('key', key);
    }
    formData.append('action', 'upload');

    const res = await fetch('/api/ddownload', {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    if (!res.ok || !json.success || !json.file) {
      return {
        success: false,
        error: json.error || 'Upload failed. Please ensure DDOWNLOAD_API_KEY is configured in your Vercel deployment.'
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

/**
 * Compress an image file to a lightweight data URL for responsive, zero-lag local rendering
 * and upload the full master file to DDownload cloud storage via proxy (using server or client key).
 */
export async function uploadItemPictureWithDDownload(
  file: File,
  apiKey?: string
): Promise<{
  success: boolean;
  imageUrl: string;
  fileCode?: string;
  downloadUrl?: string;
  warning?: string;
  error?: string;
}> {
  // Step 1: Create a client-side compressed preview data URL
  let optimizedDataUrl = '';
  try {
    optimizedDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image format'));
        img.onload = () => {
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  } catch (err: any) {
    return {
      success: false,
      imageUrl: '',
      error: err.message || 'Could not process image file.'
    };
  }

  // Step 2: Upload original image to DDownload via server proxy
  try {
    const uploadRes = await uploadItemDocumentToDDownload(file, 'Other', apiKey);
    if (uploadRes.success && uploadRes.attachment) {
      return {
        success: true,
        imageUrl: optimizedDataUrl,
        fileCode: uploadRes.attachment.fileCode,
        downloadUrl: uploadRes.attachment.downloadUrl
      };
    }
    return {
      success: true,
      imageUrl: optimizedDataUrl,
      warning: uploadRes.error || 'Picture saved locally, but DDownload cloud backup could not complete.'
    };
  } catch (err: any) {
    return {
      success: true,
      imageUrl: optimizedDataUrl,
      warning: 'Picture saved locally. DDownload cloud upload failed.'
    };
  }
}

/**
 * Permanently delete a file from DDownload cloud storage via proxy
 */
export async function deleteDDownloadFile(
  fileCodeOrUrl: string,
  apiKey?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanCode = extractDDownloadCode(fileCodeOrUrl);
  if (!cleanCode) {
    return { success: false, error: 'Invalid file code or URL.' };
  }

  const key = apiKey?.trim() || getStoredDDownloadApiKey();
  const queryParam = key ? `&key=${encodeURIComponent(key)}` : '';

  try {
    const res = await fetch(`/api/ddownload?action=delete&file_code=${encodeURIComponent(cleanCode)}${queryParam}`, {
      method: 'GET'
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      return { success: false, error: json.error || 'Failed to delete file from DDownload.' };
    }
    return { success: true, message: json.message || 'File permanently deleted from DDownload.' };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error deleting file from DDownload.'
    };
  }
}

