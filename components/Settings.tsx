
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSettings, Category, InventoryItem } from '../types';
import * as storage from '../services/storageService';
import * as notifications from '../services/notificationService';
import { 
  Upload, Save, CheckCircle, Plus, Trash2, Edit2, X, Loader2, Type, Lock, 
  User, Eye, EyeOff, Mail, Server, FileCode, Key, Users, Send, 
  ExternalLink, Copy, Code, Zap, Clock, AlertTriangle, Link as LinkIcon, MailCheck, Database,
  Search, Check, Tag, RefreshCw, AlertCircle, Layers, ArrowRight, Cloud, HardDrive
} from 'lucide-react';
import { SYSTEM_SHORT_NAME } from '../branding';
import { getCategoryColor, getCategoryIcon } from '../constants';
import UserManagementSettings from './UserManagementSettings';
import { 
  getDDownloadAccountInfo, 
  formatBytes, 
  DDownloadAccountInfo, 
  getStoredDDownloadApiKey, 
  setStoredDDownloadApiKey 
} from '../services/ddownloadService';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => boolean | Promise<boolean>;
  items?: InventoryItem[];
  categories?: Category[];
  onCategoriesChange?: () => void;
}

interface SmtpPublicConfig {
  configured: boolean;
  host: string;
  port: number;
  security: string;
  username: string;
  fromName: string;
  fromEmail: string;
  hasPassword?: boolean;
  missing?: string[];
  endpointError?: string;
}

