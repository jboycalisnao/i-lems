import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useCallback } from 'react';
import { PropertyItem, PropertyCondition, PropertyInventoryType } from '../types';
import * as propertyStorage from '../services/propertyStorageService';
import { supabase } from '../supabaseClient';
import PropertyFormModal from './PropertyFormModal';
import PropertyStickerModal from './PropertyStickerModal';
import PISBatchGeneratorModal from './PISBatchGeneratorModal';
import CableStickerGeneratorModal from './CableStickerGeneratorModal';
import QuickPISEncoderModal from './QuickPISEncoderModal';
import ConfirmModal from './ConfirmModal';
import { BulkInventoryModal } from './BulkInventoryModal';
import { exportPropertyFullExcel, exportPropertyByNameExcel } from '../services/bulkImportService';
import { toast } from '../context/ToastContext';
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
  Eye,
  Upload,
  HandPlatter
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
  onBorrow?: (item: PropertyItem) => void;
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

interface PropertyTableRowProps {
  item: PropertyItem;
  showCategoryCol: boolean;
  isGroupChild?: boolean;
  unitIndex?: number;
  totalGroupUnits?: number;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onLinkPIS: (item: PropertyItem) => void;
  onPrintSticker: (item: PropertyItem) => void;
  onPrintCable: (propertyNumber: string) => void;
  onEdit: (item: PropertyItem) => void;
  onDelete: (id: string, name: string) => void;
  onExportExcel?: (propertyName: string) => void;
  onBorrow?: (item: PropertyItem) => void;
}

