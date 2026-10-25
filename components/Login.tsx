
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FlaskConical, Lock, User, AlertCircle, Eye, EyeOff, Mail, ArrowRight, ArrowLeft, KeyRound, Loader2, Send, ShoppingBag, Search, QrCode, MapPin, Activity, Box, Tag, Building2, ShieldCheck, Barcode, CheckCircle2, Radio, RefreshCw, Clock, Volume2, VolumeX, X } from 'lucide-react';
import { AppSettings, BorrowRequest, InventoryItem, PropertyItem, AppUser } from '../types';
import * as storage from '../services/storageService';
import * as propertyStorage from '../services/propertyStorageService';
import * as notifications from '../services/notificationService';
import * as userService from '../services/userService';
import { getPasswordResetTemplate } from '../services/emailTemplates';
import PublicRequestModal from './PublicRequestModal';
import { getCategoryColor, getCategoryIcon } from '../constants';
import { SYSTEM_NAME, SYSTEM_SUBTITLE } from '../branding';
import { LEON_NHS_SEAL_DATA_URI } from '../services/schoolSeal';
import AppFooter from './AppFooter';
import { useLearnerRoster, RegistrarLearner } from '../services/usisRoster';
import usbScannerService from '../services/usbScannerService';
import { lookupScannedBarcode } from '../services/scannerLookupService';
import LearnerConfirmModal from './LearnerConfirmModal';

interface LoginProps {
  appName: string;
  logoUrl?: string;
  backgroundImageUrl?: string;
  customFooterText?: string;
  expectedUsername?: string;
  expectedPassword?: string;
  recoveryEmail?: string;
  settings?: AppSettings; 
  onLogin: (status: boolean, user?: AppUser) => void;
  onPasswordReset?: (newPassword: string) => void;
}

const stripMetadata = (text: string) => {
    if (!text) return '';
    return text.replace(/<!--SYSTEM_META:.*?-->/g, '').trim();
};

