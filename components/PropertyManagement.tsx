import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PropertyItem, PropertyCondition, PropertyInventoryType } from '../types';
import * as propertyStorage from '../services/propertyStorageService';
import { supabase } from '../supabaseClient';
import PropertyFormModal from './PropertyFormModal';
import PropertyStickerModal from './PropertyStickerModal';
import PISBatchGeneratorModal from './PISBatchGeneratorModal';
import CableStickerGeneratorModal from './CableStickerGeneratorModal';
import QuickPISEncoderModal from './QuickPISEncoderModal';
import ConfirmModal from './ConfirmModal';
import { Card } from './ui/Surface';
import { getCategoryIcon, getCategoryColor } from '../constants';
import {
  Building2,
  Plus,
  Search,
  Filter,
  Download,
  Printer,
  Edit2,
  Trash2,
  Tag,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  PieChart as PieChartIcon,
  LayoutGrid,
  List as ListIcon,
  Coins,
  ShieldCheck,
  RefreshCw,
  Archive,
  ArrowUpDown,
  Building,
  UserCheck,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Layers,
  Folder,
  Cable,
  MapPin,
  Check,
  X,
  Eye
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface PropertyManagementProps {
  onRefreshParent?: () => void;
}

const CATEGORY_COLORS = [
  '#2563eb', // blue
  '#7c3aed', // purple
  '#059669', // emerald
  '#d97706', // amber
  '#dc2626', // red
  '#0891b2', // cyan
  '#db2777', // pink
  '#4b5563'  // gray
];

const CONDITION_BADGES: Record<PropertyCondition, { bg: string; text: string; border: string; icon: any }> = {
  'Serviceable': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2 },
  'Needs Repair': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: AlertTriangle },
  'Unserviceable': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
  'For Condemnation': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', icon: Archive },
  'Disposed': { bg: 'bg-zinc-100', text: 'text-zinc-600', border: 'border-zinc-300', icon: Archive }
};

