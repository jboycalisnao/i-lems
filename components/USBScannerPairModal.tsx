import React, { useState, useEffect, useRef } from 'react';
import { 
  Usb, Radio, CheckCircle2, AlertCircle, X, Volume2, VolumeX, 
  Terminal, RefreshCw, Zap, ShieldCheck, Tag, Laptop, Cpu, Check
} from 'lucide-react';
import usbScannerService, { USBDeviceSummary } from '../services/usbScannerService';

interface USBScannerPairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestScanSuccess?: (barcode: string) => void;
}

interface TestScanLog {
  id: string;
  code: string;
  time: string;
  source: string;
}

export const USBScannerPairModal: React.FC<USBScannerPairModalProps> = ({
  isOpen,
  onClose,
  onTestScanSuccess
}) => {
  const [deviceSummary, setDeviceSummary] = useState<USBDeviceSummary | null>(null);
  const [isWebHIDSupported, setIsWebHIDSupported] = useState(true);
  const [isPairing, setIsPairing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(() => usbScannerService.isSoundEnabled());
  const [autoModalEnabled, setAutoModalEnabled] = useState(() => usbScannerService.isAutoModalEnabled());
  const [testLogs, setTestLogs] = useState<TestScanLog[]>([]);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsWebHIDSupported(usbScannerService.isWebHIDSupported());
    setDeviceSummary(usbScannerService.getConnectedDevice());

    // Listen for live scans to show in the test console
    const unsubscribeScan = usbScannerService.onScan((barcode, source) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      setTestLogs(prev => [
        ...prev.slice(-15),
        {
          id: Math.random().toString(36).substring(2, 9),
          code: barcode,
          time: timeStr,
          source: source === 'webhid' ? 'WebHID Direct' : 'USB 2.4G Wedge'
        }
      ]);
      onTestScanSuccess?.(barcode);
    });

    const unsubscribeStatus = usbScannerService.onStatus(() => {
      setDeviceSummary(usbScannerService.getConnectedDevice());
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubscribeScan();
      unsubscribeStatus();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, onTestScanSuccess]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [testLogs]);

  if (!isOpen) return null;

  const handlePairDongle = async () => {
    setIsPairing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await usbScannerService.requestUSBScanner();
    setIsPairing(false);

    if (res.success) {
      setSuccessMessage(`Successfully paired: ${res.deviceName}`);
      setDeviceSummary(usbScannerService.getConnectedDevice());
      usbScannerService.playSuccessBeep();
    } else if (res.error) {
      setErrorMessage(res.error);
    }
  };

  const handleDisconnect = async () => {
    await usbScannerService.disconnectHID();
    setDeviceSummary(null);
    setSuccessMessage('USB device disconnected.');
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    usbScannerService.setSoundEnabled(next);
    if (next) usbScannerService.playSuccessBeep();
  };

  const handleToggleAutoModal = () => {
    const next = !autoModalEnabled;
    setAutoModalEnabled(next);
    usbScannerService.setAutoModalEnabled(next);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-md border border-white/20">
              <Usb className="w-5 h-5 text-blue-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">USB Barcode Scanner & Dongle Connection</h3>
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  WebHID & Wedge Active
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-0.5">
                Connect your 2.4GHz wireless scanner dongle or handheld USB scanner to pull up records
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gray-50/70">
          {/* Status Message Banners */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Connection Card */}
          <div className="bg-white p-5 rounded-md border border-gray-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-600" />
                  Scanner Dongle Connection Status
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {deviceSummary ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Directly Paired via WebHID: {deviceSummary.productName}
                    </span>
                  ) : (
                    <span className="text-blue-900 font-medium flex items-center gap-1.5 mt-1">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      USB 2.4GHz Dongle Receiver: Ready & Listening in Background
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {deviceSummary ? (
                  <button
                    onClick={handleDisconnect}
                    className="px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors cursor-pointer"
                  >
                    Disconnect USB
                  </button>
                ) : (
                  <button
                    onClick={handlePairDongle}
                    disabled={isPairing || !isWebHIDSupported}
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>{isPairing ? 'Select in Browser...' : 'Pair USB Scanner'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* How It Works Explainer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-xs">
              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-md">
                <span className="font-bold text-blue-950 block flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-blue-700" />
                  Plug & Play 2.4G USB Dongle
                </span>
                <span className="text-blue-900 text-[11px] leading-relaxed block">
                  Most 2.4G wireless scanners work instantly upon inserting the USB receiver. I-LEMS auto-detects high-speed barcode transmissions even without manual pairing!
                </span>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-md">
                <span className="font-bold text-emerald-950 block flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  WebHID Direct Pairing
                </span>
                <span className="text-emerald-900 text-[11px] leading-relaxed block">
                  Pairing directly in Google Chrome / Microsoft Edge isolates scanner events so scanning works uninterrupted anywhere across the system.
                </span>
              </div>
            </div>
          </div>

          {/* Settings & Options Card */}
          <div className="bg-white p-4 rounded-md border border-gray-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={handleToggleSound}
                className={`p-2 rounded-md border transition-colors flex items-center gap-2 font-semibold ${
                  soundEnabled
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-gray-100 text-gray-500 border-gray-300'
                }`}
                title="Toggle scan audio tone"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-700" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                <span>{soundEnabled ? 'Scanner Beep: ON' : 'Scanner Beep: Muted'}</span>
              </button>

              <button
                type="button"
                onClick={() => usbScannerService.playSuccessBeep()}
                className="px-2.5 py-1 text-gray-600 hover:text-gray-900 underline text-[11px]"
              >
                Test Beep
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoModalEnabled}
                onChange={handleToggleAutoModal}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-gray-800">Auto pull-up record card on scan</span>
            </label>
          </div>

          {/* Live Scanner Testing Console */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-600 px-1">
              <span className="font-bold uppercase tracking-wider text-[11px] text-gray-700 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-700" />
                Live Scan Terminal (Test Your Scanner)
              </span>
              <button
                onClick={() => setTestLogs([])}
                className="text-[11px] text-gray-400 hover:text-gray-700 underline"
              >
                Clear Terminal
              </button>
            </div>

            <div className="bg-gray-900 text-emerald-400 font-mono text-xs p-4 rounded-md shadow-inner h-44 overflow-y-auto space-y-1.5 border border-gray-800">
              <div className="text-gray-500 text-[11px]">
                # I-LEMS USB Scanner Port Initialized... Point your scanner at any barcode or QR code.
              </div>

              {testLogs.length === 0 ? (
                <div className="text-gray-600 italic text-[11px] py-6 text-center">
                  Waiting for barcode scan... Pull the trigger on your scanner to test.
                </div>
              ) : (
                testLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between text-[11px] leading-relaxed border-b border-gray-800/60 pb-1">
                    <div>
                      <span className="text-blue-400 font-bold mr-2">[{log.time}]</span>
                      <span className="text-white font-extrabold">{log.code}</span>
                    </div>
                    <span className="text-gray-500 text-[10px] bg-gray-800 px-1.5 py-0.5 rounded">
                      {log.source}
                    </span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-100 border-t border-gray-200 flex items-center justify-between flex-shrink-0 text-xs text-gray-600">
          <div className="hidden sm:block">
            Compatible with all 2.4G wireless receivers, Netum, Tera, Eyoyo, Honeywell, and Zebra scanners.
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-md font-bold transition-colors ml-auto cursor-pointer"
          >
            Done & Ready
          </button>
        </div>
      </div>
    </div>
  );
};

export default USBScannerPairModal;