const Login: React.FC<LoginProps> = ({ 
    appName, 
    logoUrl, 
    backgroundImageUrl, 
    customFooterText, 
    expectedUsername,
    expectedPassword,
    recoveryEmail,
    settings,
    onLogin,
    onPasswordReset
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isKioskInit = location.pathname === '/kiosk' || new URLSearchParams(location.search).get('kiosk') === 'true';
  const [viewMode, setViewMode] = useState<'landing' | 'admin' | 'reset' | 'item_view' | 'request_lookup' | 'property_view' | 'kiosk'>(
      isKioskInit ? 'kiosk' : location.pathname === '/request-status' ? 'request_lookup' : 'landing'
  );

  // USIS Satellite Offline Learner Roster Hook
  const {
    learners,
    totalCount: rosterCount,
    isHydrated: isRosterHydrated,
    isSyncing: isRosterSyncing,
    lastSyncedAt: rosterLastSyncedAt,
    revalidate: syncRoster,
    findLearner
  } = useLearnerRoster();

  const [kioskLearner, setKioskLearner] = useState<RegistrarLearner | null>(null);
  const [kioskLearnerEmail, setKioskLearnerEmail] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingConfirmLearner, setPendingConfirmLearner] = useState<RegistrarLearner | null>(null);
  const [manualLrn, setManualLrn] = useState('');
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [kioskToast, setKioskToast] = useState<{ message: string; submessage?: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [kioskSound, setKioskSound] = useState(() => usbScannerService.isSoundEnabled());
  const [scannerStatus, setScannerStatus] = useState(() => usbScannerService.getStatus());

  useEffect(() => {
    const unsub = usbScannerService.onStatus((status) => {
      setScannerStatus(status);
    });
    return () => unsub();
  }, []);

  const handleConnectRfid = async () => {
    const res = await usbScannerService.requestRfidScanner();
    if (res.success) {
      setKioskToast({
        message: 'RFID Scanner Connected',
        submessage: res.deviceName,
        type: 'success'
      });
    } else if (res.error && res.error !== 'No USB device was selected.') {
      setKioskToast({
        message: 'Connection Failed',
        submessage: res.error,
        type: 'error'
      });
    }
  };

  const handleConnectBarcode = async () => {
    const res = await usbScannerService.requestBarcodeScanner();
    if (res.success) {
      setKioskToast({
        message: 'Barcode Scanner Connected',
        submessage: res.deviceName,
        type: 'success'
      });
    } else if (res.error && res.error !== 'No USB device was selected.') {
      setKioskToast({
        message: 'Connection Failed',
        submessage: res.error,
        type: 'error'
      });
    }
  };

  const handleLearnerConfirmed = (confirmedLearner: RegistrarLearner, email: string) => {
    setShowConfirmModal(false);
    setPendingConfirmLearner(null);
    setKioskLearner(confirmedLearner);
    setKioskLearnerEmail(email);
    setShowRequestModal(true);
  };

  const handleLearnerCancel = () => {
    setShowConfirmModal(false);
    setPendingConfirmLearner(null);
  };

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showRequestModal, setShowRequestModal] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [trackResult, setTrackResult] = useState<BorrowRequest | null | 'not_found'>(null);
  const [isTrackLoading, setIsTrackLoading] = useState(false);

  const [publicItem, setPublicItem] = useState<InventoryItem | null>(null);
  const [isItemLoading, setIsItemLoading] = useState(false);

  const [publicProperty, setPublicProperty] = useState<PropertyItem | null>(null);
  const [publicPisCode, setPublicPisCode] = useState<string>('');
  const [isPropertyLoading, setIsPropertyLoading] = useState(false);

  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [inputEmail, setInputEmail] = useState('');
  const [inputOtp, setInputOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    const viewItem = params.get('view_item');
    const viewPis = params.get('view_pis');

    if (viewPis) {
        setViewMode('property_view');
        loadPublicProperty(viewPis);
    } else if (viewItem) {
        setViewMode('item_view');
        loadPublicItem(viewItem);
    } else if (ref) {
        setTrackCode(ref);
        setViewMode('request_lookup');
        if (window.location.pathname !== '/request-status') {
            navigate(`/request-status?ref=${encodeURIComponent(ref)}`, { replace: true });
        }
        handleTrackRequest(undefined, ref);
    }
  }, []);

  useEffect(() => {
      const searchParams = new URLSearchParams(location.search);
      if (location.pathname === '/kiosk' || searchParams.get('kiosk') === 'true') {
          setViewMode('kiosk');
      } else if (location.pathname === '/request-status') {
          setViewMode('request_lookup');
      } else if (searchParams.get('view_pis')) {
          setViewMode('property_view');
      } else if (searchParams.get('view_item')) {
          setViewMode('item_view');
      } else if (location.pathname === '/' && viewMode !== 'kiosk') {
          setViewMode('landing');
      }
  }, [location.pathname, location.search]);

  // Digital clock for kiosk screen
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Standby Scanner Listener when Kiosk is Active and Form is not open
  useEffect(() => {
    if (viewMode !== 'kiosk' || showRequestModal || showConfirmModal) return;

    const unsub = usbScannerService.onScan(async (code) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      // 1. Look up student in roster cache
      const learner = findLearner(cleanCode);
      if (learner) {
        usbScannerService.markRfidDetected();
        usbScannerService.playSuccessBeep();
        // Show confirmation box before going to borrowers view
        setPendingConfirmLearner(learner);
        setShowConfirmModal(true);
        return;
      }

      // 2. Look up equipment barcode
      try {
        const lookup = await lookupScannedBarcode(cleanCode, [], []);
        if (lookup.matchType === 'property_item' || lookup.matchType === 'lab_item') {
          usbScannerService.markBarcodeDetected();
          usbScannerService.playSuccessBeep();
          setKioskLearner(null);
          setKioskLearnerEmail('');
          setShowRequestModal(true);
          setKioskToast({
            message: `Equipment Scanned: ${lookup.propertyItem?.name || lookup.labItem?.name}`,
            submessage: 'Now tap student RFID ID card or enter LRN.',
            type: 'info'
          });
          return;
        }
      } catch (err) {}

      // 3. Fallback: Unregistered / Unindexed RFID Card or ID -> Directly open Public Request Modal for manual entry
      usbScannerService.markRfidDetected();
      usbScannerService.playSuccessBeep();
      setPendingConfirmLearner(null);
      setShowConfirmModal(false);
      setKioskLearner({
        id: cleanCode,
        lrn: cleanCode,
        first_name: '',
        last_name: '',
        middle_name: '',
        gender: null,
        birth_date: null,
        status: 'Active',
        section_id: null,
        full_name: '',
        name: '',
        section_name: '',
        grade_level: ''
      });
      setKioskLearnerEmail('');
      setShowRequestModal(true);
      setKioskToast({
        message: `Card Scanned: "${cleanCode}"`,
        submessage: 'No learner profile found in USIS roster. Please manually fill in your borrower information.',
        type: 'info'
      });
    });

    return () => {
      unsub();
    };
  }, [viewMode, showRequestModal, showConfirmModal, findLearner]);

  useEffect(() => {
    if (kioskToast) {
      const timer = setTimeout(() => setKioskToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [kioskToast]);

  const handleManualLrnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = manualLrn.trim();
    if (!query) return;

    const learner = findLearner(query);
    if (learner) {
      usbScannerService.playSuccessBeep();
      setPendingConfirmLearner(learner);
      setShowConfirmModal(true);
      setManualLrn('');
    } else {
      // Unregistered LRN -> Directly open Public Request Modal for manual entry
      usbScannerService.playSuccessBeep();
      setPendingConfirmLearner(null);
      setShowConfirmModal(false);
      setKioskLearner({
        id: query,
        lrn: query,
        first_name: '',
        last_name: '',
        middle_name: '',
        gender: null,
        birth_date: null,
        status: 'Active',
        section_id: null,
        full_name: '',
        name: '',
        section_name: '',
        grade_level: ''
      });
      setKioskLearnerEmail('');
      setShowRequestModal(true);
      setManualLrn('');
      setKioskToast({
        message: `LRN "${query}" not found in USIS`,
        submessage: 'Please manually fill in your borrower information in the form.',
        type: 'info'
      });
    }
  };

  const loadPublicItem = async (id: string) => {
      setIsItemLoading(true);
      const item = await storage.getInventoryItem(id);
      setPublicItem(item);
      setIsItemLoading(false);
  };

  const loadPublicProperty = async (pisCode: string) => {
      setIsPropertyLoading(true);
      setPublicPisCode(pisCode);
      try {
          const items = await propertyStorage.getPropertyItems();
          const prop = propertyStorage.getPropertyByPIS(items, pisCode);
          setPublicProperty(prop || null);
      } catch (e) {
          console.error('Error loading property for public view:', e);
          setPublicProperty(null);
      } finally {
          setIsPropertyLoading(false);
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 1. First, attempt authentication against RBAC users database
    try {
      const authResult = await userService.authenticateUser(username, password);
      if (authResult.user) {
        onLogin(true, authResult.user);
        return;
      } else if (authResult.error && authResult.error.includes('suspended')) {
        setError(authResult.error);
        return;
      }
    } catch (err) {
      console.warn('RBAC user authentication error, trying fallback:', err);
    }

    // 2. Fallback check for settings-configured admin credentials
    const validUser = expectedUsername || 'admin';
    const validPass = expectedPassword || 'admin123';

    if (username === validUser && password === validPass) {
      const defaultAdmin: AppUser = {
        id: 'user-001',
        username: validUser,
        name: 'System Administrator',
        email: recoveryEmail || 'admin@leonnationalhigh.edu.ph',
        role: 'admin',
        department: 'ICT & Laboratory Administration',
        permissions: [
          'inventory:view', 'inventory:manage',
          'property:view', 'property:manage',
          'requests:view', 'requests:manage',
          'lending:view', 'lending:manage',
          'scanner:use',
          'settings:view', 'settings:manage',
          'users:manage'
        ],
        status: 'active',
        createdAt: new Date().toISOString()
      };
      userService.setCurrentUser(defaultAdmin);
      onLogin(true, defaultAdmin);
    } else {
      setError('Invalid username or password');
    }
  };

  const handleTrackRequest = async (e?: React.FormEvent, codeOverride?: string) => {
      if (e) e.preventDefault();
      const code = codeOverride || trackCode;
      
      if (!code.trim()) return;
      
      setIsTrackLoading(true);
      setTrackResult(null);
      const res = await storage.getBorrowRequestByCode(code.trim().toUpperCase());
      setTrackResult(res || 'not_found');
      setIsTrackLoading(false);
  };

  const sendOtpEmail = async (email: string, otp: string) => {
      if (!settings) throw new Error('Application settings are unavailable.');

      const htmlBody = getPasswordResetTemplate({
          code: otp,
          appName: appName || SYSTEM_NAME
      });
      
      const body = `Your Password Reset Code is: ${otp}\n\n` + 
                   `If you did not request this, please ignore this email.\n\n` +
                   `Sent from ${appName || SYSTEM_NAME}`;

      const sent = await notifications.sendEmail(settings, {
          to_email: email,
          subject: "Password Reset Request",
          body,
          html_body: htmlBody
      });
      if (!sent) throw new Error('The SMTP server could not send the reset email.');
  };

  const handleResetStep1 = async (e: React.FormEvent) => {
      e.preventDefault();
      setResetError('');
      const validEmail = recoveryEmail || 'admin@school.edu';
      if (inputEmail.trim().toLowerCase() === validEmail.toLowerCase()) {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          setGeneratedOtp(otp);
          setIsSendingOtp(true);
          try {
              await sendOtpEmail(validEmail, otp);
              setResetStep(2);
          } catch (err: any) {
              setResetError(err.message || "Failed to send verification email.");
          } finally {
              setIsSendingOtp(false);
          }
      } else {
          setResetError('Email address does not match the recovery email on file.');
      }
  };

  const handleResetStep2 = (e: React.FormEvent) => {
      e.preventDefault();
      setResetError('');
      if (inputOtp === generatedOtp) setResetStep(3);
      else setResetError('Invalid verification code.');
  };

  const handleResetStep3 = (e: React.FormEvent) => {
      e.preventDefault();
      setResetError('');
      if (newPassword.length < 4) { setResetError('Password is too short.'); return; }
      if (newPassword !== confirmPassword) { setResetError('Passwords do not match.'); return; }
      if (onPasswordReset) {
          onPasswordReset(newPassword);
          setResetSuccess('Password updated successfully!');
          setTimeout(() => {
              setViewMode('admin');
              setResetStep(1);
              setResetSuccess('');
          }, 2000);
      }
  };

  const getStatusColor = (status: string) => {
      switch (status) {
          case 'Approved': return 'text-green-600 bg-green-50 border-green-200';
          case 'Pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
          case 'Rejected': return 'text-maroon-600 bg-maroon-50 border-maroon-200';
          case 'Completed': return 'text-blue-600 bg-blue-50 border-blue-200';
          case 'Released': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
          case 'Returned': return 'text-teal-600 bg-teal-50 border-teal-200';
          default: return 'text-gray-600 bg-gray-50';
      }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center py-12 px-4 relative overflow-hidden">
      <div className="relative z-10 mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex justify-center mb-4">
            {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-24 h-24 object-contain" />
            ) : (
                <div className="bg-blue-600 p-4 rounded-md shadow-md text-white">
                    <FlaskConical className="w-12 h-12" />
                </div>
            )}
        </div>
        <h2 className="max-w-5xl px-4 text-xl sm:text-2xl md:text-3xl font-extrabold leading-tight text-gray-800">{appName}</h2>
        <p className="px-4 text-gray-500 mt-2 font-medium">{SYSTEM_SUBTITLE}</p>
      </div>

      <div className="relative z-10 w-full max-w-4xl bg-white/90 backdrop-blur-xl border border-gray-200 rounded-md shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
        {viewMode === 'landing' && (
            <div className="flex-1 flex flex-col animate-in fade-in zoom-in duration-300">
                <div className="flex-1 p-8 md:p-12 flex flex-col justify-center items-center relative group">
                    <div className="relative z-10 text-center space-y-8 w-full max-w-2xl">
                        <div>
                            <div className="bg-maroon-100 p-5 rounded-full inline-flex mb-4">
                                <ShoppingBag className="w-12 h-12 text-maroon-600" />
                            </div>
                            <h3 className="text-3xl font-bold text-gray-800">Student / Guest Portal</h3>
                            <p className="text-gray-500 mt-2 text-lg">Browse available equipment and submit borrow requests instantly.</p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                            <button 
                                onClick={() => {
                                    setKioskLearner(null);
                                    setShowRequestModal(true);
                                }}
                                className="w-full sm:w-auto px-8 py-3.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-md font-bold shadow-md transition-all flex items-center justify-center gap-2.5 text-base"
                            >
                                <ShoppingBag className="w-5 h-5" /> Start Request
                            </button>
                            <button
                                onClick={() => navigate('/request-status')}
                                className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 rounded-md font-bold shadow-sm transition-colors flex items-center justify-center gap-2.5 text-base"
                            >
                                <Search className="w-5 h-5" /> Track Request
                            </button>
                        </div>
                    </div>
                </div>

                <div className="py-3 px-4 border-t border-gray-100 bg-gray-50 flex flex-col items-center justify-center gap-1">
                    <button 
                        onClick={() => {
                            setViewMode('kiosk');
                            navigate('/kiosk');
                        }}
                        className="text-gray-600 hover:text-maroon-700 text-xs font-medium flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
                    >
                        <Barcode className="w-3.5 h-3.5 text-maroon-600" /> Kiosk Station (RFID & Barcode)
                    </button>
                    <button 
                        onClick={() => setViewMode('admin')}
                        className="text-gray-400 hover:text-blue-600 text-xs font-medium flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-md hover:bg-gray-100"
                    >
                        <Lock className="w-3 h-3" /> Lab Admin Access
                    </button>
                </div>
            </div>
        )}

        {viewMode === 'kiosk' && (
            <div className="flex-1 flex flex-col p-6 md:p-10 animate-in fade-in duration-300 bg-white">
                {/* Centered Date & Time Header */}
                <div className="text-center pb-5 border-b border-gray-200">
                    <div className="flex items-center justify-center gap-2 text-2xl sm:text-3xl font-mono font-bold text-gray-800 tracking-tight">
                        <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-maroon-600" />
                        <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500 mt-1">
                        {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                </div>

                {/* Hardware & Cache Status Bar */}
                <div className="py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-md my-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-5 text-gray-600">
                        <span className="inline-flex items-center gap-1.5">
                            <Radio className={`w-3.5 h-3.5 ${scannerStatus.rfid.isConnected ? 'text-maroon-600' : 'text-gray-400'}`} />
                            <span className="font-semibold text-gray-800">RFID Scanner:</span>
                            {scannerStatus.rfid.isConnected ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="text-emerald-700 font-semibold" title={scannerStatus.rfid.deviceName || 'Connected'}>
                                        Connected
                                    </span>
                                    {scannerStatus.rfid.source === 'webhid' && (
                                        <button
                                            type="button"
                                            onClick={() => usbScannerService.disconnectRfid()}
                                            className="text-[10px] text-gray-400 hover:text-red-600 transition-colors"
                                            title="Disconnect USB RFID reader"
                                        >
                                            [Disconnect]
                                        </button>
                                    )}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-gray-500">
                                    <span className="text-red-600 font-medium">Disconnected</span>
                                    {usbScannerService.isWebHIDSupported() && (
                                        <button
                                            type="button"
                                            onClick={handleConnectRfid}
                                            className="px-1.5 py-0.5 text-[11px] font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded transition-colors cursor-pointer"
                                            title="Click to connect USB RFID scanner"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </span>
                            )}
                        </span>

                        <span className="inline-flex items-center gap-1.5">
                            <Barcode className={`w-3.5 h-3.5 ${scannerStatus.barcode.isConnected ? 'text-gray-800' : 'text-gray-400'}`} />
                            <span className="font-semibold text-gray-800">Barcode Scanner:</span>
                            {scannerStatus.barcode.isConnected ? (
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="text-emerald-700 font-semibold" title={scannerStatus.barcode.deviceName || 'Connected'}>
                                        Connected
                                    </span>
                                    {scannerStatus.barcode.source === 'webhid' && (
                                        <button
                                            type="button"
                                            onClick={() => usbScannerService.disconnectBarcode()}
                                            className="text-[10px] text-gray-400 hover:text-red-600 transition-colors"
                                            title="Disconnect USB Barcode scanner"
                                        >
                                            [Disconnect]
                                        </button>
                                    )}
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1.5 text-gray-500">
                                    <span className="text-red-600 font-medium">Disconnected</span>
                                    {usbScannerService.isWebHIDSupported() && (
                                        <button
                                            type="button"
                                            onClick={handleConnectBarcode}
                                            className="px-1.5 py-0.5 text-[11px] font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded transition-colors cursor-pointer"
                                            title="Click to connect USB Barcode scanner"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </span>
                            )}
                        </span>

                        <span>
                            <span className="font-bold text-gray-800">{rosterCount}</span> learners in offline cache
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => syncRoster()}
                            disabled={isRosterSyncing}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 text-[11px] font-medium transition-colors"
                            title="Synchronize offline student list with master registrar database"
                        >
                            <RefreshCw className={`w-3 h-3 ${isRosterSyncing ? 'animate-spin text-maroon-600' : ''}`} />
                            {isRosterSyncing ? 'Syncing...' : 'Sync Roster'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                const next = !kioskSound;
                                setKioskSound(next);
                                usbScannerService.setSoundEnabled(next);
                            }}
                            className="p-1 rounded bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
                            title={kioskSound ? 'Mute scanner sounds' : 'Enable scanner sounds'}
                        >
                            {kioskSound ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-red-500" />}
                        </button>
                    </div>
                </div>

                {/* Scan Toast */}
                {kioskToast && (
                    <div className={`mb-4 py-2.5 px-4 rounded-md text-xs flex items-center justify-between gap-2 border animate-in slide-in-from-top-2 ${
                        kioskToast.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-200' :
                        kioskToast.type === 'error' ? 'bg-red-50 text-red-900 border-red-200' :
                        'bg-blue-50 text-blue-900 border-blue-200'
                    }`}>
                        <div>
                            <span className="font-bold">{kioskToast.message}</span>
                            {kioskToast.submessage && <span className="opacity-90 ml-2">— {kioskToast.submessage}</span>}
                        </div>
                        <button onClick={() => setKioskToast(null)} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
                    </div>
                )}

                {/* Center Hero Card OR In-Card USIS Verification & Confirmation View */}
                {!pendingConfirmLearner ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center my-6 max-w-xl mx-auto w-full">
                        <div className="w-28 h-28 rounded-full bg-maroon-50 border-2 border-maroon-200 flex items-center justify-center mb-6">
                            <Radio className="w-14 h-14 text-maroon-600" />
                        </div>

                        {/* Logo & Headline Stack */}
                        <div className="flex flex-col items-center justify-center">
                            <img
                                src="/img/leon-nhs-id-logo.png"
                                alt="LEON NHS ID"
                                className="h-12 sm:h-14 w-auto object-contain mb-3"
                            />
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight uppercase">
                                TAP YOUR CARD WITH RFID
                            </h2>
                        </div>

                        {/* Manual LRN Form Fallback */}
                        <form onSubmit={handleManualLrnSubmit} className="mt-8 w-full max-w-md">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualLrn}
                                    onChange={(e) => setManualLrn(e.target.value)}
                                    placeholder="Or enter 12-digit Learner Reference No. (LRN)..."
                                    className="flex-1 px-4 py-2.5 bg-white border border-gray-300 rounded-md text-sm text-gray-800 focus:ring-2 focus:ring-maroon-500 outline-none"
                                />
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 bg-maroon-600 hover:bg-maroon-700 text-white rounded-md font-bold text-sm shadow-sm transition-colors flex items-center gap-1.5"
                                >
                                    <ArrowRight className="w-4 h-4" /> Start
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1.5 text-left">
                                Learner ID cards from other schools can also be entered manually.
                            </p>
                        </form>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center w-full my-4">
                        <LearnerConfirmModal
                            isOpen={Boolean(pendingConfirmLearner)}
                            learner={pendingConfirmLearner}
                            onConfirm={handleLearnerConfirmed}
                            onCancel={handleLearnerCancel}
                            inline={true}
                        />
                    </div>
                )}

                {/* Bottom Actions */}
                {!pendingConfirmLearner && (
                    <div className="pt-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
                        <button
                            onClick={() => {
                                setKioskLearner(null);
                                setShowRequestModal(true);
                            }}
                            className="text-xs font-semibold text-gray-600 hover:text-maroon-700 flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors"
                        >
                            <ShoppingBag className="w-3.5 h-3.5" /> Start Request Form (Without ID)
                        </button>

                        <button
                            onClick={() => {
                                setViewMode('landing');
                                navigate('/');
                            }}
                            className="text-xs font-semibold text-gray-400 hover:text-gray-700 flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" /> Exit Kiosk Station
                        </button>
                    </div>
                )}
            </div>
        )}

        {viewMode === 'request_lookup' && (
            <div className="flex-1 p-8 md:p-12 animate-in fade-in slide-in-from-right-8 duration-300 bg-white">
                <div className="w-full max-w-lg mx-auto">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 text-sm transition-colors mb-10">
                        <ArrowLeft className="w-4 h-4" /> Back to Portal
                    </button>

                    <div className="text-center mb-8">
                        <Search className="w-10 h-10 text-maroon-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-gray-800">Request Status</h3>
                        <p className="text-sm text-gray-500 mt-2">Enter your reference code to view the latest status.</p>
                    </div>

                    <form onSubmit={(e) => handleTrackRequest(e)} className="relative shadow-sm rounded-md">
                        <input
                            type="text"
                            value={trackCode}
                            onChange={(e) => setTrackCode(e.target.value)}
                            placeholder="Enter Reference Code (e.g. REQ-123456)"
                            aria-label="Request reference code"
                            className="w-full pl-4 pr-12 py-3 bg-white border border-gray-200 rounded-md text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-maroon-500 outline-none transition-all"
                        />
                        <button type="submit" aria-label="Look up request" className="absolute right-2 top-2 bottom-2 p-2 text-gray-400 hover:text-maroon-600">
                            {isTrackLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <ArrowRight className="w-5 h-5" />}
                        </button>
                    </form>

                    {trackResult && (
                        <div className="mt-5 animate-in fade-in slide-in-from-top-2">
                            {trackResult === 'not_found' ? (
                                <div className="p-4 bg-red-50 rounded-md border border-red-100 text-red-600 text-sm flex items-center gap-2 justify-center font-medium">
                                    <AlertCircle className="w-4 h-4"/> Request not found
                                </div>
                            ) : (
                                <div className="p-5 rounded-md border border-gray-200 flex justify-between items-center gap-4 bg-white shadow-sm">
                                    <div className="text-left min-w-0">
                                        <div className="text-gray-900 font-bold truncate">{trackResult.borrowerName}</div>
                                        <div className="text-xs text-gray-500 mt-1">Ref: {trackResult.referenceCode}</div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase border whitespace-nowrap ${getStatusColor(trackResult.status)}`}>
                                        {trackResult.status === 'Released' ? 'Released (Active)' : (trackResult.status === 'Completed' || trackResult.status === 'Returned') ? 'Returned' : trackResult.status}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        )}

        {viewMode === 'item_view' && (
            <div className="flex-1 flex flex-col p-8 md:p-12 animate-in fade-in zoom-in duration-300">
                 <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col">
                    <button onClick={() => { setViewMode('landing'); window.history.replaceState({}, '', window.location.pathname); }} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 text-sm transition-colors mb-6 w-fit">
                        <ArrowLeft className="w-4 h-4" /> Back to Portal
                    </button>

                    {isItemLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <Loader2 className="w-12 h-12 text-maroon-600 animate-spin mb-4" />
                            <p className="text-gray-500">Loading Equipment Details...</p>
                        </div>
                    ) : publicItem ? (
                        <div className="space-y-8">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-3xl font-extrabold text-gray-800 mb-2">{publicItem.name}</h2>
                                    <div className="flex gap-2">
                                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200">
                                            {publicItem.category}
                                        </span>
                                        {publicItem.shortId && (
                                            <span className="px-3 py-1 rounded-full text-sm font-mono bg-blue-50 text-blue-700 border border-blue-100">
                                                ID: {publicItem.shortId}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 bg-white rounded-md shadow-sm border border-gray-100">
                                    <div style={{ color: getCategoryColor(publicItem.category) }}>
                                        {getCategoryIcon(publicItem.category)}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-maroon-50/50 border border-maroon-100 rounded-md p-6 shadow-sm">
                                <div className="flex items-center gap-3 mb-2">
                                    <Box className="w-5 h-5 text-maroon-600" />
                                    <h3 className="text-lg font-bold text-gray-800">Availability Status</h3>
                                </div>
                                {(() => {
                                    const limit = publicItem.maxBorrowable ?? publicItem.quantity;
                                    const available = Math.max(0, limit - (publicItem.borrowedQuantity || 0));
                                    const percentage = (available / limit) * 100;
                                    
                                    return (
                                        <>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl font-extrabold text-maroon-600">
                                                    {available}
                                                </span>
                                                <span className="text-lg text-gray-500 font-medium">
                                                    pieces available
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 mt-4 overflow-hidden">
                                                <div 
                                                    className="bg-maroon-500 h-full rounded-full transition-all duration-500" 
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-2 text-right">
                                                {(publicItem.maxBorrowable !== undefined && publicItem.maxBorrowable !== null)
                                                    ? `Limited Stock (Total Inventory: ${publicItem.quantity} ${publicItem.unit || 'units'})`
                                                    : `Total in Inventory: ${publicItem.quantity} ${publicItem.unit || 'units'}`
                                                }
                                            </p>
                                        </>
                                    );
                                })()}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-gray-50 p-5 rounded-md border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3 text-gray-700 font-bold">
                                        <MapPin className="w-4 h-4" /> Location
                                    </div>
                                    <p className="text-gray-600">{publicItem.location}</p>
                                </div>
                                <div className="bg-gray-50 p-5 rounded-md border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3 text-gray-700 font-bold">
                                        <Activity className="w-4 h-4" /> Condition
                                    </div>
                                    <p className="text-gray-600">{publicItem.condition}</p>
                                </div>
                            </div>

                            {publicItem.description && (
                                <div>
                                    <h4 className="font-bold text-gray-800 mb-2">Description</h4>
                                    <p className="text-gray-600 leading-relaxed bg-white p-4 border border-gray-100 rounded-md">
                                        {stripMetadata(publicItem.description)}
                                    </p>
                                </div>
                            )}

                             {publicItem.safetyNotes && (
                                <div className="bg-orange-50 p-5 rounded-md border border-orange-100">
                                    <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" /> Safety Notes
                                    </h4>
                                    <p className="text-orange-700 text-sm leading-relaxed">
                                        {publicItem.safetyNotes}
                                    </p>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center">
                            <div className="p-4 bg-gray-100 rounded-full mb-4">
                                <Search className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Item Not Found</h3>
                            <p className="text-gray-500 mt-2">The requested equipment could not be found or has been removed.</p>
                        </div>
                    )}
                 </div>
            </div>
        )}

        {viewMode === 'property_view' && (
            <div className="flex-1 flex flex-col p-6 sm:p-8 md:p-10 animate-in fade-in zoom-in duration-300">
                 <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col">
                    <button 
                        onClick={() => { setViewMode('landing'); window.history.replaceState({}, '', window.location.pathname); }} 
                        className="text-gray-500 hover:text-gray-800 flex items-center gap-2 text-sm transition-colors mb-4 w-fit font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Portal
                    </button>

                    {isPropertyLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-16">
                            <Loader2 className="w-12 h-12 text-[#b59a00] animate-spin mb-4" />
                            <p className="text-gray-600 font-medium">Verifying School Property Record...</p>
                        </div>
                    ) : publicProperty ? (
                        <div className="space-y-6">
                            {/* Realistic PIS Header Banner resembling the physical yellow sticker */}
                            <div className="bg-[#FFF000] border-2 border-black rounded-md p-4 sm:p-5 text-black shadow-md relative overflow-hidden">
                                <div className="flex items-center gap-3 border-b-2 border-black pb-3">
                                    <img
                                        src={LEON_NHS_SEAL_DATA_URI}
                                        alt="Leon NHS Seal"
                                        className="w-12 h-12 flex-shrink-0 object-contain"
                                    />
                                    <div className="leading-tight flex-1 min-w-0">
                                        <div className="text-base sm:text-lg font-black tracking-tight uppercase truncate">LEON NATIONAL HIGH SCHOOL</div>
                                        <div className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-gray-900">SCIENCE DEPARTMENT</div>
                                        <div className="text-xs sm:text-sm font-black tracking-normal uppercase mt-0.5">PROPERTY INVENTORY STICKER (PIS)</div>
                                    </div>
                                    <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-sm bg-black text-[#FFF000] text-xs font-black uppercase tracking-wider">
                                        <ShieldCheck className="w-3.5 h-3.5" /> DepEd Verified
                                    </span>
                                </div>

                                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 font-mono">
                                    <div>
                                        <span className="text-xs font-bold text-gray-800 uppercase block sm:inline mr-2">Property Code:</span>
                                        <span className="text-base sm:text-lg font-extrabold tracking-wide text-black bg-white/70 px-2.5 py-0.5 rounded-sm border border-black/40">
                                            {publicProperty.propertyNumber}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-800 uppercase">PIS Tag:</span>
                                        <span className="text-sm font-black text-black bg-yellow-200/90 px-2 py-0.5 rounded-sm border border-black/30">
                                            {publicProperty.pisCode || publicPisCode}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Main Information Card */}
                            <div className="bg-white border border-gray-200 rounded-md p-5 sm:p-6 shadow-sm space-y-5">
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-gray-100 pb-4">
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                                {publicProperty.category}
                                            </span>
                                            <span className="px-2.5 py-0.5 rounded-sm text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                                {publicProperty.inventoryType}
                                            </span>
                                        </div>
                                        <h2 className="text-2xl font-black text-gray-900">{publicProperty.name}</h2>
                                    </div>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold uppercase border whitespace-nowrap self-start ${
                                        publicProperty.condition === 'Serviceable' 
                                            ? 'bg-green-50 text-green-700 border-green-200'
                                            : publicProperty.condition === 'Needs Repair'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-red-50 text-red-700 border-red-200'
                                    }`}>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        {publicProperty.condition}
                                    </span>
                                </div>

                                {publicProperty.description && (
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Description / Specifications</h4>
                                        <p className="text-gray-700 text-sm leading-relaxed bg-gray-50 p-3.5 rounded-md border border-gray-100">
                                            {publicProperty.description}
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                    <div className="bg-gray-50/70 p-3.5 rounded-md border border-gray-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            <MapPin className="w-3.5 h-3.5 text-gray-400" /> Physical Location
                                        </div>
                                        <div className="font-semibold text-gray-800">{publicProperty.location}</div>
                                    </div>

                                    <div className="bg-gray-50/70 p-3.5 rounded-md border border-gray-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            <User className="w-3.5 h-3.5 text-gray-400" /> Accountable Custodian
                                        </div>
                                        <div className="font-semibold text-gray-800">{publicProperty.custodian}</div>
                                    </div>

                                    <div className="bg-gray-50/70 p-3.5 rounded-md border border-gray-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            <Tag className="w-3.5 h-3.5 text-gray-400" /> Serial / PAR Number
                                        </div>
                                        <div className="font-semibold text-gray-800 font-mono text-xs">
                                            {publicProperty.serialNumber ? `SN: ${publicProperty.serialNumber}` : (publicProperty.parNumber || 'N/A')}
                                        </div>
                                    </div>

                                    <div className="bg-gray-50/70 p-3.5 rounded-md border border-gray-100">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                                            <Building2 className="w-3.5 h-3.5 text-gray-400" /> Fund Source
                                        </div>
                                        <div className="font-semibold text-gray-800">{publicProperty.sourceOfFund}</div>
                                    </div>
                                </div>

                                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-100 text-xs text-gray-500">
                                    <div>
                                        Acquired: <strong className="text-gray-700">{publicProperty.acquisitionDate}</strong> &bull; Total: <strong className="text-gray-700">₱{(publicProperty.totalValue || publicProperty.quantity * publicProperty.unitValue).toLocaleString()}</strong>
                                    </div>
                                    <div className="text-red-600 font-extrabold tracking-wide uppercase flex items-center gap-1">
                                        School Property &bull; DO NOT REMOVE!
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white border border-gray-200 rounded-lg">
                            <div className="w-16 h-16 rounded-full bg-yellow-50 border border-yellow-200 flex items-center justify-center mb-4 text-yellow-600">
                                <Barcode className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">PIS Sticker Tag Generated</h3>
                            <div className="mt-2 inline-block px-3 py-1 bg-yellow-100 border border-yellow-300 rounded font-mono font-bold text-sm text-yellow-900">
                                {publicPisCode || 'UNASSIGNED PIS TAG'}
                            </div>
                            <p className="text-gray-600 mt-4 max-w-md text-sm leading-relaxed">
                                This official Property Inventory Sticker (PIS) has been generated by Leon National High School Science Department. 
                                However, physical property details have not yet been encoded or linked to this sticker code in the inventory ledger.
                            </p>
                            <div className="mt-6 flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setViewMode('admin')}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded shadow transition-colors flex items-center justify-center gap-2"
                                >
                                    <Lock className="w-4 h-4" /> Lab Admin Sign In
                                </button>
                                <button
                                    onClick={() => { setViewMode('landing'); window.history.replaceState({}, '', window.location.pathname); }}
                                    className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded transition-colors"
                                >
                                    Return to Portal
                                </button>
                            </div>
                        </div>
                    )}
                 </div>
            </div>
        )}

        {viewMode === 'admin' && (
            <div className="w-full flex-1 p-8 sm:px-12 flex flex-col justify-center animate-in fade-in slide-in-from-right-8 duration-300 bg-white">
                 <div className="w-full max-w-sm mx-auto">
                    <button onClick={() => setViewMode('landing')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 text-sm transition-colors mb-8">
                        <ArrowLeft className="w-4 h-4" /> Back to Portal
                    </button>
                    
                    <h3 className="text-2xl font-bold text-gray-800 text-center mb-6">Admin Login</h3>
                    
                    <form className="space-y-5" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="block w-full pl-10 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                    placeholder="Username"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                    placeholder="Password"
                                />
                                <button
                                    type="button"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            <div className="flex justify-end mt-1">
                                <button 
                                    type="button" 
                                    onClick={() => setViewMode('reset')}
                                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors font-medium"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded flex items-center gap-2 text-sm text-red-600">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold shadow-md transition-all transform active:scale-[0.99]"
                        >
                            Sign In
                        </button>
                    </form>
                 </div>
            </div>
        )}

        {viewMode === 'reset' && (
            <div className="w-full flex-1 p-8 sm:px-12 flex flex-col justify-center animate-in fade-in slide-in-from-right-8 duration-300 bg-white">
                <div className="w-full max-w-sm mx-auto">
                    <button onClick={() => setViewMode('admin')} className="text-gray-400 hover:text-gray-600 flex items-center gap-2 text-sm transition-colors mb-6">
                        <ArrowLeft className="w-4 h-4" /> Back to Login
                    </button>

                    <h3 className="text-2xl font-bold text-gray-800 text-center mb-2">Recovery</h3>
                    
                    {resetStep === 1 && (
                        <form onSubmit={handleResetStep1} className="space-y-6 mt-6">
                            <p className="text-center text-gray-500 text-sm">Enter your recovery email to receive a code.</p>
                            <input
                                type="email"
                                required
                                value={inputEmail}
                                onChange={(e) => setInputEmail(e.target.value)}
                                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500"
                                placeholder="admin@school.edu"
                            />
                            {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
                            <button type="submit" disabled={isSendingOtp} className="w-full py-2.5 bg-blue-600 text-white rounded-md font-bold flex justify-center items-center gap-2 shadow-md">
                                {isSendingOtp && <Loader2 className="w-4 h-4 animate-spin"/>} Send Code
                            </button>
                        </form>
                    )}
                    
                    {resetStep === 2 && (
                        <form onSubmit={handleResetStep2} className="space-y-6 mt-6">
                            <p className="text-center text-gray-500 text-sm">Enter the 6-digit code sent to you.</p>
                            <input
                                type="text"
                                value={inputOtp}
                                onChange={(e) => setInputOtp(e.target.value)}
                                className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 text-center text-xl tracking-widest font-mono focus:ring-2 focus:ring-blue-500"
                            />
                            {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
                            <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-md font-bold shadow-md">Verify</button>
                        </form>
                    )}

                    {resetStep === 3 && (
                        <form onSubmit={handleResetStep3} className="space-y-6 mt-6">
                            {resetSuccess ? (
                                <div className="text-green-600 text-center font-bold">{resetSuccess}</div>
                            ) : (
                                <>
                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New Password" className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 mb-4 focus:ring-2 focus:ring-blue-500" />
                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="block w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500" />
                                    {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
                                    <button type="submit" className="w-full py-2.5 bg-green-600 text-white rounded-md font-bold shadow-md">Update Password</button>
                                </>
                            )}
                        </form>
                    )}
                 </div>
            </div>
        )}

      </div>
      
      <AppFooter className="relative z-10 mt-3" />

      {customFooterText && <p className="relative z-10 text-center text-xs text-gray-400">{customFooterText}</p>}

      {showRequestModal && (
        <PublicRequestModal 
          onClose={() => {
            setShowRequestModal(false);
            setKioskLearner(null);
            setKioskLearnerEmail('');
          }} 
          initialLearner={kioskLearner}
          initialEmail={kioskLearnerEmail}
          isKioskMode={viewMode === 'kiosk'}
        />
      )}

      {/* USIS Learner Confirmation Modal (Fallback for non-kiosk mode) */}
      {viewMode !== 'kiosk' && (
        <LearnerConfirmModal
          isOpen={showConfirmModal}
          learner={pendingConfirmLearner}
          onConfirm={handleLearnerConfirmed}
          onCancel={handleLearnerCancel}
        />
      )}
    </div>
  );
};

export default Login;
