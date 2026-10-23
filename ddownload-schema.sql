-- ==============================================================================
-- DDownload Cloud Storage Integration Migration Script
-- Reference API: https://ddownload.com/api
-- ==============================================================================

-- 1. Add attachments column to inventory_items to store DDownload metadata
-- Each item attachment stores:
--   - id: unique string identifier
--   - name: original document filename (e.g. "Microscope_Service_Manual.pdf")
--   - size: file size in bytes
--   - fileCode: DDownload file_code (e.g. "gi4o0tlro01u")
--   - downloadUrl: direct public download url (e.g. "https://ddownload.com/gi4o0tlro01u")
--   - uploadedAt: ISO timestamp
--   - category: 'Manual' | 'MSDS' | 'Calibration' | 'Warranty' | 'Datasheet' | 'Guide' | 'Other'
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 2. Add DDownload API key configuration to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS ddownload_api_key TEXT DEFAULT '';

-- 3. Notify postgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
