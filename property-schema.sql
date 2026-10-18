-- ==============================================================================
-- I-LEMS: Property Management Database Schema (Supabase / PostgreSQL)
-- Includes: Table definition, PIS code linking, Indexes, RLS Policies, Realtime & Trigger
-- ==============================================================================

-- 1. Create Property Items Table
CREATE TABLE IF NOT EXISTS public.property_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_number TEXT NOT NULL UNIQUE,
    pis_code TEXT UNIQUE,                             -- Property Inventory Sticker unique code (e.g. PIS-26-04928)
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    serial_number TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'unit',
    unit_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    location TEXT NOT NULL,
    custodian TEXT NOT NULL,
    condition TEXT NOT NULL DEFAULT 'Serviceable',
    acquisition_date DATE DEFAULT CURRENT_DATE,
    source_of_fund TEXT DEFAULT 'School MOOE',
    inventory_type TEXT DEFAULT 'Semi-Expendable',
    par_number TEXT,
    notes TEXT,
    last_inspected DATE,
    short_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration safety: Add pis_code column if the table was previously created without it
ALTER TABLE public.property_items 
ADD COLUMN IF NOT EXISTS pis_code TEXT UNIQUE;

-- 2. Indexes for speedy lookup and barcode / PIS / search queries
CREATE INDEX IF NOT EXISTS idx_property_items_property_number ON public.property_items(property_number);
CREATE INDEX IF NOT EXISTS idx_property_items_pis_code ON public.property_items(pis_code);
CREATE INDEX IF NOT EXISTS idx_property_items_category ON public.property_items(category);
CREATE INDEX IF NOT EXISTS idx_property_items_custodian ON public.property_items(custodian);
CREATE INDEX IF NOT EXISTS idx_property_items_condition ON public.property_items(condition);
CREATE INDEX IF NOT EXISTS idx_property_items_location ON public.property_items(location);

-- 3. Row Level Security (RLS)
ALTER TABLE public.property_items ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated users to view, insert, update, and delete
DROP POLICY IF EXISTS "Public can view property items" ON public.property_items;
CREATE POLICY "Public can view property items"
ON public.property_items FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can insert property items" ON public.property_items;
CREATE POLICY "Public can insert property items"
ON public.property_items FOR INSERT TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update property items" ON public.property_items;
CREATE POLICY "Public can update property items"
ON public.property_items FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete property items" ON public.property_items;
CREATE POLICY "Public can delete property items"
ON public.property_items FOR DELETE TO anon, authenticated
USING (true);

-- 4. Automatically update updated_at timestamp on row modification
CREATE OR REPLACE FUNCTION public.handle_property_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_property_items_updated_at ON public.property_items;
CREATE TRIGGER tr_property_items_updated_at
    BEFORE UPDATE ON public.property_items
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_property_items_updated_at();

-- 5. Enable Supabase Realtime synchronization (Optional, for multi-device sync)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.property_items;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
