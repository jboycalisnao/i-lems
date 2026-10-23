import { AppUser, UserRole, UserPermission, ROLE_DEFINITIONS } from '../types';
import { supabase } from '../supabaseClient';

const USERS_STORAGE_KEY = 'ilems_rbac_users';
const CURRENT_USER_KEY = 'ilems_current_user';

// Initial default root admin user for Leon National High School I-LEMS
export const DEFAULT_USERS: AppUser[] = [
  {
    id: 'user-001',
    username: 'admin',
    name: 'System Administrator',
    email: 'admin@leonnationalhigh.edu.ph',
    role: 'admin',
    department: 'ICT & Laboratory Administration',
    password: 'admin',
    permissions: ROLE_DEFINITIONS.admin.defaultPermissions,
    status: 'active',
    createdAt: '2026-01-10T08:00:00Z',
    lastLogin: '2026-10-18T08:30:00Z'
  }
];

const MOCK_USER_IDS = new Set(['user-002', 'user-003', 'user-004']);
const MOCK_USERNAMES = new Set(['roberto.ramos', 'grace.mendoza', 'carmen.v']);

// Helper: load from localStorage
const loadLocalUsers = (): AppUser[] => {
  if (typeof window === 'undefined') return DEFAULT_USERS;
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Purge any legacy mock users from previous tests
      const cleaned = parsed.filter(
        (u: AppUser) => !MOCK_USER_IDS.has(u.id) && !MOCK_USERNAMES.has(u.username)
      );
      if (cleaned.length !== parsed.length) {
        saveLocalUsers(cleaned.length > 0 ? cleaned : DEFAULT_USERS);
      }
      return cleaned.length > 0 ? cleaned : DEFAULT_USERS;
    }
    return DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
};

// Helper: save to localStorage
const saveLocalUsers = (users: AppUser[]): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users to localStorage', err);
  }
};

/**
 * Fetch all RBAC users from Supabase or fallback to LocalStorage
 */
export const getUsers = async (): Promise<AppUser[]> => {
  try {
    if (supabase && typeof supabase.from === 'function') {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .order('name', { ascending: true });

      if (!error && data && data.length > 0) {
        const mapped: AppUser[] = data.map((d: any) => ({
          id: d.id,
          username: d.username,
          name: d.name,
          email: d.email || '',
          role: (d.role as UserRole) || 'custom',
          department: d.department || 'Science Department',
          password: d.password,
          permissions: (Array.isArray(d.permissions) ? d.permissions : ROLE_DEFINITIONS[d.role as UserRole]?.defaultPermissions || []),
          status: d.status === 'inactive' ? 'inactive' : 'active',
          createdAt: d.created_at || d.createdAt || new Date().toISOString(),
          lastLogin: d.last_login || d.lastLogin
        }));
        saveLocalUsers(mapped);
        return mapped;
      }
    }
  } catch (e) {
    console.warn('Could not fetch app_users from Supabase, using localStorage:', e);
  }

  return loadLocalUsers();
};

/**
 * Save or Update a User in RBAC system
 */
export const saveUser = async (user: AppUser): Promise<{ success: boolean; message?: string }> => {
  const users = loadLocalUsers();
  const existingIdx = users.findIndex(u => u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase());

  // Check duplicate username if adding new
  if (existingIdx >= 0 && users[existingIdx].id !== user.id) {
    return { success: false, message: `Username "${user.username}" is already in use.` };
  }

  let updatedList: AppUser[];
  if (existingIdx >= 0) {
    updatedList = [...users];
    updatedList[existingIdx] = {
      ...users[existingIdx],
      ...user,
      password: user.password ? user.password : users[existingIdx].password
    };
  } else {
    updatedList = [
      ...users,
      {
        ...user,
        id: user.id || `user-${Date.now()}`,
        createdAt: user.createdAt || new Date().toISOString()
      }
    ];
  }

  saveLocalUsers(updatedList);

  // Sync with Supabase if table exists
  try {
    if (supabase && typeof supabase.from === 'function') {
      await supabase.from('app_users').upsert({
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        password: user.password,
        permissions: user.permissions,
        status: user.status,
        updated_at: new Date().toISOString()
      });
    }
  } catch (e) {
    console.warn('Could not sync user to Supabase:', e);
  }

  return { success: true };
};