const PropertyTableRow = React.memo<PropertyTableRowProps>(function PropertyTableRow({
  item,
  showCategoryCol,
  isGroupChild = false,
  unitIndex,
  totalGroupUnits,
  isSelected,
  onToggleSelect,
  onLinkPIS,
  onPrintSticker,
  onPrintCable,
  onEdit,
  onDelete,
  onExportExcel,
  onBorrow
}) {
  const badge = CONDITION_BADGES[item.condition] || CONDITION_BADGES['Serviceable'];
  const BadgeIcon = badge.icon;

  return (
    <tr
      className={`hover:bg-blue-50/40 transition-colors ${
        isGroupChild ? 'bg-blue-50/15 border-l-4 border-l-blue-400' : ''
      } ${isSelected ? 'bg-blue-50/70' : ''}`}
    >
      <td className="px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
          className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>
      <td className={`px-2.5 py-2 whitespace-nowrap ${isGroupChild ? 'pl-3' : ''}`}>
        {item.pisCode ? (
          <div className="inline-flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-mono font-black text-[10.5px] bg-[#FFF000] text-black border border-black shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block"></span>
              {item.pisCode}
            </span>
            {item.pisCodes && item.pisCodes.length > 1 && (
              <span 
                title={`Assigned multi-unit PIS stickers (${item.pisCodes.length} units):\n${item.pisCodes.join(', ')}`}
                className="px-1.5 py-0.5 text-[9.5px] font-black bg-blue-100 text-blue-900 border border-blue-300 rounded-sm cursor-help whitespace-nowrap"
              >
                +{item.pisCodes.length - 1} PIS
              </span>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onLinkPIS(item)}
            className="text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-300 px-2 py-0.5 rounded-sm transition-colors cursor-pointer"
          >
            + Link PIS
          </button>
        )}
      </td>
      <td className="px-2.5 py-2 font-mono font-bold text-blue-900 whitespace-nowrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span>{item.propertyNumber}</span>
          {item.propertyNumbers && item.propertyNumbers.length > 1 && (
            <span 
              title={`Sequential Property Codes (${item.propertyNumbers.length} units):\n${item.propertyNumbers.join(', ')}`}
              className="px-1.5 py-0.5 text-[9.5px] font-bold bg-blue-100 text-blue-900 border border-blue-300 rounded-sm cursor-help whitespace-nowrap"
            >
              +{item.propertyNumbers.length - 1} Codes
            </span>
          )}
        </div>
        {item.parNumber && (
          <span className="block text-[10px] font-normal text-gray-400">
            {item.parNumber}
          </span>
        )}
      </td>
      <td className="px-2.5 py-2 min-w-[140px] max-w-[220px]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-gray-900 text-xs truncate" title={item.name}>{item.name}</span>
          {isGroupChild && unitIndex !== undefined && totalGroupUnits !== undefined && (
            <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap">
              Unit {unitIndex} of {totalGroupUnits}
            </span>
          )}
        </div>
        {item.description && (
          <p className="text-[11px] text-gray-500 truncate" title={item.description}>
            {item.description}
          </p>
        )}
        {item.serialNumber && (
          <span className="text-[10px] font-mono text-gray-400 block truncate" title={`SN: ${item.serialNumber}`}>
            SN: {item.serialNumber}
          </span>
        )}
      </td>
      {showCategoryCol && (
        <td className="px-2.5 py-2 whitespace-nowrap max-w-[140px]">
          <span className="text-gray-700 font-medium truncate block" title={item.category}>{item.category}</span>
          <span className="block text-[10px] text-gray-400 truncate">{item.inventoryType}</span>
        </td>
      )}
      <td className="px-2 py-2 text-center whitespace-nowrap font-bold text-gray-800">
        {item.quantity} {item.unit}
      </td>
      <td className="px-2.5 py-2 whitespace-nowrap text-gray-700 max-w-[120px] truncate" title={item.location}>
        {item.location}
      </td>
      <td className="px-2.5 py-2 whitespace-nowrap font-medium text-gray-900 max-w-[130px] truncate" title={item.custodian}>
        {item.custodian}
      </td>
      <td className="px-2.5 py-2 text-center whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
          <BadgeIcon className="w-3 h-3" />
          {item.condition}
        </span>
      </td>
      <td className="px-2.5 py-2 text-right whitespace-nowrap">
        <div className="flex items-center justify-end space-x-1">
          <button
            type="button"
            onClick={() => onPrintSticker(item)}
            title="Print DepEd Property Sticker / Barcode"
            className="p-1 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors cursor-pointer"
          >
            <Tag className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPrintCable(item.propertyNumber)}
            title="Print Cable Peripheral Sticker (PIS Tag)"
            className="p-1 text-amber-600 hover:bg-amber-50 rounded-sm transition-colors cursor-pointer"
          >
            <Cable className="w-4 h-4" />
          </button>
          {onExportExcel && (
            <button
              type="button"
              onClick={() => onExportExcel(item.name)}
              title={`Export all units of "${item.name}" to Excel (.xlsx)`}
              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}
          {onBorrow && (
            <button
              type="button"
              onClick={() => onBorrow(item)}
              title="Borrow Property Item"
              className="p-1 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors cursor-pointer"
            >
              <HandPlatter className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Edit Property Details"
            className="p-1 text-gray-600 hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id, item.name)}
            title="Delete Property Record"
            className="p-1 text-red-600 hover:bg-red-50 rounded-sm transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
});

interface PropertyCardProps {
  item: PropertyItem;
  onPrintSticker: (item: PropertyItem) => void;
  onPrintCable: (propertyNumber: string) => void;
  onEdit: (item: PropertyItem) => void;
  onDelete: (id: string, name: string) => void;
  onExportExcel?: (propertyName: string) => void;
  onBorrow?: (item: PropertyItem) => void;
}

const PropertyCard = React.memo<PropertyCardProps>(function PropertyCard({
  item,
  onPrintSticker,
  onPrintCable,
  onEdit,
  onDelete,
  onExportExcel,
  onBorrow
}) {
  const badge = CONDITION_BADGES[item.condition] || CONDITION_BADGES['Serviceable'];
  const BadgeIcon = badge.icon;

  return (
    <Card className="p-5 border-gray-200 hover:shadow-lg transition-all duration-200 flex flex-col justify-between rounded-md bg-white">
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
            {item.pisCodes && item.pisCodes.length > 1 && (
              <span 
                title={`Assigned multi-unit PIS stickers (${item.pisCodes.length} units):\n${item.pisCodes.join(', ')}`}
                className="px-1.5 py-0.5 text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300 rounded-sm cursor-help whitespace-nowrap"
              >
                +{item.pisCodes.length - 1} PIS
              </span>
            )}
            <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-sm border border-blue-200 inline-flex items-center gap-1">
              <span>{item.propertyNumber}</span>
              {item.propertyNumbers && item.propertyNumbers.length > 1 && (
                <span 
                  title={`Sequential Property Codes (${item.propertyNumbers.length} units):\n${item.propertyNumbers.join(', ')}`}
                  className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1 rounded cursor-help"
                >
                  +{item.propertyNumbers.length - 1}
                </span>
              )}
            </span>
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border} flex-shrink-0`}>
            <BadgeIcon className="w-3 h-3" />
            {item.condition}
          </span>
        </div>

        {/* Title and specs with Avatar thumbnail */}
        <div className="flex items-start gap-3 my-2">
          {item.imageUrl ? (
            <div className="w-12 h-12 rounded-md border border-gray-200 bg-white overflow-hidden flex-shrink-0 shadow-2xs">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 text-gray-400">
              <Building2 className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-gray-900 text-sm leading-snug line-clamp-1">{item.name}</h4>
            <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{item.description || 'No detailed specifications recorded.'}</p>
          </div>
        </div>

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
            <span className="text-gray-400 block text-[9px] font-bold uppercase">Classification</span>
            <span className="font-medium text-gray-800 truncate block">{item.inventoryType}</span>
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
            type="button"
            onClick={() => onPrintSticker(item)}
            title="Print Property Sticker Tag"
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors cursor-pointer"
          >
            <Tag className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onPrintCable(item.propertyNumber)}
            title="Print Cable Peripheral Sticker (PIS Tag)"
            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-sm transition-colors cursor-pointer"
          >
            <Cable className="w-4 h-4" />
          </button>
          {onExportExcel && (
            <button
              type="button"
              onClick={() => onExportExcel(item.name)}
              title={`Export all units of "${item.name}" to Excel (.xlsx)`}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}
          {onBorrow && (
            <button
              type="button"
              onClick={() => onBorrow(item)}
              title="Borrow Property Item"
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-sm transition-colors cursor-pointer"
            >
              <HandPlatter className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => onEdit(item)}
            title="Edit Record"
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-sm transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(item.id, item.name)}
            title="Delete"
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-sm transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  );
});

export const PropertyManagement: React.FC<PropertyManagementProps> = ({ onRefreshParent, onBorrow }) => {
  const [items, setItems] = useState<PropertyItem[]>(() => propertyStorage.getCachedPropertyItems());
  const [isLoading, setIsLoading] = useState(() => propertyStorage.getCachedPropertyItems().length === 0);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'registry' | 'reports' | 'analytics'>('registry');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [selectedCondition, setSelectedCondition] = useState<string>('All');
  const [selectedFundSource, setSelectedFundSource] = useState<string>('All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [viewGrouping, setViewGrouping] = useState<'category' | 'flat'>('category');
  const [flatPage, setFlatPage] = useState(1);
  const itemsPerPage = 50;
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<'name' | 'propertyNumber' | 'totalValue' | 'date'>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [groupSameNames, setGroupSameNames] = useState<boolean>(true);
  const [expandedNameGroups, setExpandedNameGroups] = useState<Set<string>>(new Set());

  // Reset flatPage when filters change
  useEffect(() => {
    setFlatPage(1);
  }, [deferredSearchTerm, selectedCategory, selectedLocation, selectedCondition, selectedFundSource, selectedType, sortField, sortAsc]);

  // DepEd Inventory Report State (Location / Cabinet generation)
  const [reportLocation, setReportLocation] = useState<string>('All');
  const [reportGrouping, setReportGrouping] = useState<'by-location' | 'flat'>('by-location');
  const [reportSearchTerm, setReportSearchTerm] = useState<string>('');
  const deferredReportSearchTerm = useDeferredValue(reportSearchTerm);

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
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
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

  // Print plain equipment & quantity list per cabinet state
  const [isPrintCabinetModalOpen, setIsPrintCabinetModalOpen] = useState(false);
  const [selectedPrintCabinetLocation, setSelectedPrintCabinetLocation] = useState<string>('All');
  const [printPageBreakPerCabinet, setPrintPageBreakPerCabinet] = useState(true);

  // Export Menu & Modal State
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [isExportByNameModalOpen, setIsExportByNameModalOpen] = useState(false);
  const [exportByNameSearchTerm, setExportByNameSearchTerm] = useState('');

  // Close export menu on click outside
  useEffect(() => {
    if (!isExportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExportMenuOpen]);

  // Close export by name modal on Escape key
  useEffect(() => {
    if (!isExportByNameModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsExportByNameModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExportByNameModalOpen]);

  // Close print cabinet modal on Escape key
  useEffect(() => {
    if (!isPrintCabinetModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPrintCabinetModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintCabinetModalOpen]);

  const handleOpenPrintCabinetModal = (initialLoc?: string) => {
    setSelectedPrintCabinetLocation(initialLoc && initialLoc !== 'All' ? initialLoc : 'All');
    setIsPrintCabinetModalOpen(true);
  };

  // Selected for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load properties (uses cache when available; forceRefresh only when explicitly requested)
  const loadData = async (showSpinner = false, forceRefresh = false) => {
    if (showSpinner && items.length === 0) setIsLoading(true);
    try {
      const data = await propertyStorage.getPropertyItems(forceRefresh);
      setItems(prev => {
        if (prev.length === data.length && prev.length > 0 && prev[0]?.id === data[0]?.id && prev[prev.length - 1]?.id === data[data.length - 1]?.id) {
          return prev;
        }
        return data;
      });
      setIsCloudConnected(Boolean(supabase && typeof supabase.from === 'function'));
    } catch (e) {
      console.error('Failed to load property items from cloud', e);
      setIsCloudConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 1. Asynchronously hydrate from IndexedDB if state is not yet populated
    if (items.length === 0) {
      propertyStorage.getPropertyInventoryFromDB().then(dbItems => {
        if (dbItems && dbItems.length > 0) {
          setItems(prev => (prev.length === 0 ? dbItems : prev));
          setIsLoading(false);
        }
      }).catch(console.warn);
    }

    // 2. Normal load using IndexedDB/memory cache (will NOT reload or re-fetch from network on every reload)
    loadData(items.length === 0, false);

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

  // Pre-calculate category & location counts in a single O(N) pass for fast filter rendering
  const { categoryCounts, locationCounts } = useMemo(() => {
    const catMap = new Map<string, number>();
    const locMap = new Map<string, number>();
    for (const item of items) {
      if (item.category) {
        catMap.set(item.category, (catMap.get(item.category) || 0) + 1);
      }
      if (item.location?.trim()) {
        const loc = item.location.trim();
        locMap.set(loc, (locMap.get(loc) || 0) + 1);
        locMap.set(loc.toLowerCase(), (locMap.get(loc.toLowerCase()) || 0) + 1);
      }
    }
    return { categoryCounts: catMap, locationCounts: locMap };
  }, [items]);

  // Map property items by distinct cabinet / location
  const propertyItemsByLocation = useMemo(() => {
    const map = new Map<string, PropertyItem[]>();
    
    distinctLocations.forEach(loc => map.set(loc, []));
    if (items.some(i => !i.location?.trim())) {
      map.set('General Storage / Unassigned', []);
    }

    items.forEach(item => {
      const loc = item.location?.trim() || 'General Storage / Unassigned';
      if (!map.has(loc)) {
        map.set(loc, []);
      }
      map.get(loc)!.push(item);
    });

    map.forEach((locItems) => {
      locItems.sort((a, b) => a.name.localeCompare(b.name));
    });

    return map;
  }, [items, distinctLocations]);

  const allPropertyLocationKeys = useMemo(() => {
    return Array.from(propertyItemsByLocation.keys());
  }, [propertyItemsByLocation]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    const q = deferredSearchTerm.toLowerCase().trim();
    return items.filter(item => {
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      if (selectedLocation !== 'All' && item.location !== selectedLocation) return false;
      if (selectedCondition !== 'All' && item.condition !== selectedCondition) return false;
      if (selectedFundSource !== 'All' && item.sourceOfFund !== selectedFundSource) return false;
      if (selectedType !== 'All' && item.inventoryType !== selectedType) return false;
      if (!q) return true;

      return (
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.propertyNumber && item.propertyNumber.toLowerCase().includes(q)) ||
        (item.pisCode && item.pisCode.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.custodian && item.custodian.toLowerCase().includes(q)) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.parNumber && item.parNumber.toLowerCase().includes(q)) ||
        (item.propertyNumbers && item.propertyNumbers.some(p => p && p.toLowerCase().includes(q))) ||
        (item.pisCodes && item.pisCodes.some(c => c && c.toLowerCase().includes(q)))
      );
    }).sort((a, b) => {
      let result = 0;
      if (sortField === 'name') result = a.name.localeCompare(b.name);
      else if (sortField === 'propertyNumber') result = a.propertyNumber.localeCompare(b.propertyNumber);
      else if (sortField === 'totalValue') result = (a.totalValue || 0) - (b.totalValue || 0);
      else if (sortField === 'date') result = (a.acquisitionDate || '').localeCompare(b.acquisitionDate || '');
      return sortAsc ? result : -result;
    });
  }, [items, deferredSearchTerm, selectedCategory, selectedLocation, selectedCondition, selectedFundSource, selectedType, sortField, sortAsc]);

  // Filtered Items specifically for DepEd Inventory Report by location/cabinet and report search
  const reportFilteredItems = useMemo(() => {
    const q = deferredReportSearchTerm.toLowerCase().trim();
    const locLower = reportLocation.trim().toLowerCase();
    const isAllLoc = reportLocation === 'All';

    return items.filter(item => {
      if (!isAllLoc && (item.location || '').trim().toLowerCase() !== locLower) return false;
      if (!q) return true;
      return (
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.propertyNumber && item.propertyNumber.toLowerCase().includes(q)) ||
        (item.pisCode && item.pisCode.toLowerCase().includes(q)) ||
        (item.serialNumber && item.serialNumber.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.custodian && item.custodian.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.propertyNumbers && item.propertyNumbers.some(p => p && p.toLowerCase().includes(q)))
      );
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, reportLocation, deferredReportSearchTerm]);

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

  // Distinct property summaries for name-based export
  const distinctPropertySummaries = useMemo(() => {
    const map = new Map<string, { name: string; category: string; count: number; totalValue: number }>();
    items.forEach(i => {
      const trimmed = (i.name || '').trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      const existing = map.get(lower);
      const val = (i.unitValue || 0) * (i.quantity || 1);
      if (existing) {
        existing.count += (i.quantity || 1);
        existing.totalValue += val;
      } else {
        map.set(lower, {
          name: trimmed,
          category: i.category || 'General',
          count: i.quantity || 1,
          totalValue: val
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filteredExportProperties = useMemo(() => {
    const q = (exportByNameSearchTerm || '').trim().toLowerCase();
    if (!q) return distinctPropertySummaries;
    return distinctPropertySummaries.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }, [distinctPropertySummaries, exportByNameSearchTerm]);

  // Export handlers
  const handleExportByName = useCallback(async (propertyName: string) => {
    try {
      await exportPropertyByNameExcel(propertyName, items);
      toast.success(`Exported Excel file for "${propertyName}"`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export Excel');
    }
  }, [items]);

  const handleExportAll = useCallback(async () => {
    try {
      await exportPropertyFullExcel(items);
      toast.success(`Exported all ${items.length} property items to Excel`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export Excel');
    }
  }, [items]);

  const handleExportFiltered = useCallback(async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      await exportPropertyFullExcel(filteredItems, `LNHS_Property_Filtered_${date}.xlsx`, 'Filtered Registry');
      toast.success(`Exported ${filteredItems.length} filtered items to Excel`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export Excel');
    }
  }, [filteredItems]);

  // Handlers
  const handleSaveItem = async (item: PropertyItem) => {
    const res = await propertyStorage.savePropertyItem(item);
    if (res.success) {
      await loadData(false);
      setIsFormOpen(false);
      setEditingItem(undefined);
      toast.success('Property asset record saved successfully.', 'Property Saved');
    } else {
      toast.error(res.message || 'Failed to save property item to cloud database.', 'Save Failed');
    }
  };

  const handleSaveItemsBulk = async (itemsList: PropertyItem[]) => {
    const res = await propertyStorage.savePropertyItemsBulk(itemsList);
    if (res.success) {
      await loadData(false);
      setIsFormOpen(false);
      setEditingItem(undefined);
      toast.success(`${itemsList.length} property items registered successfully.`, 'Batch Registration');
    } else {
      toast.error(res.message || 'Failed to save batch property items.', 'Batch Save Failed');
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
          toast.info(`Cloud delete notice: ${res.message}`, 'Notice');
        } else {
          toast.info(`"${name}" has been removed.`, 'Property Deleted');
        }
        await loadData(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleDeleteBulk = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Selected Properties',
      message: `Permanently delete ${count} selected property asset records from cloud database?`,
      onConfirm: async () => {
        const res = await propertyStorage.deletePropertyItemsBulk(Array.from(selectedIds));
        if (res && !res.success && res.message) {
          toast.info(`Cloud bulk delete notice: ${res.message}`, 'Notice');
        } else {
          toast.info(`${count} property records removed.`, 'Bulk Deleted');
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

  const handlePrintCabinetList = (targetLocation: string = selectedPrintCabinetLocation, pageBreak: boolean = printPageBreakPerCabinet) => {
    const printWindow = window.open('', '', 'height=850,width=800');
    if (!printWindow) return;

    const locationsToPrint: string[] = targetLocation === 'All'
      ? allPropertyLocationKeys
      : [targetLocation];

    const isSingle = locationsToPrint.length === 1;
    const singleLocName = isSingle ? locationsToPrint[0] : '';
    const totalEquipmentArticles = locationsToPrint.reduce((acc, loc) => {
      const locItems = propertyItemsByLocation.get(loc) || [];
      return acc + groupItemsByName(locItems).length;
    }, 0);
    const totalEquipmentUnits = locationsToPrint.reduce((acc, loc) => {
      const locItems = propertyItemsByLocation.get(loc) || [];
      return acc + locItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    }, 0);

    const docTitle = isSingle
      ? `Property Cabinet Inventory - ${singleLocName} - Leon NHS Science Lab`
      : `Property Cabinet Inventory List - All Locations - Leon NHS Science Lab`;

    const escape = (str?: string) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const headerHtml = (locName?: string) => `
      <div class="deped-header">
        <div class="header-main-row">
          <div class="header-side-logo left-logo-box">
            <img src="${window.location.origin}/img/Lab-Logo.png" class="header-logo-img lab-logo-img" alt="Jang Yeong-Sil Science Laboratory" />
          </div>
          <div class="header-side-logo right-logo-box">
            <img src="${window.location.origin}/img/Tri-Logo.png" class="header-logo-img tri-logo-img" alt="Leon NHS Science Department" />
          </div>
        </div>
        <div class="doc-title">PHYSICAL INVENTORY LIST PER CABINET / STORAGE LOCATION</div>
        ${locName ? `<div class="cabinet-scope-pill">STORAGE LOCATION: ${escape(locName)}</div>` : ''}
      </div>
    `;

    let contentHtml = '';

    if (!pageBreak || isSingle) {
      contentHtml += headerHtml(isSingle ? singleLocName : 'ALL PROPERTY CABINETS & STORAGE LOCATIONS');
      contentHtml += `
        <div class="print-meta-bar">
          <div><strong>Scope:</strong> ${isSingle ? escape(singleLocName) : `All Cabinets (${locationsToPrint.length} Locations)`}</div>
          <div><strong>Total Articles:</strong> ${totalEquipmentArticles} | <strong>Total Physical Units:</strong> ${totalEquipmentUnits}</div>
          <div><strong>Date Checked:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      `;
    }

    locationsToPrint.forEach((locKey, index) => {
      const locItems = propertyItemsByLocation.get(locKey) || [];
      const cabinetQty = locItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      const isLast = index === locationsToPrint.length - 1;

      const groupedCabinetItems = groupItemsByName(locItems);

      let sectionHtml = '';
      if (pageBreak && !isSingle) {
        sectionHtml += headerHtml(locKey);
        sectionHtml += `
          <div class="print-meta-bar">
            <div><strong>Location:</strong> ${escape(locKey)}</div>
            <div><strong>Articles:</strong> ${groupedCabinetItems.length} | <strong>Units:</strong> ${cabinetQty}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        `;
      }

      sectionHtml += `
        <div class="cabinet-block ${pageBreak && !isLast ? 'page-break-after' : ''}">
          <div class="cabinet-banner">
            <span class="cabinet-title">LOCATION: ${escape(locKey).toUpperCase()}</span>
            <span class="cabinet-meta">${groupedCabinetItems.length} Equipment Articles • ${cabinetQty} Total Units</span>
          </div>

          <table class="inventory-table">
            <thead>
              <tr>
                <th style="width: 5%; text-align: center;">#</th>
                <th style="width: 22%;">Property / PIS Tag</th>
                <th style="width: 36%;">Equipment / Apparatus Description</th>
                <th style="width: 17%;">Category</th>
                <th style="width: 8%; text-align: center;">Qty</th>
                <th style="width: 12%; text-align: center;">Condition</th>
              </tr>
            </thead>
            <tbody>
              ${groupedCabinetItems.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 16px; color: #64748b; font-style: italic;">
                    No property equipment currently listed in this cabinet / storage location.
                  </td>
                </tr>
              ` : groupedCabinetItems.map((group, groupIdx) => {
                const primary = group.items[0];
                const qty = group.totalQty;
                const unit = primary.unit || 'unit';

                // Format Property Numbers compactly without repeating individual numbers
                const propNums = group.items.map(i => i.propertyNumber).filter(Boolean);
                let propDisplay = '';
                if (propNums.length <= 1) {
                  propDisplay = escape(propNums[0] || primary.propertyNumber);
                } else {
                  const first = propNums[0];
                  const last = propNums[propNums.length - 1];
                  const firstParts = first.split('-');
                  const lastParts = last.split('-');
                  const firstLastNum = firstParts[firstParts.length - 1];
                  const lastLastNum = lastParts[lastParts.length - 1];
                  if (firstParts.slice(0, -1).join('-') === lastParts.slice(0, -1).join('-')) {
                    propDisplay = `${escape(first)} to ${escape(lastLastNum)} <span style="font-size: 7pt; color: #64748b;">(${propNums.length} units)</span>`;
                  } else {
                    propDisplay = `${escape(first)} <span style="font-size: 7pt; color: #64748b;">(+${propNums.length - 1} units)</span>`;
                  }
                }

                // Format PIS Tags
                const pisCodes = group.items.map(i => i.pisCode).filter(Boolean) as string[];
                let pisDisplay = '';
                if (pisCodes.length === 1) {
                  pisDisplay = `<div style="display: inline-block; font-family: monospace; font-weight: 800; font-size: 7pt; background: #fffbeb; color: #92400e; border: 1px solid #d97706; padding: 0 4px; border-radius: 2px; margin-top: 2px;">${escape(pisCodes[0])}</div>`;
                } else if (pisCodes.length > 1) {
                  const firstPis = pisCodes[0];
                  const lastPis = pisCodes[pisCodes.length - 1];
                  const lastPisSuffix = lastPis.split('-').pop();
                  pisDisplay = `<div style="display: inline-block; font-family: monospace; font-weight: 800; font-size: 7pt; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; padding: 0 4px; border-radius: 2px; margin-top: 2px;">${pisCodes.length} PIS Tags (${escape(firstPis)} … ${escape(lastPisSuffix)})</div>`;
                }

                // Condition summary
                const condCounts: Record<string, number> = {};
                group.items.forEach(it => {
                  const c = it.condition || 'Serviceable';
                  condCounts[c] = (condCounts[c] || 0) + (Number(it.quantity) || 1);
                });
                const condStr = Object.entries(condCounts)
                  .map(([c, count]) => count === group.totalQty ? c : `${count} ${c}`)
                  .join(', ');

                return `
                  <tr>
                    <td style="text-align: center; color: #475569; font-weight: bold;">${groupIdx + 1}</td>
                    <td>
                      <div style="font-family: monospace; font-weight: bold; color: #1e3a8a; font-size: 8pt;">${propDisplay}</div>
                      ${pisDisplay}
                    </td>
                    <td>
                      <div class="item-name" style="font-size: 9pt;">${escape(group.name)}</div>
                      ${primary.description ? `<div class="item-desc">${escape(primary.description)}</div>` : ''}
                      ${primary.serialNumber && group.items.length === 1 ? `<div style="font-family: monospace; font-size: 7pt; color: #64748b; margin-top: 1px;">SN: ${escape(primary.serialNumber)}</div>` : ''}
                    </td>
                    <td class="item-cat">${escape(primary.category || 'General Property')}</td>
                    <td style="text-align: center;" class="item-qty">
                      <div style="font-size: 10pt; font-weight: 900; color: #0f172a;">${qty}</div>
                      <div style="font-size: 7pt; font-weight: bold; color: #64748b; text-transform: uppercase;">${escape(unit)}</div>
                    </td>
                    <td style="text-align: center;" class="item-cond">${escape(condStr || 'Serviceable')}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <tr class="cabinet-total-row">
                <td colspan="4" style="text-align: right; font-weight: bold; text-transform: uppercase;">
                  Cabinet Subtotal (${escape(locKey)}):
                </td>
                <td style="text-align: center; font-weight: 800; font-size: 10.5pt; color: #1e3a8a;">
                  ${cabinetQty}
                </td>
                <td style="text-align: center; font-size: 8pt; color: #475569;">
                  ${groupedCabinetItems.length} article${groupedCabinetItems.length === 1 ? '' : 's'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;

      contentHtml += sectionHtml;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <base href="${window.location.origin}/">
        <title>${escape(docTitle)}</title>
        <style>
          @page {
            size: portrait;
            margin: 14mm 12mm 14mm 12mm;
            @top-left {
              content: "LEON NATIONAL HIGH SCHOOL • SCIENCE LABORATORY PROPERTY";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              color: #1e3a8a;
            }
            @top-right {
              content: "Page " counter(page) " of " counter(pages);
              font-family: Arial, Helvetica, sans-serif;
              font-size: 7.5pt;
              font-weight: 700;
              color: #1e3a8a;
            }
            @bottom-left {
              content: "I-LEMS • Property Inventory Posting Sheet (Equipment & Physical Quantity)";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 7pt;
              color: #64748b;
            }
            @bottom-right {
              content: "Printed: ${new Date().toLocaleDateString('en-PH')}";
              font-family: Arial, Helvetica, sans-serif;
              font-size: 7pt;
              color: #64748b;
            }
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            color: #111827;
            font-size: 9pt;
            line-height: 1.3;
          }
          .deped-header {
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 6px;
            margin-bottom: 8px;
            text-align: center;
          }
          .header-main-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 4px;
          }
          .header-side-logo {
            display: flex;
            align-items: center;
            flex-shrink: 0;
          }
          .left-logo-box {
            justify-content: flex-start;
            width: 140px;
          }
          .right-logo-box {
            justify-content: flex-end;
            width: 150px;
          }
          .header-logo-img {
            max-width: 100%;
            height: auto;
            object-fit: contain;
            display: block;
          }
          .lab-logo-img {
            max-height: 52px;
          }
          .tri-logo-img {
            max-height: 48px;
          }
          .header-center-text {
            flex: 1;
            text-align: center;
            min-width: 0;
          }
          .deped-sub { font-size: 7.5pt; color: #4b5563; line-height: 1.2; }
          .deped-dept { font-size: 9pt; font-weight: bold; color: #1e3a8a; margin: 1px 0; line-height: 1.2; }
          .deped-div { font-size: 7pt; color: #4b5563; line-height: 1.2; }
          .school-name { font-size: 11.5pt; font-weight: 900; color: #991b1b; margin: 1.5px 0; letter-spacing: 0.5px; }
          .lab-sub { font-size: 7.5pt; font-weight: 700; color: #1e3a8a; letter-spacing: 0.3px; }
          .doc-title { font-size: 10pt; font-weight: 800; text-transform: uppercase; color: #111827; margin: 4px 0 2px 0; }
          .cabinet-scope-pill {
            display: inline-block;
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
            padding: 2px 10px;
            border-radius: 4px;
            font-size: 9pt;
            font-weight: 800;
            margin-top: 3px;
            text-transform: uppercase;
          }
          .print-meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 8.5pt;
            background: #f8fafc;
            padding: 5px 8px;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            margin-bottom: 10px;
          }
          .cabinet-block {
            margin-bottom: 18px;
          }
          .page-break-after {
            page-break-after: always;
            break-after: page;
          }
          .cabinet-banner {
            background: #1e3a8a;
            color: #ffffff;
            padding: 5px 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 4px 4px 0 0;
            font-size: 9pt;
            font-weight: bold;
            page-break-after: avoid;
            break-after: avoid;
          }
          .cabinet-title {
            letter-spacing: 0.5px;
          }
          .cabinet-meta {
            font-size: 8pt;
            font-weight: normal;
            opacity: 0.95;
          }
          .inventory-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
            margin-bottom: 10px;
          }
          .inventory-table thead {
            display: table-header-group;
          }
          .inventory-table tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .inventory-table tfoot {
            display: table-footer-group;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .inventory-table th, .inventory-table td {
            border: 1px solid #94a3b8;
            padding: 4px 6px;
            vertical-align: middle;
          }
          .inventory-table th {
            background-color: #f1f5f9;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 7.5pt;
            color: #334155;
            letter-spacing: 0.3px;
          }
          .inventory-table tr:nth-child(even) td {
            background-color: #f8fafc;
          }
          .item-name {
            font-weight: 700;
            color: #0f172a;
          }
          .item-desc {
            font-size: 7.5pt;
            color: #475569;
            margin-top: 1px;
          }
          .item-cat {
            font-size: 8pt;
            color: #334155;
          }
          .item-qty {
            font-size: 9.5pt;
            font-weight: 800;
            color: #0f172a;
          }
          .item-cond {
            font-size: 8pt;
            color: #334155;
          }
          .cabinet-total-row {
            background-color: #f1f5f9 !important;
          }
          .signoff-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 14px;
            padding-top: 8px;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .signoff-cell {
            font-size: 8pt;
          }
          .signoff-role {
            font-weight: 700;
            color: #334155;
            margin-bottom: 24px;
          }
          .signoff-line {
            color: #64748b;
            font-weight: bold;
          }
          .signoff-label {
            font-size: 7.5pt;
            color: #475569;
            margin-top: 2px;
          }
          .signoff-date {
            font-size: 7.5pt;
            color: #64748b;
            margin-top: 3px;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        ${contentHtml}
        <script>
          window.onload = function() {
            var images = document.images;
            var total = images.length;
            var loaded = 0;
            function triggerPrint() {
              setTimeout(function() {
                window.print();
              }, 300);
            }
            if (!total) {
              triggerPrint();
            } else {
              for (var i = 0; i < total; i++) {
                if (images[i].complete) {
                  loaded++;
                  if (loaded === total) triggerPrint();
                } else {
                  images[i].addEventListener('load', function() {
                    loaded++;
                    if (loaded === total) triggerPrint();
                  });
                  images[i].addEventListener('error', function() {
                    loaded++;
                    if (loaded === total) triggerPrint();
                  });
                }
              }
            }
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Stable Callbacks for Memoized Rows and Cards
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleLinkPIS = useCallback((item: PropertyItem) => {
    setInitialEncoderPisCode(propertyStorage.generateNextPISCode(items));
    setEditingItem(item);
    setIsFormOpen(true);
  }, [items]);

  const handlePrintSticker = useCallback((item: PropertyItem) => {
    setStickerItem(item);
  }, []);

  const handlePrintCable = useCallback((code: string) => {
    setTargetCablePropertyCode(code);
    setIsCableStickerOpen(true);
  }, []);

  const handleEdit = useCallback((item: PropertyItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  }, []);

  const handleDelete = useCallback((id: string, name: string) => {
    handleDeleteItem(id, name);
  }, []);

  // Helper to group properties of the same name together for category sub-sections
  const groupItemsByName = (list: PropertyItem[]) => {
    const map = new Map<string, {
      key: string;
      name: string;
      items: PropertyItem[];
      totalQty: number;
      totalValue: number;
      locations: string[];
      custodians: string[];
      hasMultiple: boolean;
    }>();

    list.forEach(item => {
      const rawName = (item.name || 'Unnamed Property').trim();
      const key = rawName.toLowerCase();

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: rawName,
          items: [],
          totalQty: 0,
          totalValue: 0,
          locations: [],
          custodians: [],
          hasMultiple: false,
        });
      }

      const entry = map.get(key)!;
      entry.items.push(item);
      entry.totalQty += (item.quantity || 1);
      entry.totalValue += (item.totalValue || (item.quantity || 1) * (item.unitValue || 0));

      if (item.location?.trim() && !entry.locations.includes(item.location.trim())) {
        entry.locations.push(item.location.trim());
      }
      if (item.custodian?.trim() && !entry.custodians.includes(item.custodian.trim())) {
        entry.custodians.push(item.custodian.trim());
      }
    });

    const result: {
      key: string;
      name: string;
      items: PropertyItem[];
      totalQty: number;
      totalValue: number;
      locations: string[];
      custodians: string[];
      hasMultiple: boolean;
    }[] = [];

    map.forEach(entry => {
      entry.items.sort((a, b) =>
        (a.propertyNumber || '').localeCompare(b.propertyNumber || '', undefined, { numeric: true })
      );
      entry.hasMultiple = entry.items.length > 1;
      result.push(entry);
    });

    return result;
  };

  // Group filtered items by category for collapsible view with pre-computed metrics and nameGroups
  const categoriesGrouped = useMemo(() => {
    const map = new Map<string, PropertyItem[]>();

    // Standard category order
    propertyStorage.PROPERTY_CATEGORIES.forEach(cat => {
      map.set(cat, []);
    });

    for (const item of filteredItems) {
      const cat = item.category || 'General Property';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(item);
    }

    const result: {
      category: string;
      items: PropertyItem[];
      nameGroups: ReturnType<typeof groupItemsByName>;
      totalValue: number;
      totalQty: number;
      serviceableCount: number;
      repairCount: number;
      unserviceableCount: number;
    }[] = [];

    map.forEach((catItems, category) => {
      if (catItems.length > 0) {
        let totalValue = 0;
        let totalQty = 0;
        let serviceableCount = 0;
        let repairCount = 0;
        let unserviceableCount = 0;

        for (const it of catItems) {
          totalValue += (it.totalValue || it.quantity * it.unitValue);
          totalQty += it.quantity;
          if (it.condition === 'Serviceable') serviceableCount++;
          else if (it.condition === 'Needs Repair') repairCount++;
          else unserviceableCount++;
        }

        const nameGroups = groupItemsByName(catItems);

        result.push({
          category,
          items: catItems,
          nameGroups,
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

  const totalFlatPages = Math.ceil(filteredItems.length / itemsPerPage) || 1;
  const paginatedFlatItems = useMemo(() => {
    const start = (flatPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, flatPage, itemsPerPage]);

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
    const allGroupKeys = new Set<string>();
    items.forEach(it => {
      const key = (it.name || '').trim().toLowerCase();
      if (key) allGroupKeys.add(key);
    });
    setExpandedNameGroups(allGroupKeys);
  };

  const handleCollapseAll = () => {
    setCollapsedCategories(new Set(categoriesGrouped.map(c => c.category)));
    setExpandedNameGroups(new Set());
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
  const renderTable = (itemsList: PropertyItem[], showCategoryCol = true, precomputedGroups?: ReturnType<typeof groupItemsByName>) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-gray-50 text-gray-600 border-b border-gray-200 uppercase font-bold text-[10px] tracking-wider">
          <tr>
            <th className="px-2 py-2 w-9 text-center">
              <input
                type="checkbox"
                checked={itemsList.length > 0 && itemsList.every(i => selectedIds.has(i.id))}
                onChange={() => toggleSelectCategory(itemsList)}
                className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
            </th>
            <th className="px-2.5 py-2 whitespace-nowrap">PIS Sticker Tag</th>
            <th className="px-2.5 py-2 cursor-pointer whitespace-nowrap" onClick={() => { setSortField('propertyNumber'); setSortAsc(!sortAsc); }}>
              Property Code
            </th>
            <th className="px-2.5 py-2 cursor-pointer" onClick={() => { setSortField('name'); setSortAsc(!sortAsc); }}>
              Article / Property Name
            </th>
            {showCategoryCol && <th className="px-2.5 py-2 whitespace-nowrap">Category</th>}
            <th className="px-2 py-2 text-center whitespace-nowrap">Qty</th>
            <th className="px-2.5 py-2 whitespace-nowrap">Location</th>
            <th className="px-2.5 py-2 whitespace-nowrap">Custodian</th>
            <th className="px-2.5 py-2 text-center whitespace-nowrap">Condition</th>
            <th className="px-2.5 py-2 text-right whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {(() => {
            if (!groupSameNames) {
              return itemsList.map(item => (
                <PropertyTableRow
                  key={item.id}
                  item={item}
                  showCategoryCol={showCategoryCol}
                  isGroupChild={false}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={handleToggleSelect}
                  onLinkPIS={handleLinkPIS}
                  onPrintSticker={handlePrintSticker}
                  onPrintCable={handlePrintCable}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onExportExcel={handleExportByName}
                  onBorrow={onBorrow}
                />
              ));
            }

            const groups = precomputedGroups || groupItemsByName(itemsList);
            return groups.map(group => {
              const isGroupExpanded = expandedNameGroups.has(group.key);
              const allGroupSelected = group.items.every(i => selectedIds.has(i.id));
              const someGroupSelected = group.items.some(i => selectedIds.has(i.id));

              return (
                <React.Fragment key={`subgroup-${group.key}`}>
                  {/* Category Sub-Header Banner for Same-Named Properties */}
                  <tr className="bg-slate-100/95 hover:bg-slate-200/90 border-y border-slate-300 font-medium transition-colors select-none">
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={allGroupSelected}
                        ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected; }}
                        onChange={() => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (allGroupSelected) {
                              group.items.forEach(it => next.delete(it.id));
                            } else {
                              group.items.forEach(it => next.add(it.id));
                            }
                            return next;
                          });
                        }}
                        className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
                        title={`Select all ${group.items.length} ${group.items.length === 1 ? 'unit' : 'units'} of ${group.name}`}
                      />
                    </td>
                    <td colSpan={showCategoryCol ? 9 : 8} className="px-2.5 py-1.5">
                      <div
                        className="flex items-center justify-between gap-3 cursor-pointer"
                        onClick={() => {
                          setExpandedNameGroups(prev => {
                            const next = new Set(prev);
                            if (next.has(group.key)) next.delete(group.key);
                            else next.add(group.key);
                            return next;
                          });
                        }}
                      >
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedNameGroups(prev => {
                                const next = new Set(prev);
                                if (next.has(group.key)) next.delete(group.key);
                                else next.add(group.key);
                                return next;
                              });
                            }}
                            className="p-0.5 -ml-1 text-gray-500 hover:text-blue-700 transition-transform duration-150 cursor-pointer"
                            title={isGroupExpanded ? 'Collapse units' : 'Expand units'}
                          >
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-150 ${isGroupExpanded ? 'rotate-90 text-blue-600' : ''}`} />
                          </button>

                          <span className="font-extrabold text-blue-950 text-xs uppercase tracking-tight flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            {group.name}
                          </span>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-300">
                            {group.items.length} {group.items.length === 1 ? 'item' : 'items'} ({group.totalQty} {group.totalQty === 1 ? 'unit' : 'units'})
                          </span>

                          {/* PIS Tags preview */}
                          <span className="text-[10px] font-mono text-gray-600 hidden md:inline-flex items-center gap-1">
                            <span className="text-gray-400">PIS:</span>
                            <span className="font-bold text-gray-800">
                              {group.items.map(i => i.pisCode).filter(Boolean).slice(0, 4).join(', ')}
                              {group.items.filter(i => i.pisCode).length > 4 ? ` +${group.items.filter(i => i.pisCode).length - 4} more` : ''}
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 text-xs flex-shrink-0">
                          {group.locations.length > 0 && (
                            <span className="text-gray-500 hidden lg:inline text-[11px]">
                              Loc: <strong className="text-gray-700">{group.locations.join(', ')}</strong>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExportByName(group.name);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded shadow-2xs transition-colors cursor-pointer"
                            title={`Export all ${group.items.length} ${group.items.length === 1 ? 'unit' : 'units'} of "${group.name}" to Excel (.xlsx)`}
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Export Excel</span>
                          </button>
                          <span className="text-[10.5px] text-blue-600 font-bold hover:underline">
                            {isGroupExpanded ? 'Collapse' : 'Expand Units'}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* Individual unit rows */}
                  {isGroupExpanded && group.items.map((item, idx) => (
                    <PropertyTableRow
                      key={item.id}
                      item={item}
                      showCategoryCol={showCategoryCol}
                      isGroupChild={true}
                      unitIndex={idx + 1}
                      totalGroupUnits={group.items.length}
                      isSelected={selectedIds.has(item.id)}
                      onToggleSelect={handleToggleSelect}
                      onLinkPIS={handleLinkPIS}
                      onPrintSticker={handlePrintSticker}
                      onPrintCable={handlePrintCable}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onExportExcel={handleExportByName}
                      onBorrow={onBorrow}
                    />
                  ))}
                </React.Fragment>
              );
            });
          })()}
        </tbody>
      </table>
    </div>
  );

  // Reusable Cards View for category groups or flat list
  const renderCards = (itemsList: PropertyItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {itemsList.map(item => (
        <PropertyCard
          key={item.id}
          item={item}
          onPrintSticker={handlePrintSticker}
          onPrintCable={handlePrintCable}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onExportExcel={handleExportByName}
          onBorrow={onBorrow}
        />
      ))}
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
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-md group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Tag className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-sm">
              {stats.totalAssets > 0 ? Math.round((items.filter(i => i.pisCode).length / stats.totalAssets) * 100) : 0}% Tagged
            </span>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">PIS Tagged Assets</p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-gray-800 mt-1">
            {items.filter(i => i.pisCode).length}
          </h3>
          <p className="text-[11px] text-gray-500 mt-1">Units carrying physical barcode tags</p>
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
          <div className="flex items-center space-x-1 sm:space-x-2 flex-wrap gap-y-1">
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
              <span>Inventory Analytics</span>
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

        {/* Action Tools Toolbar (Row 2) - Cleanly Grouped */}
        <div className="px-4 py-3 md:px-6 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
          {/* Group 1: Physical Sticker Operations & Encoding */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider hidden sm:inline-flex items-center gap-1 mr-1">
              <Tag className="w-3.5 h-3.5 text-amber-600" />
              Stickers:
            </span>

            <button
              onClick={() => setIsBatchPISOpen(true)}
              title="Generate official yellow PIS Stickers on A4 sheet (Full A4 Page Consumption, 0.5&quot; margins)"
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-gray-950 font-bold rounded-md text-xs transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Tag className="w-3.5 h-3.5 text-gray-900" />
              <span>PIS Stickers (A4)</span>
            </button>

            <button
              onClick={() => {
                setTargetCablePropertyCode(undefined);
                setIsCableStickerOpen(true);
              }}
              title="Generate wrap-around Cable Peripheral PIS Tags on A4 sheet (Full A4 Sheet, 0.5&quot; margins)"
              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold rounded-md text-xs transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Cable className="w-3.5 h-3.5 text-amber-800" />
              <span>Cable Tags</span>
            </button>

            <button
              onClick={() => {
                setInitialEncoderPisCode(undefined);
                setIsQuickEncoderOpen(true);
              }}
              title="Scan or enter PIS sticker code to index property"
              className="px-3 py-1.5 bg-white hover:bg-amber-50 text-amber-900 border border-amber-300 font-semibold rounded-md text-xs transition-colors shadow-2xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Encode by PIS</span>
            </button>
          </div>

          {/* Group 2: Reporting, Exports, and Bulk Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteBulk}
                className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-md text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}

            <button
              onClick={() => handleOpenPrintCabinetModal(selectedLocation)}
              title="Print plain list of equipment and quantity per location/cabinet on portrait paper"
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-700" />
              <span>Cabinet List</span>
            </button>

            <button
              onClick={handleTriggerPrintReport}
              title="Print official inventory report (Preview in Modal & Print)"
              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-gray-500" />
              <span>DepEd Report</span>
            </button>

            {/* Export to Excel Dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportMenuOpen(prev => !prev)}
                title="Export properties to Excel (.xlsx)"
                className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export Excel</span>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isExportMenuOpen && (
                <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    Export Excel (.xlsx)
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsExportMenuOpen(false);
                      await handleExportAll();
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between cursor-pointer"
                  >
                    <span className="font-medium">Export All Properties</span>
                    <span className="text-[10px] text-gray-400 font-mono">({items.length} units)</span>
                  </button>
                  {deferredSearchTerm && (
                    <button
                      type="button"
                      onClick={async () => {
                        setIsExportMenuOpen(false);
                        await handleExportFiltered();
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium">Export Filtered Results</span>
                      <span className="text-[10px] text-gray-400 font-mono">({filteredItems.length} units)</span>
                    </button>
                  )}
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      setIsExportByNameModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-indigo-700 hover:bg-indigo-50 font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Export by Property Name...</span>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              title="Bulk import property items or download spreadsheet templates"
              className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-md text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs whitespace-nowrap cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-gray-500" />
              <span>Bulk Import / Download</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Property Registry */}
        <div className={activeTab === 'registry' ? 'p-4 md:p-6 space-y-3.5' : 'hidden'}>
            {/* Search and Primary Filters Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
              {/* Search input with deferred query for 60fps responsiveness */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by property tag, name, serial no, location, custodian..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-9 py-2 text-xs md:text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="w-full md:w-56 flex-shrink-0">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white truncate"
                >
                  <option value="All">All Categories ({items.length})</option>
                  {propertyStorage.PROPERTY_CATEGORIES.map(cat => {
                    const count = categoryCounts.get(cat) || 0;
                    return <option key={cat} value={cat}>{cat} ({count})</option>;
                  })}
                </select>
              </div>

              {/* Location Filter */}
              <div className="w-full md:w-48 flex-shrink-0">
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white truncate"
                  title="Filter by property location / cabinet"
                >
                  <option value="All">All Locations ({items.length})</option>
                  {distinctLocations.map(loc => {
                    const count = locationCounts.get(loc) || 0;
                    return <option key={loc} value={loc}>{loc} ({count})</option>;
                  })}
                </select>
              </div>

              {/* Condition Filter */}
              <div className="w-full md:w-40 flex-shrink-0">
                <select
                  value={selectedCondition}
                  onChange={(e) => setSelectedCondition(e.target.value)}
                  className="w-full px-3 py-2 text-xs md:text-sm border border-gray-300 rounded-md font-medium focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white truncate"
                >
                  <option value="All">All Conditions</option>
                  <option value="Serviceable">Serviceable</option>
                  <option value="Needs Repair">Needs Repair</option>
                  <option value="Unserviceable">Unserviceable</option>
                  <option value="For Condemnation">For Condemnation</option>
                  <option value="Disposed">Disposed</option>
                </select>
              </div>
            </div>

            {/* Quick Filters Strip & View Mode Controls Bar */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pt-1 border-t border-gray-100 text-xs">
              {/* Classification Quick Filter Pills & Fund */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-gray-400 font-semibold uppercase text-[10px] flex items-center gap-1 flex-shrink-0">
                  <Filter className="w-3 h-3" /> Class:
                </span>
                {['All', 'Semi-Expendable', 'Capital Outlay', 'Donated'].map(t => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`px-2.5 py-1 rounded-sm font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedType === t
                        ? 'bg-blue-100 text-blue-800 border border-blue-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}

                <span className="text-gray-400 font-semibold uppercase text-[10px] ml-2 flex-shrink-0">Fund:</span>
                <select
                  value={selectedFundSource}
                  onChange={(e) => setSelectedFundSource(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 rounded-sm bg-white font-medium text-gray-700 focus:outline-none"
                >
                  <option value="All">All Funds</option>
                  {propertyStorage.FUND_SOURCES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>

                <span className="text-gray-400 text-xs ml-2 whitespace-nowrap hidden sm:inline">
                  (<strong>{filteredItems.length}</strong> of {items.length} records)
                </span>
              </div>

              {/* View Grouping, Layout & Sorting Controls */}
              <div className="flex items-center justify-start lg:justify-end gap-2 flex-wrap flex-shrink-0">
                {/* Grouping Toggle */}
                <div className="flex border border-gray-300 rounded-sm p-0.5 bg-gray-50">
                  <button
                    onClick={() => setViewGrouping('category')}
                    title="Collapsible Category Groups"
                    className={`px-2.5 py-1 text-xs font-bold rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
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
                    className={`px-2.5 py-1 text-xs font-bold rounded-sm flex items-center gap-1.5 transition-colors cursor-pointer ${
                      viewGrouping === 'flat'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                    <span>Flat</span>
                  </button>
                </div>

                {/* Group Same Name Properties Toggle */}
                <button
                  onClick={() => setGroupSameNames(!groupSameNames)}
                  title={groupSameNames ? 'Categorizing properties of the same name together (Click to view individual rows)' : 'Click to categorize properties of the same name together'}
                  className={`px-2.5 py-1 border rounded-sm text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    groupSameNames
                      ? 'bg-blue-50 text-blue-900 border-blue-300'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 ${groupSameNames ? 'text-blue-600' : 'text-gray-400'}`} />
                  <span>Group Same Names</span>
                </button>

                {/* Expand / Collapse All (In Category Grouping or Same-Name Grouping) */}
                {(viewGrouping === 'category' || groupSameNames) && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={handleExpandAll}
                      title="Expand all sections and grouped properties"
                      className="px-2 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-colors cursor-pointer"
                    >
                      Expand
                    </button>
                    <button
                      onClick={handleCollapseAll}
                      title="Collapse all sections and grouped properties"
                      className="px-2 py-1 border border-gray-300 rounded-sm bg-white hover:bg-gray-50 text-[11px] font-bold text-gray-700 transition-colors cursor-pointer"
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
                    className={`p-1.5 rounded-sm cursor-pointer ${viewMode === 'table' ? 'bg-white shadow-xs text-blue-700 font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('cards')}
                    title="Visual Card Grid View"
                    className={`p-1.5 rounded-sm cursor-pointer ${viewMode === 'cards' ? 'bg-white shadow-xs text-blue-700 font-bold' : 'text-gray-500 hover:text-gray-800'}`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sort Order */}
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  title={`Sort ${sortAsc ? 'Ascending' : 'Descending'}`}
                  className="p-1.5 border border-gray-300 rounded-sm bg-gray-50 hover:bg-gray-100 text-gray-600 cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </div>
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
                        </div>
                      </div>

                      {/* Category Items View */}
                      {!isCollapsed && (
                        <div>
                          {viewMode === 'table' ? (
                            renderTable(group.items, false, group.nameGroups)
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
              /* Flat List View with Clean Pagination */
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-md bg-white shadow-xs overflow-hidden">
                  {viewMode === 'table' ? renderTable(paginatedFlatItems, true) : (
                    <div className="p-4 bg-gray-50/30">
                      {renderCards(paginatedFlatItems)}
                    </div>
                  )}

                  {/* Pagination Controls Bar */}
                  {filteredItems.length > itemsPerPage && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
                      <div>
                        Showing <strong className="text-gray-900 font-bold">{(flatPage - 1) * itemsPerPage + 1}</strong> to{' '}
                        <strong className="text-gray-900 font-bold">{Math.min(flatPage * itemsPerPage, filteredItems.length)}</strong> of{' '}
                        <strong className="text-gray-900 font-bold">{filteredItems.length}</strong> items
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setFlatPage(1)}
                          disabled={flatPage === 1}
                          className="px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs transition-colors cursor-pointer"
                        >
                          First
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlatPage(p => Math.max(1, p - 1))}
                          disabled={flatPage === 1}
                          className="px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs transition-colors cursor-pointer"
                        >
                          Prev
                        </button>
                        <span className="px-3 py-1 font-bold text-gray-700 bg-gray-200/70 rounded">
                          {flatPage} / {totalFlatPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setFlatPage(p => Math.min(totalFlatPages, p + 1))}
                          disabled={flatPage === totalFlatPages}
                          className="px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs transition-colors cursor-pointer"
                        >
                          Next
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlatPage(totalFlatPages)}
                          disabled={flatPage === totalFlatPages}
                          className="px-2.5 py-1 border border-gray-300 rounded bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs transition-colors cursor-pointer"
                        >
                          Last
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        {/* Tab 2: DepEd Inventory Report Preview */}
        <div className={activeTab === 'reports' ? 'p-4 md:p-8 space-y-6' : 'hidden'}>
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
                    onClick={async () => {
                      const locName = reportLocation === 'All' ? 'All_Locations' : reportLocation.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
                      const date = new Date().toISOString().split('T')[0];
                      await exportPropertyFullExcel(reportFilteredItems, `LNHS_Property_Location_${locName}_${date}.xlsx`, reportLocation === 'All' ? 'All Locations' : reportLocation);
                      toast.success(`Exported ${reportFilteredItems.length} items to Excel`);
                    }}
                    className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-sm text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs cursor-pointer"
                    title="Export currently filtered location report to formatted Excel (.xlsx)"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Export Location Excel</span>
                  </button>

                  <button
                    onClick={() => propertyStorage.exportPropertyCSV(reportFilteredItems)}
                    className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-sm text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
                    title="Export currently filtered location report to Excel/CSV"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Location CSV</span>
                  </button>

                  <button
                    onClick={() => handleOpenPrintCabinetModal(reportLocation)}
                    className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-sm text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
                    title="Print plain list of equipment and quantity per location/cabinet on portrait paper"
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-700" />
                    <span>Print Cabinet List (Portrait)</span>
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
                              const count = locationCounts.get(loc.trim().toLowerCase()) || 0;
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
                      className="w-full pl-8 pr-7 py-1.5 text-xs bg-white text-gray-900 rounded-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs font-medium"
                    />
                    {reportSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setReportSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                        title="Clear search"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
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
                  const count = locationCounts.get(loc.trim().toLowerCase()) || 0;
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
                    onClick={async () => {
                      const locName = reportLocation === 'All' ? 'All_Locations' : reportLocation.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
                      const date = new Date().toISOString().split('T')[0];
                      await exportPropertyFullExcel(reportFilteredItems, `LNHS_Property_Location_${locName}_${date}.xlsx`, reportLocation === 'All' ? 'All Locations' : reportLocation);
                      toast.success(`Exported ${reportFilteredItems.length} items to Excel`);
                    }}
                    className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                    <span>Export Location Excel</span>
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

        {/* Tab 3: Analytics */}
        {activeTab === 'analytics' && (
          <div className="p-4 md:p-8 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Distribution Bar Chart */}
              <Card className="p-5 border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-gray-800 text-sm">Equipment Distribution by Category (Units)</h4>
                  <span className="text-xs text-gray-400">Total: {stats.totalQuantity} Units</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.countByCategory || []}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                      <XAxis type="number" />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                      <RechartsTooltip formatter={(val: any) => [`${Number(val)} units`, 'Quantity']} />
                      <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]}>
                        {(stats.countByCategory || []).map((_, index) => (
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
                  <span className="text-xs text-gray-400">{stats.totalAssets} Articles ({stats.totalQuantity} Units)</span>
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
                  <h4 className="font-bold text-gray-800 text-sm">Equipment by Source of Fund (Units)</h4>
                  <span className="text-xs text-gray-400">DCP, MOOE, PTA, SEF</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(stats.countByFundSource || []).map((fund, idx) => (
                    <div key={fund.name} className="p-4 bg-gray-50 rounded-md border border-gray-200">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }}></span>
                        <span className="text-xs font-bold text-gray-800 truncate" title={fund.name}>{fund.name}</span>
                      </div>
                      <p className="text-lg font-black text-gray-900 mt-1">
                        {fund.value} {fund.value === 1 ? 'unit' : 'units'}
                      </p>
                      <span className="text-[10px] text-gray-400">
                        {stats.totalQuantity > 0 ? ((fund.value / stats.totalQuantity) * 100).toFixed(1) : 0}% of school assets
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
          onSubmitBulk={handleSaveItemsBulk}
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
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
        >
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
                                      <div className="flex items-center gap-2.5">
                                        {item.imageUrl ? (
                                          <div className="w-8 h-8 rounded-md border border-gray-200 bg-white overflow-hidden flex-shrink-0 shadow-2xs">
                                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                          </div>
                                        ) : (
                                          <div className="w-8 h-8 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 text-gray-400">
                                            <Building2 className="w-4 h-4 text-gray-400" />
                                          </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                          <div className="font-semibold text-gray-900">{item.name}</div>
                                          {item.description && <div className="text-[11px] text-gray-500 line-clamp-1">{item.description}</div>}
                                        </div>
                                      </div>
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
                                <div className="flex items-center gap-2.5">
                                  {item.imageUrl ? (
                                    <div className="w-8 h-8 rounded-md border border-gray-200 bg-white overflow-hidden flex-shrink-0 shadow-2xs">
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center flex-shrink-0 text-gray-400">
                                      <Building2 className="w-4 h-4 text-gray-400" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-gray-900">{item.name}</div>
                                    {item.description && <div className="text-[11px] text-gray-500 line-clamp-1">{item.description}</div>}
                                  </div>
                                </div>
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

      {isPrintCabinetModalOpen && (() => {
        const previewLocationName = selectedPrintCabinetLocation === 'All'
          ? (allPropertyLocationKeys[0] || 'General Storage / Unassigned')
          : selectedPrintCabinetLocation;
        const previewItems = propertyItemsByLocation.get(previewLocationName) || [];
        const previewGroups = groupItemsByName(previewItems);
        const previewTotalQty = previewItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
        const totalEquipmentArticles = (selectedPrintCabinetLocation === 'All' ? allPropertyLocationKeys : [selectedPrintCabinetLocation])
          .reduce((acc, loc) => {
            const locItems = propertyItemsByLocation.get(loc) || [];
            return acc + groupItemsByName(locItems).length;
          }, 0);
        const totalEquipmentUnits = (selectedPrintCabinetLocation === 'All' ? allPropertyLocationKeys : [selectedPrintCabinetLocation])
          .reduce((acc, loc) => {
            const locItems = propertyItemsByLocation.get(loc) || [];
            return acc + locItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
          }, 0);

        return (
          <div
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white rounded-lg shadow-2xl border border-gray-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="px-5 py-4 bg-blue-900 text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-md border border-white/20">
                    <Printer className="w-5 h-5 text-blue-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base sm:text-lg">Print Property Cabinet / Location Inventory</h3>
                      <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-blue-400/20 text-blue-200 border border-blue-400/30">
                        Portrait Paper
                      </span>
                    </div>
                    <p className="text-xs text-blue-200 mt-0.5">
                      Plain list of equipment and quantity per cabinet — formatted for cabinet door posting & physical audit
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPrintCabinetModalOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-gray-50/70">
                {/* Print Settings Card */}
                <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Location Selection */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-700" />
                        Target Cabinet / Storage Location
                      </label>
                      <select
                        value={selectedPrintCabinetLocation}
                        onChange={(e) => setSelectedPrintCabinetLocation(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                      >
                        <option value="All">
                          All Cabinets & Locations ({allPropertyLocationKeys.length} locations • {items.length} items)
                        </option>
                        {allPropertyLocationKeys.map((loc) => {
                          const count = propertyItemsByLocation.get(loc)?.length || 0;
                          const units = (propertyItemsByLocation.get(loc) || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
                          return (
                            <option key={loc} value={loc}>
                              {loc} ({count} articles • {units} units)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Options / Scope info */}
                    <div className="flex flex-col justify-end">
                      {selectedPrintCabinetLocation === 'All' ? (
                        <label className="flex items-start gap-2.5 p-2.5 rounded-md border border-blue-200 bg-blue-50/60 cursor-pointer hover:bg-blue-50 transition-colors">
                          <input
                            type="checkbox"
                            checked={printPageBreakPerCabinet}
                            onChange={(e) => setPrintPageBreakPerCabinet(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-blue-950 block">Start each cabinet on a new page</span>
                            <span className="text-blue-800 text-[11px] leading-tight block mt-0.5">
                              Inserts a page break after each cabinet. Recommended for printing individual cabinet door posting sheets.
                            </span>
                          </div>
                        </label>
                      ) : (
                        <div className="p-2.5 rounded-md border border-gray-200 bg-gray-50 text-xs">
                          <span className="font-bold text-gray-900 block">Single Cabinet Print Mode</span>
                          <span className="text-gray-600 text-[11px] block mt-0.5">
                            Generating 1 physical inventory sheet specifically for <strong>{selectedPrintCabinetLocation}</strong>.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-600 gap-2">
                    <div className="flex items-center gap-4">
                      <span>Scope: <strong className="text-gray-900">{selectedPrintCabinetLocation === 'All' ? `All ${allPropertyLocationKeys.length} Cabinets` : selectedPrintCabinetLocation}</strong></span>
                      <span>Total Articles: <strong className="text-blue-700">{totalEquipmentArticles}</strong></span>
                      <span>Total Units: <strong className="text-indigo-700">{totalEquipmentUnits}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-800 font-medium">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Paper: Standard Portrait (8.5 × 11 / A4)
                    </div>
                  </div>
                </div>

                {/* Portrait Sheet Preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-600 px-1">
                    <span className="font-bold flex items-center gap-1.5 text-gray-800 uppercase tracking-wide text-[11px]">
                      <Eye className="w-3.5 h-3.5 text-blue-700" />
                      Portrait Sheet Print Preview
                    </span>
                    {selectedPrintCabinetLocation === 'All' && (
                      <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-medium">
                        Showing sample for 1st cabinet ({previewLocationName}). All {allPropertyLocationKeys.length} cabinets will print.
                      </span>
                    )}
                  </div>

                  {/* Simulated Paper Sheet */}
                  <div className="bg-white border border-gray-300 shadow-md rounded-sm p-6 sm:p-8 max-w-2xl mx-auto text-xs text-gray-900 font-sans">
                    {/* Header */}
                    <div className="border-b-2 border-blue-900 pb-2 mb-3">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        {/* Left Logo: Lab-Logo.png */}
                        <div className="flex items-center justify-start">
                          <img
                            src="/img/Lab-Logo.png"
                            alt="Jang Yeong-Sil Science Laboratory Logo"
                            className="h-11 sm:h-13 w-auto object-contain"
                          />
                        </div>

                        {/* Right Logo: Tri-Logo.png */}
                        <div className="flex items-center justify-end">
                          <img
                            src="/img/Tri-Logo.png"
                            alt="Leon NHS Science Department Logo"
                            className="h-10 sm:h-12 w-auto object-contain"
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-xs font-extrabold uppercase text-gray-900 mt-1">PHYSICAL INVENTORY LIST PER CABINET / STORAGE LOCATION</div>
                        <div className="inline-block bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase mt-1">
                          STORAGE LOCATION: {previewLocationName}
                        </div>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-[11px] mb-3 text-gray-600">
                      <div>Location: <strong className="text-gray-900">{previewLocationName}</strong></div>
                      <div>Count: <strong className="text-gray-900">{previewGroups.length} articles • {previewTotalQty} units</strong></div>
                      <div>Date: <strong className="text-gray-900">{new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</strong></div>
                    </div>

                    {/* Cabinet Table */}
                    <div className="border border-gray-300 rounded overflow-hidden mb-3">
                      <div className="bg-blue-900 text-white px-2.5 py-1 text-[11px] font-bold flex justify-between items-center">
                        <span>LOCATION: {previewLocationName.toUpperCase()}</span>
                        <span className="font-normal opacity-90 text-[10px]">{previewGroups.length} equipment types • {previewTotalQty} units</span>
                      </div>
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
                          <tr>
                            <th className="p-1.5 text-center w-8 border-r border-gray-200">#</th>
                            <th className="p-1.5 border-r border-gray-200 w-32">Property / PIS Tag</th>
                            <th className="p-1.5 border-r border-gray-200">Equipment / Apparatus Description</th>
                            <th className="p-1.5 border-r border-gray-200 w-24">Category</th>
                            <th className="p-1.5 text-center w-14 border-r border-gray-200">Qty</th>
                            <th className="p-1.5 text-center w-16">Condition</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {previewGroups.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-gray-400 italic">
                                No property equipment currently assigned to this location.
                              </td>
                            </tr>
                          ) : (
                            previewGroups.slice(0, 10).map((group, idx) => {
                              const primary = group.items[0];
                              const propNums = group.items.map(i => i.propertyNumber).filter(Boolean);
                              let propDisplay = '';
                              if (propNums.length <= 1) {
                                propDisplay = propNums[0] || primary.propertyNumber;
                              } else {
                                const first = propNums[0];
                                const last = propNums[propNums.length - 1];
                                const lastSuffix = last.split('-').pop();
                                propDisplay = `${first} to ${lastSuffix} (${propNums.length} units)`;
                              }
                              const pisCodes = group.items.map(i => i.pisCode).filter(Boolean) as string[];

                              return (
                                <tr key={group.key} className="hover:bg-gray-50/50">
                                  <td className="p-1.5 text-center font-bold text-gray-500 border-r border-gray-200">{idx + 1}</td>
                                  <td className="p-1.5 border-r border-gray-200">
                                    <div className="font-mono font-bold text-blue-900 text-[10px] leading-tight">{propDisplay}</div>
                                    {pisCodes.length === 1 && (
                                      <span className="inline-block font-mono font-bold text-[9px] bg-yellow-100 text-yellow-900 px-1 rounded border border-yellow-300 mt-0.5">
                                        {pisCodes[0]}
                                      </span>
                                    )}
                                    {pisCodes.length > 1 && (
                                      <span className="inline-block font-mono font-bold text-[9px] bg-blue-50 text-blue-800 px-1 rounded border border-blue-200 mt-0.5">
                                        {pisCodes.length} PIS Tags
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-1.5 border-r border-gray-200">
                                    <div className="font-semibold text-gray-900 leading-tight">{group.name}</div>
                                    {primary.description && (
                                      <div className="text-[10px] text-gray-500 line-clamp-1">{primary.description}</div>
                                    )}
                                  </td>
                                  <td className="p-1.5 text-gray-600 border-r border-gray-200 text-[10px]">{primary.category}</td>
                                  <td className="p-1.5 text-center font-bold text-blue-900 border-r border-gray-200 whitespace-nowrap">
                                    {group.totalQty} {primary.unit || 'unit'}
                                  </td>
                                  <td className="p-1.5 text-center text-[10px] text-gray-700">{primary.condition}</td>
                                </tr>
                              );
                            })
                          )}
                          {previewGroups.length > 10 && (
                            <tr className="bg-gray-50 text-gray-500 italic text-[10px]">
                              <td colSpan={6} className="p-1.5 text-center">
                                ... and {previewGroups.length - 10} more equipment articles in this cabinet (all will be printed on full page)
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                          <tr>
                            <td colSpan={4} className="p-1.5 text-right uppercase text-[10px]">Cabinet Subtotal:</td>
                            <td className="p-1.5 text-center text-blue-900 font-extrabold">{previewTotalQty}</td>
                            <td className="p-1.5 text-center text-[10px] text-gray-500">{previewGroups.length} articles</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3.5 bg-gray-100 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                <div className="text-xs text-gray-500 text-center sm:text-left">
                  Portrait print opens directly in system print dialog with clean printer-optimized layout.
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => setIsPrintCabinetModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handlePrintCabinetList(selectedPrintCabinetLocation, printPageBreakPerCabinet);
                      setIsPrintCabinetModalOpen(false);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-sm text-sm font-bold flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Cabinet List (Portrait)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Export Property by Name Modal */}
      {isExportByNameModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-150">
          <div className="relative w-full max-w-xl max-h-[90vh] md:max-h-[92vh] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-white flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 tracking-tight">
                    Export Property by Name (.xlsx)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Download an official Excel sheet containing all units of a specific equipment or article.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportByNameModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/60">
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search property names (e.g. Microscope, Acer Laptop, Table)..."
                  value={exportByNameSearchTerm}
                  onChange={(e) => setExportByNameSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs md:text-sm border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  autoFocus
                />
                {exportByNameSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setExportByNameSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    title="Clear"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status bar */}
              <div className="text-[11px] font-semibold text-gray-500 flex items-center justify-between px-1">
                <span>
                  Showing {filteredExportProperties.length} of {distinctPropertySummaries.length} property names ({items.length} total units)
                </span>
                <span>Click Export to download .xlsx</span>
              </div>

              {/* Property list */}
              <div className="border border-gray-200 rounded-md divide-y divide-gray-100 bg-white max-h-[50vh] overflow-y-auto shadow-2xs">
                {filteredExportProperties.length === 0 ? (
                  <div className="p-8 text-center text-xs text-gray-500">
                    No properties match &quot;{exportByNameSearchTerm}&quot;
                  </div>
                ) : (
                  filteredExportProperties.map((prop) => (
                    <div
                      key={prop.name}
                      className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-xs md:text-sm truncate">
                            {prop.name}
                          </span>
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded">
                            {prop.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          <span><strong>{prop.count}</strong> {prop.count === 1 ? 'unit' : 'units'} registered</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await handleExportByName(prop.name);
                        }}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors flex-shrink-0 cursor-pointer"
                        title={`Download Excel sheet for "${prop.name}"`}
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Export Excel</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-white flex items-center justify-between gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setIsExportByNameModalOpen(false);
                  await handleExportAll();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 border border-gray-300 rounded transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Export All Properties ({items.length} units)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExportByNameModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <BulkInventoryModal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        type="property"
        propertyItems={items}
        onSuccess={async () => {
          const fresh = await propertyStorage.getPropertyItems();
          setItems(fresh);
          if (onRefreshParent) onRefreshParent();
        }}
      />
    </div>
  );
};

export default PropertyManagement;
