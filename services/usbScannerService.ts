/**
 * USB Barcode & RFID Scanner Service for I-LEMS
 * 
 * Supports:
 * 1. WebHID Direct USB Pairing (navigator.hid):
 *    Direct browser connection to 2.4G wireless USB dongles, wired handheld USB scanners,
 *    and USB RFID card readers with real-time hardware connect/disconnect detection.
 * 2. Hardware Keyboard Wedge Detection:
 *    Auto-detects high-speed barcode transmissions (< 50ms/char) from standard 2.4G USB dongles.
 * 3. Audio Feedback:
 *    Native Web Audio API POS confirmation beeps (Success / Error).
 */

export interface USBDeviceSummary {
  vendorId: number;
  productId: number;
  productName: string;
  opened: boolean;
}

export interface DeviceHardwareStatus {
  isConnected: boolean;
  deviceName: string | null;
  source: 'webhid' | 'wedge' | null;
}

export interface ScannerHardwareStatus {
  isConnected: boolean;
  deviceName: string;
  mode: 'webhid' | 'wedge' | 'idle';
  rfid: DeviceHardwareStatus;
  barcode: DeviceHardwareStatus;
}

export type ScanHandler = (barcode: string, source: 'webhid' | 'keyboard_wedge') => void;
export type StatusHandler = (status: ScannerHardwareStatus) => void;

class USBScannerService {
  private scanListeners: Set<ScanHandler> = new Set();
  private statusListeners: Set<StatusHandler> = new Set();
  
  // Specific physical devices
  private activeRfidDevice: any = null;
  private activeBarcodeDevice: any = null;
  private activeHIDDevice: any = null; // compatibility pointer

  // Wedge verification flags (set when actual scan is received)
  private rfidWedgeVerified: boolean = false;
  private rfidWedgeName: string | null = null;
  private barcodeWedgeVerified: boolean = false;
  private barcodeWedgeName: string | null = null;

  private isListeningWedge: boolean = false;
  
  // Keystroke wedge detection buffer
  private keyBuffer: string[] = [];
  private keyTimestamps: number[] = [];
  private wedgeTimer: any = null;

