-- Run once in the Supabase SQL Editor.
-- app_settings.logoUrl remains TEXT and stores the generated public URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-assets',
  'app-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can read app logo" ON storage.objects;
CREATE POLICY "Public can read app logo"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'app-assets' AND name = 'branding/app-logo');

DROP POLICY IF EXISTS "App can upload app logo" ON storage.objects;
CREATE POLICY "App can upload app logo"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'app-assets' AND name = 'branding/app-logo');

DROP POLICY IF EXISTS "App can replace app logo" ON storage.objects;
CREATE POLICY "App can replace app logo"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (bucket_id = 'app-assets' AND name = 'branding/app-logo')
WITH CHECK (bucket_id = 'app-assets' AND name = 'branding/app-logo');
