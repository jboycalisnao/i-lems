import React, { useState, useEffect, useRef } from 'react';
import { 
  Usb, CheckCircle2, AlertCircle, X, Volume2, VolumeX, Terminal
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
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-lg shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header - Solid Blue, No Gradient */}
        <div className="px-5 py-4 bg-blue-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-800 rounded-md">
              <Usb className="w-5 h-5 text-blue-100" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">USB Barcode Scanner</h3>
              <p className="text-xs text-blue-200">2.4GHz wireless dongle & handheld USB scanner</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-blue-800 text-blue-200 hover:text-white transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 bg-white">
          {/* Status Message Banners */}
          {errorMessage && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-md text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Connection Status Row */}
          <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-semibold text-xs text-gray-900 truncate block">
                {deviceSummary ? deviceSummary.productName : 'USB Dongle / Keyboard Wedge Ready'}
              </span>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {deviceSummary ? 'Direct WebHID connection active' : 'Plug in your 2.4G USB receiver to scan anywhere'}
              </p>
            </div>

            <div className="flex-shrink-0">
              {deviceSummary ? (
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded-md transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePairDongle}
                  disabled={isPairing || !isWebHIDSupported}
                  className="px-3 py-1.5 text-xs font-semibold text-blue-900 bg-white hover:bg-blue-50 border border-blue-300 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Usb className="w-3.5 h-3.5" />
                  <span>{isPairing ? 'Pairing...' : 'Pair WebHID'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Settings Row */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSound}
                className={`px-2.5 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  soundEnabled
                    ? 'bg-blue-50 text-blue-900 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-300'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-blue-700" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
                <span>Beep: {soundEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <button
                type="button"
                onClick={() => usbScannerService.playSuccessBeep()}
                className="px-2 py-1 text-gray-500 hover:text-gray-800 text-[11px] underline cursor-pointer"
              >
                Test Beep
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-700">
              <input
                type="checkbox"
                checked={autoModalEnabled}
                onChange={handleToggleAutoModal}
                className="w-4 h-4 rounded border-gray-300 text-blue-900 focus:ring-blue-800"
              />
              <span>Auto-open record on scan</span>
            </label>
          </div>

          {/* Scan Tester Area */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-gray-600 px-0.5">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-900" />
                Scan Test Area
              </span>
              {testLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTestLogs([])}
                  className="text-[11px] text-gray-400 hover:text-gray-700 underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 min-h-[90px] max-h-36 overflow-y-auto space-y-1.5 text-xs">
              {testLogs.length === 0 ? (
                <div className="text-gray-400 text-center py-5 text-xs">
                  Pull the trigger on your scanner to test scanning here.
                </div>
              ) : (
                testLogs.map(log => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-gray-200"
                  >
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-[11px] text-gray-400">[{log.time}]</span>
                      <span className="font-bold text-gray-900">{log.code}</span>
                    </div>
                    <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-sans">
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
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-md text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default USBScannerPairModal;
