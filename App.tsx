import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { InventoryItem, BorrowRecord, AppSettings, Category, BorrowRequest, AppUser, ROLE_DEFINITIONS } from './types';
import * as storage from './services/storageService';
import * as sync from './services/syncService';
import * as notifications from './services/notificationService';
import * as userService from './services/userService';
import { supabase, checkConnection } from './supabaseClient';
import Dashboard from './components/Dashboard';
import InventoryList from './components/InventoryList';
import LendingList from './components/LendingList';
import InventoryForm from './components/InventoryForm';
import QRCodeModal from './components/QRCodeModal';
import BulkBarcodeModal from './components/BulkBarcodeModal';
import BorrowModal from './components/BorrowModal';
import ReturnModal from './components/ReturnModal';
import Settings from './components/Settings';
import Login from './components/Login';
import Scanner from './components/Scanner';
import RequestsList from './components/RequestsList';
import PropertyManagement from './components/PropertyManagement';
import ConfirmModal from './components/ConfirmModal';
import AppFooter from './components/AppFooter';
import { getUserStatusUpdateTemplate } from './services/emailTemplates';
import { LayoutDashboard, List, Plus, FlaskConical, HandPlatter, Settings as SettingsIcon, LogOut, ScanLine, Inbox, RefreshCw, AlertCircle, Building2 } from 'lucide-react';
import { HEAD_TITLE, SYSTEM_FULL_NAME, SYSTEM_NAME, SYSTEM_SHORT_NAME } from './branding';

type AppView = 'dashboard' | 'inventory' | 'property' | 'lending' | 'scanner' | 'settings' | 'requests';

const viewPaths: Record<AppView, string> = {
  dashboard: '/dashboard',
  inventory: '/inventory/list',
  property: '/property/list',
  requests: '/requests',
  scanner: '/scanner/search',
  lending: '/lending/by-item',
  settings: '/settings/general'
};

const mobileNavigation = [
  { view: 'dashboard' as AppView, label: 'Home', icon: LayoutDashboard },
  { view: 'inventory' as AppView, label: 'Lab Inv', icon: FlaskConical },
  { view: 'property' as AppView, label: 'Property', icon: Building2 },
  { view: 'requests' as AppView, label: 'Requests', icon: Inbox },
  { view: 'scanner' as AppView, label: 'Scanner', icon: ScanLine },
  { view: 'lending' as AppView, label: 'Lending', icon: HandPlatter },
  { view: 'settings' as AppView, label: 'Settings', icon: SettingsIcon }
];

const appViews = new Set<AppView>(['dashboard', 'inventory', 'property', 'requests', 'scanner', 'lending', 'settings']);

