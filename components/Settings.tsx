
import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppSettings, Category } from '../types';
import * as storage from '../services/storageService';
import * as notifications from '../services/notificationService';
import { 
  Upload, Save, CheckCircle, Plus, Trash2, Edit2, X, Loader2, Type, Lock, 
  User, Eye, EyeOff, Mail, Server, FileCode, Key, Users, Send, 
  ExternalLink, Copy, Code, Zap, Clock, AlertTriangle, Link as LinkIcon, MailCheck, Database
} from 'lucide-react';
import { SYSTEM_SHORT_NAME } from '../branding';

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => boolean | Promise<boolean>;
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

const Settings: React.FC<SettingsProps> = ({ settings, onSave }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.split('/').filter(Boolean)[1];
  const activeTab: 'general' | 'categories' | 'automation' =
    routeTab === 'categories' || routeTab === 'automation' ? routeTab : 'general';
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (routeTab !== 'general' && routeTab !== 'categories' && routeTab !== 'automation') {
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

ALTER TABLE borrow_requests ADD COLUMN IF NOT EXISTS "instructorName" TEXT;`;

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
        throw new Error(data?.error || `HTTP ${response.status}`);
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

  const loadCategories = async () => { setCategories(await storage.getCategories()); };
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
            subject: `🧪 ${SYSTEM_SHORT_NAME} Connection Test`,
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

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    await storage.addCategory(newCategory.trim());
    await loadCategories();
    setNewCategory('');
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
            <div className={`${CardStyle} p-8 animate-in fade-in slide-in-from-top-2 duration-300`}>
                <h3 className="text-xl font-bold text-gray-800 mb-6">Equipment Categories</h3>
                <div className="space-y-6">
                    <div className="flex gap-2">
                        <input type="text" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Enter category name (e.g., Robotics)" className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
                        <button onClick={handleAddCategory} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 shadow-md font-bold flex items-center gap-2">
                            <Plus className="w-5 h-5"/> Add
                        </button>
                    </div>
                    <div className="bg-gray-50 rounded-md border border-gray-200 overflow-hidden">
                        <ul className="divide-y divide-gray-200">
                            {categories.map(cat => (
                                <li key={cat.id} className="px-6 py-4 flex justify-between items-center group bg-white hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="font-medium text-gray-700">{cat.name}</span>
                                        {cat.isDefault && <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full font-bold">System Default</span>}
                                    </div>
                                    {!cat.isDefault && (
                                        <button onClick={() => storage.deleteCategory(cat.id).then(loadCategories)} className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 className="w-4 h-4"/>
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
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
    </div>
  );
};

export default Settings;
