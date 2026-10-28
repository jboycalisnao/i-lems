import type { IncomingMessage, ServerResponse } from 'node:http';

const api = require('../api/ddownload.js');

export const ddownloadHandler = (req: IncomingMessage, res: ServerResponse) => {
  return api(req, res);
};

export const getAccountInfo = api.getAccountInfo;
export const getUploadServer = api.getUploadServer;
export const getFileInfo = api.getFileInfo;
export const uploadFileToDDownload = api.uploadFileToDDownload;
export const deleteFileFromDDownload = api.deleteFileFromDDownload;

export default api;
