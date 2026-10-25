import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { InventoryItem, BorrowRequest, RequestItem } from '../types';
import * as storage from '../services/storageService';
import * as propertyStorage from '../services/propertyStorageService';
import { notifyAdminsOfNewRequest, notifyBorrowerOfRequestCopy } from '../services/notificationService';
import { X, Search, ShoppingBag, Plus, Trash2, ArrowRight, ArrowLeft, CheckCircle, MapPin, Loader2, AlertCircle, ChevronDown, ChevronRight, Barcode, Radio, Sparkles, Check, Volume2, VolumeX, Calendar, Clock } from 'lucide-react';
import AnalogTimePicker from './AnalogTimePicker';
import { getCategoryIcon, getCategoryColor } from '../constants';
import { RegistrarLearner } from '../services/usisRoster';
import { getLearnerFromMemory } from '../services/usisRoster/useLearnerRoster';
import usbScannerService from '../services/usbScannerService';
import { lookupScannedBarcode } from '../services/scannerLookupService';

interface PublicRequestModalProps {
  onClose: () => void;
  initialLearner?: RegistrarLearner | null;
  initialEmail?: string;
  isKioskMode?: boolean;
}

const isGenuineEmail = (str?: string | null): boolean => {
  return !!str && typeof str === 'string' && str.includes('@') && str.includes('.');
};