  // Sound settings
  private soundEnabled: boolean = true;
  private autoModalEnabled: boolean = true;
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.loadPreferences();
    this.initKeyboardWedgeListener();
    this.initHidListeners();
    this.checkPreviouslyPairedHID();
  }

  // --- Preferences Persistence ---
  private loadPreferences() {
    try {
      const savedSound = localStorage.getItem('scilab_usb_sound');
      if (savedSound !== null) this.soundEnabled = savedSound === 'true';

      const savedAutoModal = localStorage.getItem('scilab_usb_automodal');
      if (savedAutoModal !== null) this.autoModalEnabled = savedAutoModal === 'true';
    } catch (e) {
      // ignore
    }
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('scilab_usb_sound', String(enabled));
    } catch (e) {}
  }

  public isAutoModalEnabled(): boolean {
    return this.autoModalEnabled;
  }

  public setAutoModalEnabled(enabled: boolean) {
    this.autoModalEnabled = enabled;
    try {
      localStorage.setItem('scilab_usb_automodal', String(enabled));
    } catch (e) {}
  }

  // --- WebHID Capability ---
  public isWebHIDSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator && typeof (navigator as any).hid?.requestDevice === 'function';
  }

  private initHidListeners() {
    if (typeof navigator === 'undefined' || !('hid' in navigator)) return;
    try {
      const hid = (navigator as any).hid;
      hid.addEventListener('connect', async (event: any) => {
        await this.handleDeviceConnect(event.device);
      });
      hid.addEventListener('disconnect', (event: any) => {
        this.handleDeviceDisconnect(event.device);
      });
    } catch (e) {
      console.warn('[USB Scanner] Could not attach native HID connect/disconnect listeners:', e);
    }
  }

  private isRfidDevice(device: any): boolean {
    const saved = localStorage.getItem('scilab_rfid_device');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.vendorId === device.vendorId && parsed.productId === device.productId) {
          return true;
        }
      } catch (e) {}
    }
    const name = String(device.productName || '').toLowerCase();
    return /rfid|nfc|card|mifare|ic\s*reader|proximity/i.test(name);
  }

  private isBarcodeDevice(device: any): boolean {
    const saved = localStorage.getItem('scilab_barcode_device');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.vendorId === device.vendorId && parsed.productId === device.productId) {
          return true;
        }
      } catch (e) {}
    }
    const name = String(device.productName || '').toLowerCase();
    return /barcode|scanner|pos|zebra|honeywell|netum|datalogic|tera|eyoyo|symcode/i.test(name);
  }

  /**
   * Connect and attach input report listener to a WebHID device
   */
  private async connectHIDDevice(device: any, explicitRole?: 'rfid' | 'barcode') {
    try {
      if (!device.opened) {
        await device.open();
      }

      device.addEventListener('inputreport', (event: any) => {
        this.handleHIDInputReport(event);
      });

      if (explicitRole === 'rfid' || (!explicitRole && this.isRfidDevice(device))) {
        this.activeRfidDevice = device;
        try {
          localStorage.setItem('scilab_rfid_device', JSON.stringify({ vendorId: device.vendorId, productId: device.productId }));
        } catch (e) {}
      } else {
        this.activeBarcodeDevice = device;
        try {
          localStorage.setItem('scilab_barcode_device', JSON.stringify({ vendorId: device.vendorId, productId: device.productId }));
        } catch (e) {}
      }

      this.activeHIDDevice = this.activeBarcodeDevice || this.activeRfidDevice;
      this.emitStatus();
    } catch (e) {
      console.error('Error opening WebHID device:', e);
      throw e;
    }
  }

  private async handleDeviceConnect(device: any) {
    try {
      await this.connectHIDDevice(device);
    } catch (e) {
      console.warn('[USB Scanner] Error auto-connecting newly inserted HID device:', e);
    }
  }

  private handleDeviceDisconnect(device: any) {
    if (this.activeRfidDevice && (this.activeRfidDevice === device || (this.activeRfidDevice.vendorId === device.vendorId && this.activeRfidDevice.productId === device.productId))) {
      this.activeRfidDevice = null;
      this.rfidWedgeVerified = false;
    }
    if (this.activeBarcodeDevice && (this.activeBarcodeDevice === device || (this.activeBarcodeDevice.vendorId === device.vendorId && this.activeBarcodeDevice.productId === device.productId))) {
      this.activeBarcodeDevice = null;
      this.barcodeWedgeVerified = false;
    }
    this.activeHIDDevice = this.activeBarcodeDevice || this.activeRfidDevice;
    this.emitStatus();
  }

  /**
   * Prompts user to pair an RFID Reader specifically
   */
  public async requestRfidScanner(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isWebHIDSupported()) {
      return { success: false, error: 'WebHID is not supported by your current browser.' };
    }
    try {
      const hid = (navigator as any).hid;
      const devices = await hid.requestDevice({ filters: [] });
      if (!devices || devices.length === 0) {
        return { success: false, error: 'No USB device was selected.' };
      }
      const device = devices[0];
      await this.connectHIDDevice(device, 'rfid');
      const name = device.productName || `USB RFID Reader (${device.vendorId.toString(16)}:${device.productId.toString(16)})`;
      return { success: true, deviceName: name };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect RFID reader.' };
    }
  }

  /**
   * Prompts user to pair a Barcode Scanner specifically
   */
  public async requestBarcodeScanner(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isWebHIDSupported()) {
      return { success: false, error: 'WebHID is not supported by your current browser.' };
    }
    try {
      const hid = (navigator as any).hid;
      const devices = await hid.requestDevice({ filters: [] });
      if (!devices || devices.length === 0) {
        return { success: false, error: 'No USB device was selected.' };
      }
      const device = devices[0];
      await this.connectHIDDevice(device, 'barcode');
      const name = device.productName || `USB Barcode Scanner (${device.vendorId.toString(16)}:${device.productId.toString(16)})`;
      return { success: true, deviceName: name };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to connect Barcode scanner.' };
    }
  }

  /**
   * General pairing method (backwards-compatible with USBScannerPairModal)
   */
  public async requestUSBScanner(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    return this.requestBarcodeScanner();
  }

  /**
   * Decodes incoming input reports from the USB scanner
   */
  private hidBuffer = '';
  private handleHIDInputReport(event: any) {
    const { data } = event;
    if (!data || data.byteLength === 0) return;

    let decodedChunk = '';
    for (let i = 0; i < data.byteLength; i++) {
      const byte = data.getUint8(i);
      if (byte >= 32 && byte <= 126) {
        decodedChunk += String.fromCharCode(byte);
      } else if (byte === 13 || byte === 10) {
        if (this.hidBuffer.trim().length >= 2) {
          const scanned = this.hidBuffer.trim();
          this.hidBuffer = '';
          this.emitScan(scanned, 'webhid');
          return;
        }
      }
    }

    if (decodedChunk) {
      this.hidBuffer += decodedChunk;
      setTimeout(() => {
        if (this.hidBuffer.trim().length >= 3) {
          const scanned = this.hidBuffer.trim();
          this.hidBuffer = '';
          this.emitScan(scanned, 'webhid');
        } else {
          this.hidBuffer = '';
        }
      }, 300);
    }
  }

  /**
   * Checks if previously paired USB devices are remembered by the browser
   */
  public async checkPreviouslyPairedHID(): Promise<USBDeviceSummary[]> {
    if (!this.isWebHIDSupported()) return [];
    try {
      const hid = (navigator as any).hid;
      const devices = await hid.getDevices();
      if (devices && devices.length > 0) {
        for (const device of devices) {
          if (this.isRfidDevice(device) && !this.activeRfidDevice) {
            await this.connectHIDDevice(device, 'rfid').catch(() => {});
          } else if (!this.activeBarcodeDevice) {
            await this.connectHIDDevice(device, 'barcode').catch(() => {});
          }
        }
        return devices.map((d: any) => ({
          vendorId: d.vendorId,
          productId: d.productId,
          productName: d.productName || 'USB Scanner',
          opened: d.opened
        }));
      }
    } catch (e) {
      // restricted
    }
    return [];
  }

  public async disconnectRfid(): Promise<void> {
    if (this.activeRfidDevice) {
      try {
        await this.activeRfidDevice.close();
      } catch (e) {}
      this.activeRfidDevice = null;
    }
    this.rfidWedgeVerified = false;
    this.activeHIDDevice = this.activeBarcodeDevice || null;
    this.emitStatus();
  }

  public async disconnectBarcode(): Promise<void> {
    if (this.activeBarcodeDevice) {
      try {
        await this.activeBarcodeDevice.close();
      } catch (e) {}
      this.activeBarcodeDevice = null;
    }
    this.barcodeWedgeVerified = false;
    this.activeHIDDevice = this.activeRfidDevice || null;
    this.emitStatus();
  }

  public async disconnectHID(): Promise<void> {
    await this.disconnectBarcode();
    await this.disconnectRfid();
  }

  public getConnectedDevice(): USBDeviceSummary | null {
    const dev = this.activeBarcodeDevice || this.activeRfidDevice;
    if (!dev) return null;
    return {
      vendorId: dev.vendorId,
      productId: dev.productId,
      productName: dev.productName || 'USB Barcode Scanner Dongle',
      opened: dev.opened
    };
  }

  // --- Keyboard Wedge Verification ---
  public markRfidDetected(deviceName?: string) {
    this.rfidWedgeVerified = true;
    if (deviceName) this.rfidWedgeName = deviceName;
    this.emitStatus();
  }

  public markBarcodeDetected(deviceName?: string) {
    this.barcodeWedgeVerified = true;
    if (deviceName) this.barcodeWedgeName = deviceName;
    this.emitStatus();
  }

  // --- Hardware Keyboard Wedge Listener ---
  private initKeyboardWedgeListener() {
    if (typeof window === 'undefined' || this.isListeningWedge) return;
    this.isListeningWedge = true;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;

      const now = Date.now();

      if (e.key === 'Enter') {
        if (this.keyBuffer.length >= 3) {
          let isBarcodeSpeed = true;
          if (this.keyTimestamps.length > 1) {
            const intervals: number[] = [];
            for (let i = 1; i < this.keyTimestamps.length; i++) {
              intervals.push(this.keyTimestamps[i] - this.keyTimestamps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            isBarcodeSpeed = avgInterval < 55;
          }

          if (isBarcodeSpeed) {
            const barcode = this.keyBuffer.join('');
            this.resetWedgeBuffer();

            // Auto-detect RFID vs Barcode based on standard tag patterns
            const isLikelyRfid = /^[A-Fa-f0-9]{8,14}$/.test(barcode) || /^\d{10,12}$/.test(barcode);
            if (isLikelyRfid) {
              this.rfidWedgeVerified = true;
            } else {
              this.barcodeWedgeVerified = true;
            }
            this.emitStatus();

            this.emitScan(barcode, 'keyboard_wedge');
            return;
          }
        }
        this.resetWedgeBuffer();
        return;
      }

      if (e.key.length === 1) {
        const lastTime = this.keyTimestamps[this.keyTimestamps.length - 1] || 0;
        if (now - lastTime > 180) {
          this.keyBuffer = [];
          this.keyTimestamps = [];
        }

        this.keyBuffer.push(e.key);
        this.keyTimestamps.push(now);

        clearTimeout(this.wedgeTimer);
        this.wedgeTimer = setTimeout(() => {
          this.resetWedgeBuffer();
        }, 250);
      }
    }, true);
  }

  private resetWedgeBuffer() {
    this.keyBuffer = [];
    this.keyTimestamps = [];
    clearTimeout(this.wedgeTimer);
  }

  // --- Audio Feedback (Web Audio API Synthesizer) ---
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public playSuccessBeep() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime); // 1760 Hz (A6) crisp POS tone
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  }

  public playErrorBeep() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(330, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  }

  // --- Event Handling ---
  public onScan(callback: ScanHandler): () => void {
    this.scanListeners.add(callback);
    return () => {
      this.scanListeners.delete(callback);
    };
  }

  public onStatus(callback: StatusHandler): () => void {
    this.statusListeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private emitScan(barcode: string, source: 'webhid' | 'keyboard_wedge') {
    const cleaned = barcode.trim();
    if (!cleaned) return;

    this.playSuccessBeep();
    this.scanListeners.forEach(listener => {
      try {
        listener(cleaned, source);
      } catch (err) {
        console.error('Error in scan listener:', err);
      }
    });
  }

  public getStatus(): ScannerHardwareStatus {
    const isRfidWebHid = !!this.activeRfidDevice;
    const isBarcodeWebHid = !!this.activeBarcodeDevice;

    const rfidConnected = isRfidWebHid || this.rfidWedgeVerified;
    const barcodeConnected = isBarcodeWebHid || this.barcodeWedgeVerified;
    const anyConnected = rfidConnected || barcodeConnected;

    return {
      isConnected: anyConnected,
      deviceName: this.activeBarcodeDevice?.productName || this.activeRfidDevice?.productName || (anyConnected ? 'USB Scanner Active' : 'No Scanner Connected'),
      mode: (isRfidWebHid || isBarcodeWebHid) ? 'webhid' : anyConnected ? 'wedge' : 'idle',
      rfid: {
        isConnected: rfidConnected,
        deviceName: this.activeRfidDevice?.productName || (this.rfidWedgeVerified ? (this.rfidWedgeName || 'USB RFID Reader (Verified)') : null),
        source: isRfidWebHid ? 'webhid' : this.rfidWedgeVerified ? 'wedge' : null,
      },
      barcode: {
        isConnected: barcodeConnected,
        deviceName: this.activeBarcodeDevice?.productName || (this.barcodeWedgeVerified ? (this.barcodeWedgeName || 'USB Barcode Scanner (Verified)') : null),
        source: isBarcodeWebHid ? 'webhid' : this.barcodeWedgeVerified ? 'wedge' : null,
      }
    };
  }

  private emitStatus() {
    const status = this.getStatus();
    this.statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch (e) {}
    });
  }
}

export const usbScannerService = new USBScannerService();
export default usbScannerService;
