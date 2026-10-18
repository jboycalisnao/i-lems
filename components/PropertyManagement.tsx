import React, { useState, useMemo, useEffect } from 'react';
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
  Cloud,
  CloudOff,
  ChevronRight,
  ChevronDown,
  Layers,
  Folder,
  Cable
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

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'IT & Digital Equipment':
      return '💻';
    case 'School Furniture & Fixtures':
      return '🪑';
    case 'Audio-Visual & Electronics':
      return '📺';
    case 'Appliances & HVAC':
      return '❄️';
    case 'Security & Safety Equipment':
      return '🧯';
    case 'Laboratory & Science Equipment':
      return '🔬';
    case 'Sports & Physical Education':
      return '⚽';
    case 'Musical Instruments':
      return '🎸';
    case 'Agricultural & Industrial Arts':
      return '🛠️';
    default:
      return '📦';
  }
};

export const PropertyManagement: React.FC<PropertyManagementProps> = () => {
  const [items, setItems] = useState<PropertyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'registry' | 'reports' | 'analytics'>('registry');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCondition, setSelectedCondition] = useState<string>('All');
  const [selectedFundSource, setSelectedFundSource] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [viewGrouping, setViewGrouping] = useState<'category' | 'flat'>('category');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'propertyNumber' | 'totalValue' | 'date'>('name');
  const [sortAsc, setSortAsc] = useState(true);

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

  // Selected for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load properties from Cloud (Supabase)
  const loadData = async (showSpinner = true) => {
    if (showSpinner) setIsLoading(true);
    try {
      const data = await propertyStorage.getPropertyItems();
      setItems(data);
      setIsCloudConnected(Boolean(supabase && typeof supabase.from === 'function'));
    } catch (e) {
      console.error('Failed to load property items from cloud', e);
      setIsCloudConnected(false);
    } finally {
      if (showSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    // Subscribe to realtime database changes from Supabase
    if (supabase && typeof supabase.channel === 'function') {
      const channel = supabase
        .channel('public:property_items')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'property_items' },
          () => {
            loadData(false);
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
      const matchesCond = selectedCondition === 'All' || item.condition === selectedCondition;
      const matchesFund = selectedFundSource === 'All' || item.sourceOfFund === selectedFundSource;
      const matchesType = selectedType === 'All' || item.inventoryType === selectedType;

      return matchesSearch && matchesCat && matchesCond && matchesFund && matchesType;
    }).sort((a, b) => {
      let result = 0;
      if (sortField === 'name') result = a.name.localeCompare(b.name);
      else if (sortField === 'propertyNumber') result = a.propertyNumber.localeCompare(b.propertyNumber);
      else if (sortField === 'totalValue') result = (a.totalValue || 0) - (b.totalValue || 0);
      else if (sortField === 'date') result = (a.acquisitionDate || '').localeCompare(b.acquisitionDate || '');
      return sortAsc ? result : -result;
    });
  }, [items, searchTerm, selectedCategory, selectedCondition, selectedFundSource, selectedType, sortField, sortAsc]);

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

  const handlePrintOfficialReport = () => {
    const printWindow = window.open('', '', 'width=1000,height=800');
    if (!printWindow) return;

    const rowsHtml = filteredItems.map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${item.propertyNumber}</td>
        <td>
          <strong>${item.name}</strong>
          ${item.description ? `<br><small style="color: #4b5563;">${item.description}</small>` : ''}
          ${item.serialNumber ? `<br><small style="color: #6b7280; font-family: monospace;">SN: ${item.serialNumber}</small>` : ''}
        </td>
        <td>${item.category}</td>
        <td style="text-align: center;">${item.quantity} ${item.unit}</td>
        <td style="text-align: right;">₱ ${item.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-weight: bold;">₱ ${(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        <td>${item.location}</td>
        <td><strong>${item.custodian}</strong></td>
        <td style="text-align: center;">${item.condition}</td>
        <td>${item.sourceOfFund}</td>
        <td style="font-family: monospace;">${item.parNumber || 'N/A'}</td>
      </tr>
    `).join('');

    const grandTotal = filteredItems.reduce((sum, item) => sum + (item.totalValue || item.quantity * item.unitValue), 0);
    const grandQuantity = filteredItems.reduce((sum, item) => sum + item.quantity, 0);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>DepEd School Property Inventory Report - Leon NHS</title>
        <style>
          @page {
            size: landscape;
            margin: 10mm;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            font-size: 11px;
            margin: 0;
            padding: 15px;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 12px;
          }
          .header h4 { margin: 0; font-size: 11px; font-weight: normal; color: #4b5563; }
          .header h3 { margin: 2px 0; font-size: 13px; font-weight: bold; color: #1e3a8a; }
          .header h2 { margin: 3px 0; font-size: 16px; font-weight: 900; color: #991b1b; }
          .header h1 { margin: 8px 0 2px 0; font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          .meta {
            display: flex;
            justify-content: space-between;
            margin-bottom: 12px;
            font-size: 11px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          th, td {
            border: 1px solid #94a3b8;
            padding: 6px 8px;
            vertical-align: top;
          }
          th {
            background-color: #f1f5f9;
            font-weight: 800;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .grand-total {
            background-color: #e2e8f0 !important;
            font-weight: bold;
          }
          .signatories {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 30px;
            margin-top: 40px;
            page-break-inside: avoid;
          }
          .sig-box {
            text-align: center;
          }
          .sig-line {
            border-top: 1px solid #000;
            margin-top: 50px;
            padding-top: 5px;
            font-weight: bold;
            font-size: 12px;
          }
          .sig-title {
            font-size: 10px;
            color: #4b5563;
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
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #4b5563;">General School Property Inventory (Non-Laboratory Assets)</p>
        </div>

        <div class="meta">
          <div><strong>Category Filter:</strong> ${selectedCategory} | <strong>Condition:</strong> ${selectedCondition}</div>
          <div><strong>Date Generated:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th style="width: 120px;">Property No.</th>
              <th>Article & Description</th>
              <th style="width: 130px;">Category</th>
              <th style="width: 60px; text-align: center;">Qty</th>
              <th style="width: 90px; text-align: right;">Unit Cost</th>
              <th style="width: 100px; text-align: right;">Total Cost</th>
              <th style="width: 120px;">Location</th>
              <th style="width: 130px;">Accountable Officer</th>
              <th style="width: 80px; text-align: center;">Condition</th>
              <th style="width: 110px;">Fund Source</th>
              <th style="width: 90px;">PAR/ICS</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
            <tr class="grand-total">
              <td colspan="4" style="text-align: right; text-transform: uppercase;"><strong>Grand Totals:</strong></td>
              <td style="text-align: center;"><strong>${grandQuantity}</strong></td>
              <td></td>
              <td style="text-align: right;"><strong>₱ ${grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
              <td colspan="5"></td>
            </tr>
          </tbody>
        </table>


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
              onClick={() => loadData(true)}
              title="Refresh cloud property records"
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
              onClick={handlePrintOfficialReport}
              title="Print official inventory report"
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
              <div className="lg:col-span-4 relative">
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

              {/* Condition Filter */}
              <div className="lg:col-span-2">
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="All">All Conditions</option>
                  <option value="Serviceable">🟢 Serviceable</option>
                  <option value="Needs Repair">🟡 Needs Repair</option>
                  <option value="Unserviceable">🔴 Unserviceable</option>
                  <option value="For Condemnation">⚫ For Condemnation</option>
                  <option value="Disposed">⚪ Disposed</option>
                </select>
              </div>

              {/* View Grouping, Layout & Sorting */}
              <div className="lg:col-span-3 flex items-center justify-start lg:justify-end gap-1.5 flex-wrap">
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
                            <span className="text-lg select-none">{getCategoryIcon(group.category)}</span>
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
            <div className="bg-blue-50/70 border border-blue-200 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-bold text-blue-950 text-sm">Official DepEd Inventory Format (RPCPPE / RPCSP)</h4>
                <p className="text-xs text-blue-800">
                  Formatted for Leon National High School property auditing and COA compliance.
                </p>
              </div>
              <button
                onClick={handlePrintOfficialReport}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-sm text-xs md:text-sm font-bold shadow-md transition-all flex items-center space-x-2"
              >
                <Printer className="w-4 h-4" />
                <span>Print Official Report</span>
              </button>
            </div>

            {/* Official Report Card preview */}
            <div className="border border-gray-300 rounded-md p-6 bg-white shadow-sm space-y-4">
              <div className="text-center pb-4 border-b-2 border-blue-900">
                <p className="text-xs text-gray-500 uppercase font-semibold">Republic of the Philippines • Department of Education</p>
                <h3 className="text-sm font-bold text-blue-900">Region VI - Western Visayas • Division of Iloilo</h3>
                <h2 className="text-lg font-black text-red-800 mt-0.5">LEON NATIONAL HIGH SCHOOL</h2>
                <h1 className="text-base font-extrabold text-gray-900 mt-2 tracking-wide uppercase">
                  Report on the Physical Count of Property, Plant & Equipment (RPCPPE)
                </h1>
                <p className="text-xs text-gray-500">As of {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 border-y border-gray-300">
                      <th className="p-2 border border-gray-300 text-center w-8">#</th>
                      <th className="p-2 border border-gray-300">Property No.</th>
                      <th className="p-2 border border-gray-300">Article / Description</th>
                      <th className="p-2 border border-gray-300">Category</th>
                      <th className="p-2 border border-gray-300 text-center">Qty</th>
                      <th className="p-2 border border-gray-300 text-right">Unit Cost (₱)</th>
                      <th className="p-2 border border-gray-300 text-right">Total Cost (₱)</th>
                      <th className="p-2 border border-gray-300">Location</th>
                      <th className="p-2 border border-gray-300">Accountable Officer</th>
                      <th className="p-2 border border-gray-300 text-center">Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item, idx) => (
                      <tr key={item.id} className="border-b border-gray-200">
                        <td className="p-2 border border-gray-200 text-center">{idx + 1}</td>
                        <td className="p-2 border border-gray-200 font-mono font-bold text-blue-950">{item.propertyNumber}</td>
                        <td className="p-2 border border-gray-200 font-semibold">{item.name}</td>
                        <td className="p-2 border border-gray-200 text-gray-600">{item.category}</td>
                        <td className="p-2 border border-gray-200 text-center font-bold">{item.quantity} {item.unit}</td>
                        <td className="p-2 border border-gray-200 text-right">₱ {item.unitValue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 border border-gray-200 text-right font-bold text-emerald-800">
                          ₱ {(item.totalValue || item.quantity * item.unitValue).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 border border-gray-200">{item.location}</td>
                        <td className="p-2 border border-gray-200 font-medium">{item.custodian}</td>
                        <td className="p-2 border border-gray-200 text-center font-semibold">{item.condition}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold border-t-2 border-gray-400">
                      <td colSpan={4} className="p-2 border border-gray-300 text-right uppercase">Grand Total:</td>
                      <td className="p-2 border border-gray-300 text-center">{stats.totalQuantity} units</td>
                      <td className="p-2 border border-gray-300"></td>
                      <td className="p-2 border border-gray-300 text-right font-black text-emerald-900">
                        ₱ {stats.totalValuation.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={3} className="p-2 border border-gray-300"></td>
                    </tr>
                  </tbody>
                </table>
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
    </div>
  );
};

export default PropertyManagement;
