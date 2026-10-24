/**
 * USB Barcode Scanner Service for I-LEMS
 * 
 * Supports:
 * 1. WebHID Direct USB Pairing (navigator.hid):
 *    Direct browser connection to 2.4G wireless USB dongles & wired handheld USB scanners.
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

export type ScanHandler = (barcode: string, source: 'webhid' | 'keyboard_wedge') => void;
export type StatusHandler = (status: { isConnected: boolean; deviceName: string; mode: 'webhid' | 'wedge' | 'idle' }) => void;

class USBScannerService {
  private scanListeners: Set<ScanHandler> = new Set();
  private statusListeners: Set<StatusHandler> = new Set();
  
  private activeHIDDevice: any = null;
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

  /**
   * Prompts the browser's native USB HID device selection dialog
   * Allows pairing wireless 2.4G scanner dongles and USB wired barcode scanners.
   */
  public async requestUSBScanner(): Promise<{ success: boolean; deviceName?: string; error?: string }> {
    if (!this.isWebHIDSupported()) {
      return { 
        success: false, 
        error: 'WebHID is not supported by your current browser. Google Chrome or Microsoft Edge is recommended for direct USB pairing.' 
      };
    }

    try {
      const hid = (navigator as any).hid;
      // Request device without vendor filters so any 2.4G dongle or scanner can be picked
      const devices = await hid.requestDevice({ filters: [] });
      
      if (!devices || devices.length === 0) {
        return { success: false, error: 'No USB device was selected.' };
      }

      const device = devices[0];
      await this.connectHIDDevice(device);

      return { 
        success: true, 
        deviceName: device.productName || `USB Barcode Device (${device.vendorId.toString(16)}:${device.productId.toString(16)})` 
      };
    } catch (err: any) {
      console.warn('WebHID pairing error:', err);
      return { success: false, error: err.message || 'Failed to connect USB device.' };
    }
  }

  /**
   * Connect and attach input report listener to a WebHID device
   */
  private async connectHIDDevice(device: any) {
    try {
      if (!device.opened) {
        await device.open();
      }

      this.activeHIDDevice = device;

      device.addEventListener('inputreport', (event: any) => {
        this.handleHIDInputReport(event);
      });

      device.addEventListener('disconnect', () => {
        this.activeHIDDevice = null;
        this.emitStatus();
      });

      this.emitStatus();
    } catch (e) {
      console.error('Error opening WebHID device:', e);
      throw e;
    }
  }

  /**
   * Decodes incoming input reports from the USB scanner
   */
  private hidBuffer = '';
  private handleHIDInputReport(event: any) {
    const { data } = event;
    if (!data || data.byteLength === 0) return;

    // Many POS scanners send ASCII bytes or HID keyboard usage codes in the report
    let decodedChunk = '';
    for (let i = 0; i < data.byteLength; i++) {
      const byte = data.getUint8(i);
      // printable ASCII range
      if (byte >= 32 && byte <= 126) {
        decodedChunk += String.fromCharCode(byte);
      } else if (byte === 13 || byte === 10) {
        // Enter / Line feed indicates end of barcode
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
      // Auto-clear buffer if no enter received within 1 second
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
        // Attempt to connect to the first remembered device
        if (!this.activeHIDDevice) {
          await this.connectHIDDevice(devices[0]);
        }
        return devices.map((d: any) => ({
          vendorId: d.vendorId,
          productId: d.productId,
          productName: d.productName || 'USB Barcode Scanner',
          opened: d.opened
        }));
      }
    } catch (e) {
      // user or browser policy restricted
    }
    return [];
  }

  public async disconnectHID(): Promise<void> {
    if (this.activeHIDDevice) {
      try {
        await this.activeHIDDevice.close();
      } catch (e) {}
      this.activeHIDDevice = null;
      this.emitStatus();
    }
  }

  public getConnectedDevice(): USBDeviceSummary | null {
    if (!this.activeHIDDevice) return null;
    return {
      vendorId: this.activeHIDDevice.vendorId,
      productId: this.activeHIDDevice.productId,
      productName: this.activeHIDDevice.productName || 'USB Barcode Scanner Dongle',
      opened: this.activeHIDDevice.opened
    };
  }

  // --- Hardware Keyboard Wedge Listener ---
  /**
   * Listens for 2.4G USB Dongle barcode transmissions.
   * Scanners transmit keystrokes in bursts (under 50ms per character) ending with 'Enter'.
   */
  private initKeyboardWedgeListener() {
    if (typeof window === 'undefined' || this.isListeningWedge) return;
    this.isListeningWedge = true;

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Ignore functional modifier keys
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) return;

      const now = Date.now();

      if (e.key === 'Enter') {
        if (this.keyBuffer.length >= 3) {
          // Calculate average key interval
          let isBarcodeSpeed = true;
          if (this.keyTimestamps.length > 1) {
            const intervals: number[] = [];
            for (let i = 1; i < this.keyTimestamps.length; i++) {
              intervals.push(this.keyTimestamps[i] - this.keyTimestamps[i - 1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            // Barcode scanners transmit at 2ms to 45ms per character. Human typing is > 80ms.
            isBarcodeSpeed = avgInterval < 55;
          }

          if (isBarcodeSpeed) {
            const barcode = this.keyBuffer.join('');
            this.resetWedgeBuffer();
            this.emitScan(barcode, 'keyboard_wedge');
            return;
          }
        }
        this.resetWedgeBuffer();
        return;
      }

      // Buffer character
      if (e.key.length === 1) {
        // If gap between this and last key is > 200ms, start a new scan buffer
        const lastTime = this.keyTimestamps[this.keyTimestamps.length - 1] || 0;
        if (now - lastTime > 180) {
          this.keyBuffer = [];
          this.keyTimestamps = [];
        }

        this.keyBuffer.push(e.key);
        this.keyTimestamps.push(now);

        // Auto-clear buffer if abandoned
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
    } catch (e) {
      // Audio playback might be restricted until user interaction
    }
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
    // Send immediate initial status
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

  public getStatus(): { isConnected: boolean; deviceName: string; mode: 'webhid' | 'wedge' | 'idle' } {
    if (this.activeHIDDevice) {
      return {
        isConnected: true,
        deviceName: this.activeHIDDevice.productName || 'USB Barcode Scanner Dongle',
        mode: 'webhid'
      };
    }
    return {
      isConnected: true, // Keyboard wedge listener is always active and ready
      deviceName: 'USB Hardware Wedge (Auto-detecting)',
      mode: 'wedge'
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