const Settings: React.FC<SettingsProps> = ({ 
  settings, 
  onSave, 
  items = [], 
  categories: propCategories = [], 
  onCategoriesChange 
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.split('/').filter(Boolean)[1];
  const activeTab: 'general' | 'categories' | 'automation' | 'users' =
    routeTab === 'categories' || routeTab === 'automation' || routeTab === 'users' ? routeTab : 'general';
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState<SmtpPublicConfig>({
    configured: false,
    host: 'smtp.gmail.com',
    port: 465,
    security: 'TLS',
    username: '',
    fromName: SYSTEM_SHORT_NAME,
    fromEmail: ''
  });

  // --- Category CRUD State ---
  const [categories, setCategories] = useState<Category[]>(propCategories);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [reassignCategoryTo, setReassignCategoryTo] = useState<string>('General');
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [categoryFeedback, setCategoryFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (routeTab !== 'general' && routeTab !== 'categories' && routeTab !== 'automation' && routeTab !== 'users') {
      navigate('/settings/general', { replace: true });
    }
  }, [navigate, routeTab]);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Updated SQL Schema Snippet for easy reference in the UI
  const SCHEMA_CODE = `-- 1. Create a public bucket for application branding
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

-- 2. Allow the app's anonymous client to manage only the fixed logo object
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

-- 3. Existing table migrations
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS "labInCharge" TEXT;
ALTER TABLE borrow_requests ADD COLUMN IF NOT EXISTS "instructorName" TEXT;
ALTER TABLE borrow_records ADD COLUMN IF NOT EXISTS "borrowerEmail" TEXT;

-- 4. DDownload Cloud Storage Integration (https://ddownload.com/api)
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS ddownload_api_key TEXT;`;

  // --- DDownload Cloud File Service State ---
  const [ddownloadKey, setDdownloadKey] = useState<string>(settings.ddownloadApiKey || getStoredDDownloadApiKey() || '');
  const [showDdownloadKey, setShowDdownloadKey] = useState<boolean>(false);
  const [isTestingDDownload, setIsTestingDDownload] = useState<boolean>(false);
  const [ddownloadAccount, setDdownloadAccount] = useState<DDownloadAccountInfo | null>(null);
  const [ddownloadError, setDdownloadError] = useState<string | null>(null);
  const [ddownloadSuccess, setDdownloadSuccess] = useState<string | null>(null);

  useEffect(() => {
    const key = ddownloadKey.trim();
    if (key && activeTab === 'automation') {
      getDDownloadAccountInfo(key).then(res => {
        if (res.success && res.data) {
          setDdownloadAccount(res.data);
        }
      }).catch(() => {});
    }
  }, [activeTab]);

  const handleDDownloadKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.trim();
    // Auto-extract token if full URL was pasted: e.g. https://api-v2.ddownload.com/api/account/info?key=507988y2akd8lwsiu54m5e
    const match = raw.match(/[?&]key=([a-zA-Z0-9]+)/i);
    const key = match && match[1] ? match[1] : raw;
    setDdownloadKey(key);
    setFormData(prev => ({ ...prev, ddownloadApiKey: key }));
  };

  const handleTestDDownload = async () => {
    let raw = ddownloadKey.trim();
    const match = raw.match(/[?&]key=([a-zA-Z0-9]+)/i);
    const key = match && match[1] ? match[1] : raw;
    setDdownloadKey(key);

    if (!key) {
      setDdownloadError('Please enter a DDownload API key first.');
      return;
    }
    setIsTestingDDownload(true);
    setDdownloadError(null);
    setDdownloadSuccess(null);
    try {
      const res = await getDDownloadAccountInfo(key);
      if (!res.success || !res.data) {
        throw new Error(res.error || 'Failed to authenticate with DDownload');
      }
      setDdownloadAccount(res.data);
      setDdownloadSuccess('DDownload API Key verified successfully! Account is active.');
      setFormData(prev => ({ ...prev, ddownloadApiKey: key }));
      setStoredDDownloadApiKey(key);
    } catch (err: any) {
      setDdownloadError(err.message || 'DDownload verification failed.');
      setDdownloadAccount(null);
    } finally {
      setIsTestingDDownload(false);
    }
  };

  const loadSmtpConfig = async () => {
    try {
      const response = await fetch('/api/send-email', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });
      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await response.json().catch(() => ({})) : null;

      if (!response.ok) {
        const err = data?.error;
        const msg = typeof err === 'string' ? err : err?.message || err?.code || data?.message || `HTTP ${response.status}`;
        throw new Error(msg);
      }
      if (!isJson) {
        throw new Error('API returned HTML instead of JSON. Ensure latest Vercel deployment is active.');
      }
      setSmtpConfig({ ...data, endpointError: undefined });
    } catch (error) {
      console.warn('Could not load SMTP status:', error);
      setSmtpConfig(prev => ({
        ...prev,
        endpointError: error instanceof Error ? error.message : 'Could not reach /api/send-email'
      }));
    }
  };

  useEffect(() => {
    loadCategories();
    loadSmtpConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'automation') {
      loadSmtpConfig();
    }
  }, [activeTab]);

  useEffect(() => {
    if (propCategories && propCategories.length > 0) {
      setCategories(propCategories);
    }
  }, [propCategories]);

  const loadCategories = async () => {
    setIsLoadingCategories(true);
    try {
      const data = await storage.getCategories();
      setCategories(data);
    } catch (e: any) {
      console.error('Failed to load categories:', e);
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (categoryFeedback) {
      const timer = setTimeout(() => setCategoryFeedback(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [categoryFeedback]);

  const getItemCount = (catName: string): number => {
    const target = catName.trim().toLowerCase();
    return items.filter(item => (item.category || '').trim().toLowerCase() === target).length;
  };

  const totalCategorizedItems = items.length;

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  useEffect(() => { setFormData(settings); }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        e.target.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('Logo images must be 5 MB or smaller.');
        e.target.value = '';
        return;
    }

    setIsUploadingLogo(true);
    setSaved(false);
    try {
        const publicUrl = await storage.uploadAppLogo(file);
        setFormData(prev => ({ ...prev, logoUrl: publicUrl }));
    } catch (error) {
        alert(error instanceof Error ? `Logo upload failed: ${error.message}` : 'Logo upload failed.');
    } finally {
        setIsUploadingLogo(false);
        e.target.value = '';
    }
  };

  const handleTestConnection = async () => {
      setIsTestingConnection(true);
      try {
          const response = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'verify' })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || 'SMTP verification failed.');
          alert('Gmail SMTP connection verified successfully.');
          await loadSmtpConfig();
      } catch (error) {
          alert(error instanceof Error ? error.message : 'SMTP connection failed.');
      } finally {
          setIsTestingConnection(false);
      }
  };

  const handleSendTestEmail = async () => {
    if (!formData.notificationEmails) {
        alert("Add a notification recipient to send a test email.");
        return;
    }
    
    setIsSendingTestEmail(true);
    try {
        const recipients = formData.notificationEmails.split(',')[0].trim();
        const sent = await notifications.sendEmail(formData, {
            to_email: recipients,
            subject: `${SYSTEM_SHORT_NAME} Connection Test`,
            body: `This is a test email from your Laboratory Inventory System (${formData.appName}). If you are reading this, your Gmail Automation is successfully configured!`,
            html_body: `<div style="font-family: sans-serif; padding: 20px; border: 2px solid #2005A2; border-radius: 12px; text-align: center;">
                <h2 style="color: #2005A2;">Connection Successful!</h2>
                <p>This is a test email confirming that your Gmail SMTP integration is working correctly.</p>
                <div style="background: #f8fafc; padding: 10px; border-radius: 8px; font-size: 12px; color: #64748b;">
                    Sent from: ${formData.appName}
                </div>
            </div>`
        });
        if (!sent) throw new Error('The SMTP server could not send the test email.');
        alert(`Test email sent to: ${recipients}. Please check your inbox (and spam folder).`);
    } catch (e) {
        alert("Failed to send test email. Verify your Script URL and internet connection.");
    } finally {
        setIsSendingTestEmail(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploadingLogo) return;
    if (formData.logoUrl?.startsWith('data:')) {
        alert('The current logo is stored as legacy base64 data. Upload it again or enter a public image URL before saving.');
        return;
    }
    setIsSaving(true);
    setSaved(false);
    setTimeout(async () => {
        try {
            const success = await onSave(formData);
            if (!success) throw new Error('The database rejected the settings update.');
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (error: any) { alert("Failed to save settings."); } finally { setIsSaving(false); }
    }, 100);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert("Code copied!");
  };

  // --- Category CRUD Handlers ---

  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newCategory.trim();
    if (!trimmed) {
      setCategoryFeedback({ type: 'error', message: 'Please enter a category name.' });
      return;
    }
    if (categories.some(c => c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setCategoryFeedback({ type: 'error', message: `Category "${trimmed}" already exists.` });
      return;
    }

    setIsAddingCategory(true);
    setCategoryFeedback(null);
    try {
      await storage.addCategory(trimmed);
      setNewCategory('');
      setCategoryFeedback({ type: 'success', message: `Category "${trimmed}" successfully added!` });
      await loadCategories();
      onCategoriesChange?.();
    } catch (err: any) {
      setCategoryFeedback({ type: 'error', message: err.message || 'Failed to add category.' });
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleStartEdit = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
    setCategoryFeedback(null);
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditingCategoryName('');
  };

  const handleSaveEdit = async (cat: Category) => {
    const trimmed = editingCategoryName.trim();
    if (!trimmed) {
      setCategoryFeedback({ type: 'error', message: 'Category name cannot be empty.' });
      return;
    }
    if (trimmed.toLowerCase() === cat.name.trim().toLowerCase()) {
      handleCancelEdit();
      return;
    }
    if (categories.some(c => c.id !== cat.id && c.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setCategoryFeedback({ type: 'error', message: `Another category named "${trimmed}" already exists.` });
      return;
    }

    setIsSavingCategory(true);
    setCategoryFeedback(null);
    try {
      await storage.updateCategory(cat.id, trimmed, cat.name);
      const affectedCount = getItemCount(cat.name);
      setCategoryFeedback({
        type: 'success',
        message: affectedCount > 0
          ? `Category renamed to "${trimmed}". ${affectedCount} inventory item(s) updated!`
          : `Category renamed to "${trimmed}".`
      });
      handleCancelEdit();
      await loadCategories();
      onCategoriesChange?.();
    } catch (err: any) {
      setCategoryFeedback({ type: 'error', message: err.message || 'Failed to rename category.' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleOpenDeleteModal = (cat: Category) => {
    if (cat.name.toLowerCase() === 'general') return;
    setCategoryToDelete(cat);
    const available = categories.filter(c => c.id !== cat.id);
    const hasGeneral = available.some(c => c.name.toLowerCase() === 'general');
    setReassignCategoryTo(hasGeneral ? 'General' : (available[0]?.name || 'General'));
    setCategoryFeedback(null);
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    setCategoryFeedback(null);
    try {
      const affectedCount = getItemCount(categoryToDelete.name);
      await storage.deleteCategory(categoryToDelete.id, categoryToDelete.name, reassignCategoryTo);
      setCategoryFeedback({
        type: 'success',
        message: affectedCount > 0
          ? `Category "${categoryToDelete.name}" deleted. ${affectedCount} item(s) reassigned to "${reassignCategoryTo}".`
          : `Category "${categoryToDelete.name}" deleted successfully.`
      });
      setCategoryToDelete(null);
      await loadCategories();
      onCategoriesChange?.();
    } catch (err: any) {
      setCategoryFeedback({ type: 'error', message: err.message || 'Failed to delete category.' });
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const CardStyle = "bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden";

  return (
    <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex space-x-2 bg-gray-100 p-1.5 rounded-md w-full sm:w-fit border border-gray-200 overflow-x-auto">
            <button onClick={() => navigate('/settings/general')} className={`flex-shrink-0 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'general' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>General</button>
            <button onClick={() => navigate('/settings/categories')} className={`flex-shrink-0 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'categories' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Categories</button>
            <button onClick={() => navigate('/settings/automation')} className={`flex-shrink-0 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'automation' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <div className="flex items-center gap-2"><Zap className="w-4 h-4" /> Automation</div>
            </button>
            <button onClick={() => navigate('/settings/users')} className={`flex-shrink-0 px-4 py-2 rounded-md text-sm font-bold transition-all ${activeTab === 'users' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Users & Roles (RBAC)</div>
            </button>
        </div>

        {activeTab === 'general' && (
            <div className={`${CardStyle} p-8 animate-in fade-in slide-in-from-top-2 duration-300`}>
                <h3 className="text-xl font-bold text-gray-800 mb-6">General Settings</h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Application Name</label>
                          <input type="text" name="appName" value={formData.appName} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm" />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Laboratory In-Charge (Permit Signatory)</label>
                          <input type="text" name="labInCharge" value={formData.labInCharge || ''} onChange={handleChange} placeholder="e.g. Prof. Albert Einstein" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm font-semibold" />
                      </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Custom Footer Text</label>
                        <input type="text" name="customFooterText" value={formData.customFooterText || ''} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Header Logo</label>
                        <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                            <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center">
                                {isUploadingLogo ? <Loader2 className="w-6 h-6 animate-spin text-blue-500" /> : formData.logoUrl ? <img src={formData.logoUrl} alt="Logo preview" className="w-full h-full object-contain" /> : <span className="text-gray-400 text-xs">No Logo</span>}
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1">
                                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                        <input type="url" name="logoUrl" value={formData.logoUrl || ''} onChange={handleChange} placeholder="https://..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-900 shadow-sm" />
                                    </div>
                                    <button type="button" disabled={isUploadingLogo} onClick={() => logoInputRef.current?.click()} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"><Upload className="w-4 h-4 inline mr-2"/>{isUploadingLogo ? 'Uploading' : 'Upload Image'}</button>
                                    {formData.logoUrl && <button type="button" onClick={() => { setFormData(prev => ({ ...prev, logoUrl: '' })); setSaved(false); }} className="p-2 border border-gray-300 rounded-md text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Remove logo"><Trash2 className="w-4 h-4" /></button>}
                                </div>
                                {formData.logoUrl?.startsWith('data:') && <p className="text-xs font-medium text-amber-700">Legacy base64 logo detected. Upload it again to create a hosted URL.</p>}
                            </div>
                            <input type="file" ref={logoInputRef} className="hidden" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={handleImageUpload} />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mt-4">
                        <div className="flex items-center gap-2 text-blue-800 font-bold mb-2">
                            <Database className="w-4 h-4" />
                            <h4 className="text-sm">Database Schema Migration</h4>
                        </div>
                        <p className="text-xs text-blue-600 mb-3">Run this once in the Supabase SQL Editor to enable hosted logo uploads and the existing settings migrations:</p>
                        <div className="relative group">
                            <pre className="bg-slate-900 text-blue-300 p-4 rounded-md text-[10px] font-mono overflow-x-auto shadow-inner leading-relaxed">
                                {SCHEMA_CODE}
                            </pre>
                            <button type="button" onClick={() => copyCode(SCHEMA_CODE)} className="absolute right-2 top-2 p-1.5 bg-slate-800 text-white rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t">
                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Lock className="w-4 h-4 text-gray-400" /> Security Credentials</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Admin Username</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="text" name="adminUsername" value={formData.adminUsername || 'admin'} onChange={handleChange} className="w-full pl-10 px-4 py-2 border rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500" placeholder="Username" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Admin Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type={showAdminPassword ? "text" : "password"} name="adminPassword" value={formData.adminPassword || 'admin123'} onChange={handleChange} className="w-full pl-10 px-4 py-2 border rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500" placeholder="Password" />
                                    <button type="button" onClick={() => setShowAdminPassword(!showAdminPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button type="submit" className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-md shadow-lg hover:bg-blue-700 transition-all font-bold">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                            Save All Settings
                        </button>
                    </div>
                </form>
            </div>
        )}

        {activeTab === 'categories' && (
            <div className={`${CardStyle} p-6 sm:p-8 animate-in fade-in slide-in-from-top-2 duration-300 space-y-6`}>
                {/* Status / Feedback Banner */}
                {categoryFeedback && (
                    <div className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm font-semibold transition-all ${
                        categoryFeedback.type === 'success' 
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm' 
                            : 'bg-rose-50 text-rose-800 border border-rose-200 shadow-sm'
                    }`}>
                        <div className="flex items-center gap-2">
                            {categoryFeedback.type === 'success' ? (
                                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                            ) : (
                                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                            )}
                            <span>{categoryFeedback.message}</span>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => setCategoryFeedback(null)} 
                            className="p-1 hover:bg-black/5 rounded-md transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Header & Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Layers className="w-5 h-5 text-blue-600" />
                            Equipment Categories
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Classify laboratory equipment. Renaming a category automatically migrates all linked inventory items.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                            <Tag className="w-3.5 h-3.5" />
                            <span>{categories.length} Categories</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200">
                            <span>{totalCategorizedItems} Total Items</span>
                        </div>
                        <button 
                            type="button"
                            onClick={loadCategories} 
                            disabled={isLoadingCategories}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                            title="Refresh categories"
                        >
                            <RefreshCw className={`w-4 h-4 ${isLoadingCategories ? 'animate-spin text-blue-600' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Create Category Form */}
                <form onSubmit={handleAddCategory} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Create New Category
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                placeholder="Enter category name (e.g., Robotics, Optics, Glassware)"
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm font-medium"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isAddingCategory || !newCategory.trim()}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isAddingCategory ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Adding...
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4" /> Add Category
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            placeholder="Search categories..."
                            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        {categorySearch && (
                            <button 
                                type="button"
                                onClick={() => setCategorySearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                        Showing {filteredCategories.length} of {categories.length} categories
                    </span>
                </div>

                {/* Categories List */}
                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white divide-y divide-gray-100">
                    {filteredCategories.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                            <Tag className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                            <p className="font-semibold text-sm">No categories found</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {categorySearch ? 'Try a different search term.' : 'Get started by creating your first equipment category above.'}
                            </p>
                        </div>
                    ) : (
                        filteredCategories.map(cat => {
                            const count = getItemCount(cat.name);
                            const color = getCategoryColor(cat.name);
                            const isEditing = editingCategoryId === cat.id;
                            const isDefault = cat.isDefault || cat.name.toLowerCase() === 'general';

                            return (
                                <div
                                    key={cat.id}
                                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors group"
                                >
                                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                        <div 
                                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                                            style={{ 
                                                backgroundColor: `${color}18`, 
                                                color: color,
                                                border: `1px solid ${color}30` 
                                            }}
                                        >
                                            {getCategoryIcon(cat.name)}
                                        </div>

                                        {isEditing ? (
                                            <div className="flex-1 flex items-center gap-2">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={editingCategoryName}
                                                    onChange={(e) => setEditingCategoryName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(cat);
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                    className="flex-1 px-3 py-1.5 border border-blue-400 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveEdit(cat)}
                                                    disabled={isSavingCategory}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-colors disabled:opacity-50"
                                                    title="Save category name"
                                                >
                                                    {isSavingCategory ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCancelEdit}
                                                    disabled={isSavingCategory}
                                                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                                <span className="font-bold text-gray-900 text-sm truncate">
                                                    {cat.name}
                                                </span>

                                                <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                                    {count} {count === 1 ? 'item' : 'items'}
                                                </span>

                                                {isDefault && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-full font-bold whitespace-nowrap">
                                                        System Default
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {!isEditing && (
                                        <div className="flex items-center gap-1 self-end sm:self-center">
                                            <button
                                                type="button"
                                                onClick={() => handleStartEdit(cat)}
                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Rename Category"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleOpenDeleteModal(cat)}
                                                disabled={cat.name.toLowerCase() === 'general'}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                                                title={cat.name.toLowerCase() === 'general' ? 'General is the default fallback and cannot be deleted' : 'Delete Category'}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        )}

        {activeTab === 'automation' && (
            <div className={`${CardStyle} p-8 animate-in fade-in slide-in-from-top-2 duration-300`}>
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-2xl font-bold text-gray-800">SMTP & Sync Automation</h3>
                        <p className="text-sm text-gray-500">Manage email notifications and background maintenance tasks.</p>
                    </div>
                    <div className="bg-indigo-100 p-4 rounded-md text-indigo-600 shadow-inner">
                        <Zap className="w-8 h-8" />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="bg-white border border-indigo-100 rounded-md p-6 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 text-indigo-700 font-bold border-b border-indigo-50 pb-3">
                            <Server className="w-5 h-5" />
                            <h4>Gmail SMTP Configuration</h4>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">SMTP Server</label><input readOnly value={smtpConfig.host} className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Port</label><input readOnly value={smtpConfig.port} className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Security</label><input readOnly value={smtpConfig.security} className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm" /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Username</label><input readOnly value={smtpConfig.username || 'Not configured'} className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Password</label><input readOnly type="password" value={smtpConfig.hasPassword || smtpConfig.configured ? 'configured-secret' : ''} placeholder={smtpConfig.hasPassword ? '••••••••••••••••' : 'Not configured'} className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm" /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">Sender Name</label><input readOnly value={smtpConfig.fromName || SYSTEM_SHORT_NAME} className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm" /></div>
                            <div><label className="block text-xs font-bold text-gray-500 mb-1">From Email Address</label><input readOnly value={smtpConfig.fromEmail || 'Not configured'} className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-sm" /></div>
                        </div>

                        <div className={`p-4 rounded-md border ${smtpConfig.configured ? 'bg-green-50 border-green-200 text-green-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                            <p className="text-sm font-bold">{smtpConfig.configured ? 'SMTP credentials configured' : 'SMTP credentials not configured'}</p>
                            {smtpConfig.endpointError ? (
                                <p className="text-xs mt-1 text-red-600 font-medium">
                                    Server status: {smtpConfig.endpointError}
                                </p>
                            ) : smtpConfig.missing && smtpConfig.missing.length > 0 ? (
                                <div className="text-xs mt-1 space-y-1">
                                    <p>The backend endpoint is active, but the following variable(s) are missing on the server:</p>
                                    <ul className="list-disc list-inside font-mono font-bold text-amber-900">
                                        {smtpConfig.missing.map(m => (
                                            <li key={m}>
                                                {m} {m === 'SMTP_PASSWORD' && '(Check Vercel: clear the "Needs Attention" badge on SMTP_PASSWORD and redeploy)'}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <p className="text-xs mt-1">Configure the server-only SMTP variables in <span className="font-mono">.env.local</span> for development and in Vercel Environment Variables for deployment.</p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Administrator Notification Recipients</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input type="text" name="notificationEmails" value={formData.notificationEmails || ''} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm" placeholder="admin@school.edu, technician@school.edu" />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <button type="button" onClick={handleTestConnection} disabled={isTestingConnection} className="flex-1 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50">
                                {isTestingConnection ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />} Test SMTP Connection
                            </button>
                            <button type="button" onClick={handleSendTestEmail} disabled={isSendingTestEmail} className="flex-1 px-4 py-2.5 bg-green-50 text-green-700 rounded-md border border-green-200 hover:bg-green-100 transition-colors flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50">
                                {isSendingTestEmail ? <Loader2 className="w-4 h-4 animate-spin"/> : <MailCheck className="w-4 h-4" />} Send Test Email
                            </button>
                        </div>
                    </div>

                    {/* DDownload Cloud Storage Integration */}
                    <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md">
                                    <Cloud className="w-6 h-6" />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        DDownload Cloud File Service
                                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                            ddownloadAccount ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {ddownloadAccount ? 'Connected' : 'External Host'}
                                        </span>
                                    </h4>
                                    <p className="text-xs text-gray-500">
                                        Cloud storage provider for equipment manuals, Material Safety Data Sheets (MSDS), calibration records, and spec sheets.
                                    </p>
                                </div>
                            </div>
                            <a
                                href="https://ddownload.com/api"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200 transition-colors self-start sm:self-center"
                            >
                                <ExternalLink className="w-3.5 h-3.5" />
                                DDownload API Docs
                            </a>
                        </div>

                        {/* Status feedback */}
                        {ddownloadError && (
                            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                                <span>{ddownloadError}</span>
                            </div>
                        )}
                        {ddownloadSuccess && (
                            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span>{ddownloadSuccess}</span>
                            </div>
                        )}

                        {/* API Key Input */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                                DDownload API Key
                            </label>
                            <div className="relative">
                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type={showDdownloadKey ? 'text' : 'password'}
                                    value={ddownloadKey}
                                    onChange={handleDDownloadKeyChange}
                                    placeholder="Enter your DDownload API key"
                                    className="w-full pl-10 pr-24 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowDdownloadKey(!showDdownloadKey)}
                                        className="p-1.5 text-gray-400 hover:text-gray-600 rounded"
                                    >
                                        {showDdownloadKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                Enter your DDownload API key (e.g. <span className="font-mono text-gray-700 font-bold">507988y2akd8lwsiu54m5e</span>). If you copy the full URL from the DDownload dashboard, the key is automatically extracted for you.
                                <br />
                                <span className="text-blue-600 font-semibold">Tip:</span> If DDownload responds with <span className="font-mono text-red-600 font-bold">Wrong auth</span>, click the blue <span className="font-semibold text-gray-800">"Regenerate Key"</span> button on your DDownload dashboard and ensure your account email is confirmed.
                            </p>
                        </div>

                        {/* Live Account Stats if connected */}
                        {ddownloadAccount && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                <div>
                                    <span className="block text-[11px] font-bold text-blue-700 uppercase">Account Email</span>
                                    <span className="text-sm font-semibold text-gray-900 truncate block" title={ddownloadAccount.email}>
                                        {ddownloadAccount.email || 'Active DDownload Account'}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[11px] font-bold text-blue-700 uppercase">Storage Quota</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {formatBytes(ddownloadAccount.storage_used)} used
                                        <span className="text-xs font-normal text-gray-500"> ({formatBytes(ddownloadAccount.storage_left)} left)</span>
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-[11px] font-bold text-blue-700 uppercase">Account Status</span>
                                    <span className="text-sm font-bold text-gray-900">
                                        {ddownloadAccount.prem_until ? `Premium (${ddownloadAccount.prem_until.split(' ')[0]})` : `${formatBytes(ddownloadAccount.traffic_left)} traffic left`}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={handleTestDDownload}
                                disabled={isTestingDDownload || !ddownloadKey.trim()}
                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
                            >
                                {isTestingDDownload ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                                Verify DDownload Connection
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 border-t flex justify-between items-center">
                         <div className="flex items-center gap-3">
                            <div className="p-3 bg-green-100 text-green-700 rounded-md shadow-inner">
                                <CheckCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-gray-800">Maintenance Logic Ready</p>
                                <p className="text-xs text-gray-500">The app will automatically sync overdue items whenever an admin logs in.</p>
                            </div>
                        </div>
                        <button type="submit" className="px-8 py-3 bg-indigo-600 text-white rounded-md shadow-lg hover:bg-indigo-700 transition-all font-bold flex items-center gap-2">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>}
                            Apply Automation Changes
                        </button>
                    </div>
                </form>
            </div>
        )}

        {activeTab === 'users' && (
            <UserManagementSettings onUsersChange={onCategoriesChange} />
        )}

        {/* Delete & Reassign Category Modal */}
        {categoryToDelete && typeof document !== 'undefined' && createPortal(
            <div
                className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] flex items-center justify-center p-3 md:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
            >
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-100 animate-in zoom-in-95 duration-200 space-y-4">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-lg font-bold text-gray-900">Delete Category</h4>
                            <p className="text-sm text-gray-500 mt-1">
                                Are you sure you want to delete <span className="font-bold text-gray-800">"{categoryToDelete.name}"</span>?
                            </p>
                        </div>
                        <button 
                            type="button"
                            onClick={() => !isDeletingCategory && setCategoryToDelete(null)} 
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-md"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {getItemCount(categoryToDelete.name) > 0 ? (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                            <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{getItemCount(categoryToDelete.name)} inventory item(s) currently linked</span>
                            </div>
                            <p className="text-xs text-amber-700 leading-relaxed">
                                To protect your records and prevent orphaned inventory items, please select an existing category where these items will be migrated:
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase mb-1">
                                    Reassign items to:
                                </label>
                                <select
                                    value={reassignCategoryTo}
                                    onChange={(e) => setReassignCategoryTo(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                                >
                                    {categories
                                        .filter(c => c.id !== categoryToDelete.id)
                                        .map(c => (
                                            <option key={c.id} value={c.name}>
                                                {c.name} {c.name.toLowerCase() === 'general' ? '(Default)' : ''}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                            No inventory items currently belong to this category. It will be removed permanently.
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            type="button"
                            disabled={isDeletingCategory}
                            onClick={() => setCategoryToDelete(null)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isDeletingCategory}
                            onClick={handleConfirmDelete}
                            className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                        >
                            {isDeletingCategory ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {getItemCount(categoryToDelete.name) > 0 ? 'Delete & Reassign Items' : 'Delete Category'}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}
    </div>
  );
};

export default Settings;
