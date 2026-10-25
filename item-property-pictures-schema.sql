-- ==============================================================================
-- I-LEMS: Laboratory Equipment & Property Asset Pictures Migration
-- Supports direct profile photos backed up to DDownload Cloud Storage
-- ==============================================================================

-- 1. Laboratory Inventory Items: Add image URL and DDownload tracking columns
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_file_code TEXT,
ADD COLUMN IF NOT EXISTS image_ddownload_url TEXT;

-- 2. Property Items (PIS / Capital Outlay / Semi-Expendable): Add image URL and DDownload tracking
ALTER TABLE public.property_items 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_file_code TEXT,
ADD COLUMN IF NOT EXISTS image_ddownload_url TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 3. Create indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_inventory_items_image_file_code ON public.inventory_items(image_file_code);
CREATE INDEX IF NOT EXISTS idx_property_items_image_file_code ON public.property_items(image_file_code);

-- 4. Notify PostgREST schema cache to reload immediately
NOTIFY pgrst, 'reload schema';
