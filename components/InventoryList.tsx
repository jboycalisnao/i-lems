
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { InventoryItem, ItemCondition, Category } from '../types';
import { 
  Edit2, Trash2, QrCode, Search, Filter, Barcode, FileText, List, 
  Printer, AlertTriangle, XCircle, Clipboard, ChevronDown, ChevronRight, 
  Package, LayoutGrid, Droplets, Minus, Paperclip, MapPin, Microscope,
  X, Layers, Eye
} from 'lucide-react';
import { getCategoryColor, getCategoryIcon } from '../constants';
import { SYSTEM_NAME } from '../branding';
import * as storage from '../services/storageService';
import ItemFileManagerModal from './ItemFileManagerModal';

interface InventoryListProps {
  items: InventoryItem[];
  categories: Category[];
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onShowQR: (item: InventoryItem) => void;
  onPrintBarcodes: (item: InventoryItem) => void;
  onConsume?: (item: InventoryItem) => void;
  initialSearchTerm?: string;
  onRefresh?: () => void;
}

const stripMetadata = (text: string) => {
    if (!text) return '';
    return text.replace(/<!--SYSTEM_META:.*?-->/g, '').trim();
};

const InventoryList: React.FC<InventoryListProps> = ({ 
  items, 
  categories, 
  onEdit, 
  onDelete, 
  onShowQR, 
  onPrintBarcodes, 
  onConsume, 
  initialSearchTerm,
  onRefresh
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const routeTab = location.pathname.split('/').filter(Boolean)[1];
  const activeTab: 'list' | 'report' = routeTab === 'report' ? 'report' : 'list';
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterLocation, setFilterLocation] = useState<string>('All');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [managingFilesItem, setManagingFilesItem] = useState<InventoryItem | null>(null);

  // Print plain equipment & quantity list per cabinet state
  const [isPrintLocationModalOpen, setIsPrintLocationModalOpen] = useState(false);
  const [selectedPrintLocation, setSelectedPrintLocation] = useState<string>('All');
  const [printPageBreakPerCabinet, setPrintPageBreakPerCabinet] = useState(true);

  // Close print location modal on Escape key
  useEffect(() => {
    if (!isPrintLocationModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsPrintLocationModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPrintLocationModalOpen]);

  const handleOpenPrintLocationModal = (initialLoc?: string) => {
    setSelectedPrintLocation(initialLoc && initialLoc !== 'All' ? initialLoc : 'All');
    setIsPrintLocationModalOpen(true);
  };

  // Handle Initial Search Term (e.g. from Deep Link)
  useEffect(() => {
      if (initialSearchTerm) {
          setSearchTerm(initialSearchTerm);
      }
  }, [initialSearchTerm]);

  useEffect(() => {
      if (routeTab !== 'list' && routeTab !== 'report') {
          navigate('/inventory/list', { replace: true });
      }
  }, [navigate, routeTab]);

  // Distinct locations from inventory items
  const distinctLocations = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.location?.trim()) set.add(i.location.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [items]);

  // Map items by distinct cabinet / location
  const itemsByLocation = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    
    distinctLocations.forEach(loc => map.set(loc, []));
    if (items.some(i => !i.location?.trim())) {
      map.set('Unassigned / General Storage', []);
    }

    items.forEach(item => {
      const loc = item.location?.trim() || 'Unassigned / General Storage';
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

  const allLocationKeys = useMemo(() => {
    return Array.from(itemsByLocation.keys());
  }, [itemsByLocation]);

  // --- Filtering Logic ---
  const filteredItems = useMemo(() => {
      return items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (item.shortId && item.shortId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            item.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = filterCategory === 'All' || item.category === filterCategory;
        const matchesLocation = filterLocation === 'All' || item.location === filterLocation;
        return matchesSearch && matchesCategory && matchesLocation;
      });
  }, [items, searchTerm, filterCategory, filterLocation]);

  // --- Grouping Logic ---
  const groupedItems = useMemo(() => {
      const groups: Record<string, InventoryItem[]> = {};
      
      filteredItems.forEach(item => {
          if (!groups[item.category]) groups[item.category] = [];
          groups[item.category].push(item);
      });
      return groups;
  }, [filteredItems]);

  // Auto-expand categories when search changes
  useEffect(() => {
      if (searchTerm.trim().length > 0) {
          const visibleCategories = Object.keys(groupedItems);
          setExpandedCategories(new Set(visibleCategories));
      }
  }, [groupedItems, searchTerm]);

  const toggleCategory = (category: string) => {
      const newSet = new Set(expandedCategories);
      if (newSet.has(category)) {
          newSet.delete(category);
      } else {
          newSet.add(category);
      }
      setExpandedCategories(newSet);
  };

  // --- Report Logic ---
  const reportData = useMemo(() => {
      const totalItems = items.length;
      const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
      const totalBorrowed = items.reduce((sum, i) => sum + (i.borrowedQuantity || 0), 0);
      
      const byCategory = categories.map(cat => {
          const catItems = items.filter(i => i.category === cat.name);
          return {
              name: cat.name,
              count: catItems.length,
              qty: catItems.reduce((sum, i) => sum + i.quantity, 0),
              borrowed: catItems.reduce((sum, i) => sum + (i.borrowedQuantity || 0), 0)
          };
      }).filter(c => c.count > 0);

      const knownCats = new Set(categories.map(c => c.name));
      const otherItems = items.filter(i => !knownCats.has(i.category));
      if (otherItems.length > 0) {
          byCategory.push({
              name: 'Uncategorized',
              count: otherItems.length,
              qty: otherItems.reduce((sum, i) => sum + i.quantity, 0),
              borrowed: otherItems.reduce((sum, i) => sum + (i.borrowedQuantity || 0), 0)
          });
      }

      const byCondition = Object.values(ItemCondition).map(cond => ({
          condition: cond,
          count: items.filter(i => i.condition === cond).length
      }));

      const lowStock = items.filter(i => (i.quantity - (i.borrowedQuantity || 0)) <= 5 && i.quantity > 0);
      const unavailable = items.filter(i => i.condition === ItemCondition.Defective || i.condition === ItemCondition.Condemned);

      return { totalItems, totalQty, totalBorrowed, byCategory, byCondition, lowStock, unavailable };
  }, [items, categories]);

  const handlePrintReport = () => {
      const printWindow = window.open('', '', 'height=800,width=900');
      if (printWindow) {
          printWindow.document.write('<html><head><title>Inventory Summary Report</title>');
          printWindow.document.write(`
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #1f2937; }
                h1 { border-bottom: 3px solid #3b82f6; padding-bottom: 10px; margin-bottom: 5px; color: #111827; }
                h2 { margin-top: 30px; margin-bottom: 15px; font-size: 1.2em; border-left: 4px solid #3b82f6; padding-left: 10px; color: #374151; }
                .meta { color: #6b7280; font-size: 0.9em; margin-bottom: 30px; }
                .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; }
                .card { background: #f3f4f6; padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
                .card h3 { font-size: 2em; margin: 0; color: #111827; }
                .card p { margin: 5px 0 0; text-transform: uppercase; font-size: 0.75em; letter-spacing: 1px; color: #4b5563; }
                table { width: 100%; border-collapse: collapse; font-size: 0.9em; }
                th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
                th { background-color: #f9fafb; font-weight: 600; color: #374151; }
                tr:nth-child(even) { background-color: #f9fafb; }
            </style>
          `);
          printWindow.document.write('</head><body>');
          
          printWindow.document.write(`<h1>Inventory Summary Report</h1>`);
          printWindow.document.write(`<div class="meta">Generated on: ${new Date().toLocaleString()}</div>`);

          printWindow.document.write(`
            <div class="grid">
                <div class="card"><h3>${reportData.totalItems}</h3><p>Unique Items</p></div>
                <div class="card"><h3>${reportData.totalQty}</h3><p>Total Assets (Qty)</p></div>
                <div class="card"><h3>${reportData.totalBorrowed}</h3><p>Currently On Loan</p></div>
            </div>
          `);

          printWindow.document.write(`<h2>Category Breakdown</h2>`);
          printWindow.document.write(`<table><thead><tr><th>Category</th><th>Unique Items</th><th>Total Qty</th><th>On Loan</th></tr></thead><tbody>`);
          reportData.byCategory.forEach(cat => {
              printWindow.document.write(`<tr><td>${cat.name}</td><td>${cat.count}</td><td>${cat.qty}</td><td>${cat.borrowed}</td></tr>`);
          });
          printWindow.document.write(`</tbody></table>`);

          printWindow.document.write(`<h2>Condition Breakdown</h2>`);
          printWindow.document.write(`<table><thead><tr><th>Condition</th><th>Count</th></tr></thead><tbody>`);
          reportData.byCondition.forEach(c => {
               printWindow.document.write(`<tr><td>${c.condition}</td><td>${c.count}</td></tr>`);
          });
          printWindow.document.write(`</tbody></table>`);

          if (reportData.lowStock.length > 0) {
              printWindow.document.write(`<h2>Low Stock Alerts (< 5 available)</h2>`);
              printWindow.document.write(`<table><thead><tr><th>Item Name</th><th>Category</th><th>Available</th><th>Total</th></tr></thead><tbody>`);
              reportData.lowStock.forEach(i => {
                  const qty = Number(i.quantity);
                  const borrowed = Number(i.borrowedQuantity || 0);
                  const available = qty - borrowed;
                  printWindow.document.write(`<tr><td>${i.name}</td><td>${i.category}</td><td>${available}</td><td>${i.quantity}</td></tr>`);
              });
              printWindow.document.write(`</tbody></table>`);
          }

          printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
          printWindow.document.write('</body></html>');
          printWindow.document.close();
      }
  };

  const handlePrintWorksheet = () => {
    const printWindow = window.open('', '', 'height=800,width=900');
    if (printWindow) {
        printWindow.document.write('<html><head><title>Inventory Encoding Worksheet</title>');
        printWindow.document.write(`
          <style>
              body { font-family: 'Inter', system-ui, sans-serif; padding: 20px; color: #111827; }
              .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2005A2; padding-bottom: 10px; margin-bottom: 20px; }
              .header h1 { margin: 0; font-size: 1.5em; color: #2005A2; text-transform: uppercase; letter-spacing: 0.05em; }
              .header p { margin: 0; font-size: 0.9em; color: #6b7280; }
              table { width: 100%; border-collapse: collapse; font-size: 0.85em; }
              th, td { border: 1px solid #e5e7eb; padding: 12px 8px; text-align: left; vertical-align: top; }
              th { background-color: #f3f4f6; font-weight: 600; color: #374151; text-transform: uppercase; font-size: 0.75em; letter-spacing: 0.05em; }
              tr.empty-row td { height: 40px; }
              .footer { margin-top: 30px; font-size: 0.8em; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 10px; }
              @media print { body { padding: 0; } th { background-color: #f3f4f6 !important; -webkit-print-color-adjust: exact; } }
          </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(`
            <div class="header">
                <div><h1>Inventory Encoding Worksheet</h1><p>Science Laboratory</p></div>
                <div style="text-align: right;"><p>Date: __________________</p><p>Encoder: ________________</p></div>
            </div>
            <table>
                <thead><tr><th style="width: 25%">Item Name</th><th style="width: 15%">Category</th><th style="width: 10%">Total Qty</th><th style="width: 10%">Loan Limit*</th><th style="width: 15%">Location</th><th style="width: 10%">Condition</th><th style="width: 15%">Notes / Safety</th></tr></thead>
                <tbody>
        `);
        for(let i=0; i<20; i++) {
            printWindow.document.write(`<tr class="empty-row"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`);
        }
        printWindow.document.write(`
                </tbody>
            </table>
            <div class="footer"><p>* Loan Limit: Specify if only a portion of stock is available for borrowing.</p><p>System Generated Form • ${SYSTEM_NAME}</p></div>
        `);
        printWindow.document.write('<script>window.onload = function() { window.print(); }</script>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
    }
  };

  const handlePrintCabinetList = (targetLocation: string = selectedPrintLocation, pageBreak: boolean = printPageBreakPerCabinet) => {
    const printWindow = window.open('', '', 'height=850,width=800');
    if (!printWindow) return;

    const locationsToPrint: string[] = targetLocation === 'All' 
      ? allLocationKeys 
      : [targetLocation];

    const isSingle = locationsToPrint.length === 1;
    const singleLocName = isSingle ? locationsToPrint[0] : '';
    const totalEquipmentArticles = locationsToPrint.reduce((acc, loc) => acc + (itemsByLocation.get(loc)?.length || 0), 0);
    const totalEquipmentUnits = locationsToPrint.reduce((acc, loc) => {
      const locItems = itemsByLocation.get(loc) || [];
      return acc + locItems.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    }, 0);

    const docTitle = isSingle 
      ? `Cabinet Inventory - ${singleLocName} - Leon NHS Science Lab`
      : `Cabinet Inventory List - All Locations - Leon NHS Science Lab`;

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
        <div class="deped-sub">Republic of the Philippines</div>
        <div class="deped-dept">DEPARTMENT OF EDUCATION</div>
        <div class="deped-div">Region VI - Western Visayas • Division of Iloilo • District of Leon</div>
        <div class="school-name">LEON NATIONAL HIGH SCHOOL</div>
        <div class="lab-sub">SCIENCE LABORATORY • INVENTORY MANAGEMENT SYSTEM</div>
        <div class="doc-title">PHYSICAL INVENTORY LIST PER CABINET / STORAGE LOCATION</div>
        ${locName ? `<div class="cabinet-scope-pill">STORAGE LOCATION: ${escape(locName)}</div>` : ''}
      </div>
    `;

    let contentHtml = '';

    if (!pageBreak || isSingle) {
      contentHtml += headerHtml(isSingle ? singleLocName : 'ALL CABINETS & STORAGE LOCATIONS');
      contentHtml += `
        <div class="print-meta-bar">
          <div><strong>Scope:</strong> ${isSingle ? escape(singleLocName) : `All Cabinets (${locationsToPrint.length} Locations)`}</div>
          <div><strong>Total Articles:</strong> ${totalEquipmentArticles} | <strong>Total Physical Units:</strong> ${totalEquipmentUnits}</div>
          <div><strong>Date Checked:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>
      `;
    }

    locationsToPrint.forEach((locKey, index) => {
      const locItems = itemsByLocation.get(locKey) || [];
      const cabinetQty = locItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      const isLast = index === locationsToPrint.length - 1;

      let sectionHtml = '';
      if (pageBreak && !isSingle) {
        sectionHtml += headerHtml(locKey);
        sectionHtml += `
          <div class="print-meta-bar">
            <div><strong>Location:</strong> ${escape(locKey)}</div>
            <div><strong>Articles:</strong> ${locItems.length} | <strong>Units:</strong> ${cabinetQty}</div>
            <div><strong>Date:</strong> ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
        `;
      }

      sectionHtml += `
        <div class="cabinet-block ${pageBreak && !isLast ? 'page-break-after' : ''}">
          <div class="cabinet-banner">
            <span class="cabinet-title">LOCATION: ${escape(locKey).toUpperCase()}</span>
            <span class="cabinet-meta">${locItems.length} Equipment Articles • ${cabinetQty} Total Units</span>
          </div>

          <table class="inventory-table">
            <thead>
              <tr>
                <th style="width: 6%; text-align: center;">#</th>
                <th style="width: 50%;">Equipment / Apparatus Description</th>
                <th style="width: 22%;">Category</th>
                <th style="width: 10%; text-align: center;">Qty</th>
                <th style="width: 12%; text-align: center;">Condition</th>
              </tr>
            </thead>
            <tbody>
              ${locItems.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 16px; color: #64748b; font-style: italic;">
                    No equipment currently listed in this cabinet / storage location.
                  </td>
                </tr>
              ` : locItems.map((item, itemIdx) => `
                <tr>
                  <td style="text-align: center; color: #475569; font-weight: bold;">${itemIdx + 1}</td>
                  <td>
                    <div class="item-name">${escape(item.name)}</div>
                    ${item.description ? `<div class="item-desc">${escape(stripMetadata(item.description))}</div>` : ''}
                  </td>
                  <td class="item-cat">${escape(item.category || 'General')}</td>
                  <td style="text-align: center;" class="item-qty">${item.quantity}</td>
                  <td style="text-align: center;" class="item-cond">${escape(item.condition || 'Good')}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="cabinet-total-row">
                <td colspan="3" style="text-align: right; font-weight: bold; text-transform: uppercase;">
                  Cabinet Subtotal (${escape(locKey)}):
                </td>
                <td style="text-align: center; font-weight: 800; font-size: 11pt; color: #1e3a8a;">
                  ${cabinetQty}
                </td>
                <td style="text-align: center; font-size: 8pt; color: #475569;">
                  ${locItems.length} items
                </td>
              </tr>
            </tfoot>
          </table>

          <div class="signoff-grid">
            <div class="signoff-cell">
              <div class="signoff-role">Physical Count & Inventory Conducted by:</div>
              <div class="signoff-line">_____________________________________________</div>
              <div class="signoff-label">Science Teacher / Laboratory Custodian</div>
              <div class="signoff-date">Date Signed: _________________________________</div>
            </div>
            <div class="signoff-cell">
              <div class="signoff-role">Verified & Inspected by:</div>
              <div class="signoff-line">_____________________________________________</div>
              <div class="signoff-label">Science Department Coordinator / School Head</div>
              <div class="signoff-date">Date Signed: _________________________________</div>
            </div>
          </div>
        </div>
      `;

      contentHtml += sectionHtml;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escape(docTitle)}</title>
        <style>
          @page {
            size: portrait;
            margin: 14mm 12mm 14mm 12mm;
            @top-left {
              content: "LEON NATIONAL HIGH SCHOOL • SCIENCE LABORATORY";
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
              content: "I-LEMS • Cabinet Door Inventory Sheet (Plain Equipment & Quantity)";
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
            font-size: 9.5pt;
            line-height: 1.3;
          }
          .deped-header {
            text-align: center;
            border-bottom: 2px solid #1e3a8a;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .deped-sub { font-size: 8pt; color: #4b5563; }
          .deped-dept { font-size: 9.5pt; font-weight: bold; color: #1e3a8a; margin: 1px 0; }
          .deped-div { font-size: 7.5pt; color: #4b5563; }
          .school-name { font-size: 12pt; font-weight: 900; color: #991b1b; margin: 2px 0; letter-spacing: 0.5px; }
          .lab-sub { font-size: 8pt; font-weight: 700; color: #1e3a8a; letter-spacing: 0.3px; }
          .doc-title { font-size: 10.5pt; font-weight: 800; text-transform: uppercase; color: #111827; margin: 4px 0 2px 0; }
          .cabinet-scope-pill {
            display: inline-block;
            background: #eff6ff;
            color: #1e40af;
            border: 1px solid #bfdbfe;
            padding: 2px 10px;
            border-radius: 4px;
            font-size: 9.5pt;
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
            page-break-inside: avoid;
            break-inside: avoid;
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
            font-size: 9pt;
            margin-bottom: 10px;
          }
          .inventory-table th, .inventory-table td {
            border: 1px solid #94a3b8;
            padding: 5px 6px;
            vertical-align: middle;
          }
          .inventory-table th {
            background-color: #f1f5f9;
            font-weight: 800;
            text-transform: uppercase;
            font-size: 8pt;
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
            font-size: 8.5pt;
            color: #334155;
          }
          .item-qty {
            font-size: 10.5pt;
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
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getConditionBadge = (condition: ItemCondition) => {
    switch (condition) {
      case ItemCondition.Good: return <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium border border-green-200">Good</span>;
      case ItemCondition.Repairable: return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-medium border border-yellow-200">Repairable</span>;
      case ItemCondition.Defective: return <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-medium border border-red-200">Defective</span>;
      default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-medium border border-gray-200">{condition}</span>;
    }
  };

  const sortedCategoryKeys = useMemo(() => {
      const activeKeys = Object.keys(groupedItems);
      const orderMap = new Map<string, number>(categories.map((c, i) => [c.name, i]));
      
      return activeKeys.sort((a, b) => {
          const orderA = orderMap.get(a) ?? 999;
          const orderB = orderMap.get(b) ?? 999;
          return orderA - orderB;
      });
  }, [groupedItems, categories]);

  return (
    <div className="bg-white rounded-md shadow-xl border border-gray-200 flex flex-col h-[calc(100dvh-250px)] min-h-[420px] md:h-[calc(100vh-200px)] md:min-h-0">
      {/* Informative Banner */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border-b border-blue-200/60 px-4 py-2.5 flex items-center gap-2.5 text-xs">
        <Microscope className="w-4 h-4 text-blue-700 flex-shrink-0" />
        <div className="text-blue-950 min-w-0">
          <span className="font-bold">Laboratory Inventory (Non-PIS):</span> Equipment and supplies that do <em>not</em> carry physical property stickers — primarily glasswares, plastic containers, and consumables (gloves, filter paper, batteries, blades).
          <span className="hidden xl:inline text-blue-700 ml-1">For durable tagged assets (microscopes, triple beam balances, hot plates), check <strong>Property Inventory</strong>.</span>
        </div>
      </div>

      <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50 px-3 md:px-4 pt-3 md:pt-4 gap-1 flex-shrink-0">
          <button
            onClick={() => navigate('/inventory/list')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'list' 
                ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-sm mb-[-1px] z-10' 
                : 'text-gray-500 hover:bg-white/40 hover:text-gray-700'
            }`}
          >
            <List className="w-4 h-4" />
            Item List
          </button>
          <button
            onClick={() => navigate('/inventory/report')}
            className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'report' 
                ? 'bg-white text-blue-700 border-t border-x border-gray-200 shadow-sm mb-[-1px] z-10' 
                : 'text-gray-500 hover:bg-white/40 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4" />
            Summary Report
          </button>
      </div>

      {activeTab === 'list' && (
        <>
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-white flex-shrink-0">
                <div className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                <input
                    type="text"
                    placeholder="Search equipment, location, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-800 placeholder-gray-500 shadow-sm"
                />
                </div>
                
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <button 
                        onClick={handlePrintWorksheet}
                        className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors border border-gray-200 shadow-sm text-sm font-medium"
                        title="Print empty form for manual recording"
                    >
                        <Clipboard className="w-4 h-4" />
                        <span className="hidden sm:inline">Worksheet</span>
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-2 hidden sm:block"></div>
                    <Filter className="text-gray-500 w-4 h-4" />
                    <select 
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white text-gray-800 shadow-sm"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="All" className="bg-white text-gray-800">All Categories</option>
                        {categories.map(cat => (
                        <option key={cat.id} value={cat.name} className="bg-white text-gray-800">{cat.name}</option>
                        ))}
                    </select>

                    <MapPin className="text-gray-500 w-4 h-4 ml-1" />
                    <select 
                        className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer bg-white text-gray-800 shadow-sm"
                        value={filterLocation}
                        onChange={(e) => setFilterLocation(e.target.value)}
                        title="Filter by laboratory location / cabinet"
                    >
                        <option value="All" className="bg-white text-gray-800">All Locations ({items.length})</option>
                        {distinctLocations.map(loc => {
                          const count = items.filter(i => i.location === loc).length;
                          return (
                            <option key={loc} value={loc} className="bg-white text-gray-800">
                              {loc} ({count})
                            </option>
                          );
                        })}
                    </select>

                    <button 
                        onClick={() => handleOpenPrintLocationModal(filterLocation)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-800 rounded-md hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm text-sm font-semibold whitespace-nowrap"
                        title="Print plain equipment & quantity list per location/cabinet on portrait paper"
                    >
                        <Printer className="w-4 h-4 text-blue-700" />
                        <span className="hidden md:inline">Print Cabinet List</span>
                        <span className="md:hidden">Print</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 p-4 space-y-4">
                {filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                        <Package className="w-16 h-16 mb-4 opacity-20" />
                        <p className="text-lg font-medium">No equipment found.</p>
                        <p className="text-sm">Try adjusting your search or filters.</p>
                    </div>
                ) : (
                    sortedCategoryKeys.map(catName => {
                        const catItems = groupedItems[catName] || [];
                        if (catItems.length === 0) return null;
                        
                        const isExpanded = expandedCategories.has(catName);
                        const categoryColor = getCategoryColor(catName);

                        return (
                            <div key={catName} className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                                <div 
                                    onClick={() => toggleCategory(catName)}
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 select-none group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div 
                                            className="p-2 rounded-md border shadow-sm transition-transform group-hover:scale-105"
                                            style={{ backgroundColor: `${categoryColor}15`, borderColor: `${categoryColor}30`, color: categoryColor }}
                                        >
                                            {getCategoryIcon(catName)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                                {catName}
                                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                                    {catItems.length} items
                                                </span>
                                            </h3>
                                        </div>
                                    </div>
                                    <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-gray-50/80 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-3 w-1/4">Item Name</th>
                                                        <th className="px-6 py-3 w-1/6">Stock</th>
                                                        <th className="px-6 py-3 w-1/5">Location</th>
                                                        <th className="px-6 py-3 w-1/6">Condition</th>
                                                        <th className="px-6 py-3 text-right">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {catItems.map((item) => {
                                                        const hasLimit = item.maxBorrowable !== undefined && item.maxBorrowable !== null;
                                                        const borrowLimit = hasLimit ? Number(item.maxBorrowable!) : Number(item.quantity);
                                                        const available = Math.max(0, borrowLimit - Number(item.borrowedQuantity || 0));
                                                        const isRestricted = hasLimit && borrowLimit < Number(item.quantity);
                                                        const sanitizedDescription = stripMetadata(item.description);

                                                        return (
                                                            <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                                                                <td className="px-6 py-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="font-medium text-gray-900">{item.name}</div>
                                                                        {item.isConsumable && (
                                                                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full border border-blue-200 font-bold flex items-center gap-1" title="Consumable Item">
                                                                                <Droplets className="w-3 h-3" /> Consumable
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {item.shortId && <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.shortId}</div>}
                                                                    {sanitizedDescription && <div className="text-xs text-gray-500 truncate max-w-[180px]">{sanitizedDescription}</div>}
                                                                    {item.attachments && item.attachments.length > 0 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setManagingFilesItem(item);
                                                                            }}
                                                                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 mt-1 transition-colors"
                                                                            title="View attached DDownload files"
                                                                        >
                                                                            <Paperclip className="w-3 h-3" />
                                                                            <span>{item.attachments.length} {item.attachments.length === 1 ? 'file' : 'files'}</span>
                                                                        </button>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    <div className="flex flex-col">
                                                                        <span className={`text-sm font-medium ${available === 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                                                            {available} / {item.quantity}
                                                                        </span>
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[10px] text-gray-400">{item.unit}</span>
                                                                            {isRestricted && (
                                                                                <span className="text-[9px] px-1 rounded bg-blue-50 text-blue-600 border border-blue-100" title={`Borrowing limited to ${item.maxBorrowable} units`}>Limit</span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-3 text-sm text-gray-600">
                                                                    {item.location}
                                                                </td>
                                                                <td className="px-6 py-3">
                                                                    {getConditionBadge(item.condition)}
                                                                </td>
                                                                <td className="px-6 py-3 text-right">
                                                                    <div className="flex justify-end space-x-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                                        {item.isConsumable && onConsume && (
                                                                            <button
                                                                                onClick={() => onConsume(item)}
                                                                                className="p-1.5 rounded-md transition-colors text-gray-500 hover:text-blue-600 hover:bg-blue-50"
                                                                                title="Quick Deduct (Consumed)"
                                                                            >
                                                                                <Minus className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        
                                                                        <button 
                                                                            onClick={() => setManagingFilesItem(item)}
                                                                            className={`p-1.5 rounded-md transition-colors ${
                                                                                (item.attachments && item.attachments.length > 0)
                                                                                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                                                                    : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                                                            }`}
                                                                            title={
                                                                                item.attachments && item.attachments.length > 0
                                                                                    ? `DDownload Files (${item.attachments.length} attached)`
                                                                                    : 'Attach DDownload Files'
                                                                            }
                                                                        >
                                                                            <Paperclip className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => onPrintBarcodes(item)}
                                                                            className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                                                                            title="Print Bulk Barcodes"
                                                                        >
                                                                            <Barcode className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => onShowQR(item)}
                                                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                                            title="View QR Code"
                                                                        >
                                                                            <QrCode className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => onEdit(item)}
                                                                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors"
                                                                            title="Edit Item"
                                                                        >
                                                                            <Edit2 className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            onClick={() => onDelete(item.id)}
                                                                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                            title="Delete Item"
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
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </>
      )}

      {activeTab === 'report' && (
          <div className="flex-1 overflow-auto p-6 space-y-8 animate-in fade-in duration-300 bg-gray-50">
              <div className="flex justify-between items-start">
                  <div>
                      <h3 className="text-2xl font-bold text-gray-800">Inventory Summary</h3>
                      <p className="text-gray-500">Real-time analysis of equipment status and categories.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleOpenPrintLocationModal('All')}
                      className="flex items-center space-x-2 bg-white text-blue-700 border border-blue-300 px-4 py-2 rounded-md hover:bg-blue-50 transition-colors shadow-sm font-semibold text-sm"
                      title="Print plain list of equipment and quantity per location/cabinet on portrait paper"
                    >
                        <Layers className="w-4 h-4 text-blue-700" />
                        <span>Print Cabinet Lists (Portrait)</span>
                    </button>
                    <button 
                      onClick={handlePrintReport}
                      className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors shadow-md text-sm font-medium"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Print Report</span>
                    </button>
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white border border-gray-200 p-6 rounded-md shadow-sm text-center">
                      <div className="text-3xl font-bold text-gray-900">{reportData.totalItems}</div>
                      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mt-1">Unique Items</div>
                  </div>
                  <div className="bg-white border border-gray-200 p-6 rounded-md shadow-sm text-center">
                      <div className="text-3xl font-bold text-blue-700">{reportData.totalQty}</div>
                      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mt-1">Total Assets (Qty)</div>
                  </div>
                  <div className="bg-white border border-gray-200 p-6 rounded-md shadow-sm text-center">
                      <div className="text-3xl font-bold text-indigo-700">{reportData.totalBorrowed}</div>
                      <div className="text-xs uppercase tracking-wider text-gray-500 font-semibold mt-1">Currently On Loan</div>
                  </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                      <h4 className="font-bold text-gray-800">Breakdown by Category</h4>
                  </div>
                  <table className="w-full text-left">
                      <thead className="bg-white text-xs uppercase text-gray-500">
                          <tr>
                              <th className="px-6 py-3">Category</th>
                              <th className="px-6 py-3">Unique Items</th>
                              <th className="px-6 py-3">Total Qty</th>
                              <th className="px-6 py-3">On Loan</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                          {reportData.byCategory.map(cat => (
                              <tr key={cat.name} className="hover:bg-gray-50">
                                  <td className="px-6 py-3 font-medium text-gray-800">{cat.name}</td>
                                  <td className="px-6 py-3 text-gray-600">{cat.count}</td>
                                  <td className="px-6 py-3 text-gray-600">{cat.qty}</td>
                                  <td className="px-6 py-3 text-indigo-600">{cat.borrowed}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
                       <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                          <h4 className="font-bold text-gray-800">Low Stock Alerts</h4>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-gray-100">
                                {reportData.lowStock.length > 0 ? reportData.lowStock.map(i => {
                                    const qty = Number(i.quantity);
                                    const borrowed = Number(i.borrowedQuantity || 0);
                                    const available = qty - borrowed;
                                    return (
                                    <tr key={i.id} className="hover:bg-amber-50/30">
                                        <td className="px-6 py-3 text-sm text-gray-800">{i.name}</td>
                                        <td className="px-6 py-3 text-sm font-bold text-amber-700">
                                            {available} / {i.quantity}
                                        </td>
                                    </tr>
                                )}) : (
                                    <tr><td className="px-6 py-4 text-sm text-gray-400 text-center">No low stock items.</td></tr>
                                )}
                            </tbody>
                        </table>
                      </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-md overflow-hidden shadow-sm">
                      <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          <h4 className="font-bold text-gray-800">Defective / Condemned</h4>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left">
                            <tbody className="divide-y divide-gray-100">
                                {reportData.unavailable.length > 0 ? reportData.unavailable.map(i => (
                                    <tr key={i.id} className="hover:bg-red-50/30">
                                        <td className="px-6 py-3 text-sm text-gray-800">{i.name}</td>
                                        <td className="px-6 py-3 text-sm font-bold text-red-700">{i.condition}</td>
                                    </tr>
                                )) : (
                                    <tr><td className="px-6 py-4 text-sm text-gray-400 text-center">No defective items.</td></tr>
                                )}
                            </tbody>
                        </table>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {isPrintLocationModalOpen && (() => {
        const previewLocationName = selectedPrintLocation === 'All'
          ? (allLocationKeys[0] || 'Unassigned / General Storage')
          : selectedPrintLocation;
        const previewItems = itemsByLocation.get(previewLocationName) || [];
        const previewTotalQty = previewItems.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
        const totalEquipmentArticles = (selectedPrintLocation === 'All' ? allLocationKeys : [selectedPrintLocation])
          .reduce((acc, loc) => acc + (itemsByLocation.get(loc)?.length || 0), 0);
        const totalEquipmentUnits = (selectedPrintLocation === 'All' ? allLocationKeys : [selectedPrintLocation])
          .reduce((acc, loc) => {
            const locItems = itemsByLocation.get(loc) || [];
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
              <div className="px-5 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-md border border-white/20">
                    <Printer className="w-5 h-5 text-blue-200" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base sm:text-lg">Print Cabinet / Location Inventory</h3>
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
                  onClick={() => setIsPrintLocationModalOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white transition-colors"
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
                        value={selectedPrintLocation}
                        onChange={(e) => setSelectedPrintLocation(e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium cursor-pointer"
                      >
                        <option value="All">
                          All Cabinets & Locations ({allLocationKeys.length} locations • {items.length} items)
                        </option>
                        {allLocationKeys.map((loc) => {
                          const count = itemsByLocation.get(loc)?.length || 0;
                          const units = (itemsByLocation.get(loc) || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
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
                      {selectedPrintLocation === 'All' ? (
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
                            Generating 1 physical inventory sheet specifically for <strong>{selectedPrintLocation}</strong>.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between text-xs text-gray-600 gap-2">
                    <div className="flex items-center gap-4">
                      <span>Scope: <strong className="text-gray-900">{selectedPrintLocation === 'All' ? `All ${allLocationKeys.length} Cabinets` : selectedPrintLocation}</strong></span>
                      <span>Total Articles: <strong className="text-blue-700">{totalEquipmentArticles}</strong></span>
                      <span>Total Units: <strong className="text-indigo-700">{totalEquipmentUnits}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-blue-800 font-medium">
                      <FileText className="w-3.5 h-3.5" />
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
                    {selectedPrintLocation === 'All' && (
                      <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-medium">
                        Showing sample for 1st cabinet ({previewLocationName}). All {allLocationKeys.length} cabinets will print.
                      </span>
                    )}
                  </div>

                  {/* Simulated Paper Sheet */}
                  <div className="bg-white border border-gray-300 shadow-md rounded-sm p-6 sm:p-8 max-w-2xl mx-auto text-xs text-gray-900 font-sans">
                    {/* Header */}
                    <div className="text-center border-b-2 border-blue-900 pb-2 mb-3">
                      <div className="text-[10px] text-gray-500 leading-tight">Republic of the Philippines</div>
                      <div className="text-xs font-bold text-blue-900 leading-tight">DEPARTMENT OF EDUCATION</div>
                      <div className="text-[10px] text-gray-500 leading-tight">Region VI - Western Visayas • Division of Iloilo • District of Leon</div>
                      <div className="text-sm font-black text-red-800 tracking-wide my-0.5">LEON NATIONAL HIGH SCHOOL</div>
                      <div className="text-[10px] font-bold text-blue-900">SCIENCE LABORATORY • INVENTORY MANAGEMENT SYSTEM</div>
                      <div className="text-xs font-extrabold uppercase text-gray-900 mt-1">PHYSICAL INVENTORY LIST PER CABINET / STORAGE LOCATION</div>
                      <div className="inline-block bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase mt-1">
                        STORAGE LOCATION: {previewLocationName}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-[11px] mb-3 text-gray-600">
                      <div>Location: <strong className="text-gray-900">{previewLocationName}</strong></div>
                      <div>Count: <strong className="text-gray-900">{previewItems.length} articles • {previewTotalQty} units</strong></div>
                      <div>Date: <strong className="text-gray-900">{new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</strong></div>
                    </div>

                    {/* Cabinet Table */}
                    <div className="border border-gray-300 rounded overflow-hidden mb-3">
                      <div className="bg-blue-900 text-white px-2.5 py-1 text-[11px] font-bold flex justify-between items-center">
                        <span>LOCATION: {previewLocationName.toUpperCase()}</span>
                        <span className="font-normal opacity-90 text-[10px]">{previewItems.length} items • {previewTotalQty} units</span>
                      </div>
                      <table className="w-full text-left text-[11px] border-collapse">
                        <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
                          <tr>
                            <th className="p-1.5 text-center w-8 border-r border-gray-200">#</th>
                            <th className="p-1.5 border-r border-gray-200">Equipment / Apparatus Description</th>
                            <th className="p-1.5 border-r border-gray-200 w-28">Category</th>
                            <th className="p-1.5 text-center w-14 border-r border-gray-200">Qty</th>
                            <th className="p-1.5 text-center w-16">Condition</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {previewItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-gray-400 italic">
                                No equipment currently assigned to this location.
                              </td>
                            </tr>
                          ) : (
                            previewItems.slice(0, 8).map((item, idx) => (
                              <tr key={item.id} className="hover:bg-gray-50/50">
                                <td className="p-1.5 text-center font-bold text-gray-500 border-r border-gray-200">{idx + 1}</td>
                                <td className="p-1.5 border-r border-gray-200">
                                  <div className="font-semibold text-gray-900 leading-tight">{item.name}</div>
                                  {item.description && (
                                    <div className="text-[10px] text-gray-500 line-clamp-1">{stripMetadata(item.description)}</div>
                                  )}
                                </td>
                                <td className="p-1.5 text-gray-600 border-r border-gray-200">{item.category}</td>
                                <td className="p-1.5 text-center font-bold text-blue-900 border-r border-gray-200">{item.quantity}</td>
                                <td className="p-1.5 text-center text-[10px] text-gray-700">{item.condition}</td>
                              </tr>
                            ))
                          )}
                          {previewItems.length > 8 && (
                            <tr className="bg-gray-50 text-gray-500 italic text-[10px]">
                              <td colSpan={5} className="p-1.5 text-center">
                                ... and {previewItems.length - 8} more equipment items in this cabinet (all will be printed on full page)
                              </td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold border-t border-gray-300">
                          <tr>
                            <td colSpan={3} className="p-1.5 text-right uppercase text-[10px]">Cabinet Subtotal:</td>
                            <td className="p-1.5 text-center text-blue-900 font-extrabold">{previewTotalQty}</td>
                            <td className="p-1.5 text-center text-[10px] text-gray-500">{previewItems.length} items</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Sign-off Preview */}
                    <div className="grid grid-cols-2 gap-6 pt-3 border-t border-gray-200 text-[10px]">
                      <div>
                        <div className="font-bold text-gray-700 mb-6">Counted & Inspected by:</div>
                        <div className="border-b border-gray-400 pb-0.5"></div>
                        <div className="text-gray-500 mt-0.5">Science Teacher / Laboratory Custodian</div>
                        <div className="text-gray-400 mt-0.5">Date: ____________________</div>
                      </div>
                      <div>
                        <div className="font-bold text-gray-700 mb-6">Verified by:</div>
                        <div className="border-b border-gray-400 pb-0.5"></div>
                        <div className="text-gray-500 mt-0.5">Science Coordinator / School Head</div>
                        <div className="text-gray-400 mt-0.5">Date: ____________________</div>
                      </div>
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
                    onClick={() => setIsPrintLocationModalOpen(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      handlePrintCabinetList(selectedPrintLocation, printPageBreakPerCabinet);
                      setIsPrintLocationModalOpen(false);
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

      {managingFilesItem && (
        <ItemFileManagerModal
          item={managingFilesItem}
          onClose={() => setManagingFilesItem(null)}
          onSaveAttachments={async (updatedItem) => {
            await storage.saveItem(updatedItem);
            setManagingFilesItem(updatedItem);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
};

export default InventoryList;