const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathView = location.pathname.split('/').filter(Boolean)[0] as AppView | undefined;
  const view = pathView && appViews.has(pathView) ? pathView : 'dashboard';
  const setView = (nextView: AppView) => navigate(viewPaths[nextView]);

  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('scilab_auth') === 'true');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => userService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(() => storage.getCachedItems().length === 0);
  const [isDbConnected, setIsDbConnected] = useState<boolean | null>(null);
  
  const [isFirstLoad, setIsFirstLoad] = useState(() => storage.getCachedItems().length === 0);
  const [lastSynced, setLastSynced] = useState<Date>(new Date());

  const [items, setItems] = useState<InventoryItem[]>(() => storage.getCachedItems());
  const [borrowRecords, setBorrowRecords] = useState<BorrowRecord[]>(() => storage.getCachedBorrowRecords());
  const [settings, setSettings] = useState<AppSettings | null>(() => storage.getCachedSettings());
  const [categories, setCategories] = useState<Category[]>(() => storage.getCachedCategories());
  const [requests, setRequests] = useState<BorrowRequest[]>(() => storage.getCachedBorrowRequests());
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | undefined>(undefined);
  const [qrItem, setQrItem] = useState<InventoryItem | undefined>(undefined);
  const [barcodeItem, setBarcodeItem] = useState<InventoryItem | undefined>(undefined);
  const [isBorrowModalOpen, setIsBorrowModalOpen] = useState(false);
  const [preSelectedBorrowItem, setPreSelectedBorrowItem] = useState<InventoryItem | undefined>(undefined);
  const [borrowSpecificId, setBorrowSpecificId] = useState<string | undefined>(undefined);
  const [returnModalState, setReturnModalState] = useState<{ isOpen: boolean; record?: BorrowRecord; item?: InventoryItem }>({ isOpen: false });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean; title: string; message: string; onConfirm: () => void; isDestructive: boolean;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDestructive: false });

  const refreshData = useCallback(async (silent = false, forceRefresh = false) => {
      const hasCachedItems = storage.getCachedItems().length > 0;
      if (!silent && !hasCachedItems) setIsLoading(true);
      try {
          const connected = await checkConnection();
          setIsDbConnected(connected);

          if (!connected) {
              // We do not throw here, we just set the state so the UI can handle it gracefully
              setIsLoading(false);
              return false;
          }

          const loadedSettings = await storage.getSettings(forceRefresh);
          setSettings(loadedSettings);

          const [inventorySnapshot, loadedCats, loadedRequests] = await Promise.all([
              storage.getInventorySnapshot(forceRefresh),
              storage.getCategories(forceRefresh),
              storage.getBorrowRequests(forceRefresh)
          ]);
          const { items: loadedItems, borrowRecords: loadedRecords } = inventorySnapshot;
          
          setItems(loadedItems);
          setBorrowRecords(loadedRecords);
          setCategories(loadedCats);
          setRequests(loadedRequests);
          setLastSynced(new Date());
          
          return true;
      } catch (e: any) {
          console.error("Data loading failed", e);
          setIsDbConnected(false);
          return false;
      } finally {
          setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    const hasCache = storage.getCachedItems().length > 0;
    refreshData(hasCache, !hasCache)
      .then((success) => {
        if (success) {
            sync.performMaintenanceSync();
        }
        setIsFirstLoad(false);
      });

    // Subscriptions only if database is present
    let channels: any[] = [];
    if (isDbConnected) {
        channels = [
            supabase.channel('public:inventory_items').on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => refreshData(true, true).catch(() => {})).subscribe(),
            supabase.channel('public:borrow_records').on('postgres_changes', { event: '*', schema: 'public', table: 'borrow_records' }, () => refreshData(true, true).catch(() => {})).subscribe(),
            supabase.channel('public:app_settings').on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => refreshData(true, true).catch(() => {})).subscribe(),
            supabase.channel('public:categories').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => refreshData(true, true).catch(() => {})).subscribe(),
            supabase.channel('public:borrow_requests').on('postgres_changes', { event: '*', schema: 'public', table: 'borrow_requests' }, () => refreshData(true, true).catch(() => {})).subscribe(),
        ];
    }

    const cleanupRefresh = sync.setupAutoRefresh(() => {
        if (isDbConnected) {
            refreshData(true, false).then((success) => {
                if (success) sync.performMaintenanceSync();
            }).catch(() => {});
        }
    }, 300000); // 5 min auto-refresh

    return () => {
        channels.forEach(ch => supabase.removeChannel(ch));
        cleanupRefresh();
    };
  }, [refreshData, isDbConnected]);

  // Reflect the official title and an uploaded logo in the browser tab.
  useEffect(() => {
    document.title = HEAD_TITLE;

    try {
      let link: HTMLLinkElement | null = document.querySelector("link[rel='icon']");
      const logoUrl = settings?.logoUrl?.trim();

      if (!logoUrl) {
        link?.remove();
        return;
      }

      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.removeAttribute('type');
      link.href = logoUrl;
    } catch (e) {
      console.warn('Failed to update favicon dynamically', e);
    }
  }, [settings]);

  const sendStatusUpdateEmail = async (borrowerEmail: string, borrowerName: string, status: 'Approved' | 'Released' | 'Rejected' | 'Returned', items: {name: string, qty: number}[], returnDate: string) => {
      if (!borrowerEmail || !settings) return;

      try {
          const htmlBody = getUserStatusUpdateTemplate({
              borrowerName,
              referenceCode: "Active Record",
              status,
              returnDate,
              appName: settings.appName,
              items
          });

          await notifications.sendEmail(settings, {
              to_email: borrowerEmail,
              subject: `Update: Laboratory Equipment ${status}`,
              body: `Hello ${borrowerName}, your borrowed equipment status is now: ${status}.`,
              html_body: htmlBody
          });
      } catch (e) {
          console.error("Failed to send status email", e);
      }
  };

  const AppBrand = ({ compact = false }: { compact?: boolean }) => (
      <div className="flex items-start gap-3 min-w-0">
              {settings?.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-10 h-10 object-contain flex-shrink-0" />
              ) : (
                  <div className="bg-blue-600 p-2 rounded-md text-white shadow-sm flex-shrink-0">
                     <FlaskConical className="w-6 h-6" />
                  </div>
              )}
          <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-800 leading-tight">{SYSTEM_SHORT_NAME}</h1>
              {!compact && <p className="mt-1 text-[10px] font-semibold leading-4 text-gray-500">{SYSTEM_FULL_NAME}</p>}
              <p className={`${compact ? 'mt-0.5 text-[10px]' : 'text-[11px]'} leading-4 text-gray-600`}>Leon NHS - Science Laboratory</p>
          </div>
      </div>
  );

  const openBorrowModal = (item?: InventoryItem, sId?: string) => {
      setPreSelectedBorrowItem(item);
      setBorrowSpecificId(sId);
      setIsBorrowModalOpen(true);
  };

  const handleLogin = (status: boolean, user?: AppUser) => {
      if (status) {
          localStorage.setItem('scilab_auth', 'true');
          if (user) {
              setCurrentUser(user);
              userService.setCurrentUser(user);
          }
          setIsAuthenticated(true);
          navigate('/dashboard', { replace: true });
      }
  };

  const handleLogout = () => {
      localStorage.removeItem('scilab_auth');
      userService.setCurrentUser(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      navigate('/', { replace: true });
  };

  const confirmAction = (title: string, message: string, action: () => void, isDestructive = false) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm: () => { action(); setConfirmModal(prev => ({ ...prev, isOpen: false })); }, isDestructive });
  };

  const handleSave = async (item: InventoryItem) => {
    const result = await storage.saveItem(item);
    if (result.success) {
        await refreshData(true).catch(() => {});
        setIsFormOpen(false);
        setEditingItem(undefined);
    } else {
        alert("Save failed: " + (result.message || "Network error"));
    }
  };

  const handleDelete = async (id: string) => {
    confirmAction("Delete Equipment", "Permanently remove this equipment record? This action cannot be undone.", async () => {
        await storage.deleteItem(id);
        await refreshData(true).catch(() => {});
    }, true);
  };

  const handleDeleteRecord = async (id: string) => {
      confirmAction(
        "Delete Loan Record",
        "Permanently remove this borrowing record? This will NOT restore inventory. Use Return if the item was physically returned.",
        async () => {
            await storage.deleteBorrowRecord(id);
            await refreshData(true).catch(() => {});
        },
        true
      );
  };

  const handleDeleteRecordsBulk = async (ids: string[]) => {
      confirmAction(
        "Delete Bulk Records",
        `Permanently delete ${ids.length} selected borrowing records?`,
        async () => {
            for (const id of ids) {
                await storage.deleteBorrowRecord(id);
            }
            await refreshData(true).catch(() => {});
        },
        true
      );
  };

  const handleBorrowConfirm = async (item: InventoryItem, bName: string, bId: string, qty: number, dDate: string, borrowerEmail?: string, sId?: string) => {
    const result = await storage.borrowItem(item.id, bName, bId, qty, dDate, borrowerEmail, sId);
    if (result.success) {
        await refreshData(true).catch(() => {});
        setIsBorrowModalOpen(false);
    } else {
        alert(result.message || "Failed to save the loan record.");
    }
  };

  const initiateReturn = (recordId: string) => {
      const record = borrowRecords.find(r => r.id === recordId);
      if (!record) return;
      const item = items.find(i => i.id === record.itemId);
      setReturnModalState({ isOpen: true, record, item });
  };

  const handleReturnConfirm = async (details: any) => {
      const record = returnModalState.record;
      if (!record) return;
      
      const result = await storage.returnItem(record.id, details);
      if (result.success) {
          if (record.borrowerEmail) {
              await sendStatusUpdateEmail(
                  record.borrowerEmail,
                  record.borrowerName,
                  'Returned',
                  [{name: record.itemName, qty: record.quantity}],
                  new Date().toLocaleDateString()
              );
          }
          await refreshData(true).catch(() => {});
          setReturnModalState({ isOpen: false });
      } else {
          alert(result.message || "Failed to finalize the return.");
      }
  };

  if (isFirstLoad) {
      return (
          <div className="fixed inset-0 bg-gray-50 flex items-center justify-center z-50 px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#eff1ff_0%,#fdf2f7_38%,#ffffff_72%)]"></div>
              <div className="relative flex items-center justify-center">
                  <div className="relative flex h-32 w-32 items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-[10px] border-blue-100"></div>
                      <div className={`absolute inset-0 rounded-full border-[10px] border-transparent ${isDbConnected === false ? 'border-t-red-600' : 'border-t-blue-600 border-r-maroon-600'} animate-spin`}></div>
                      {settings?.logoUrl && (
                          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg border border-gray-100 overflow-hidden">
                              <img src={settings.logoUrl} alt="App loading" className="h-16 w-16 object-contain" />
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  if (isDbConnected === false) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
              <div className="max-w-md w-full bg-white rounded-md shadow-xl p-8 border border-red-100 text-center">
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Data Unavailable</h2>
                  <p className="text-gray-500 mb-8">The system cannot access laboratory records right now. Check your internet connection and try again.</p>
                  <button onClick={() => refreshData(false).catch(() => {})} className="w-full py-3 bg-blue-600 text-white rounded-md font-bold shadow-md hover:bg-blue-700 flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5" /> Reconnect Now
                  </button>
              </div>
          </div>
      );
  }

  if (location.pathname === '/' || location.pathname === '/request-status') {
      return <Login appName={settings?.appName || SYSTEM_NAME} logoUrl={settings?.logoUrl} settings={settings || undefined} onLogin={handleLogin} expectedUsername={settings?.adminUsername} expectedPassword={settings?.adminPassword} />;
  }

  if (!isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="flex h-[100dvh] text-gray-800 bg-transparent">
      <aside className="w-64 bg-white border-r border-gray-200 hidden md:flex flex-col h-full shadow-xl z-20">
        <div className="p-6 border-b border-gray-100 flex-shrink-0"><AppBrand /></div>

        {/* Current Logged-in User Profile Card */}
        <div className="px-4 py-3 mx-3 my-2 bg-slate-50 border border-slate-200 rounded-md flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black flex items-center justify-center text-xs flex-shrink-0 shadow-xs">
            {currentUser?.name
              ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              : 'AD'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-xs text-gray-900 truncate leading-tight">
              {currentUser?.name || 'Administrator'}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`text-[9.5px] px-1.5 py-0.2 rounded-xs font-bold border ${ROLE_DEFINITIONS[currentUser?.role || 'admin']?.badgeColor?.bg || 'bg-purple-100'} ${ROLE_DEFINITIONS[currentUser?.role || 'admin']?.badgeColor?.text || 'text-purple-800'} ${ROLE_DEFINITIONS[currentUser?.role || 'admin']?.badgeColor?.border || 'border-purple-300'}`}>
                {ROLE_DEFINITIONS[currentUser?.role || 'admin']?.title || 'Admin'}
              </span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {userService.canAccessView(currentUser, 'dashboard') && (
            <button onClick={() => setView('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors font-medium ${view === 'dashboard' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><LayoutDashboard className="w-5 h-5" /><span>Dashboard</span></button>
          )}
          {userService.canAccessView(currentUser, 'inventory') && (
            <button onClick={() => setView('inventory')} title="Laboratory Inventory: Glasswares, plastic containers & consumables (Non-PIS)" className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors font-medium ${view === 'inventory' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><FlaskConical className="w-5 h-5 flex-shrink-0" /><span>Lab Inventory</span></button>
          )}
          {userService.canAccessView(currentUser, 'property') && (
            <button onClick={() => setView('property')} title="Property Inventory: Equipment with Physical Property Stickers (PIS)" className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors font-medium ${view === 'property' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Building2 className="w-5 h-5 flex-shrink-0" /><span>Property Inventory</span></button>
          )}
          {userService.canAccessView(currentUser, 'requests') && (
            <button onClick={() => setView('requests')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors font-medium ${view === 'requests' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><Inbox className="w-5 h-5" /><span>Requests</span></button>
          )}
          {userService.canAccessView(currentUser, 'scanner') && (
            <button onClick={() => setView('scanner')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors font-medium ${view === 'scanner' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><ScanLine className="w-5 h-5" /><span>Scanner</span></button>
          )}
          {userService.canAccessView(currentUser, 'lending') && (
            <button onClick={() => setView('lending')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors font-medium ${view === 'lending' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><HandPlatter className="w-5 h-5" /><span>Lending</span></button>
          )}
          {userService.canAccessView(currentUser, 'settings') && (
            <button onClick={() => setView('settings')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-md transition-colors font-medium ${view === 'settings' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}><SettingsIcon className="w-5 h-5" /><span>Settings</span></button>
          )}
        </nav>
        <div className="p-4 border-t border-gray-100 flex-shrink-0">
            <div className="text-[9px] text-gray-400 font-mono mb-4 flex items-center gap-1 justify-center">
                <RefreshCw className={`w-2 h-2 ${isLoading ? 'animate-spin' : ''}`} />
                Last Updated: {lastSynced.toLocaleTimeString()}
            </div>
            <button onClick={handleLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-md text-red-600 hover:bg-red-50 transition-colors font-medium"><LogOut className="w-5 h-5" /><span>Log Out</span></button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 px-3 py-2.5 md:hidden flex justify-between items-center gap-2 z-30 shadow-sm flex-shrink-0">
             <AppBrand compact />
             <div className="flex items-center gap-2 flex-shrink-0">
                 <button aria-label="Refresh records" title="Refresh records" onClick={() => refreshData(true).catch(() => {})} className={`p-2 rounded-md text-gray-500 hover:bg-gray-100 ${isLoading ? 'animate-spin' : ''}`}><RefreshCw className="w-5 h-5"/></button>
                 <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg p-1 pr-1.5">
                     <div className="w-7 h-7 rounded-full bg-[#18008F] text-white font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                         {currentUser?.name
                           ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                           : 'SA'}
                     </div>
                     <button aria-label="Log out" title="Log out" onClick={handleLogout} className="p-1 rounded text-red-500 hover:bg-red-50">
                         <LogOut className="w-4 h-4"/>
                     </button>
                 </div>
             </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
            <div className="bg-white border-b border-gray-200 px-4 py-3 md:px-8 md:py-4 mb-4 md:mb-6 sticky top-0 z-10 shadow-sm">
                <div className="max-w-7xl mx-auto flex justify-between items-center gap-4">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-gray-900 uppercase">
                          {view === 'property' ? 'Property Inventory' : view === 'inventory' ? 'Laboratory Inventory' : view}
                        </h2>
                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wide">
                          {view === 'property' 
                            ? 'Physical Property Sticker (PIS) Tagged Assets & Equipment' 
                            : view === 'inventory' 
                              ? 'Glasswares, Plasticware & Consumables (Non-PIS)' 
                              : 'Laboratory Records'}
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {view === 'inventory' && (
                            <button onClick={() => setIsFormOpen(true)} className="flex items-center space-x-2 bg-blue-600 text-white px-3 md:px-4 py-2 rounded-md font-bold shadow-sm transition-colors hover:bg-blue-700 text-sm">
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Add Lab Item</span>
                                <span className="sm:hidden">Add</span>
                            </button>
                        )}

                        {/* Top Right User Profile Card matching screenshot + Logout Button */}
                        <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1.5 pr-2.5 shadow-xs gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#18008F] text-white font-black flex items-center justify-center text-sm flex-shrink-0 shadow-xs tracking-tight">
                                {currentUser?.name
                                  ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                  : 'SA'}
                            </div>
                            <div className="hidden sm:block text-left">
                                <div className="text-sm font-bold text-gray-900 leading-tight">
                                    {currentUser?.name || 'System Administrator'}
                                </div>
                                <div className="mt-0.5">
                                    <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded border bg-purple-50 text-purple-700 border-purple-200">
                                        {currentUser?.role === 'admin' ? 'Super Admin' : (ROLE_DEFINITIONS[currentUser?.role || 'admin']?.title || 'User')}
                                    </span>
                                </div>
                            </div>
                            <div className="h-7 w-px bg-gray-200 mx-0.5 hidden sm:block"></div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                title="Log Out"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                <span className="hidden lg:inline">Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 md:px-8 pb-8">
                <div className="max-w-7xl mx-auto">
                    <Routes>
                        <Route path="/dashboard" element={<Dashboard items={items} borrowRecords={borrowRecords} />} />
                        <Route path="/inventory/*" element={<InventoryList items={items} categories={categories} onEdit={(item) => { setEditingItem(item); setIsFormOpen(true); }} onDelete={handleDelete} onShowQR={setQrItem} onPrintBarcodes={setBarcodeItem} onRefresh={() => refreshData(false, true)} />} />
                        <Route path="/property/*" element={<PropertyManagement onRefreshParent={() => refreshData(true, true)} />} />
                        <Route path="/requests" element={<RequestsList onRefresh={() => refreshData(false, true)} />} />
                        <Route path="/scanner/*" element={<Scanner items={items} borrowRecords={borrowRecords} onBorrow={openBorrowModal} onReturn={initiateReturn} />} />
                        <Route path="/lending/*" element={<LendingList records={borrowRecords} requests={requests} onReturn={initiateReturn} onReturnBulk={() => {}} onDelete={handleDeleteRecord} onDeleteBulk={handleDeleteRecordsBulk} />} />
                        <Route path="/settings/*" element={settings ? <Settings settings={settings} onSave={storage.saveSettings} items={items} categories={categories} onCategoriesChange={() => refreshData(true, true)} /> : null} />
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </div>
            </div>
            <AppFooter className="border-t border-gray-200 bg-white/70" />
        </div>

        <nav
          aria-label="Primary navigation"
          className="md:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-7 border-t border-gray-200 bg-white/95 backdrop-blur-md shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {mobileNavigation.filter(nav => userService.canAccessView(currentUser, nav.view)).map(({ view: navView, label, icon: Icon }) => {
            const isActive = view === navView;
            return (
              <button
                key={navView}
                type="button"
                onClick={() => setView(navView)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-16 min-w-0 px-1 flex flex-col items-center justify-center gap-1 text-[9px] font-semibold transition-colors ${isActive ? 'text-blue-700 bg-blue-50' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="w-full truncate text-center">{label}</span>
              </button>
            );
          })}
        </nav>
      </main>

      {isFormOpen && <InventoryForm initialData={editingItem} categories={categories} onSubmit={handleSave} onCancel={() => { setIsFormOpen(false); setEditingItem(undefined); }} />}
      {qrItem && <QRCodeModal item={qrItem} onClose={() => setQrItem(undefined)} />}
      {barcodeItem && <BulkBarcodeModal item={barcodeItem} onClose={() => setBarcodeItem(undefined)} />}
      {isBorrowModalOpen && <BorrowModal availableItems={items} initialItem={preSelectedBorrowItem} specificId={borrowSpecificId} onConfirm={handleBorrowConfirm} onCancel={() => setIsBorrowModalOpen(false)} />}
      {returnModalState.isOpen && returnModalState.record && <ReturnModal record={returnModalState.record} item={returnModalState.item} onConfirm={handleReturnConfirm} onCancel={() => setReturnModalState({ isOpen: false })} />}
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))} isDestructive={confirmModal.isDestructive} />
    </div>
  );
};

export default App;
