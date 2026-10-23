-- ==============================================================================
-- I-LEMS: Role-Based Access Control (RBAC) User Schema (Supabase / PostgreSQL)
-- Multi-user school laboratory & property management with granular permissions
-- ==============================================================================

-- 1. Create table for system users and assigned roles
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'borrower',
    department TEXT DEFAULT 'Science Department',
    password TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Indexes for fast lookup on login & filtering
CREATE INDEX IF NOT EXISTS idx_app_users_username ON public.app_users(username);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON public.app_users(role);
CREATE INDEX IF NOT EXISTS idx_app_users_status ON public.app_users(status);

-- 3. Row-Level Security (RLS)
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated and anon access to app_users" ON public.app_users;
CREATE POLICY "Allow authenticated and anon access to app_users"
ON public.app_users FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. Initial Root Administrator Account
INSERT INTO public.app_users (id, username, name, email, role, department, password, permissions, status)
VALUES 
  ('user-001', 'admin', 'System Administrator', 'admin@leonnationalhigh.edu.ph', 'admin', 'ICT & Laboratory Administration', 'admin', '["inventory:view", "inventory:manage", "property:view", "property:manage", "requests:view", "requests:manage", "lending:view", "lending:manage", "scanner:use", "settings:view", "settings:manage", "users:manage"]'::jsonb, 'active')
ON CONFLICT (username) DO NOTHING;