const PublicRequestModal: React.FC<PublicRequestModalProps> = ({ onClose, initialLearner, initialEmail, isKioskMode = false }) => {
  // If prefilled with a learner, start directly at Step 2 (Select Equipment)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(() => (initialLearner?.full_name ? 2 : 1));
  // Instant 0ms pre-hydration from persistent offline cache
  const [items, setItems] = useState<InventoryItem[]>(() => {
    const cached = storage.getCachedItems();
    return cached.filter(i => {
      const hasLimit = i.maxBorrowable !== undefined && i.maxBorrowable !== null;
      const limit = hasLimit ? i.maxBorrowable! : i.quantity;
      return (limit - (i.borrowedQuantity || 0)) > 0;
    });
  });
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const cached = storage.getCachedItems();
    const categories = Array.from(new Set(cached.map(i => i.category)));
    return categories.length > 0 ? new Set([categories[0]]) : new Set();
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Get Today's Date String for Min Date Restriction
  const todayString = new Date().toISOString().split('T')[0];
  
  // Format Initial Learner Info
  const initialName = initialLearner?.full_name || initialLearner?.name || '';
  const initialId = initialLearner
    ? [
        initialLearner.lrn ? `LRN: ${initialLearner.lrn}` : '',
        initialLearner.section_name ? initialLearner.section_name : '',
        initialLearner.grade_level ? `(${initialLearner.grade_level})` : ''
      ].filter(Boolean).join(' • ')
    : '';

  // Determine prefilled email (NEVER prefill with phone numbers from contact_number)
  const resolvedEmail = initialEmail?.trim() || (
    isGenuineEmail((initialLearner as any)?.email)
      ? (initialLearner as any).email
      : isGenuineEmail(initialLearner?.contact_number)
        ? initialLearner!.contact_number!
        : initialLearner?.lrn
          ? `${initialLearner.lrn}@deped.gov.ph`
          : ''
  );

  // Form State
  const [borrowerName, setBorrowerName] = useState(initialName);
  const [borrowerId, setBorrowerId] = useState(initialId);
  const [borrowerEmail, setBorrowerEmail] = useState(resolvedEmail);
  const [returnDate, setReturnDate] = useState(todayString);
  const [selectedItems, setSelectedItems] = useState<RequestItem[]>([]);
  const [isReservingLab, setIsReservingLab] = useState(false);
  
  // Time State for Analog Pickers
  const [reservationDate, setReservationDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [createdRequest, setCreatedRequest] = useState<BorrowRequest | null>(null);
  const [requestCopySent, setRequestCopySent] = useState<boolean | null>(null);

  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState<string | null>(null);
  const [bucketBump, setBucketBump] = useState(false);
  const [scannerSound, setScannerSound] = useState(() => usbScannerService.isSoundEnabled());
  const [kioskCountdown, setKioskCountdown] = useState(10);
  const [rfidVerified, setRfidVerified] = useState(Boolean(initialLearner?.full_name));

  interface ToastNotification {
    title: string;
    message: string;
    detail?: string;
    type: 'warning' | 'error' | 'info';
  }
  const [toast, setToast] = useState<ToastNotification | null>(null);

  const showToast = (title: string, message: string, detail?: string, type: 'warning' | 'error' | 'info' = 'warning') => {
    setToast({ title, message, detail, type });
  };

  interface AlertModalState {
    title: string;
    message: string;
    type?: 'warning' | 'error' | 'info';
  }
  const [alertModal, setAlertModal] = useState<AlertModalState | null>(null);

  useEffect(() => {
    if (!alertModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setAlertModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [alertModal]);

  /**
   * Analyzes the real-time available stock of an item in inventory
   * Accounts for both Laboratory Inventory and Property Inventory (e.g. PIS-tagged assets like RFID Scanners)
   */
  const getAvailableStockForItem = (itemId: string, itemName?: string): { available: number; total: number; unit: string; borrowed: number } => {
    // 1. Check Laboratory Inventory Items
    const inv = items.find(i => i.id === itemId);
    if (inv) {
      const hasLimit = inv.maxBorrowable !== undefined && inv.maxBorrowable !== null;
      const limit = hasLimit ? Math.min(inv.maxBorrowable!, inv.quantity) : inv.quantity;
      const available = Math.max(0, limit - (inv.borrowedQuantity || 0));
      return { available, total: inv.quantity, unit: inv.unit || 'pcs', borrowed: inv.borrowedQuantity || 0 };
    }

    const cleanName = (itemName || '').replace(/\s*\[.*?\]\s*/g, '').trim().toLowerCase();
    const matchedByName = items.find(i => i.name.toLowerCase() === cleanName);
    if (matchedByName) {
      const hasLimit = matchedByName.maxBorrowable !== undefined && matchedByName.maxBorrowable !== null;
      const limit = hasLimit ? Math.min(matchedByName.maxBorrowable!, matchedByName.quantity) : matchedByName.quantity;
      const available = Math.max(0, limit - (matchedByName.borrowedQuantity || 0));
      return { available, total: matchedByName.quantity, unit: matchedByName.unit || 'pcs', borrowed: matchedByName.borrowedQuantity || 0 };
    }

    // 2. Check Property Management Items (PIS equipment, RFID Scanners, Laptops, Balances)
    const propItems = propertyStorage.getCachedPropertyItems();
    const matchedProp = propItems.find(p => 
      p.id === itemId ||
      (itemName && p.pisCode && itemName.includes(p.pisCode)) ||
      (itemName && p.propertyNumber && itemName.includes(p.propertyNumber)) ||
      (itemName && p.pisCodes && p.pisCodes.some(c => c && itemName.includes(c))) ||
      (itemName && p.propertyNumbers && p.propertyNumbers.some(pn => pn && itemName.includes(pn))) ||
      p.name.toLowerCase() === cleanName
    );

    if (matchedProp) {
      // If a specific physical unit barcode/PIS was targeted, quantity is strictly 1 unit
      const isSpecificUnit = Boolean(
        itemName && (
          (matchedProp.pisCode && itemName.includes(matchedProp.pisCode)) ||
          (matchedProp.propertyNumber && itemName.includes(matchedProp.propertyNumber)) ||
          (matchedProp.pisCodes && matchedProp.pisCodes.some(c => c && itemName.includes(c)))
        )
      );

      const propQty = isSpecificUnit ? 1 : Math.max(1, matchedProp.quantity || 1);
      const activeRecords = storage.getCachedBorrowRecords();
      const borrowedCount = activeRecords.filter(r => 
        (r.status === 'Borrowed' || r.status === 'Overdue') &&
        (
          r.itemId === matchedProp.id || 
          (matchedProp.pisCode && (r.specificId === matchedProp.pisCode || r.itemName?.includes(matchedProp.pisCode)))
        )
      ).length;

      const available = Math.max(0, propQty - borrowedCount);
      return {
        available,
        total: propQty,
        unit: matchedProp.unit || 'unit',
        borrowed: borrowedCount
      };
    }

    // 3. Fallback for physical tagged items: strictly 1 unit, never 99
    return { available: 1, total: 1, unit: 'unit', borrowed: 0 };
  };

  const triggerBucketAnimation = (itemId: string) => {
    setRecentlyAddedItemId(itemId);
    setBucketBump(true);
    setToast(null);
    setTimeout(() => setBucketBump(false), 450);
    setTimeout(() => {
      setRecentlyAddedItemId(current => (current === itemId ? null : current));
    }, 2200);
  };

  useEffect(() => {
    loadInventory();
  }, []);

  // Update learner fields if initialLearner prop changes
  useEffect(() => {
    if (initialLearner) {
      if (initialLearner.full_name || initialLearner.name) {
        setBorrowerName(initialLearner.full_name || initialLearner.name || '');
      }
      const formatted = [
        initialLearner.lrn ? `LRN: ${initialLearner.lrn}` : '',
        initialLearner.section_name ? initialLearner.section_name : '',
        initialLearner.grade_level ? `(${initialLearner.grade_level})` : ''
      ].filter(Boolean).join(' • ');
      if (formatted) setBorrowerId(formatted);
      if (!borrowerEmail && initialLearner.lrn) {
        setBorrowerEmail(`${initialLearner.lrn}@deped.gov.ph`);
      }
      setRfidVerified(true);
      setStep(2);
    }
  }, [initialLearner]);

  // Kiosk Auto-Reset Countdown on Step 4
  useEffect(() => {
    if (step === 4 && isKioskMode) {
      setKioskCountdown(10);
      const timer = setInterval(() => {
        setKioskCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            onClose();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, isKioskMode, onClose]);

  // USB RFID & Barcode Scanner Integration
  useEffect(() => {
    const unsub = usbScannerService.onScan(async (code) => {
      if (!code) return;
      const cleanCode = code.trim();

      // 1. Check if the scanned code corresponds to a Learner's RFID badge or LRN
      const foundLearner = getLearnerFromMemory(cleanCode);
      if (foundLearner) {
        usbScannerService.markRfidDetected();
        usbScannerService.playSuccessBeep();
        const studentName = foundLearner.full_name || foundLearner.name || 'Student Borrower';
        setBorrowerName(studentName);
        const formatted = [
          foundLearner.lrn ? `LRN: ${foundLearner.lrn}` : '',
          foundLearner.section_name ? foundLearner.section_name : '',
          foundLearner.grade_level ? `(${foundLearner.grade_level})` : ''
        ].filter(Boolean).join(' • ');
        setBorrowerId(formatted || cleanCode);
        if (!borrowerEmail || !borrowerEmail.includes('@')) {
          const freshEmail = isGenuineEmail((foundLearner as any)?.email)
            ? (foundLearner as any).email
            : isGenuineEmail(foundLearner.contact_number)
              ? foundLearner.contact_number!
              : (foundLearner.lrn ? `${foundLearner.lrn}@deped.gov.ph` : '');
          if (freshEmail) setBorrowerEmail(freshEmail);
        }
        if (!returnDate) {
          setReturnDate(todayString);
        }
        setRfidVerified(true);
        // Auto-advance to Step 2 so student or assistant can scan equipment
        if (step === 1) {
          setStep(2);
        }
        return;
      }

      // 2. Check if the code is an equipment barcode (PIS sticker code, property number, lab inventory barcode)
      try {
        const lookup = await lookupScannedBarcode(cleanCode, items, []);
        
        if (lookup.matchType === 'property_item' && lookup.propertyItem) {
          const prop = lookup.propertyItem;
          const tagCode = lookup.specificUnitId || prop.pisCode || prop.propertyNumber || cleanCode;
          
          // Check if this specific physical unit barcode is already in the bucket
          const alreadyHasSpecificUnit = selectedItems.some(p => p.itemName.includes(tagCode));
          if (alreadyHasSpecificUnit) {
            usbScannerService.playErrorBeep();
            const propName = prop.name || 'Physical Equipment';
            const existingItem = selectedItems.find(p => p.itemName.includes(tagCode));
            const currentQty = existingItem ? existingItem.quantity : 1;
            showToast(
              'Quantity Limit Reached (Stock Maxed)',
              `Asset "${propName}" with physical barcode "${tagCode}" is already in your borrow bucket.`,
              `Only 1 unit exists for this individual physical asset, and it is already allocated (${currentQty} of 1 unit in bucket). You cannot add the same barcode twice.`,
              'warning'
            );
            return;
          }

          // Check if an inventory item has the same name or shortId
          const matchedInv = items.find(i => 
            i.name.toLowerCase() === prop.name.toLowerCase() ||
            (i.shortId && prop.shortId && i.shortId.toLowerCase() === prop.shortId.toLowerCase())
          );

          if (matchedInv) {
            const stock = getAvailableStockForItem(matchedInv.id, matchedInv.name);
            const inBucket = selectedItems.find(p => p.itemId === matchedInv.id)?.quantity || 0;
            
            if (stock.available <= 0) {
              usbScannerService.playErrorBeep();
              showToast(
                'Item Out of Stock in Inventory',
                `"${matchedInv.name}" has 0 available units to loan in inventory.`,
                `Total inventory quantity is ${stock.total} ${stock.unit}, and all units are currently loaned out (${stock.borrowed} active loans).`,
                'error'
              );
              return;
            }
            if (inBucket >= stock.available) {
              usbScannerService.playErrorBeep();
              showToast(
                'Quantity Limit Reached (Stock Maxed)',
                `All available units of "${matchedInv.name}" are already in your borrow bucket.`,
                `The available inventory limit of ${stock.available} ${stock.unit} is already reached (${inBucket} of ${stock.available} allocated in bucket). No additional units can be added.`,
                'warning'
              );
              return;
            }

            usbScannerService.markBarcodeDetected();
            usbScannerService.playSuccessBeep();
            addItem(matchedInv);
            triggerBucketAnimation(matchedInv.id);
          } else {
            // Standalone Property item
            const propMax = prop.quantity || 1;
            const existingIndex = selectedItems.findIndex(p => p.itemId === prop.id);
            const inBucket = existingIndex >= 0 ? selectedItems[existingIndex].quantity : 0;
            
            if (inBucket >= propMax) {
              usbScannerService.playErrorBeep();
              showToast(
                'Property Asset Quantity Maxed',
                `"${prop.name}" has reached its maximum allowable loan quantity.`,
                `Only ${propMax} ${prop.unit || 'units'} exist in the property registry, and ${inBucket} of ${propMax} are already allocated in your bucket.`,
                'warning'
              );
              return;
            }

            usbScannerService.markBarcodeDetected();
            usbScannerService.playSuccessBeep();
            const targetId = prop.id;
            setSelectedItems(prev => {
              const idx = prev.findIndex(p => p.itemId === prop.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = {
                  ...next[idx],
                  quantity: next[idx].quantity + 1
                };
                return next;
              }
              return [...prev, {
                itemId: prop.id,
                itemName: `${prop.name} [PIS: ${tagCode}]`,
                quantity: 1
              }];
            });
            triggerBucketAnimation(targetId);
          }

          if (step === 1 && (borrowerName.trim().length > 0 || isKioskMode)) {
            setStep(2);
          }
          return;
        }

        if (lookup.matchType === 'lab_item' && lookup.labItem) {
          const lab = lookup.labItem;
          const stock = getAvailableStockForItem(lab.id, lab.name);
          const inBucket = selectedItems.find(p => p.itemId === lab.id)?.quantity || 0;

          if (stock.available <= 0) {
            usbScannerService.playErrorBeep();
            showToast(
              'Item Out of Stock in Inventory',
              `"${lab.name}" has 0 available units in inventory.`,
              `Total inventory stock is ${stock.total} ${stock.unit}, with ${stock.borrowed} units on active loans.`,
              'error'
            );
            return;
          }
          if (inBucket >= stock.available) {
            usbScannerService.playErrorBeep();
            showToast(
              'Quantity Limit Reached (Stock Maxed)',
              `All available units of "${lab.name}" are already in your borrow bucket.`,
              `The available inventory limit of ${stock.available} ${stock.unit} is already allocated in your bucket (${inBucket} of ${stock.available}). No more units available.`,
              'warning'
            );
            return;
          }

          usbScannerService.markBarcodeDetected();
          usbScannerService.playSuccessBeep();
          addItem(lab);
          triggerBucketAnimation(lab.id);
          if (step === 1 && (borrowerName.trim().length > 0 || isKioskMode)) {
            setStep(2);
          }
          return;
        }

        // 3. Fallback: Check if the string looks like an un-indexed student LRN or RFID
        if (/^\d{10,12}$/.test(cleanCode) || /^[0-9A-Fa-f]{8,14}$/.test(cleanCode)) {
          // If in step 1 and borrowerId is empty, prefill scanned ID
          if (step === 1) {
            usbScannerService.markRfidDetected();
            usbScannerService.playSuccessBeep();
            setBorrowerId(`Badge UID: ${cleanCode}`);
            return;
          }
        }

        // 4. Code not recognized
        usbScannerService.playErrorBeep();
        showToast(
          'Unrecognized Barcode',
          `Barcode "${cleanCode}" was not recognized.`,
          `No matching learner RFID badge or laboratory/property asset tag was found in the database.`,
          'error'
        );
      } catch (err) {
        console.error('[PublicRequestModal] Scanner lookup error:', err);
      }
    });

    return () => {
      unsub();
    };
  }, [items, borrowerName, isKioskMode, step, borrowerEmail, returnDate, todayString, selectedItems]);



  const loadInventory = async () => {
    // 1. Check if we already have valid cached equipment; if so, hydrate without network request
    const cached = storage.getCachedItems();
    if (cached.length > 0) {
      const availableItems = cached.filter(i => {
        const hasLimit = i.maxBorrowable !== undefined && i.maxBorrowable !== null;
        const limit = hasLimit ? i.maxBorrowable! : i.quantity;
        return (limit - (i.borrowedQuantity || 0)) > 0;
      });
      setItems(availableItems);
      const categories = Array.from(new Set(availableItems.map(i => i.category)));
      if (categories.length > 0) {
        setExpandedCategories(prev => (prev.size > 0 ? prev : new Set([categories[0]])));
      }
      setIsLoading(false);
      return;
    }

    // 2. Only if the cache is completely empty do we query the database
    setIsLoading(true);
    try {
        const data = await storage.getInventory();
        const availableItems = data.filter(i => {
            const hasLimit = i.maxBorrowable !== undefined && i.maxBorrowable !== null;
            const limit = hasLimit ? i.maxBorrowable! : i.quantity;
            return (limit - (i.borrowedQuantity || 0)) > 0;
        });
        setItems(availableItems);
        
        // Auto-expand first category if available
        const categories = Array.from(new Set(availableItems.map(i => i.category)));
        if (categories.length > 0) {
            setExpandedCategories(new Set([categories[0]]));
        }
    } catch (e) {
        console.error("Failed to load inventory", e);
    } finally {
        setIsLoading(false);
    }
  };

  const validateStep1 = () => {
      const newErrors: Record<string, string> = {};

      if (!borrowerName.trim()) newErrors.borrowerName = "Full Name is required";
      if (!borrowerId.trim()) newErrors.borrowerId = "ID / Section is required";
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!borrowerEmail.trim()) newErrors.borrowerEmail = "Email is required for your request copy";
      else if (!emailRegex.test(borrowerEmail)) newErrors.borrowerEmail = "Invalid email format";

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
      const newErrors: Record<string, string> = {};
      const today = new Date().toISOString().split('T')[0];

      if (!returnDate) {
          newErrors.returnDate = "Return date is required";
      } else if (returnDate < today) {
          newErrors.returnDate = "Return date cannot be in the past";
      }

      if (isReservingLab) {
          if (!reservationDate) newErrors.reservationDate = "Lab reservation date is required";
          if (!startTime) newErrors.startTime = "Start time is required";
          if (!endTime) newErrors.endTime = "End time is required";
          
          if (startTime && endTime && startTime >= endTime) {
              newErrors.endTime = "End time must be after start time";
          }

          if (reservationDate && reservationDate < today) newErrors.reservationDate = "Reservation cannot be in the past";
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
  };

  // Real-time check to disable the Confirm button until Return Date and Lab Facility fields (if toggled) are complete
  const isStep3Complete = useMemo(() => {
      // 1. Return Due Date must be selected and not in the past
      if (!returnDate || !returnDate.trim()) return false;
      if (returnDate < todayString) return false;

      // 2. If Laboratory Facility Reservation is toggled ON, date and valid start/end times are required
      if (isReservingLab) {
          if (!reservationDate || !reservationDate.trim()) return false;
          if (reservationDate < todayString) return false;
          if (!startTime || !startTime.trim()) return false;
          if (!endTime || !endTime.trim()) return false;
          if (startTime >= endTime) return false;
      }

      return true;
  }, [returnDate, todayString, isReservingLab, reservationDate, startTime, endTime]);

  const handleNext = () => {
      if (step === 1) {
          if (validateStep1()) setStep(2);
      } else if (step === 2) {
          if (selectedItems.length === 0) {
              setAlertModal({
                title: "Borrow Bucket is Empty",
                message: "Please select at least one item to borrow or scan equipment PIS barcodes.",
                type: "warning"
              });
              return;
          }
          // Validate actual quantity of every item in bucket against inventory
          for (const p of selectedItems) {
              const stock = getAvailableStockForItem(p.itemId, p.itemName);
              if (p.quantity > stock.available) {
                  showToast(
                    'Quantity Exceeds Available Stock',
                    `"${p.itemName}" exceeds available inventory.`,
                    `Requested ${p.quantity} units, but only ${stock.available} ${stock.unit} are available in inventory (${stock.total} total). Please adjust quantity before continuing.`,
                    'error'
                  );
                  return;
              }
          }
          setStep(3);
      }
  };

  const filteredInventory = useMemo(() => {
      const filtered = items.filter(i => 
          i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          i.category.toLowerCase().includes(searchTerm.toLowerCase())
      );

      // If searching, auto-expand all matching categories
      if (searchTerm.trim().length > 0) {
          const matchingCats = new Set(filtered.map(i => i.category));
          setExpandedCategories(matchingCats);
      }

      return filtered;
  }, [items, searchTerm]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};
    filteredInventory.forEach(item => {
        if (!groups[item.category]) groups[item.category] = [];
        groups[item.category].push(item);
    });
    return groups;
  }, [filteredInventory]);

  const toggleCategory = (cat: string) => {
      setExpandedCategories(prev => {
          const newSet = new Set(prev);
          if (newSet.has(cat)) newSet.delete(cat);
          else newSet.add(cat);
          return newSet;
      });
  };

  const addItem = (item: InventoryItem) => {
      const stock = getAvailableStockForItem(item.id, item.name);
      const inBucket = selectedItems.find(p => p.itemId === item.id)?.quantity || 0;

      if (stock.available <= 0) {
          showToast(
            'Item Out of Stock',
            `"${item.name}" has 0 available units to loan in inventory.`,
            `Total inventory stock is ${stock.total} ${stock.unit}, with ${stock.borrowed} units on active loans.`,
            'error'
          );
          return;
      }

      if (inBucket >= stock.available) {
          showToast(
            'Quantity Limit Reached (Stock Maxed)',
            `All available units of "${item.name}" are already in your borrow bucket.`,
            `You have already allocated all ${stock.available} available ${stock.unit} in your borrow bucket (${inBucket} of ${stock.available}).`,
            'warning'
          );
          return;
      }

      setSelectedItems(prev => {
          const existing = prev.find(p => p.itemId === item.id);
          if (existing) {
              return prev.map(p => p.itemId === item.id ? { ...p, quantity: Math.min(stock.available, p.quantity + 1) } : p);
          }
          return [...prev, { itemId: item.id, itemName: item.name, quantity: 1 }];
      });
      triggerBucketAnimation(item.id);
  };

  const toggleSound = () => {
    const next = !scannerSound;
    setScannerSound(next);
    usbScannerService.setSoundEnabled(next);
  };

  const formatTime = (t24: string) => {
      if (!t24) return '';
      const [h, m] = t24.split(':').map(Number);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const handleSubmit = async () => {
      // 1. Verify borrower info (if missing, return to step 1)
      if (!validateStep1()) {
          setStep(1);
          return;
      }

      // 2. Verify equipment bucket
      if (selectedItems.length === 0) {
          setAlertModal({
            title: "Borrow Bucket is Empty",
            message: "Please select at least one item to borrow or scan equipment PIS barcodes.",
            type: "warning"
          });
          setStep(2);
          return;
      }

      // 3. Verify return date and facility reservation
      if (!validateStep3()) return;
      
      // Re-verify that all bucket item quantities do not exceed actual inventory
      for (const p of selectedItems) {
          const stock = getAvailableStockForItem(p.itemId, p.itemName);
          if (p.quantity > stock.available) {
              setAlertModal({
                title: "Stock Limit Exceeded",
                message: `Cannot submit: "${p.itemName}" exceeds available inventory (${stock.available} ${stock.unit} available).`,
                type: "error"
              });
              return;
          }
      }

      setIsLoading(true);
      try {
          const refCode = 'REQ-' + Math.floor(100000 + Math.random() * 900000);
          const resSlot = isReservingLab ? `${formatTime(startTime)} - ${formatTime(endTime)}` : undefined;
          
          const requestData: Partial<BorrowRequest> = {
              referenceCode: refCode,
              borrowerName,
              borrowerId,
              borrowerEmail,
              returnDate,
              requestDate: new Date().toISOString(),
              items: selectedItems,
              reservationSlot: resSlot,
              reservationDate: isReservingLab ? reservationDate : undefined,
              status: 'Pending'
          };

          const newRequest = await storage.createBorrowRequest(requestData);

          if (newRequest) {
              let copySent = false;
              try {
                  const settings = await storage.getSettings();
                  const [, requesterCopyResult] = await Promise.all([
                      notifyAdminsOfNewRequest(settings, newRequest),
                      notifyBorrowerOfRequestCopy(settings, newRequest)
                  ]);
                  copySent = requesterCopyResult === true;
              } catch (notificationError) {
                  console.error('Request saved, but email notification failed:', notificationError);
              }
              
              setRequestCopySent(copySent);
              setCreatedRequest(newRequest);
              setStep(4);
          } else {
              throw new Error("Failed to save the request.");
          }
      } catch (err: any) {
          setAlertModal({
            title: "Submission Error",
            message: err.message || "Please check your internet connection and try again.",
            type: "error"
          });
      } finally {
          setIsLoading(false);
      }
  };

  const modalContent = (
    <div
      className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen min-h-screen z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Top-Left Floating Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-6 z-[10001] max-w-sm w-full bg-white border border-gray-200 shadow-2xl rounded-md p-3.5 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-start gap-3">
            <div className={`p-1.5 rounded-md flex-shrink-0 ${
              toast.type === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
              toast.type === 'info' ? 'bg-blue-50 text-blue-600 border border-blue-200' :
              'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <h4 className={`text-xs font-bold leading-tight ${
                toast.type === 'error' ? 'text-red-900' :
                toast.type === 'info' ? 'text-blue-900' :
                'text-amber-900'
              }`}>
                {toast.title}
              </h4>
              <p className="text-xs text-gray-800 font-medium mt-1 leading-snug">
                {toast.message}
              </p>
              {toast.detail && (
                <p className="text-[11px] text-gray-500 mt-1 leading-relaxed border-t border-gray-100 pt-1">
                  {toast.detail}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-700 p-1 -mr-1 -mt-1 rounded-sm hover:bg-gray-100 transition-colors cursor-pointer"
              title="Close Notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Institutional Alert / Notice Modal Dialog */}
      {alertModal && (
        <div
          className="fixed inset-0 z-[10010] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={() => setAlertModal(null)}
        >
          <div
            className="bg-white rounded-lg border border-gray-300 shadow-2xl max-w-md w-full p-6 text-center animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border ${
              alertModal.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-600'
                : alertModal.type === 'info'
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'bg-maroon-50 border-maroon-200 text-maroon-600'
            }`}>
              {alertModal.type === 'error' ? (
                <AlertCircle className="w-7 h-7" />
              ) : (
                <ShoppingBag className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {alertModal.title}
            </h3>

            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              {alertModal.message}
            </p>

            <button
              type="button"
              autoFocus
              onClick={() => setAlertModal(null)}
              className="w-full py-2.5 px-4 bg-maroon-600 hover:bg-maroon-700 text-white text-sm font-bold rounded-md shadow-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-maroon-500 focus:ring-offset-2"
            >
              OK, Got It
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-md shadow-2xl w-full max-w-4xl h-[88vh] flex flex-col border border-gray-200 overflow-hidden relative">
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-gray-300 hover:text-white z-20 p-2 transition-colors">
          <X className="w-6 h-6" />
        </button>

        {/* Modal Top Header */}
        <div className="bg-maroon-600 p-5 text-white flex-shrink-0 relative">
            <div className="pr-10">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5" />
                  {isKioskMode ? 'Public Borrowing Kiosk Station' : 'Borrow Request'}
                </h2>
                <p className="text-maroon-100 text-xs mt-0.5">
                  Step {step} of 4: {step === 1 ? 'Borrower Information' : step === 2 ? 'Select / Scan Equipment' : step === 3 ? 'Schedule & Final Review' : 'Submission Completed'}
                </p>
            </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-hidden p-6 bg-gray-50 flex flex-col">
            {step === 1 && (
                <div className="max-w-xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 overflow-y-auto w-full pr-2">
                    {/* RFID Badge Indicator if Prefilled */}
                    {rfidVerified && borrowerName && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-md p-3.5 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">Verified via USIS Learner Roster</div>
                          <div className="text-sm font-extrabold text-emerald-950 truncate">{borrowerName}</div>
                          <div className="text-[11px] text-emerald-700 truncate">{borrowerId}</div>
                        </div>
                      </div>
                    )}

                    {/* Unregistered Card Indicator */}
                    {initialLearner && !rfidVerified && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-md bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold uppercase tracking-wider text-amber-900">Card Captured (Not in USIS)</div>
                          <div className="text-xs text-amber-800">
                            Card ID: <span className="font-mono font-bold">{initialLearner.lrn || initialLearner.id}</span>
                          </div>
                          <div className="text-[11px] text-amber-700">Please enter your Full Name, Grade & Section, and Email below to complete the request.</div>
                        </div>
                      </div>
                    )}

                    {/* Scanner live tip */}
                    <div className="bg-blue-50/70 border border-blue-200 rounded-md p-3 flex items-center gap-3 text-xs text-blue-800">
                      <Radio className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <span className="font-bold">Scanner Active:</span> You can tap the learner's physical RFID ID badge or scan the LRN barcode now to automatically prefill this form.
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-gray-800 border-b pb-2">Borrower Information</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                            <input 
                              type="text" 
                              value={borrowerName} 
                              onChange={(e) => setBorrowerName(e.target.value)} 
                              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500 bg-white ${errors.borrowerName ? 'border-red-500' : 'border-gray-300'}`} 
                              placeholder="Juan Dela Cruz" 
                            />
                            {errors.borrowerName && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.borrowerName}</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ID / Grade & Section *</label>
                            <input 
                              type="text" 
                              value={borrowerId} 
                              onChange={(e) => setBorrowerId(e.target.value)} 
                              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500 bg-white ${errors.borrowerId ? 'border-red-500' : 'border-gray-300'}`} 
                              placeholder="LRN: 123456789012 • 10-Einstein (Grade 10)" 
                            />
                            {errors.borrowerId && <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.borrowerId}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Request Copy Email *</label>
                        <input 
                          type="email" 
                          required 
                          value={borrowerEmail} 
                          onChange={(e) => setBorrowerEmail(e.target.value)} 
                          className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500 bg-white ${errors.borrowerEmail ? 'border-red-500' : 'border-gray-300'}`} 
                          placeholder="student@school.edu" 
                        />
                        {errors.borrowerEmail ? (
                          <p className="text-[10px] text-red-500 mt-1 font-bold">{errors.borrowerEmail}</p>
                        ) : (
                          <p className="text-[10px] text-gray-400 mt-1">A submission copy and future status updates will be sent here.</p>
                        )}
                    </div>
                </div>
            )}

            {step === 2 && (
                <div className="flex h-full gap-6 animate-in fade-in slide-in-from-right-8 duration-300 overflow-hidden">
                    <div className="flex-1 flex flex-col min-w-0">
                         {/* Barcode Scanner Ready Banner */}
                         <div className="mb-3 bg-maroon-50/80 border border-maroon-200 rounded-md px-3.5 py-2.5 flex items-center gap-3 text-xs text-maroon-900 flex-shrink-0">
                            <Barcode className="w-5 h-5 text-maroon-700 flex-shrink-0" />
                            <div className="truncate">
                              <span className="font-extrabold uppercase tracking-wide">Barcode Scanner Active:</span> Aim scanner at any PIS barcode sticker (e.g. <span className="font-mono font-bold">PIS-26-XXXXX</span>) to auto-add items to your bucket.
                            </div>
                         </div>

                         <div className="mb-3 relative flex-shrink-0">
                            <input 
                              type="text" 
                              placeholder="Search laboratory equipment..." 
                              value={searchTerm} 
                              onChange={(e) => setSearchTerm(e.target.value)} 
                              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-maroon-500 text-sm" 
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                         </div>

                         <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                             {Object.keys(groupedItems).length > 0 ? Object.keys(groupedItems).map(category => {
                                 const isExpanded = expandedCategories.has(category);
                                 const catItems = groupedItems[category];
                                 
                                 return (
                                    <div key={category} className="bg-white rounded-md border border-gray-200 shadow-sm mb-2 overflow-hidden transition-all duration-300">
                                        <button 
                                            onClick={() => toggleCategory(category)}
                                            className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors select-none"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div style={{ color: getCategoryColor(category) }}>
                                                    {getCategoryIcon(category)}
                                                </div>
                                                <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider">{category}</h4>
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{catItems.length}</span>
                                            </div>
                                            <div className="text-gray-400">
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </div>
                                        </button>
                                        
                                        {isExpanded && (
                                            <div className="p-2 pt-0 border-t border-gray-100 bg-gray-50/30 animate-in slide-in-from-top-1 duration-200">
                                                <div className="grid grid-cols-1 gap-1.5 pt-2">
                                                    {catItems.map(item => {
                                                        const stock = getAvailableStockForItem(item.id, item.name);
                                                        const inBucket = selectedItems.find(p => p.itemId === item.id)?.quantity || 0;
                                                        const isOut = stock.available <= 0;
                                                        const isMaxed = inBucket >= stock.available && !isOut;

                                                        return (
                                                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-md border border-gray-200 hover:border-maroon-300 transition-all group shadow-sm">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-semibold text-gray-800 truncate">{item.name}</p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                                                                        isOut 
                                                                            ? 'bg-red-50 text-red-600 border-red-200 font-bold' 
                                                                            : 'bg-gray-100 text-gray-700 border-gray-200'
                                                                    }`}>
                                                                        {isOut ? 'Out of Stock' : `Available: ${stock.available} ${stock.unit} (Total: ${stock.total})`}
                                                                    </span>
                                                                    {inBucket > 0 && (
                                                                        <span className="text-[10px] text-blue-700 font-bold px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded">
                                                                            {inBucket} in bucket
                                                                        </span>
                                                                    )}
                                                                    {item.shortId && <span className="text-[10px] text-blue-600 font-mono px-1.5 py-0.5 bg-blue-50 rounded border border-blue-100">Tag: {item.shortId}</span>}
                                                                    {item.location && <span className="text-[10px] text-gray-400 flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {item.location}</span>}
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={() => addItem(item)} 
                                                                disabled={isOut || isMaxed}
                                                                className={`ml-3 p-2 rounded-md transition-all shadow-sm border ${
                                                                    isOut || isMaxed
                                                                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                                                        : 'bg-maroon-50 text-maroon-600 hover:bg-maroon-600 hover:text-white border-maroon-100 cursor-pointer'
                                                                }`}
                                                                title={isOut ? 'Out of stock' : isMaxed ? 'All available stock is in bucket' : 'Add to bucket'}
                                                            >
                                                                <Plus className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                 );
                             }) : (
                                 <div className="text-center py-20 text-gray-400">
                                     <Search className="w-12 h-12 mx-auto opacity-10 mb-2"/>
                                     <p>No matching equipment found.</p>
                                 </div>
                             )}
                         </div>
                    </div>

                    {/* Right side: Borrow Bucket */}
                    <div className={`w-80 bg-white p-4 rounded-md border shadow-sm flex flex-col flex-shrink-0 transition-all duration-300 ${
                      bucketBump ? 'border-maroon-400 ring-2 ring-maroon-300/50 shadow-md' : 'border-gray-200'
                    }`}>
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                            <div>
                              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
                                <ShoppingBag className={`w-4 h-4 transition-transform duration-200 ${bucketBump ? 'scale-125 text-maroon-600' : 'text-gray-600'}`} />
                                <span>Borrow Bucket</span>
                              </h4>
                              {borrowerName && (
                                <p className="text-[10px] text-gray-500 truncate max-w-[170px]">For: {borrowerName}</p>
                              )}
                            </div>
                            <span className={`text-[11px] px-2.5 py-0.5 rounded font-bold border transition-all duration-300 ${
                              bucketBump 
                                ? 'bg-maroon-600 text-white border-maroon-700 scale-110 shadow-sm' 
                                : 'bg-maroon-50 text-maroon-700 border-maroon-200'
                            }`}>
                              {selectedItems.reduce((acc, curr) => acc + curr.quantity, 0)} Items
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                            {selectedItems.length > 0 ? selectedItems.map(p => {
                                const isRecentlyAdded = p.itemId === recentlyAddedItemId;
                                const stock = getAvailableStockForItem(p.itemId, p.itemName);
                                const isAtMax = p.quantity >= stock.available;

                                return (
                                  <div 
                                    key={p.itemId} 
                                    className={`flex justify-between items-center text-sm border-b pb-2.5 px-2.5 py-2 rounded-md transition-all duration-300 ${
                                      isRecentlyAdded 
                                        ? 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-400/50 animate-in fade-in slide-in-from-left-3 zoom-in-95 duration-300 shadow-sm' 
                                        : 'border-gray-100 hover:bg-gray-50/60'
                                    }`}
                                  >
                                      <div className="min-w-0 flex-1 mr-2">
                                          <p className={`font-semibold truncate text-xs transition-colors ${isRecentlyAdded ? 'text-emerald-950 font-bold' : 'text-gray-800'}`}>
                                            {p.itemName}
                                          </p>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className="text-[10px] text-gray-500 font-medium">
                                              Stock: <strong className="text-gray-700">{stock.available}</strong> {stock.unit} available
                                            </span>
                                            {isAtMax && (
                                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded">
                                                Max
                                              </span>
                                            )}
                                          </div>
                                          {isRecentlyAdded && (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 mt-0.5 animate-in fade-in duration-200">
                                              <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" /> Added to bucket
                                            </span>
                                          )}
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (p.quantity > 1) {
                                                setSelectedItems(prev => prev.map(item => item.itemId === p.itemId ? {...item, quantity: item.quantity - 1} : item));
                                              } else {
                                                setSelectedItems(prev => prev.filter(item => item.itemId !== p.itemId));
                                              }
                                            }}
                                            className="w-5 h-5 flex items-center justify-center text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold transition-colors cursor-pointer"
                                            title="Decrease quantity"
                                          >
                                            -
                                          </button>
                                          <input 
                                            type="number" 
                                            min="1" 
                                            max={stock.available}
                                            value={p.quantity} 
                                            onChange={(e) => {
                                              const raw = parseInt(e.target.value) || 1;
                                              const clamped = Math.max(1, Math.min(stock.available, raw));
                                              if (raw > stock.available) {
                                                showToast(
                                                  'Quantity Capped at Maximum Stock',
                                                  `Quantity for "${p.itemName}" was capped at ${stock.available} ${stock.unit}.`,
                                                  `Requested quantity exceeded the available stock limit (${stock.available} ${stock.unit} available in inventory).`,
                                                  'warning'
                                                );
                                              }
                                              setSelectedItems(prev => prev.map(item => item.itemId === p.itemId ? {...item, quantity: clamped} : item));
                                            }} 
                                            className={`w-10 px-1 py-0.5 border rounded text-center text-xs font-bold transition-all ${
                                              isRecentlyAdded ? 'border-emerald-400 bg-white ring-1 ring-emerald-300' : 'border-gray-200 bg-white'
                                            }`} 
                                          />
                                          <button
                                            type="button"
                                            disabled={isAtMax}
                                            onClick={() => {
                                              if (!isAtMax) {
                                                setSelectedItems(prev => prev.map(item => item.itemId === p.itemId ? {...item, quantity: item.quantity + 1} : item));
                                                triggerBucketAnimation(p.itemId);
                                              } else {
                                                showToast(
                                                  'Quantity Limit Reached (Stock Maxed)',
                                                  `Cannot add more "${p.itemName}".`,
                                                  `Maximum available stock for this item is ${stock.available} ${stock.unit}, and all ${stock.available} units are already in your bucket.`,
                                                  'warning'
                                                );
                                              }
                                            }}
                                            className={`w-5 h-5 flex items-center justify-center rounded text-xs font-bold transition-colors ${
                                              isAtMax 
                                                ? 'text-gray-300 bg-gray-50 cursor-not-allowed' 
                                                : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 cursor-pointer'
                                            }`}
                                            title={isAtMax ? 'Maximum stock reached' : 'Increase quantity'}
                                          >
                                            +
                                          </button>
                                          <button 
                                            type="button"
                                            onClick={() => setSelectedItems(prev => prev.filter(item => item.itemId !== p.itemId))} 
                                            className="text-gray-400 hover:text-red-600 transition-colors p-1 ml-0.5 cursor-pointer"
                                            title="Remove item"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                      </div>
                                  </div>
                                );
                            }) : (
                                <div className="text-center py-12 px-3">
                                    <Barcode className="w-10 h-10 text-gray-300 mx-auto mb-2 opacity-60" />
                                    <p className="text-xs text-gray-400 font-medium">Your bucket is empty.</p>
                                    <p className="text-[11px] text-gray-400 mt-1">Scan a PIS barcode sticker or click <Plus className="w-3 h-3 inline text-maroon-600" /> to add equipment.</p>
                                </div>
                            )}
                        </div>

                        {selectedItems.length > 0 && (
                          <div className="pt-3 border-t mt-2 text-center">
                            <span className="text-[10px] text-gray-400">Scan more items or proceed to Review</span>
                          </div>
                        )}
                    </div>
                </div>
            )}

            {step === 3 && (
                <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-8 duration-300 overflow-y-auto w-full pr-2">
                     <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold text-gray-800">Schedule & Final Review</h3>
                        <p className="text-gray-500 text-sm">Set your return date, optional lab facility reservation, and review your request.</p>
                     </div>

                     {/* Return Date & Lab Facility Usage (Placed after equipment selection) */}
                     <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                            <Calendar className="w-5 h-5 text-maroon-600" />
                            <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Return Due Date & Facility Usage</h4>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Estimated Return Due Date <span className="text-red-500">*</span>
                            </label>
                            <input 
                                type="date" 
                                min={todayString}
                                value={returnDate} 
                                onChange={(e) => {
                                  setReturnDate(e.target.value);
                                  if (errors.returnDate) setErrors(prev => ({ ...prev, returnDate: '' }));
                                }} 
                                className={`w-full max-w-sm px-4 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500 bg-white ${errors.returnDate ? 'border-red-500' : 'border-gray-300'}`} 
                            />
                            {errors.returnDate ? (
                              <p className="text-[11px] text-red-600 mt-1 font-semibold">{errors.returnDate}</p>
                            ) : (
                              <p className="text-[11px] text-gray-400 mt-1">Specify when the borrowed equipment will be returned to the laboratory.</p>
                            )}
                        </div>

                        {/* Laboratory Facility Reservation Toggle */}
                        <div className="pt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-maroon-50 text-maroon-600 rounded-md"><MapPin className="w-4 h-4" /></div>
                                    <div>
                                        <h4 className="font-bold text-gray-800 text-sm">Laboratory Facility Reservation</h4>
                                        <p className="text-xs text-gray-500">Enable if you need physical laboratory room/table space for your activity.</p>
                                    </div>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => setIsReservingLab(!isReservingLab)} 
                                  className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${isReservingLab ? 'bg-maroon-600' : 'bg-gray-200'}`}
                                >
                                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isReservingLab ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>

                            {isReservingLab && (
                                <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-2 bg-maroon-50/40 p-4 rounded-md border border-maroon-100">
                                    <div>
                                        <label className="text-xs font-bold text-gray-700 uppercase block mb-1">
                                          Reservation Date <span className="text-red-500">*</span>
                                        </label>
                                        <input 
                                            type="date" 
                                            min={todayString}
                                            value={reservationDate} 
                                            onChange={(e) => {
                                              setReservationDate(e.target.value);
                                              if (errors.reservationDate) setErrors(prev => ({ ...prev, reservationDate: '' }));
                                            }} 
                                            className={`w-full max-w-sm px-4 py-2 border rounded-md focus:ring-2 focus:ring-maroon-500 bg-white ${errors.reservationDate ? 'border-red-500' : 'border-maroon-200'}`} 
                                        />
                                        {errors.reservationDate && <p className="text-[11px] text-red-600 mt-1 font-semibold">{errors.reservationDate}</p>}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <AnalogTimePicker 
                                              label="Start Time *"
                                              value={startTime}
                                              onChange={(val) => {
                                                setStartTime(val);
                                                if (errors.startTime || errors.endTime) setErrors(prev => ({ ...prev, startTime: '', endTime: '' }));
                                              }}
                                            />
                                            {errors.startTime && <p className="text-[11px] text-red-600 mt-1 font-semibold">{errors.startTime}</p>}
                                        </div>
                                        <div>
                                            <AnalogTimePicker 
                                              label="End Time *"
                                              value={endTime}
                                              onChange={(val) => {
                                                setEndTime(val);
                                                if (errors.endTime) setErrors(prev => ({ ...prev, endTime: '' }));
                                              }}
                                            />
                                            {errors.endTime && <p className="text-[11px] text-red-600 mt-1 font-semibold">{errors.endTime}</p>}
                                        </div>
                                    </div>
                                    {(!reservationDate || !startTime || !endTime) && (
                                      <p className="text-[11px] text-amber-800 font-medium bg-amber-50/80 border border-amber-200 rounded px-2.5 py-1.5 mt-2">
                                        Please provide the reservation date, start time, and end time to enable submission.
                                      </p>
                                    )}
                                </div>
                            )}
                        </div>
                     </div>

                     {/* Borrower Info Summary */}
                     <div className="bg-white p-5 rounded-md shadow-sm border border-gray-200">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 mb-3">
                            <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wider">Borrower Details</h4>
                            {!initialLearner?.full_name && (
                              <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="text-xs text-maroon-600 hover:text-maroon-800 font-semibold cursor-pointer"
                              >
                                Edit Details
                              </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div><label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Borrower Name</label><p className="font-bold text-gray-800 text-sm">{borrowerName}</p></div>
                            <div><label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Learner ID / Section</label><p className="font-medium text-gray-600 text-xs">{borrowerId}</p></div>
                            <div><label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Notification Email</label><p className="font-medium text-blue-600 text-xs truncate">{borrowerEmail}</p></div>
                        </div>
                     </div>

                     {/* Equipment Bucket Summary */}
                     <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                            Selected Equipment ({selectedItems.reduce((acc, curr) => acc + curr.quantity, 0)} items)
                          </h4>
                          <button
                            type="button"
                            onClick={() => setStep(2)}
                            className="text-xs text-maroon-600 hover:text-maroon-800 font-semibold cursor-pointer"
                          >
                            Modify Equipment
                          </button>
                        </div>
                        <ul className="space-y-2">
                            {selectedItems.map((item, idx) => {
                                const stock = getAvailableStockForItem(item.itemId, item.itemName);
                                return (
                                  <li key={idx} className="flex justify-between items-center text-sm border-b border-gray-100 pb-2">
                                      <div>
                                        <span className="text-gray-800 font-medium block">{item.itemName}</span>
                                        <span className="text-[10px] text-gray-500 font-normal">
                                          Verified Stock: {stock.available} {stock.unit} available in inventory
                                        </span>
                                      </div>
                                      <span className="font-bold text-maroon-600 font-mono">x{item.quantity}</span>
                                  </li>
                                );
                            })}
                        </ul>
                     </div>
                </div>
            )}

            {step === 4 && createdRequest && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 text-center animate-in zoom-in overflow-y-auto">
                    <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                      <CheckCircle className="w-12 h-12" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900">Borrow Request Submitted!</h2>
                        <p className="text-gray-500 mt-1 max-w-md mx-auto text-sm">Your request has been saved and queued for laboratory staff approval.</p>
                        <p className={`mt-2 text-xs font-medium ${requestCopySent ? 'text-green-700' : 'text-amber-700'}`}>
                            {requestCopySent ? `A request copy was sent to ${borrowerEmail}.` : `Your request was saved. Notice: Email notification to ${borrowerEmail} was skipped.`}
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-md shadow-xl border-2 border-dashed border-maroon-200 transform hover:scale-105 transition-transform flex-shrink-0 w-full max-w-sm">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Your Tracking Code</p>
                        <h3 className="text-3xl font-mono font-black text-maroon-600">{createdRequest.referenceCode}</h3>
                        <p className="text-[10px] text-gray-400 mt-2">Take a photo or note this code down to claim your equipment.</p>
                    </div>

                    {isKioskMode && (
                        <div className="bg-maroon-50 border border-maroon-200 text-maroon-900 px-4 py-2 rounded-md text-xs font-semibold">
                          Kiosk station will automatically reset for the next student in <span className="font-bold text-maroon-700">{kioskCountdown}s</span>...
                        </div>
                    )}

                    <div className="flex gap-3">
                      <button 
                        onClick={onClose} 
                        className="px-8 py-2.5 bg-gray-800 text-white rounded-md font-bold shadow-lg hover:bg-gray-900 transition-colors text-sm"
                      >
                        {isKioskMode ? 'Finish & Next Borrower' : 'Close Portal'}
                      </button>
                    </div>
                </div>
            )}
        </div>

        {/* Modal Bottom Footer Actions */}
        {step < 4 && (
            <div className="p-4 border-t bg-white flex justify-between items-center flex-shrink-0">
                {step > 1 ? (
                  <button 
                    onClick={() => setStep(prev => (prev - 1) as any)} 
                    className="flex items-center gap-2 text-gray-500 font-bold hover:text-gray-800 px-4 py-2 text-sm"
                  >
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                ) : <div />}
                
                <div className="flex gap-3">
                    {step < 3 ? (
                        <button 
                          onClick={handleNext} 
                          className="bg-maroon-600 text-white px-8 py-2.5 rounded-md font-bold shadow-md hover:bg-maroon-700 transition-all flex items-center gap-2 text-sm"
                        >
                          {step === 1 ? 'Select Equipment' : 'Schedule & Review'} <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            {!isStep3Complete && (
                              <span className="text-[11px] text-gray-500 font-medium hidden sm:inline">
                                {isReservingLab && (!reservationDate || !startTime || !endTime)
                                  ? 'Complete lab reservation fields to submit'
                                  : !returnDate
                                  ? 'Select return due date to submit'
                                  : 'Please complete all required fields'}
                              </span>
                            )}
                            <button 
                              onClick={handleSubmit} 
                              disabled={isLoading || !isStep3Complete} 
                              className="bg-green-600 text-white px-8 py-2.5 rounded-md font-bold shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-green-700 disabled:hover:bg-green-600 transition-all flex items-center gap-2 text-sm cursor-pointer"
                              title={!isStep3Complete ? (isReservingLab && (!reservationDate || !startTime || !endTime) ? 'Please complete the laboratory reservation date and times' : 'Please provide a valid return due date') : 'Confirm & Submit Request'}
                            >
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
                                {isLoading ? 'Submitting...' : 'Confirm & Submit'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default PublicRequestModal;