export const PropertyManagement: React.FC<PropertyManagementProps> = ({ onRefreshParent }) => {
  const [items, setItems] = useState<PropertyItem[]>(() => propertyStorage.getCachedPropertyItems());
  const [isLoading, setIsLoading] = useState(() => propertyStorage.getCachedPropertyItems().length === 0);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'registry' | 'reports' | 'analytics'>('registry');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedCondition, setSelectedCondition] = useState<string>('All');
  const [selectedFundSource, setSelectedFundSource] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [viewGrouping, setViewGrouping] = useState<'category' | 'flat'>('category');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'propertyNumber' | 'totalValue' | 'date'>('name');
  const [sortAsc, setSortAsc] = useState(true);

  // DepEd Inventory Report State (Location / Cabinet generation)
  const [reportLocation, setReportLocation] = useState<string>('All');
  const [reportGrouping, setReportGrouping] = useState<'by-location' | 'flat'>('by-location');
  const [reportSearchTerm, setReportSearchTerm] = useState<string>('');

  // Searchable Location / Cabinet Dropdown State
  const [isReportLocDropdownOpen, setIsReportLocDropdownOpen] = useState(false);
  const [reportLocSearchQuery, setReportLocSearchQuery] = useState('');
  const reportLocDropdownRef = useRef<HTMLDivElement>(null);
  const reportLocInputRef = useRef<HTMLInputElement>(null);

  // Close searchable dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (reportLocDropdownRef.current && !reportLocDropdownRef.current.contains(e.target as Node)) {
        setIsReportLocDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isReportLocDropdownOpen) {
      setTimeout(() => {
        reportLocInputRef.current?.focus();
      }, 50);
    } else {
      setReportLocSearchQuery('');
    }
  }, [isReportLocDropdownOpen]);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PropertyItem | undefined>(undefined);
  const [stickerItem, setStickerItem] = useState<PropertyItem | undefined>(undefined);
  const [isBatchPISOpen, setIsBatchPISOpen] = useState(false);
  const [isCableStickerOpen, setIsCableStickerOpen] = useState(false);
  const [targetCablePropertyCode, setTargetCablePropertyCode] = useState<string | undefined>(undefined);
  const [isQuickEncoderOpen, setIsQuickEncoderOpen] = useState(false);
  const [initialEncoderPisCode, setInitialEncoderPisCode] = useState<string | undefined>(undefined);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });
  const [isPrintReportModalOpen, setIsPrintReportModalOpen] = useState(false);

  // Close report preview modal on Escape key
  useEffect(() => {
    if (!isPrintReportModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPrintReportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintReportModalOpen]);

  // Selected for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load properties (uses cache when available; forceRefresh only when explicitly requested)
  const loadData = async (showSpinner = false, forceRefresh = false) => {
    if (showSpinner && items.length === 0) setIsLoading(true);
    try {
      const data = await propertyStorage.getPropertyItems(forceRefresh);
      setItems(data);
      setIsCloudConnected(Boolean(supabase && typeof supabase.from === 'function'));
    } catch (e) {
      console.error('Failed to load property items from cloud', e);
      setIsCloudConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If cache is empty, query Supabase on first mount; otherwise use cached data with zero delay!
    if (items.length === 0) {
      loadData(true, false);
    }

    // Subscribe to realtime database changes from Supabase
    if (supabase && typeof supabase.channel === 'function') {
      const channel = supabase
        .channel('public:property_items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'property_items' },
          () => {
            loadData(false, true); // Silent background refresh when DB changes
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  // Compute statistics
  const stats = useMemo(() => {
    return propertyStorage.calculatePropertyStats(items);
  }, [items]);

  // Distinct locations from property items
  const distinctLocations = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.location?.trim()) set.add(i.location.trim());
    });
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [items]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        item.name.toLowerCase().includes(q) ||
        item.propertyNumber.toLowerCase().includes(q) ||
        (item.pisCode && item.pisCode.toLowerCase().includes(q)) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
        item.location.toLowerCase().includes(q) ||
        item.custodian.toLowerCase().includes(q) ||
        (item.parNumber && item.parNumber.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q);

      const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesLoc = selectedLocation === 'All' || item.location === selectedLocation;
      const matchesCond = selectedCondition === 'All' || item.condition === selectedCondition;
      const matchesFund = selectedFundSource === 'All' || item.sourceOfFund === selectedFundSource;
      const matchesType = selectedType === 'All' || item.inventoryType === selectedType;

      return matchesSearch && matchesCat && matchesLoc && matchesCond && matchesFund && matchesType;
    }).sort((a, b) => {
      let result = 0;
      if (sortField === 'name') result = a.name.localeCompare(b.name);
      else if (sortField === 'propertyNumber') result = a.propertyNumber.localeCompare(b.propertyNumber);
      else if (sortField === 'totalValue') result = (a.totalValue || 0) - (b.totalValue || 0);
      else if (sortField === 'date') result = (a.acquisitionDate || '').localeCompare(b.acquisitionDate || '');
      return sortAsc ? result : -result;
    });
  }, [items, searchTerm, selectedCategory, selectedLocation, selectedCondition, selectedFundSource, selectedType, sortField, sortAsc]);

  // Filtered Items specifically for DepEd Inventory Report by location/cabinet and report search
  const reportFilteredItems = useMemo(() => {
    return items.filter(item => {
      const locMatch = reportLocation === 'All' || (item.location || '').trim().toLowerCase() === reportLocation.trim().toLowerCase();
      const q = reportSearchTerm.toLowerCase().trim();
      const searchMatch = !q ||
        item.name.toLowerCase().includes(q) ||
        item.propertyNumber.toLowerCase().includes(q) ||
        (item.pisCode && item.pisCode.toLowerCase().includes(q)) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
        item.location.toLowerCase().includes(q) ||
        item.custodian.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q);
      return locMatch && searchMatch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, reportLocation, reportSearchTerm]);

  // Group items by location/cabinet for report generation
  const reportLocationsGrouped = useMemo(() => {
    const map = new Map<string, PropertyItem[]>();
    reportFilteredItems.forEach(item => {
      const loc = (item.location || 'General Storage / Unassigned').trim();
      if (!map.has(loc)) {
        map.set(loc, []);
      }
      map.get(loc)!.push(item);
    });
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [reportFilteredItems]);

  const reportTotalQuantity = useMemo(() => {
    return reportFilteredItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [reportFilteredItems]);

  const reportTotalValuation = useMemo(() => {
    return reportFilteredItems.reduce((sum, item) => sum + (item.totalValue || item.quantity * item.unitValue), 0);
  }, [reportFilteredItems]);

  // Handlers
  const handleSaveItem = async (item: PropertyItem) => {
    const res = await propertyStorage.savePropertyItem(item);
    if (res.success) {
      await loadData(false);
      setIsFormOpen(false);
      setEditingItem(undefined);
    } else {
      alert(res.message || 'Failed to save property item to cloud database.');
    }
  };

  const handleDeleteItem = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Property Asset',
      message: `Permanently delete "${name}" from cloud property records? This action cannot be undone.`,
      onConfirm: async () => {
        const res = await propertyStorage.deletePropertyItem(id);
        if (res && !res.success && res.message) {
          alert(`Cloud delete notice: ${res.message}`);
        }
        await loadData(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteBulk = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Selected Properties',
      message: `Permanently delete ${selectedIds.size} selected property asset records from cloud database?`,
      onConfirm: async () => {
        const res = await propertyStorage.deletePropertyItemsBulk(Array.from(selectedIds));
        if (res && !res.success && res.message) {
          alert(`Cloud bulk delete notice: ${res.message}`);
        }
        setSelectedIds(new Set());
        await loadData(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Scope and calculations for Report Modal Preview
  const isReportTab = activeTab === 'reports';
  const modalItemsToPreview = isReportTab ? reportFilteredItems : filteredItems;
  const modalIsSpecificLocation = isReportTab && reportLocation !== 'All';
  const modalIsGrouped = isReportTab ? (reportGrouping === 'by-location' && !modalIsSpecificLocation) : false;

  const modalTotalQuantity = useMemo(() => {
    return modalItemsToPreview.reduce((sum, item) => sum + item.quantity, 0);
  }, [modalItemsToPreview]);

  const modalTotalValuation = useMemo(() => {
    return modalItemsToPreview.reduce((sum, item) => sum + (item.totalValue || item.quantity * item.unitValue), 0);
  }, [modalItemsToPreview]);

  const handlePrintOfficialReport = () => {
    const printWindow = window.open('', '', 'width=1100,height=850');
    if (!printWindow) return;

    const itemsToPrint = isReportTab ? reportFilteredItems : filteredItems;
    const isSpecificLocation = isReportTab && reportLocation !== 'All';
    const isGrouped = isReportTab ? (reportGrouping === 'by-location' && !isSpecificLocation) : false;

    let tablesHtml = '';

    if (isGrouped) {
      tablesHtml = reportLocationsGrouped.map(([locName, locItems]) => {
        const locTotal = locItems.reduce((sum, item) => sum + (item.totalValue || item.quantity * item.unitValue), 0);
        const locQty = locItems.reduce((sum, item) => sum + item.quantity, 0);

        const rows = locItems.map((item, idx) => `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="font-family: monospace; font-weight: bold; white-space: nowrap;">${item.propertyNumber}</td>
            <td style="font-family: monospace; font-weight: bold; font-size: 10px; background: #fffbeb; white-space: nowrap; text-align: center;">${item.pisCode || '—'}</td>
            <td>
              <strong>${item.name}</strong>
              ${item.description ? `<br><small style="color: #4b5563;">${item.description}</small>` : ''}
              ${item.serialNumber ? `<br><small style="color: #6b7280; font-family: monospace;">SN: ${item.serialNumber}</small>` : ''}
            </td>
            <td>${item.category}</td>
            <td style="text-align: center; font-weight: bold;">${item.quantity} ${item.unit}</td>
            <td style="text-align: right;">₱ ${item.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
            <td style="text-align: right; font-weight: bold; color: #047857;">₱ ${(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
            <td><strong>${item.custodian}</strong></td>
            <td style="text-align: center;">${item.condition}</td>
            <td>${item.sourceOfFund}</td>
            <td style="font-family: monospace;">${item.parNumber || 'N/A'}</td>
          </tr>
        `).join('');

        return `
          <div class="location-group-block">
            <div class="location-header-banner">
              <span class="location-title">STORAGE CABINET / LOCATION: <strong>${locName}</strong></span>
              <span class="location-meta">${locItems.length} article(s) • ${locQty} physical units • Subtotal: <strong>₱ ${locTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 25px; text-align: center;">#</th>
                  <th style="width: 110px;">Property No.</th>
                  <th style="width: 95px; text-align: center;">PIS Sticker</th>
                  <th>Article & Specifications</th>
                  <th style="width: 120px;">Category</th>
                  <th style="width: 55px; text-align: center;">Qty</th>
                  <th style="width: 85px; text-align: right;">Unit Cost</th>
                  <th style="width: 95px; text-align: right;">Total Cost</th>
                  <th style="width: 120px;">Accountable Officer</th>
                  <th style="width: 75px; text-align: center;">Condition</th>
                  <th style="width: 100px;">Fund Source</th>
                  <th style="width: 80px;">PAR/ICS</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
                <tr class="loc-subtotal-row">
                  <td colspan="5" style="text-align: right; font-weight: bold; text-transform: uppercase;">Subtotal for ${locName}:</td>
                  <td style="text-align: center; font-weight: bold;">${locQty}</td>
                  <td></td>
                  <td style="text-align: right; font-weight: bold; color: #065f46;">₱ ${locTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td colspan="4"></td>
                </tr>
              </tbody>
            </table>
          </div>
        `;
      }).join('');
    } else {
      const rows = itemsToPrint.map((item, idx) => `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; white-space: nowrap;">${item.propertyNumber}</td>
          <td style="font-family: monospace; font-weight: bold; font-size: 10px; background: #fffbeb; white-space: nowrap; text-align: center;">${item.pisCode || '—'}</td>
          <td>
            <strong>${item.name}</strong>
            ${item.description ? `<br><small style="color: #4b5563;">${item.description}</small>` : ''}
            ${item.serialNumber ? `<br><small style="color: #6b7280; font-family: monospace;">SN: ${item.serialNumber}</small>` : ''}
          </td>
          <td>${item.category}</td>
          <td style="text-align: center; font-weight: bold;">${item.quantity} ${item.unit}</td>
          <td style="text-align: right;">₱ ${item.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: bold; color: #047857;">₱ ${(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td>${item.location}</td>
          <td><strong>${item.custodian}</strong></td>
          <td style="text-align: center;">${item.condition}</td>
          <td>${item.sourceOfFund}</td>
          <td style="font-family: monospace;">${item.parNumber || 'N/A'}</td>
        </tr>
      `).join('');

      tablesHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">#</th>
              <th style="width: 110px;">Property No.</th>
              <th style="width: 95px; text-align: center;">PIS Sticker</th>
              <th>Article & Specifications</th>
              <th style="width: 120px;">Category</th>
              <th style="width: 55px; text-align: center;">Qty</th>
              <th style="width: 85px; text-align: right;">Unit Cost</th>
              <th style="width: 95px; text-align: right;">Total Cost</th>
              <th style="width: 115px;">Location / Cabinet</th>
              <th style="width: 120px;">Accountable Officer</th>
              <th style="width: 75px; text-align: center;">Condition</th>
              <th style="width: 100px;">Fund Source</th>
              <th style="width: 80px;">PAR/ICS</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    }

    const grandTotal = itemsToPrint.reduce((sum, item) => sum + (item.totalValue || item.quantity * item.unitValue), 0);
    const grandQuantity = itemsToPrint.reduce((sum, item) => sum + item.quantity, 0);

    const locationScopeTitle = isSpecificLocation
      ? `CABINET / STORAGE LOCATION: ${reportLocation}`
      : (isGrouped ? `ALL LOCATIONS & CABINETS (${reportLocationsGrouped.length} SECTIONS)` : 'ALL PROPERTY INVENTORY ARTICLES');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DepEd School Property Inventory Report - Leon NHS</title>
        <style>
          @page {
            size: landscape;
            margin: 14mm 10mm 14mm 10mm;
            @top-left {
              content: "SYSTEM GENERATED DOCUMENT • INTEGRATED LABORATORY EQUIPMENT MANAGEMENT SYSTEM (I-LEMS)";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8pt;
              font-weight: 700;
              color: #1e3a8a;
            }
            @top-right {
              content: "Page " counter(page) " of " counter(pages);
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8pt;
              font-weight: 700;
              color: #1e3a8a;
            }
            @bottom-left {
              content: "Integrated Laboratory Equipment Management System (I-LEMS) • Developed by Fitz Jyro Calisnao, through the vision of Jong Bok Chun, KOICA Volunteer";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 7.5pt;
              color: #475569;
            }
            @bottom-right {
              content: "© 2025-${new Date().getFullYear()}. Leon NHS - Science Laboratory";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 7.5pt;
              color: #475569;
            }
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            font-size: 10px;
            height: auto;
          }
          .header {
            text-align: center;
            margin-bottom: 8px;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 8px;
          }
          .header h4 { margin: 0; font-size: 9.5px; font-weight: normal; color: #4b5563; }
          .header h3 { margin: 1px 0; font-size: 11px; font-weight: bold; color: #1e3a8a; }
          .header h2 { margin: 2px 0; font-size: 13.5px; font-weight: 900; color: #991b1b; }
          .header h1 { margin: 4px 0 2px 0; font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          .location-scope-banner {
            display: inline-block;
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
            padding: 2.5px 10px;
            border-radius: 4px;
            font-size: 10.5px;
            font-weight: bold;
            margin-top: 3px;
            text-transform: uppercase;
          }
          .meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
            font-size: 9.5px;
            background: #f8fafc;
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
          }
          .location-group-block {
            margin-bottom: 14px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .location-header-banner {
            background: #1e3a8a;
            color: white;
            padding: 4px 8px;
            font-size: 10px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 4px 4px 0 0;
          }
          .location-title {
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .location-meta {
            font-size: 9px;
            font-weight: normal;
            opacity: 0.95;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
          }
          th, td {
            border: 1px solid #94a3b8;
            padding: 4px 6px;
            vertical-align: top;
          }
          th {
            background-color: #f1f5f9;
            font-weight: 800;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .loc-subtotal-row {
            background-color: #ecfdf5 !important;
            font-weight: bold;
          }
          .grand-total-card {
            background: #f1f5f9;
            border: 2px solid #1e3a8a;
            border-radius: 4px;
            padding: 7px 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
            margin-bottom: 0;
            page-break-inside: avoid;
            break-inside: avoid;
            page-break-after: avoid;
            break-after: avoid;
          }
          .grand-total-label {
            font-size: 10.5px;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
          }
          .grand-total-val {
            font-size: 13px;
            font-weight: 900;
            color: #047857;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h4>Republic of the Philippines</h4>
          <h3>DEPARTMENT OF EDUCATION</h3>
          <h4>Region VI - Western Visayas • Division of Iloilo</h4>
          <h2>LEON NATIONAL HIGH SCHOOL</h2>
          <h1>Report on the Physical Count of Property, Plant & Equipment (RPCPPE)</h1>
          <div class="location-scope-banner">${locationScopeTitle}</div>
        </div>

        <div class="meta">
          <div><strong>Location / Scope:</strong> ${isSpecificLocation ? `Cabinet / Storage: ${reportLocation}` : (isGrouped ? 'All Cabinets (Grouped by Storage Location)' : 'All Inventory Articles')}</div>
          <div><strong>Articles Count:</strong> ${itemsToPrint.length} | <strong>Total Physical Units:</strong> ${grandQuantity}</div>
          <div><strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        ${tablesHtml}

        <div class="grand-total-card">
          <div class="grand-total-label">
            REPORT GRAND TOTAL (${itemsToPrint.length} Articles • ${grandQuantity} Physical Units${isSpecificLocation ? ` in ${reportLocation}` : ''})
          </div>
          <div class="grand-total-val">
            ₱ ${grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleTriggerPrintReport = () => {
    setIsPrintReportModalOpen(true);
    handlePrintOfficialReport();
  };

  // Group filtered items by category for collapsible view
  const categoriesGrouped = useMemo(() => {
    const map = new Map<string, PropertyItem[]>();

    // Standard category order
    propertyStorage.PROPERTY_CATEGORIES.forEach(cat => {
      map.set(cat, []);
    });

    filteredItems.forEach(item => {
      const cat = item.category || 'General Property';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(item);
    });

    const result: {
      category: string;
      items: PropertyItem[];
      totalValue: number;
      totalQty: number;
      serviceableCount: number;
      repairCount: number;
      unserviceableCount: number;
    }[] = [];

    map.forEach((catItems, category) => {
      if (catItems.length > 0) {
        const totalValue = catItems.reduce((acc, it) => acc + (it.totalValue || it.quantity * it.unitValue), 0);
        const totalQty = catItems.reduce((acc, it) => acc + it.quantity, 0);
        const serviceableCount = catItems.filter(it => it.condition === 'Serviceable').length;
        const repairCount = catItems.filter(it => it.condition === 'Needs Repair').length;
        const unserviceableCount = catItems.filter(
          it => it.condition === 'Unserviceable' || it.condition === 'For Condemnation' || it.condition === 'Disposed'
        ).length;

        result.push({
          category,
          items: catItems,
          totalValue,
          totalQty,
          serviceableCount,
          repairCount,
          unserviceableCount
        });
      }
    });

    return result;
  }, [filteredItems]);

  const toggleCategoryCollapse = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    setCollapsedCategories(new Set());
  };

  const handleCollapseAll = () => {
    setCollapsedCategories(new Set(categoriesGrouped.map(c => c.category)));
  };

  const toggleSelectCategory = (categoryItems: PropertyItem[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = categoryItems.length > 0 && categoryItems.every(it => next.has(it.id));
      if (allSelected) {
        categoryItems.forEach(it => next.delete(it.id));
      } else {
        categoryItems.forEach(it => next.add(it.id));
      }
      return next;
    });
  };

  // Reusable Table View for category groups or flat list
  const renderTable = (itemsList: PropertyItem[], showCategoryCol = true) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase font-bold text-[10px] tracking-wider">
          <tr>
            <th className="p-3 w-10 text-center">
              <input
                type="checkbox"
                checked={itemsList.length > 0 && itemsList.every(i => selectedIds.has(i.id))}
                onChange={() => toggleSelectCategory(itemsList)}
                className="rounded-sm text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th className="p-3">PIS Sticker Tag</th>
            <th className="p-3 cursor-pointer" onClick={() => { setSortField('propertyNumber'); setSortAsc(!sortAsc); }}>
              Property Code
            </th>
            <th className="p-3 cursor-pointer" onClick={() => { setSortField('name'); setSortAsc(!sortAsc); }}>
              Article / Property Name
            </th>
            {showCategoryCol && <th className="p-3">Category</th>}
            <th className="p-3 text-center">Qty</th>
            <th className="p-3 text-right cursor-pointer" onClick={() => { setSortField('totalValue'); setSortAsc(!sortAsc); }}>
              Total Value (₱)
            </th>
            <th className="p-3">Location</th>
            <th className="p-3">Custodian</th>
            <th className="p-3 text-center">Condition</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {itemsList.map(item => {
            const isSelected = selectedIds.has(item.id);
            const badge = CONDITION_BADGES[item.condition] || CONDITION_BADGES['Serviceable'];
            const BadgeIcon = badge.icon;

            return (
              <tr
                key={item.id}
                className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/70' : ''}`}
              >
                <td className="p-3 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectItem(item.id)}
                    className="rounded-sm text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="p-3 whitespace-nowrap">
                  {item.pisCode ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-sm font-mono font-black text-[11px] bg-[#FFF000] text-black border border-black shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                      {item.pisCode}
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setInitialEncoderPisCode(propertyStorage.generateNextPISCode(items));
                        setEditingItem(item);
                        setIsFormOpen(true);
                      }}
                      className="text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 px-2 py-0.5 rounded-sm transition-colors"
                    >
                      + Link PIS
                    </button>
                  )}
                </td>
                <td className="p-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                  {item.propertyNumber}
                  {item.parNumber && (
                    <span className="block text-[10px] font-normal text-gray-400">
                      {item.parNumber}
                    </span>
                  )}
                </td>
                <td className="p-3 max-w-xs">
                  <div className="font-bold text-gray-900 text-xs">{item.name}</div>
                  {item.description && (
                    <p className="text-[11px] text-gray-500 truncate" title={item.description}>
                      {item.description}
                    </p>
                  )}
                  {item.serialNumber && (
                    <span className="text-[10px] font-mono text-gray-400">
                      SN: {item.serialNumber}
                    </span>
                  )}
                </td>
                {showCategoryCol && (
                  <td className="p-3 whitespace-nowrap">
                    <span className="text-gray-700 font-medium">{item.category}</span>
                    <span className="block text-[10px] text-gray-400">{item.inventoryType}</span>
                  </td>
                )}
                <td className="p-3 text-center whitespace-nowrap font-bold text-gray-800">
                  {item.quantity} {item.unit}
                </td>
                <td className="p-3 text-right whitespace-nowrap font-bold text-emerald-800">
                  ₱ {(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  <span className="block text-[10px] font-normal text-gray-400">
                    @ ₱ {item.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap text-gray-700">
                  {item.location}
                </td>
                <td className="p-3 whitespace-nowrap font-medium text-gray-900">
                  {item.custodian}
                </td>
                <td className="p-3 text-center whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                    <BadgeIcon className="w-3 h-3" />
                    {item.condition}
                  </span>
                </td>
                <td className="p-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      onClick={() => setStickerItem(item)}
                      title="Print DepEd Property Sticker / Barcode"
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                    >
                      <Tag className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setTargetCablePropertyCode(item.propertyNumber);
                        setIsCableStickerOpen(true);
                      }}
                      title="Print Cable Peripheral Sticker (PIS Tag)"
                      className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-sm transition-colors"
                    >
                      <Cable className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setIsFormOpen(true);
                      }}
                      title="Edit Property Details"
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id, item.name)}
                      title="Delete Property Record"
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  // Reusable Cards View for category groups or flat list
  const renderCards = (itemsList: PropertyItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {itemsList.map(item => {
        const badge = CONDITION_BADGES[item.condition] || CONDITION_BADGES['Serviceable'];
        const BadgeIcon = badge.icon;

        return (
          <Card
            key={item.id}
            className="p-5 border-gray-200 hover:shadow-lg transition-all duration-200 flex flex-col justify-between rounded-md bg-white"
          >
            <div>
              {/* Top tag & condition */}
              <div className="flex items-center justify-between mb-2 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.pisCode && (
                    <span className="font-mono text-[10.5px] font-black bg-[#FFF000] text-black border border-black px-2 py-0.5 rounded-sm shadow-xs flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
                      {item.pisCode}
                    </span>
                  )}
                  <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200">
                    {item.propertyNumber}
                  </span>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border} flex-shrink-0`}>
                  <BadgeIcon className="w-3 h-3" />
                  {item.condition}
                </span>
              </div>

              {/* Title and specs */}
              <h4 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">{item.name}</h4>
              <p className="text-xs text-gray-500 line-clamp-2 mt-1 mb-3">{item.description || 'No detailed specifications recorded.'}</p>

              {/* Metadata grid */}
              <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2.5 rounded-md border border-gray-100 mb-3">
                <div>
                  <span className="text-gray-400 block text-[9px] font-bold uppercase">Category</span>
                  <span className="font-medium text-gray-800 truncate block">{item.category}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px] font-bold uppercase">Quantity</span>
                  <span className="font-bold text-gray-800">{item.quantity} {item.unit}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px] font-bold uppercase">Location</span>
                  <span className="font-medium text-gray-800 truncate block">{item.location}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px] font-bold uppercase">Total Cost</span>
                  <span className="font-extrabold text-emerald-700">₱ {(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { maximumFractionDigits: 0 })}</span>
                </div>
              </div>

              {/* Custodian tag */}
              <div className="flex items-center space-x-1.5 text-xs text-gray-600 mb-2">
                <UserCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="truncate"><strong>Custodian:</strong> {item.custodian}</span>
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between mt-2">
              <span className="text-[10px] font-medium text-gray-400">
                Fund: {item.sourceOfFund.split('(')[0]}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setStickerItem(item)}
                  title="Print Property Sticker Tag"
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors"
                >
                  <Tag className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setTargetCablePropertyCode(item.propertyNumber);
                    setIsCableStickerOpen(true);
                  }}
                  title="Print Cable Peripheral Sticker (PIS Tag)"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-sm transition-colors"
                >
                  <Cable className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingItem(item);
                    setIsFormOpen(true);
                  }}
                  title="Edit Record"
                  className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-sm transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id, item.name)}
                  title="Delete"
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-sm transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-gray-100 hover:shadow-md transition-shadow group rounded-md">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-sm">
              {stats.totalQuantity} Units
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Property Assets</p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-gray-800 mt-1">{stats.totalAssets}</h3>
          <p className="text-[11px] text-gray-500 mt-1">Registered School Property Articles</p>
        </Card>

        <Card className="p-5 border-gray-100 hover:shadow-md transition-shadow group rounded-md">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-md group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-sm">
              Book Value
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Asset Valuation</p>
          <h3 className="text-2xl md:text-3xl font-black text-emerald-700 mt-1">
            ₱ {stats.totalValuation.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">Combined acquisition cost</p>
        </Card>

        <Card className="p-5 border-gray-100 hover:shadow-md transition-shadow group rounded-md">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-md group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-sm">
              {stats.totalAssets > 0 ? Math.round((stats.serviceableCount / stats.totalAssets) * 100) : 0}% Good
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Serviceable Property</p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-gray-800 mt-1">{stats.serviceableCount}</h3>
          <p className="text-[11px] text-gray-500 mt-1">Active and functional in campus</p>
        </Card>

        <Card className="p-5 border-gray-100 hover:shadow-md transition-shadow group rounded-md">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-md group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-sm">
              Action Needed
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Under Repair / Defective</p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-amber-800 mt-1">
            {stats.repairCount + stats.unserviceableCount}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">
            {stats.repairCount} for repair • {stats.unserviceableCount} unserviceable
          </p>
        </Card>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
        {/* Informative Banner */}
        <div className="bg-amber-50 border-b border-amber-200/80 px-4 py-2.5 md:px-6 flex items-center gap-2.5 text-xs">
          <Tag className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <div className="text-amber-950 min-w-0">
            <span className="font-bold">Property Inventory (PIS Tagged Assets):</span> Designated for equipment and machinery large and durable enough to carry **Physical Property Stickers (PIS)** — such as microscopes, triple beam balances, hot plates, optical benches, multimeters, and modular science kits.
            <span className="hidden xl:inline text-amber-800 ml-1">Small items, glasswares, and consumables without stickers belong in <strong>Laboratory Inventory</strong>.</span>
          </div>
        </div>

        {/* Navigation Tabs Bar (Row 1) */}
        <div className="px-4 py-3 md:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/70">
          <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('registry')}
              className={`px-3 md:px-4 py-2 rounded-sm text-xs md:text-sm font-bold flex items-center space-x-2 transition-all whitespace-nowrap ${
                activeTab === 'registry'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Property Registry</span>
              <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-mono ${activeTab === 'registry' ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'}`}>
                {items.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`px-3 md:px-4 py-2 rounded-sm text-xs md:text-sm font-bold flex items-center space-x-2 transition-all whitespace-nowrap ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>DepEd Inventory Report</span>
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 md:px-4 py-2 rounded-sm text-xs md:text-sm font-bold flex items-center space-x-2 transition-all whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <PieChartIcon className="w-4 h-4" />
              <span>Asset Valuation & Charts</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={() => loadData(true, true)}
              title="Force refresh cloud property records"
              className="p-2 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            <button
              onClick={() => {
                setEditingItem(undefined);
                setInitialEncoderPisCode(undefined);
                setIsFormOpen(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs md:text-sm font-bold transition-all shadow-sm flex items-center space-x-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Register Property</span>
            </button>
          </div>
        </div>

        {/* Action Tools Toolbar (Row 2) */}
        <div className="px-4 py-2.5 md:px-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white">
          {/* Left: Physical Sticker Operations */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={() => setIsBatchPISOpen(true)}
              title="Generate official yellow PIS Stickers on A4 sheet (Full A4 Page Consumption, 0.5&quot; margins)"
              className="px-3.5 py-1.5 bg-[#FFF000] hover:bg-yellow-400 text-gray-950 border border-black rounded-sm text-xs md:text-sm font-black transition-all shadow-xs flex items-center space-x-1.5 whitespace-nowrap"
            >
              <Tag className="w-4 h-4 text-black" />
              <span>PIS Stickers (A4 Sheet)</span>
            </button>

            <button
              onClick={() => {
                setTargetCablePropertyCode(undefined);
                setIsCableStickerOpen(true);
              }}
              title="Generate wrap-around Cable Peripheral PIS Tags on A4 sheet (Full A4 Sheet, 0.5&quot; margins)"
              className="px-3.5 py-1.5 bg-[#FFF000] hover:bg-yellow-400 text-gray-950 border border-black rounded-sm text-xs md:text-sm font-black transition-all shadow-xs flex items-center space-x-1.5 whitespace-nowrap"
            >
              <Cable className="w-4 h-4 text-black" />
              <span>Cable Tags (A4)</span>
            </button>

            <button
              onClick={() => {
                setInitialEncoderPisCode(undefined);
                setIsQuickEncoderOpen(true);
              }}
              title="Scan or enter PIS sticker code to index property"
              className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 rounded-sm text-xs md:text-sm font-bold transition-all shadow-xs flex items-center space-x-1.5 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-amber-700" />
              <span>Encode by PIS</span>
            </button>
          </div>

          {/* Right: Reporting, Exports, and Bulk Actions */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteBulk}
                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-sm text-xs font-bold transition-colors flex items-center space-x-1 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}

            <button
              onClick={handleTriggerPrintReport}
              title="Print official inventory report (Preview in Modal & Print)"
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-sm text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Report</span>
            </button>

            <button
              onClick={() => propertyStorage.exportPropertyCSV(filteredItems)}
              title="Export filtered records to Excel/CSV"
              className="px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-sm text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-xs whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Property Registry */}
        {activeTab === 'registry' && (
          <div className="p-4 md:p-6 space-y-4">
            {/* Search and Filters Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              {/* Search input */}
              <div className="lg:col-span-3 relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by property tag, name, serial no, location, custodian..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs md:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Category Filter */}
              <div className="lg:col-span-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="All">All Categories ({items.length})</option>
                  {propertyStorage.PROPERTY_CATEGORIES.map(cat => {
                    const count = items.filter(i => i.category === cat).length;
                    return <option key={cat} value={cat}>{cat} ({count})</option>;
                  })}
                </select>
              </div>

              {/* Location Filter */}
              <div className="lg:col-span-2">
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  title="Filter by property location / cabinet"
                >
                  <option value="All">All Locations ({items.length})</option>
                  {distinctLocations.map(loc => {
                    const count = items.filter(i => i.location === loc).length;
                    return <option key={loc} value={loc}>{loc} ({count})</option>;
                  })}
                </select>
              </div>

              {/* Condition Filter */}
              <div className="lg:col-span-2">
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="All">All Conditions</option>
                  <option value="Serviceable">Serviceable</option>
                  <option value="Needs Repair">Needs Repair</option>
                  <option value="Unserviceable">Unserviceable</option>
                  <option value="For Condemnation">For Condemnation</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </div>

              {/* View Grouping, Layout & Sorting */}
              <div className="lg:col-span-2 flex items-center justify-start lg:justify-end gap-1.5 flex-wrap">
                {/* Grouping Toggle */}
                <div className="flex border border-gray-300 rounded-sm p-0.5 bg-gray-50">
                  <button
                    onClick={() => setViewGrouping('category')}
                    title="Collapsible Category Groups"
                    className={`px-2 py-1 text-xs font-bold rounded-sm flex items-center space-x-1 transition-colors ${
                      viewGrouping === 'category'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>By Category</span>
                  </button>
                  <button
                    onClick={() => setViewGrouping('flat')}
                    title="Flat List View"
                    className={`px-2 py-1 text-xs font-bold rounded-sm flex items-center space-x-1 transition-colors ${
                      viewGrouping === 'flat'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                    <span>Flat</span>
                  </button>
                </div>

                {/* Expand / Collapse All */}
                {viewGrouping === 'category' && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={handleExpandAll}
                      title="Expand all category sections"
                      className="px-2 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-colors"
                    >
                      Expand
                    </button>
                    <button
                      onClick={handleCollapseAll}
                      title="Collapse all category sections"
                      className="px-2 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-colors"
                    >
                      Collapse
                    </button>
                  </div>
                )}

                {/* Table vs Cards */}
                <div className="flex border border-gray-300 rounded-sm p-0.5 bg-gray-50">
                  <button
                    onClick={() => setViewMode('table')}
                    title="Dense Table View"
                    className={`p-1.5 rounded-sm ${viewMode === 'table' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    title="Visual Card Grid View"
                    className={`p-1.5 rounded-sm ${viewMode === 'cards' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  title={`Sort ${sortAsc ? 'Ascending' : 'Descending'}`}
                  className="p-1.5 border border-gray-300 rounded-sm bg-gray-50 hover:bg-gray-100 text-gray-600"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Classification Quick Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-gray-400 font-semibold uppercase text-[10px] flex items-center gap-1">
                <Filter className="w-3 h-3" /> Class:
              </span>
              {['All', 'Semi-Expendable', 'Capital Outlay', 'Donated'].map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedType(t)}
                  className={`px-2.5 py-1 rounded-sm font-bold transition-colors ${
                    selectedType === t
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t}
                </button>
              ))}

              <span className="text-gray-400 font-semibold uppercase text-[10px] ml-3">Fund:</span>
              <select
                value={selectedFundSource}
                onChange={(e) => setSelectedFundSource(e.target.value)}
                className="px-2 py-0.5 text-xs border border-gray-300 rounded-sm bg-white font-medium text-gray-700 focus:outline-none"
              >
                <option value="All">All Funds</option>
                {propertyStorage.FUND_SOURCES.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              <span className="text-gray-400 text-xs ml-auto font-medium">
                Showing <strong>{filteredItems.length}</strong> of {items.length} records
              </span>
            </div>

            {/* Loading / Empty state */}
            {isLoading ? (
              <div className="text-center py-16">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">Loading school property records...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-md bg-gray-50/50">
                <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-gray-800">No Property Assets Found</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                  {searchTerm || selectedCategory !== 'All'
                    ? 'No records match your active search or filters. Try resetting the filter.'
                    : 'Get started by registering non-laboratory school property such as laptops, armchairs, TVs, and air conditioners.'}
                </p>
                <button
                  onClick={() => {
                    setEditingItem(undefined);
                    setIsFormOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs font-bold inline-flex items-center space-x-1.5 shadow"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register First Property</span>
                </button>
              </div>
            ) : viewGrouping === 'category' ? (
              /* Collapsible Category Groups View */
              <div className="space-y-3.5">
                {categoriesGrouped.map(group => {
                  const isCollapsed = collapsedCategories.has(group.category);

                  return (
                    <div
                      key={group.category}
                      className="border border-gray-200 rounded-md bg-white shadow-xs overflow-hidden transition-all"
                    >
                      {/* Collapsible Category Header */}
                      <div
                        onClick={() => toggleCategoryCollapse(group.category)}
                        className="px-4 py-3 bg-gray-50/90 hover:bg-gray-100/90 border-b border-gray-200 cursor-pointer flex flex-wrap items-center justify-between gap-3 transition-colors select-none"
                      >
                        <div className="flex items-center space-x-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCategoryCollapse(group.category);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-700 transition-transform duration-200"
                          >
                            <ChevronRight
                              className={`w-4 h-4 transition-transform duration-200 ${
                                !isCollapsed ? 'rotate-90 text-blue-600' : ''
                              }`}
                            />
                          </button>

                          <div className="flex items-center space-x-2">
                            <span
                              className="flex items-center justify-center w-7 h-7 rounded-md border flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4"
                              style={{
                                color: getCategoryColor(group.category),
                                borderColor: `${getCategoryColor(group.category)}40`,
                                backgroundColor: `${getCategoryColor(group.category)}12`
                              }}
                            >
                              {getCategoryIcon(group.category)}
                            </span>
                            <h4 className="font-bold text-gray-900 text-sm md:text-base">
                              {group.category}
                            </h4>
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              {group.items.length} {group.items.length === 1 ? 'item' : 'items'} ({group.totalQty} {group.totalQty === 1 ? 'unit' : 'units'})
                            </span>
                          </div>
                        </div>

                        {/* Right: Quick metrics & condition counts */}
                        <div className="flex items-center space-x-3 ml-auto">
                          <div className="hidden md:flex items-center space-x-2 text-xs">
                            {group.serviceableCount > 0 && (
                              <span className="px-2 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10.5px]">
                                {group.serviceableCount} Serviceable
                              </span>
                            )}
                            {group.repairCount > 0 && (
                              <span className="px-2 py-0.5 rounded-sm bg-amber-50 text-amber-700 font-bold border border-amber-200 text-[10.5px]">
                                {group.repairCount} Repair
                              </span>
                            )}
                            {group.unserviceableCount > 0 && (
                              <span className="px-2 py-0.5 rounded-sm bg-red-50 text-red-700 font-bold border border-red-200 text-[10.5px]">
                                {group.unserviceableCount} Unserviceable
                              </span>
                            )}
                          </div>

                          <span className="font-black text-xs md:text-sm text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-sm border border-emerald-200">
                            ₱ {group.totalValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Category Items View */}
                      {!isCollapsed && (
                        <div>
                          {viewMode === 'table' ? (
                            renderTable(group.items, false)
                          ) : (
                            <div className="p-4 bg-gray-50/30">
                              {renderCards(group.items)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Flat List View */
              viewMode === 'table' ? renderTable(filteredItems, true) : renderCards(filteredItems)
            )}
          </div>
        )}

        {/* Tab 2: DepEd Inventory Report Preview */}
        {activeTab === 'reports' && (
          <div className="p-4 md:p-8 space-y-6">
            {/* Top Controls Card (Clean, Institutional Layout with Highlighted Borders) */}
            <div className="bg-white border-2 border-slate-300 rounded-lg p-5 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-900 border border-blue-200 mb-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    DepEd Form RPCPPE / RPCSP
                  </div>
                  <h3 className="font-extrabold text-gray-900 text-lg tracking-tight">
                    Official DepEd Property Inventory Report
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generate, inspect, and print official inventory sheets filtered or organized by physical cabinets and storage locations.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => propertyStorage.exportPropertyCSV(reportFilteredItems)}
                    className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-sm text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
                    title="Export currently filtered location report to Excel/CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Location CSV</span>
                  </button>

                  <button
                    onClick={handleTriggerPrintReport}
                    className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-sm text-xs md:text-sm font-bold shadow-xs transition-all flex items-center space-x-2"
                    title="Print official landscape report for selected location/cabinets"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Official Report</span>
                  </button>
                </div>
              </div>

              {/* Location / Cabinet Selection & Report Settings Bar */}
              <div className="bg-gray-50/90 rounded-md p-3.5 border border-gray-300 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* Searchable Storage Location / Cabinet Dropdown */}
                <div className="md:col-span-5 relative" ref={reportLocDropdownRef}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Storage Location / Cabinet Filter
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsReportLocDropdownOpen(prev => !prev)}
                      className="w-full pl-9 pr-9 py-2 text-xs bg-white text-gray-900 font-bold rounded-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 shadow-2xs flex items-center justify-between text-left transition-all hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <span className="truncate">
                          {reportLocation === 'All' ? (
                            <span>All Storage Locations & Cabinets ({distinctLocations.length} locations • {items.length} items)</span>
                          ) : (
                            <span>
                              {reportLocation} ({items.filter(i => (i.location || '').trim().toLowerCase() === reportLocation.trim().toLowerCase()).length} articles)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {reportLocation !== 'All' && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setReportLocation('All');
                            }}
                            className="p-0.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors"
                            title="Reset to All Locations"
                          >
                            <X className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isReportLocDropdownOpen ? 'rotate-180 text-blue-600' : ''}`} />
                      </div>
                    </button>

                    {/* Searchable Dropdown Popover */}
                    {isReportLocDropdownOpen && (
                      <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-gray-200 rounded-md shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Search Input Box */}
                        <div className="p-2 border-b border-gray-100 bg-gray-50">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              ref={reportLocInputRef}
                              type="text"
                              value={reportLocSearchQuery}
                              onChange={(e) => setReportLocSearchQuery(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                  setIsReportLocDropdownOpen(false);
                                }
                              }}
                              placeholder="Search cabinet or room (e.g. Cabinet 1)..."
                              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white text-gray-900 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                            />
                            {reportLocSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setReportLocSearchQuery('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* List of Locations */}
                        <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 text-xs">
                          {/* "All Storage Locations" option */}
                          {(!reportLocSearchQuery || 'all storage locations & cabinets'.includes(reportLocSearchQuery.toLowerCase())) && (
                            <button
                              type="button"
                              onClick={() => {
                                setReportLocation('All');
                                setIsReportLocDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-2 transition-colors ${
                                reportLocation === 'All'
                                  ? 'bg-blue-50 text-blue-900 font-bold'
                                  : 'text-gray-800 hover:bg-gray-50 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                                  <Layers className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="truncate font-bold">All Storage Locations & Cabinets</div>
                                  <div className="text-[10.5px] text-gray-500">
                                    {distinctLocations.length} locations • {items.length} items
                                  </div>
                                </div>
                              </div>
                              {reportLocation === 'All' && (
                                <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              )}
                            </button>
                          )}

                          {/* Specific Locations / Cabinets */}
                          {distinctLocations
                            .filter(loc => !reportLocSearchQuery || loc.toLowerCase().includes(reportLocSearchQuery.toLowerCase().trim()))
                            .map(loc => {
                              const count = items.filter(i => (i.location || '').trim().toLowerCase() === loc.trim().toLowerCase()).length;
                              const isSelected = reportLocation.trim().toLowerCase() === loc.trim().toLowerCase();
                              const isCabinet = /^cabinet\s*\d+/i.test(loc);

                              return (
                                <button
                                  key={loc}
                                  type="button"
                                  onClick={() => {
                                    setReportLocation(loc);
                                    setIsReportLocDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3.5 py-2 flex items-center justify-between gap-2 transition-colors ${
                                    isSelected
                                      ? 'bg-blue-50 text-blue-900 font-bold'
                                      : 'text-gray-800 hover:bg-gray-50 font-medium'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isCabinet ? 'text-amber-600' : 'text-blue-500'}`} />
                                    <span className="truncate">{loc}</span>
                                    {isCabinet && (
                                      <span className="text-[9.5px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded border border-amber-200">
                                        Cabinet
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-[10.5px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                                      {count} article{count === 1 ? '' : 's'}
                                    </span>
                                    {isSelected && (
                                      <Check className="w-4 h-4 text-blue-600" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}

                          {distinctLocations.filter(loc => loc.toLowerCase().includes(reportLocSearchQuery.toLowerCase().trim())).length === 0 && reportLocSearchQuery && (
                            <div className="p-4 text-center text-xs text-gray-400">
                              No storage locations or cabinets found matching "{reportLocSearchQuery}".
                            </div>
                          )}
                        </div>

                        {/* Footer hint */}
                        <div className="p-1.5 border-t border-gray-100 bg-gray-50/80 text-[10px] text-gray-500 flex items-center justify-between px-3">
                          <span>{distinctLocations.length} locations available</span>
                          <span className="text-gray-400">Esc to close</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Grouping Style (only active when All Locations is selected) */}
                <div className="md:col-span-4">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Report Grouping Format
                  </label>
                  <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-sm border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setReportGrouping('by-location')}
                      className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-xs transition-colors flex items-center justify-center gap-1 ${
                        reportGrouping === 'by-location'
                          ? 'bg-white text-blue-950 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>By Location / Cabinet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportGrouping('flat')}
                      className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-xs transition-colors flex items-center justify-center gap-1 ${
                        reportGrouping === 'flat'
                          ? 'bg-white text-blue-950 shadow-xs'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                      }`}
                    >
                      <ListIcon className="w-3 h-3" />
                      <span>Flat List</span>
                    </button>
                  </div>
                </div>

                {/* Search in Report */}
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    Search Articles
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search in report..."
                      value={reportSearchTerm}
                      onChange={(e) => setReportSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 text-xs bg-white text-gray-900 rounded-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Filter Location Pills (Using SVG Icons, No Emojis) */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
                <span className="text-gray-500 font-bold text-[10px] uppercase mr-1">Quick Select:</span>
                <button
                  type="button"
                  onClick={() => setReportLocation('All')}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors inline-flex items-center gap-1.5 ${
                    reportLocation === 'All'
                      ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-medium'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 flex-shrink-0 ${reportLocation === 'All' ? 'text-white' : 'text-blue-600'}`} />
                  <span>All Cabinets</span>
                  <span className={reportLocation === 'All' ? 'text-blue-200 font-normal' : 'text-gray-500 font-normal'}>({items.length})</span>
                </button>
                {distinctLocations.slice(0, 6).map(loc => {
                  const count = items.filter(i => (i.location || '').trim() === loc.trim()).length;
                  const isSelected = reportLocation === loc;
                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setReportLocation(loc)}
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors truncate max-w-[200px] inline-flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-medium'
                      }`}
                      title={loc}
                    >
                      <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-white' : 'text-blue-600'}`} />
                      <span className="truncate">{loc}</span>
                      <span className={isSelected ? 'text-blue-200 font-normal' : 'text-gray-500 font-normal'}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scope Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white border border-gray-200 p-3.5 rounded-md shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Report Scope</span>
                <div className="font-extrabold text-blue-900 text-sm mt-0.5 truncate" title={reportLocation === 'All' ? 'All Storage Locations' : reportLocation}>
                  {reportLocation === 'All' ? (
                    <span>All ({distinctLocations.length} Cabinets/Rooms)</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 inline" />
                      <span className="truncate">{reportLocation}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-3.5 rounded-md shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Articles</span>
                <div className="font-black text-gray-900 text-lg mt-0.5">
                  {reportFilteredItems.length} <span className="text-xs font-normal text-gray-500">record{reportFilteredItems.length === 1 ? '' : 's'}</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-3.5 rounded-md shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Units</span>
                <div className="font-black text-gray-900 text-lg mt-0.5">
                  {reportTotalQuantity} <span className="text-xs font-normal text-gray-500">physical units</span>
                </div>
              </div>

              <div className="bg-white border border-gray-200 p-3.5 rounded-md shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">Total Scope Valuation</span>
                <div className="font-black text-emerald-700 text-lg mt-0.5">
                  ₱ {reportTotalValuation.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Report Document Action / Status Card */}
            <div className="bg-white border-2 border-slate-300 rounded-lg p-6 sm:p-8 text-center shadow-xs">
              <div className="max-w-xl mx-auto space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center justify-center">
                  <Printer className="w-6 h-6 text-blue-900" />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-base sm:text-lg">
                    Official DepEd Property Inventory Report Ready
                  </h4>
                  <p className="text-xs sm:text-sm text-gray-500 mt-1">
                    {reportLocation === 'All'
                      ? `Includes all ${distinctLocations.length} storage locations and cabinets (${reportFilteredItems.length} articles • ${reportTotalQuantity} physical units)`
                      : `Filtered specifically for ${reportLocation} (${reportFilteredItems.length} articles • ${reportTotalQuantity} physical units)`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTriggerPrintReport}
                    className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-md text-xs sm:text-sm font-bold shadow-xs transition-all flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Official Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrintReportModalOpen(true)}
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-2xs"
                  >
                    <Eye className="w-4 h-4 text-gray-500" />
                    <span>Preview Document</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => propertyStorage.exportPropertyCSV(reportFilteredItems)}
                    className="px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-2xs"
                  >
                    <Download className="w-4 h-4 text-gray-500" />
                    <span>Export Location CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Analytics & Valuation */}
        {activeTab === 'analytics' && (
          <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Valuation Bar Chart */}
              <Card className="p-5 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800 text-sm">Asset Valuation by Category (₱ PHP)</h4>
                  <span className="text-xs text-gray-400">Total: ₱ {stats.totalValuation.toLocaleString('en-PH')}</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.valueByCategory}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <XAxis type="number" tickFormatter={(val) => `₱${(val / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={(val: any) => [`₱ ${Number(val).toLocaleString('en-PH')}`, 'Valuation']} />
                      <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]}>
                        {stats.valueByCategory.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Condition Breakdown Pie Chart */}
              <Card className="p-5 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800 text-sm">Property Condition Status</h4>
                  <span className="text-xs text-gray-400">{stats.totalAssets} Articles</span>
                </div>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.countByCondition}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={85}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {stats.countByCondition.map((entry, index) => {
                          let color = '#059669'; // Serviceable
                          if (entry.name === 'Needs Repair') color = '#d97706';
                          else if (entry.name === 'Unserviceable') color = '#dc2626';
                          else if (entry.name.includes('Condemnation')) color = '#4b5563';
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <RechartsTooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Fund Source Distribution */}
              <Card className="p-5 border-gray-200 lg:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800 text-sm">Asset Valuation by Source of Fund</h4>
                  <span className="text-xs text-gray-400">DCP, MOOE, PTA, SEF</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {stats.valueByFundSource.map((fund, idx) => (
                    <div key={fund.name} className="p-4 bg-gray-50 rounded-md border border-gray-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}></span>
                        <span className="text-xs font-bold text-gray-800 truncate" title={fund.name}>{fund.name}</span>
                      </div>
                      <p className="text-lg font-black text-gray-900 mt-1">
                        ₱ {fund.value.toLocaleString('en-PH', { maximumFractionDigits: 0 })}
                      </p>
                      <span className="text-[10px] text-gray-400">
                        {stats.totalValuation > 0 ? ((fund.value / stats.totalValuation) * 100).toFixed(1) : 0}% of school assets
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {isFormOpen && (
        <PropertyFormModal
          initialData={editingItem}
          existingItems={items}
          initialPISCode={initialEncoderPisCode}
          onSubmit={handleSaveItem}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingItem(undefined);
            setInitialEncoderPisCode(undefined);
          }}
        />
      )}

      {stickerItem && (
        <PropertyStickerModal
          item={stickerItem}
          onClose={() => setStickerItem(undefined)}
          onOpenBatchSheet={() => setIsBatchPISOpen(true)}
          onOpenCableTag={() => {
            setTargetCablePropertyCode(stickerItem.propertyNumber);
            setIsCableStickerOpen(true);
          }}
        />
      )}

      {isBatchPISOpen && (
        <PISBatchGeneratorModal
          properties={items}
          onClose={() => setIsBatchPISOpen(false)}
        />
      )}

      {isCableStickerOpen && (
        <CableStickerGeneratorModal
          properties={items}
          defaultPropertyCode={targetCablePropertyCode}
          onClose={() => {
            setIsCableStickerOpen(false);
            setTargetCablePropertyCode(undefined);
          }}
        />
      )}

      {isQuickEncoderOpen && (
        <QuickPISEncoderModal
          existingItems={items}
          onSaveItem={async (newItem) => {
            await handleSaveItem(newItem);
            setIsQuickEncoderOpen(false);
          }}
          onEditExisting={(existing) => {
            setIsQuickEncoderOpen(false);
            setEditingItem(existing);
            setIsFormOpen(true);
          }}
          onClose={() => setIsQuickEncoderOpen(false)}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        isDestructive={true}
      />

      {/* DepEd Inventory Report Preview Modal with Auto-Print */}
      {isPrintReportModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">
            {/* Modal Header Toolbar */}
            <div className="px-5 py-3.5 bg-blue-950 text-white flex items-center justify-between gap-3 border-b border-blue-900 flex-shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="font-extrabold text-sm sm:text-base text-white truncate flex items-center gap-2">
                    <span>DepEd Inventory Report Preview</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider bg-blue-900 text-blue-200 px-2 py-0.5 rounded border border-blue-800">
                      RPCPPE / RPCSP
                    </span>
                  </div>
                  <div className="text-[11px] text-blue-200 truncate flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                    <span className="font-medium">
                      Scope: {modalIsSpecificLocation ? `Cabinet / Storage: ${reportLocation}` : (modalIsGrouped ? `All Cabinets (${distinctLocations.length} locations)` : 'All Articles')} • {modalItemsToPreview.length} articles • {modalTotalQuantity} units
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handlePrintOfficialReport}
                  className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-300 text-blue-950 font-bold rounded-sm text-xs transition-colors flex items-center gap-1.5 shadow-xs"
                  title="Trigger print dialog again"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintReportModalOpen(false)}
                  className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-900 rounded-sm transition-colors"
                  title="Close Preview (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Document Body (Scrollable paper sheet preview) */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-slate-100">
              <div className="max-w-5xl mx-auto bg-white border border-gray-300 rounded-md p-6 sm:p-8 shadow-sm space-y-6">
                {/* Document Header (System Generated Text & Page Numbering Preview) */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-3 border-b-2 border-gray-900 text-xs text-gray-500 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-[10px] uppercase bg-gray-900 text-white px-2 py-0.5 rounded-xs tracking-wider">
                      System Generated Document
                    </span>
                    <span className="font-extrabold text-blue-900 text-xs tracking-wide">
                      INTEGRATED LABORATORY EQUIPMENT MANAGEMENT SYSTEM (I-LEMS)
                    </span>
                    <span className="text-gray-300 hidden sm:inline">•</span>
                    <span className="text-[11px] text-gray-600 font-medium">DepEd Form RPCPPE / RPCSP</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-gray-600">
                    <span className="text-gray-500 hidden md:inline">Leon National High School</span>
                    <span className="text-gray-300 hidden md:inline">•</span>
                    <span className="bg-gray-100 border border-gray-300 px-2 py-0.5 rounded text-[11px] font-bold text-gray-700">
                      Page 1 of 1
                    </span>
                  </div>
                </div>

                <div className="text-center pb-4 border-b-2 border-blue-900">
                  <p className="text-xs text-gray-500 uppercase font-semibold">Republic of the Philippines • Department of Education</p>
                  <h3 className="text-sm font-bold text-blue-900">Region VI - Western Visayas • Division of Iloilo</h3>
                  <h2 className="text-lg font-black text-red-800 mt-0.5">LEON NATIONAL HIGH SCHOOL</h2>
                  <h1 className="text-base font-extrabold text-gray-900 mt-2 tracking-wide uppercase">
                    Report on the Physical Count of Property, Plant & Equipment (RPCPPE)
                  </h1>
                  <div className="inline-block bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-sm text-xs font-bold mt-2">
                    {modalIsSpecificLocation
                      ? `STORAGE CABINET / LOCATION: ${reportLocation}`
                      : (modalIsGrouped ? `ALL STORAGE LOCATIONS & CABINETS (${distinctLocations.length} LOCATIONS)` : 'ALL PROPERTY INVENTORY ARTICLES')}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">As of {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                {/* Grouped by Location / Cabinets */}
                {modalIsGrouped ? (
                  <div className="space-y-6">
                    {reportLocationsGrouped.map(([locName, locItems]) => {
                      const locTotal = locItems.reduce((sum, item) => sum + (item.totalValue || item.quantity * item.unitValue), 0);
                      const locQty = locItems.reduce((sum, item) => sum + item.quantity, 0);

                      return (
                        <div key={locName} className="border border-gray-300 rounded-md overflow-hidden">
                          {/* Cabinet Header */}
                          <div className="bg-blue-900 text-white px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-yellow-300 flex-shrink-0" />
                              <h4 className="font-bold text-sm tracking-wide">{locName}</h4>
                            </div>
                            <div className="text-xs text-blue-100 font-mono">
                              {locItems.length} article(s) • {locQty} unit(s) • Subtotal: <strong className="text-white">₱ {locTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
                            </div>
                          </div>

                          {/* Cabinet Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-100 text-gray-700 border-b border-gray-300 font-bold">
                                  <th className="p-2 border border-gray-300 text-center w-8">#</th>
                                  <th className="p-2 border border-gray-300 w-28">Property No.</th>
                                  <th className="p-2 border border-gray-300 w-24">PIS Code</th>
                                  <th className="p-2 border border-gray-300">Article / Description</th>
                                  <th className="p-2 border border-gray-300 w-32">Category</th>
                                  <th className="p-2 border border-gray-300 text-center w-16">Qty</th>
                                  <th className="p-2 border border-gray-300 text-right w-24">Unit Cost (₱)</th>
                                  <th className="p-2 border border-gray-300 text-right w-28">Total Cost (₱)</th>
                                  <th className="p-2 border border-gray-300 w-28">Custodian</th>
                                  <th className="p-2 border border-gray-300 text-center w-20">Condition</th>
                                </tr>
                              </thead>
                              <tbody>
                                {locItems.map((item, idx) => (
                                  <tr key={item.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                                    <td className="p-2 border border-gray-200 text-center">{idx + 1}</td>
                                    <td className="p-2 border border-gray-200 font-mono font-bold text-blue-950 whitespace-nowrap">{item.propertyNumber}</td>
                                    <td className="p-2 border border-gray-200 whitespace-nowrap">
                                      {item.pisCode ? (
                                        <span className="font-mono text-[10px] font-black bg-[#FFF000] text-black border border-black px-1.5 py-0.5 rounded-xs">
                                          {item.pisCode}
                                        </span>
                                      ) : (
                                        <span className="text-gray-400 font-mono text-[10px]">—</span>
                                      )}
                                    </td>
                                    <td className="p-2 border border-gray-200">
                                      <div className="font-semibold text-gray-900">{item.name}</div>
                                      {item.description && <div className="text-[11px] text-gray-500 line-clamp-1">{item.description}</div>}
                                    </td>
                                    <td className="p-2 border border-gray-200 text-gray-600">{item.category}</td>
                                    <td className="p-2 border border-gray-200 text-center font-bold">{item.quantity} {item.unit}</td>
                                    <td className="p-2 border border-gray-200 text-right">₱ {item.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                                    <td className="p-2 border border-gray-200 text-right font-bold text-emerald-800">
                                      ₱ {(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="p-2 border border-gray-200 font-medium">{item.custodian}</td>
                                    <td className="p-2 border border-gray-200 text-center font-semibold">{item.condition}</td>
                                  </tr>
                                ))}
                                <tr className="bg-emerald-50/70 font-bold border-t border-gray-300 text-emerald-950">
                                  <td colSpan={5} className="p-2 border border-gray-300 text-right uppercase text-[11px]">Subtotal for {locName}:</td>
                                  <td className="p-2 border border-gray-300 text-center">{locQty} units</td>
                                  <td className="p-2 border border-gray-300"></td>
                                  <td className="p-2 border border-gray-300 text-right font-black text-emerald-900">
                                    ₱ {locTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td colSpan={2} className="p-2 border border-gray-300"></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Flat Table or Specific Location Table */
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100 text-gray-700 border-y border-gray-300 font-bold">
                          <th className="p-2 border border-gray-300 text-center w-8">#</th>
                          <th className="p-2 border border-gray-300 w-28">Property No.</th>
                          <th className="p-2 border border-gray-300 w-24">PIS Code</th>
                          <th className="p-2 border border-gray-300">Article / Description</th>
                          <th className="p-2 border border-gray-300 w-32">Category</th>
                          <th className="p-2 border border-gray-300 text-center w-16">Qty</th>
                          <th className="p-2 border border-gray-300 text-right w-24">Unit Cost (₱)</th>
                          <th className="p-2 border border-gray-300 text-right w-28">Total Cost (₱)</th>
                          <th className="p-2 border border-gray-300 w-32">Location / Cabinet</th>
                          <th className="p-2 border border-gray-300 w-28">Custodian</th>
                          <th className="p-2 border border-gray-300 text-center w-20">Condition</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalItemsToPreview.length > 0 ? (
                          modalItemsToPreview.map((item, idx) => (
                            <tr key={item.id} className="border-b border-gray-200 hover:bg-blue-50/30">
                              <td className="p-2 border border-gray-200 text-center">{idx + 1}</td>
                              <td className="p-2 border border-gray-200 font-mono font-bold text-blue-950 whitespace-nowrap">{item.propertyNumber}</td>
                              <td className="p-2 border border-gray-200 whitespace-nowrap">
                                {item.pisCode ? (
                                  <span className="font-mono text-[10px] font-black bg-[#FFF000] text-black border border-black px-1.5 py-0.5 rounded-xs">
                                    {item.pisCode}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-mono text-[10px]">—</span>
                                )}
                              </td>
                              <td className="p-2 border border-gray-200">
                                <div className="font-semibold text-gray-900">{item.name}</div>
                                {item.description && <div className="text-[11px] text-gray-500 line-clamp-1">{item.description}</div>}
                              </td>
                              <td className="p-2 border border-gray-200 text-gray-600">{item.category}</td>
                              <td className="p-2 border border-gray-200 text-center font-bold">{item.quantity} {item.unit}</td>
                              <td className="p-2 border border-gray-200 text-right">₱ {item.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                              <td className="p-2 border border-gray-200 text-right font-bold text-emerald-800">
                                ₱ {(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 border border-gray-200 font-medium">{item.location}</td>
                              <td className="p-2 border border-gray-200 font-medium">{item.custodian}</td>
                              <td className="p-2 border border-gray-200 text-center font-semibold">{item.condition}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={11} className="p-8 text-center text-gray-400">
                              No property records found matching {modalIsSpecificLocation ? `location "${reportLocation}"` : 'the current filters'}.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Grand Total Row */}
                <div className="bg-gray-100 border border-gray-300 rounded-md p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Report Grand Total ({modalItemsToPreview.length} Articles • {modalTotalQuantity} Physical Units)
                  </div>
                  <div className="text-xl font-black text-emerald-900">
                    ₱ {modalTotalValuation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* System Generated Document Footer Preview */}
                <div className="pt-6 border-t border-gray-200">
                  <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 mb-1">
                      <span>SYSTEM GENERATED DOCUMENT</span>
                      <span>•</span>
                      <span>DO NOT ALTER ENTRIES MANUALLY</span>
                    </div>
                    <p className="text-xs font-bold text-gray-900">
                      Integrated Laboratory Equipment Management System (I-LEMS)
                    </p>
                    <p className="text-[11px] text-gray-500">
                      &copy; 2025-{new Date().getFullYear()}. Leon NHS - Science Laboratory
                    </p>
                    <p className="text-[11px] text-gray-500">
                      Developed by Fitz Jyro Calisnao, through the vision of Jong Bok Chun, KOICA Volunteer
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Toolbar */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0 text-xs">
              <div className="text-gray-500 font-medium text-[11px] sm:text-xs">
                Print dialog opened automatically. You can review the document above or click Print Document to reprint.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintReportModalOpen(false)}
                  className="px-3.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-sm font-semibold transition-colors shadow-2xs"
                >
                  Close Preview
                </button>
                <button
                  type="button"
                  onClick={handlePrintOfficialReport}
                  className="px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-sm font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertyManagement;