/**
 * Delete a User (Protects primary admin)
 */
export const deleteUser = async (userId: string): Promise<{ success: boolean; message?: string }> => {
  const users = loadLocalUsers();
  const target = users.find(u => u.id === userId);

  if (!target) return { success: false, message: 'User not found.' };
  if (target.username === 'admin') {
    return { success: false, message: 'The primary system administrator cannot be deleted.' };
  }

  const updatedList = users.filter(u => u.id !== userId);
  saveLocalUsers(updatedList);

  try {
    if (supabase && typeof supabase.from === 'function') {
      await supabase.from('app_users').delete().eq('id', userId);
    }
  } catch (e) {
    console.warn('Could not delete user from Supabase:', e);
  }

  return { success: true };
};

/**
 * Authenticate credentials against the RBAC users list
 */
export const authenticateUser = async (username: string, password: string): Promise<{ user: AppUser | null; error?: string }> => {
  const cleanUser = username.trim().toLowerCase();
  const users = await getUsers();

  const match = users.find(u => u.username.toLowerCase() === cleanUser);
  if (!match) {
    return { user: null, error: 'User does not exist.' };
  }

  if (match.status === 'inactive') {
    return { user: null, error: 'This user account has been suspended. Please contact the administrator.' };
  }

  // Check password
  if (match.password !== password) {
    return { user: null, error: 'Incorrect password.' };
  }

  // Update last login
  const now = new Date().toISOString();
  match.lastLogin = now;
  saveUser(match).catch(() => {});
  setCurrentUser(match);

  return { user: match };
};

/**
 * Active Session Management
 */
export const getCurrentUser = (): AppUser | null => {
  if (typeof window === 'undefined') return DEFAULT_USERS[0];
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return DEFAULT_USERS[0]; // Default to admin for seamless continuity
    return JSON.parse(raw);
  } catch {
    return DEFAULT_USERS[0];
  }
};

export const setCurrentUser = (user: AppUser | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch {}
};

/**
 * Check if a user has a specific permission
 */
export const hasPermission = (user: AppUser | null, permission: UserPermission): boolean => {
  if (!user) return false;
  if (user.role === 'admin') return true; // Admins have all permissions
  return user.permissions.includes(permission);
};

/**
 * Check if user can access a specific view
 */
export const canAccessView = (user: AppUser | null, view: string): boolean => {
  if (!user || user.role === 'admin') return true;

  switch (view) {
    case 'dashboard':
      return true;
    case 'inventory':
      return hasPermission(user, 'inventory:view');
    case 'property':
      return hasPermission(user, 'property:view');
    case 'requests':
      return hasPermission(user, 'requests:view');
    case 'scanner':
      return hasPermission(user, 'scanner:use');
    case 'lending':
      return hasPermission(user, 'lending:view');
    case 'settings':
      return hasPermission(user, 'settings:view');
    default:
      return true;
  }
};

/**
 * SQL Schema Snippet for app_users table
 */
export const SQL_APP_USERS_SCHEMA = `-- ==============================================================================
-- I-LEMS: Role-Based Access Control (RBAC) User Schema (Supabase / PostgreSQL)
-- ==============================================================================

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

CREATE INDEX IF NOT EXISTS idx_app_users_username ON public.app_users(username);
CREATE INDEX IF NOT EXISTS idx_app_users_role ON public.app_users(role);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated and anon access to app_users" ON public.app_users;
CREATE POLICY "Allow authenticated and anon access to app_users"
ON public.app_users FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);
`;
