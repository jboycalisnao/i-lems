-- ==============================================================================
-- I-LEMS: Database Schema Fix for inventory_items (Boxes, Attachments, Images)
-- Run this in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/ewwadohdfmqfbdqndrhr/sql
-- ==============================================================================

-- 1. Add 'boxes' JSONB column to track individual boxed inventory sets
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS boxes JSONB DEFAULT '[]'::jsonb;

-- 2. Add 'attachments' JSONB column to track DDownload document files
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 3. Add equipment photo / avatar columns backed up to DDownload
ALTER TABLE public.inventory_items 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_file_code TEXT,
ADD COLUMN IF NOT EXISTS image_ddownload_url TEXT;

-- 4. Ensure property_items also has photo and attachment columns
ALTER TABLE public.property_items 
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_file_code TEXT,
ADD COLUMN IF NOT EXISTS image_ddownload_url TEXT,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 5. Create index for fast DDownload file code lookups
CREATE INDEX IF NOT EXISTS idx_inventory_items_image_file_code ON public.inventory_items(image_file_code);
CREATE INDEX IF NOT EXISTS idx_property_items_image_file_code ON public.property_items(image_file_code);

-- 6. Reload Supabase PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
