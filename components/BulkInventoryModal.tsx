import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import {
  InventoryItem,
  PropertyItem,
  Category,
  ItemCondition,
  PropertyCondition,
  PropertyInventoryType
} from '../types';
import {
  parseDelimitedText,
  parseExcelBuffer,
  downloadLaboratoryBlankTemplateExcel,
  downloadPropertyBlankTemplateExcel,
  exportLaboratoryFullExcel,
  exportPropertyFullExcel,
  exportPropertyByNameExcel,
  mapRowsToLabItems,
  mapRowsToPropertyItems
} from '../services/bulkImportService';
import { saveInventoryItemsBulk } from '../services/storageService';
import {
  savePropertyItemsBulk,
  PROPERTY_CATEGORIES,
  FUND_SOURCES,
  generateNextPropertyNumbers,
  generateNextPISCodes
} from '../services/propertyStorageService';
import { fetchRememberedLocations, getCachedLocations } from '../services/locationService';

export interface BulkInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'laboratory' | 'property';
  labItems?: InventoryItem[];
  propertyItems?: PropertyItem[];
  categories?: Category[];
  onSuccess: () => void;
}

// Editable Laboratory Row
interface EditableLabRow {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  location: string;
  condition: ItemCondition;
  description: string;
  safetyNotes: string;
  isConsumable: boolean;
}

// Editable Property Row
interface EditablePropertyRow {
  id: string;
  propertyNumber: string;
  pisCode: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitValue: number;
  location: string;
  condition: PropertyCondition;
  inventoryType: PropertyInventoryType;
  sourceOfFund: string;
  description: string;
}

const DEFAULT_LAB_CATEGORIES: string[] = [
  'Equipment',
  'Glassware',
  'Chemicals',
  'Specimens',
  'Safety',
  'Consumables',
  'General'
];

const LAB_CONDITIONS: ItemCondition[] = [
  ItemCondition.Good,
  ItemCondition.Fair,
  ItemCondition.Repairable,
  ItemCondition.Defective,
  ItemCondition.Condemned
];

const PROPERTY_CONDITIONS: PropertyCondition[] = [
  'Serviceable',
  'Needs Repair',
  'Unserviceable',
  'For Condemnation',
  'Disposed'
];

const PROPERTY_INVENTORY_TYPES: PropertyInventoryType[] = [
  'Semi-Expendable',
  'Capital Outlay',
  'Donated'
];

export const BulkInventoryModal: React.FC<BulkInventoryModalProps> = ({
  isOpen,
  onClose,
  type,
  labItems = [],
  propertyItems = [],
  categories = [],
  onSuccess
}) => {
  const [locations, setLocations] = useState<string[]>(() => getCachedLocations());
  const [labRows, setLabRows] = useState<EditableLabRow[]>([]);
  const [propertyRows, setPropertyRows] = useState<EditablePropertyRow[]>([]);
  const [selectedExportPropName, setSelectedExportPropName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Available category list
  const availableLabCategories = useMemo(() => {
    if (categories && categories.length > 0) {
      return Array.from(new Set([...categories.map(c => c.name), ...DEFAULT_LAB_CATEGORIES]));
    }
    return DEFAULT_LAB_CATEGORIES;
  }, [categories]);

  // Load locations on mount
  useEffect(() => {
    let mounted = true;
    fetchRememberedLocations().then(locs => {
      if (mounted) setLocations(locs);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setLabRows([]);
      setPropertyRows([]);
      setStatusMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Aggregate distinct lab equipment options for autocomplete
  const distinctLabEquipments = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    labItems.forEach(item => {
      const trimmed = (item.name || '').trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [labItems]);

  // Aggregate distinct property equipment options for autocomplete
  const distinctPropertyEquipments = useMemo(() => {
    const map = new Map<string, PropertyItem>();
    propertyItems.forEach(item => {
      const trimmed = (item.name || '').trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (!map.has(lower)) {
        map.set(lower, item);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [propertyItems]);

  if (!isOpen) return null;

  // File Upload Handler (Supports both .xlsx / .xls and .csv / .tsv / .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatusMessage(null);
    try {
      let rawRows: string[][] = [];

      if (/\.xlsx?$/i.test(file.name)) {
        const buffer = await file.arrayBuffer();
        rawRows = await parseExcelBuffer(buffer);
      } else {
        const text = await file.text();
        rawRows = parseDelimitedText(text);
      }

      if (rawRows.length <= 1) {
        setStatusMessage({
          type: 'error',
          text: 'The uploaded file appears to be empty or has only header rows.'
        });
        return;
      }

      if (type === 'laboratory') {
        const parsedItems = mapRowsToLabItems(rawRows);
        if (parsedItems.length === 0) {
          setStatusMessage({
            type: 'error',
            text: 'No valid laboratory items could be parsed from the file.'
          });
          return;
        }
        const newRows: EditableLabRow[] = parsedItems.map(item => ({
          id: item.id || crypto.randomUUID(),
          name: item.name || '',
          category: item.category || availableLabCategories[0] || 'General',
          quantity: item.quantity || 1,
          unit: item.unit || 'pcs',
          location: item.location || '',
          condition: item.condition || ItemCondition.Good,
          description: item.description || '',
          safetyNotes: item.safetyNotes || '',
          isConsumable: !!item.isConsumable
        }));
        setLabRows(prev => [...prev, ...newRows]);
        setStatusMessage({
          type: 'success',
          text: `Successfully parsed ${newRows.length} laboratory items. Review and adjust them below before importing.`
        });
      } else {
        const parsedItems = mapRowsToPropertyItems(rawRows, propertyItems);
        if (parsedItems.length === 0) {
          setStatusMessage({
            type: 'error',
            text: 'No valid property items could be parsed from the file.'
          });
          return;
        }
        const newRows: EditablePropertyRow[] = parsedItems.map(item => ({
          id: item.id || crypto.randomUUID(),
          propertyNumber: item.propertyNumber || '',
          pisCode: item.pisCode || '',
          name: item.name || '',
          category: item.category || PROPERTY_CATEGORIES[0] || 'Office Equipment',
          quantity: item.quantity || 1,
          unit: item.unit || 'unit',
          unitValue: item.unitValue || 0,
          location: item.location || '',
          condition: item.condition || 'Serviceable',
          inventoryType: item.inventoryType || 'Semi-Expendable',
          sourceOfFund: item.sourceOfFund || FUND_SOURCES[0] || 'DepEd DCP',
          description: item.description || ''
        }));
        setPropertyRows(prev => [...prev, ...newRows]);
        setStatusMessage({
          type: 'success',
          text: `Successfully parsed ${newRows.length} property items. Review and adjust them below before importing.`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Failed to process file: ${err?.message || 'Invalid format'}`
      });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Add Empty Row
  const handleAddRow = () => {
    if (type === 'laboratory') {
      const newRow: EditableLabRow = {
        id: crypto.randomUUID(),
        name: '',
        category: availableLabCategories[0] || 'General',
        quantity: 1,
        unit: 'pcs',
        location: locations[0] || 'Cabinet 1',
        condition: ItemCondition.Good,
        description: '',
        safetyNotes: '',
        isConsumable: false
      };
      setLabRows(prev => [...prev, newRow]);
    } else {
      const nextCodes = generateNextPropertyNumbers(
        propertyItems,
        propertyRows.length + 1,
        'Semi-Expendable',
        PROPERTY_CATEGORIES[0] || 'Science Laboratory Equipment'
      );
      const newRow: EditablePropertyRow = {
        id: crypto.randomUUID(),
        propertyNumber: nextCodes[propertyRows.length] || `LNHS-SE-SCI-${Date.now()}`,
        pisCode: '',
        name: '',
        category: PROPERTY_CATEGORIES[0] || 'Science Lab - Apparatus & Instruments',
        quantity: 1,
        unit: 'unit',
        unitValue: 0,
        location: locations[0] || 'Science Laboratory',
        condition: 'Serviceable',
        inventoryType: 'Semi-Expendable',
        sourceOfFund: FUND_SOURCES[0] || 'DepEd DCP',
        description: ''
      };
      setPropertyRows(prev => [...prev, newRow]);
    }
  };

  // Lab row update
  const updateLabRow = (id: string, updates: Partial<EditableLabRow>) => {
    setLabRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        return { ...row, ...updates };
      })
    );
  };

  // Property row update
  const updatePropertyRow = (id: string, updates: Partial<EditablePropertyRow>) => {
    setPropertyRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        return { ...row, ...updates };
      })
    );
  };

  // When equipment name is selected from database for Lab
  const handleSelectLabEquipment = (rowId: string, selectedItemName: string) => {
    const match = distinctLabEquipments.find(
      i => i.name.toLowerCase() === selectedItemName.trim().toLowerCase()
    );
    if (match) {
      updateLabRow(rowId, {
        name: match.name,
        category: match.category || 'General',
        unit: match.unit || 'pcs',
        location: match.location || '',
        condition: match.condition || ItemCondition.Good,
        description: match.description || '',
        safetyNotes: match.safetyNotes || '',
        isConsumable: !!match.isConsumable
      });
    } else {
      updateLabRow(rowId, { name: selectedItemName });
    }
  };

  // When equipment name is selected from database for Property
  const handleSelectPropertyEquipment = (rowId: string, selectedItemName: string) => {
    const match = distinctPropertyEquipments.find(
      i => i.name.toLowerCase() === selectedItemName.trim().toLowerCase()
    );
    if (match) {
      updatePropertyRow(rowId, {
        name: match.name,
        category: match.category || PROPERTY_CATEGORIES[0],
        unit: match.unit || 'unit',
        unitValue: match.unitValue || 0,
        location: match.location || '',
        condition: match.condition || 'Serviceable',
        inventoryType: match.inventoryType || 'Semi-Expendable',
        sourceOfFund: match.sourceOfFund || FUND_SOURCES[0],
        description: match.description || ''
      });
    } else {
      updatePropertyRow(rowId, { name: selectedItemName });
    }
  };

  // Submit Bulk Import
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (type === 'laboratory') {
        const validRows = labRows.filter(r => r.name.trim().length > 0);
        if (validRows.length === 0) {
          setStatusMessage({
            type: 'error',
            text: 'Please add at least one item with a valid name before importing.'
          });
          setIsSubmitting(false);
          return;
        }

        const itemsToSave: InventoryItem[] = validRows.map(row => ({
          id: row.id,
          name: row.name.trim(),
          category: row.category,
          quantity: Number(row.quantity) || 1,
          borrowedQuantity: 0,
          unit: row.unit.trim() || 'pcs',
          location: row.location.trim() || 'Unassigned',
          condition: row.condition,
          description: row.description.trim(),
          safetyNotes: row.safetyNotes.trim(),
          isConsumable: row.isConsumable,
          lastUpdated: new Date().toISOString()
        }));

        const res = await saveInventoryItemsBulk(itemsToSave);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: `Successfully imported ${res.count} laboratory inventory items!`
          });
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        } else {
          setStatusMessage({
            type: 'error',
            text: `Import failed: ${res.errors?.join(', ') || 'Unknown error'}`
          });
        }
      } else {
        const validRows = propertyRows.filter(r => r.name.trim().length > 0);
        if (validRows.length === 0) {
          setStatusMessage({
            type: 'error',
            text: 'Please add at least one property with a valid name before importing.'
          });
          setIsSubmitting(false);
          return;
        }

        const isValidUUID = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

        const itemsToSave: PropertyItem[] = validRows.map((row, idx) => {
          const cost = Number(row.unitValue) || 0;
          const qty = Number(row.quantity) || 1;
          const invType: PropertyInventoryType =
            row.inventoryType || (cost >= 50000 ? 'Capital Outlay' : 'Semi-Expendable');
          const finalId = isValidUUID(row.id) ? row.id : crypto.randomUUID();

          return {
            id: finalId,
            propertyNumber: row.propertyNumber?.trim() || `LNHS-SE-SCI-${Date.now()}-${idx + 1}`,
            pisCode: row.pisCode?.trim() || undefined,
            name: row.name.trim(),
            category: row.category,
            quantity: qty,
            unit: row.unit.trim() || 'unit',
            unitValue: cost,
            totalValue: cost * qty,
            location: row.location.trim() || 'Science Laboratory',
            custodian: 'Jeebs M. Sabidalas',
            condition: row.condition,
            inventoryType: invType,
            sourceOfFund: row.sourceOfFund || FUND_SOURCES[0],
            description: row.description.trim(),
            acquisitionDate: new Date().toISOString().split('T')[0]
          };
        });

        const res = await savePropertyItemsBulk(itemsToSave);
        if (res.success) {
          setStatusMessage({
            type: 'success',
            text: `Successfully imported ${res.count} property inventory items!`
          });
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1200);
        } else {
          setStatusMessage({
            type: 'error',
            text: `Import failed: ${res.message || 'Unknown error'}`
          });
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Import error: ${err?.message || 'Could not complete import'}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const rowCount = type === 'laboratory' ? labRows.length : propertyRows.length;
  const isLab = type === 'laboratory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] md:max-h-[92vh] overflow-hidden my-auto">
        {/* Modal Header - Institutional Light Theme */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white rounded-t-lg flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              {isLab ? 'Laboratory Inventory' : 'Property Inventory'} Bulk Import & Download
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Download templates, export existing data, or review and upload inventory items in bulk.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar / Options - 3 Institutional Cards */}
        <div className="p-4 sm:p-5 border-b border-gray-200 bg-slate-100/70 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 flex-shrink-0">
          {/* Option 1: Download Blank Template */}
          <div className="bg-white p-3.5 sm:p-4 rounded-lg border border-gray-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                <FileSpreadsheet className="w-4 h-4" />
                <h3 className="font-semibold text-sm text-gray-900">1. Blank Excel Template (.xlsx)</h3>
              </div>
              <p className="text-xs text-gray-600 mb-2.5">
                Download a formatted Excel sheet with interactive dropdowns for <strong>equipment</strong> and <strong>locations</strong> loaded directly from the database.
              </p>
            </div>
            <button
              onClick={async () => {
                if (isLab) {
                  await downloadLaboratoryBlankTemplateExcel(labItems, locations, availableLabCategories);
                } else {
                  await downloadPropertyBlankTemplateExcel(propertyItems, locations);
                }
              }}
              className="inline-flex items-center justify-center space-x-2 w-full px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50/70 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Blank Template (.xlsx)</span>
            </button>
          </div>

          {/* Option 2: Export Inventory (.xlsx) */}
          <div className="bg-white p-3.5 sm:p-4 rounded-lg border border-gray-200 shadow-2xs flex flex-col justify-between space-y-2.5">
            <div>
              <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                <FileSpreadsheet className="w-4 h-4" />
                <h3 className="font-semibold text-sm text-gray-900">2. Export to Excel (.xlsx)</h3>
              </div>
              <p className="text-xs text-gray-600 mb-2">
                Export all currently saved items, or select a specific property name to download its dedicated Excel sheet.
              </p>

              {/* Specific Property Name Selection */}
              {!isLab && distinctPropertyEquipments.length > 0 && (
                <div className="mt-2 p-2 bg-slate-50 border border-slate-200 rounded">
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">
                    Export by Property Name:
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedExportPropName}
                      onChange={(e) => setSelectedExportPropName(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 text-xs bg-white border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500 text-gray-800"
                    >
                      <option value="">-- Choose Property ({distinctPropertyEquipments.length}) --</option>
                      {distinctPropertyEquipments.map(item => {
                        const count = propertyItems.filter(i => (i.name || '').trim().toLowerCase() === item.name.toLowerCase()).length;
                        return (
                          <option key={item.name} value={item.name}>
                            {item.name} ({count} {count === 1 ? 'unit' : 'units'})
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedExportPropName}
                      onClick={async () => {
                        if (!selectedExportPropName) return;
                        await exportPropertyByNameExcel(selectedExportPropName, propertyItems);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1"
                      title="Export units of selected property to Excel"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={async () => {
                if (isLab) await exportLaboratoryFullExcel(labItems);
                else await exportPropertyFullExcel(propertyItems);
              }}
              className="inline-flex items-center justify-center space-x-2 w-full px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export All Current Items ({isLab ? labItems.length : propertyItems.length})</span>
            </button>
          </div>

          {/* Option 3: Upload Spreadsheet */}
          <div className="bg-white p-3.5 sm:p-4 rounded-lg border border-gray-200 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-indigo-700 mb-1">
                <Upload className="w-4 h-4" />
                <h3 className="font-semibold text-sm text-gray-900">3. Upload Spreadsheet</h3>
              </div>
              <p className="text-xs text-gray-600 mb-2.5">
                Import completed Excel (.xlsx) or CSV files. Rows will populate the interactive review table below.
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .tsv, .txt"
                onChange={handleFileUpload}
                className="hidden"
                id="bulk-import-file-input"
              />
              <label
                htmlFor="bulk-import-file-input"
                className="inline-flex items-center justify-center space-x-2 w-full px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 cursor-pointer transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose Excel / CSV File</span>
              </label>
            </div>
          </div>
        </div>

        {/* Status Notification */}
        {statusMessage && (
          <div
            className={`mx-4 sm:mx-6 mt-3 p-2.5 sm:p-3 rounded text-xs flex items-center space-x-2 flex-shrink-0 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Interactive Data Table Area */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 bg-slate-50/60">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">
                Review & Edit Items ({rowCount})
              </h4>
              <p className="text-[11px] text-gray-500">
                You can edit any cell directly, pick equipment/location from dropdowns, or add new rows manually.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
              {rowCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (isLab) setLabRows([]);
                    else setPropertyRows([]);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-gray-400" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {rowCount === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg py-8 px-6 text-center bg-white shadow-2xs">
              <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-sm font-semibold text-gray-800">No items in the review table yet</p>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-4">
                Upload a completed Excel or CSV template above, or click &quot;Add Row&quot; to manually enter items with instant equipment and location suggestions.
              </p>
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add First Row</span>
              </button>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white shadow-2xs">
              {isLab ? (
                /* LABORATORY TABLE */
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5 min-w-[200px]">Item / Equipment Name <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[140px]">Category <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 w-20">Qty <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 w-20">Unit <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[160px]">Location / Cabinet <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[130px]">Condition <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[180px]">Description / Specs</th>
                      <th className="p-2.5 min-w-[140px]">Safety Notes</th>
                      <th className="p-2.5 w-20 text-center">Consumable</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {labRows.map((row, index) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="p-2 text-center text-gray-400 font-mono text-[11px]">
                          {index + 1}
                        </td>
                        {/* Equipment Name Combobox */}
                        <td className="p-2">
                          <input
                            type="text"
                            list={`lab-items-datalist-${row.id}`}
                            value={row.name}
                            onChange={(e) => handleSelectLabEquipment(row.id, e.target.value)}
                            placeholder="Type or select equipment..."
                            className={`w-full px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              !row.name.trim() ? 'border-amber-300 bg-amber-50/30' : 'border-gray-300'
                            }`}
                          />
                          <datalist id={`lab-items-datalist-${row.id}`}>
                            {distinctLabEquipments.map(item => (
                              <option key={item.id} value={item.name}>
                                {item.category} • {item.location || 'No location'}
                              </option>
                            ))}
                          </datalist>
                        </td>
                        {/* Category */}
                        <td className="p-2">
                          <select
                            value={row.category}
                            onChange={(e) => updateLabRow(row.id, { category: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            {availableLabCategories.map(cat => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Qty */}
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => updateLabRow(row.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Unit */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updateLabRow(row.id, { unit: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Location */}
                        <td className="p-2">
                          <input
                            type="text"
                            list={`lab-locations-datalist-${row.id}`}
                            value={row.location}
                            onChange={(e) => updateLabRow(row.id, { location: e.target.value })}
                            placeholder="e.g. Cabinet 1"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                          <datalist id={`lab-locations-datalist-${row.id}`}>
                            {locations.map(loc => (
                              <option key={loc} value={loc} />
                            ))}
                          </datalist>
                        </td>
                        {/* Condition */}
                        <td className="p-2">
                          <select
                            value={row.condition}
                            onChange={(e) => updateLabRow(row.id, { condition: e.target.value as ItemCondition })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            {LAB_CONDITIONS.map(cond => (
                              <option key={cond} value={cond}>
                                {cond}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Description */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateLabRow(row.id, { description: e.target.value })}
                            placeholder="Specifications / details"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Safety Notes */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.safetyNotes}
                            onChange={(e) => updateLabRow(row.id, { safetyNotes: e.target.value })}
                            placeholder="PPE required, hazards..."
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Consumable */}
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={row.isConsumable}
                            onChange={(e) => updateLabRow(row.id, { isConsumable: e.target.checked })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                          />
                        </td>
                        {/* Remove */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setLabRows(prev => prev.filter(r => r.id !== row.id))}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* PROPERTY TABLE */
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-200">
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5 min-w-[150px]">Property No. (Auto)</th>
                      <th className="p-2.5 min-w-[125px]">PIS Sticker No. <span className="text-gray-400 font-normal text-[10px]">(Optional)</span></th>
                      <th className="p-2.5 min-w-[200px]">Article / Property Name <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[140px]">Classification <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 w-20">Qty <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 w-20">Unit <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 w-28">Unit Cost (₱) <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[160px]">Assigned Location <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[120px]">Condition <span className="text-red-500 font-bold ml-0.5">*</span></th>
                      <th className="p-2.5 min-w-[130px]">Type</th>
                      <th className="p-2.5 min-w-[100px]">Fund Cluster</th>
                      <th className="p-2.5 min-w-[180px]">Description</th>
                      <th className="p-2.5 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {propertyRows.map((row, index) => (
                      <tr key={row.id} className="hover:bg-gray-50/80">
                        <td className="p-2 text-center text-gray-400 font-mono text-[11px]">
                          {index + 1}
                        </td>
                        {/* Auto-generated Property Number */}
                        <td className="p-2 whitespace-nowrap">
                          <span className="font-mono text-[11px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200 block text-center" title="Property number automatically generated">
                            {row.propertyNumber || 'Auto on import'}
                          </span>
                        </td>
                        {/* PIS Sticker Number */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.pisCode}
                            onChange={(e) => updatePropertyRow(row.id, { pisCode: e.target.value })}
                            placeholder="Optional"
                            className="w-full font-mono px-2 py-1 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                            title="Physical PIS Sticker Code (Leave blank if unassigned)"
                          />
                        </td>
                        {/* Property Name Combobox */}
                        <td className="p-2">
                          <input
                            type="text"
                            list={`property-items-datalist-${row.id}`}
                            value={row.name}
                            onChange={(e) => handleSelectPropertyEquipment(row.id, e.target.value)}
                            placeholder="Type or select property..."
                            className={`w-full px-2 py-1 border rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                              !row.name.trim() ? 'border-amber-300 bg-amber-50/30' : 'border-gray-300'
                            }`}
                          />
                          <datalist id={`property-items-datalist-${row.id}`}>
                            {distinctPropertyEquipments.map(item => (
                              <option key={item.id} value={item.name}>
                                {item.category} • ₱{item.unitValue?.toLocaleString() || '0'}
                              </option>
                            ))}
                          </datalist>
                        </td>
                        {/* Category */}
                        <td className="p-2">
                          <select
                            value={row.category}
                            onChange={(e) => updatePropertyRow(row.id, { category: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            {PROPERTY_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Qty */}
                        <td className="p-2">
                          <input
                            type="number"
                            min="1"
                            value={row.quantity}
                            onChange={(e) => updatePropertyRow(row.id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Unit */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.unit}
                            onChange={(e) => updatePropertyRow(row.id, { unit: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Unit Cost */}
                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.unitValue}
                            onChange={(e) => {
                              const cost = parseFloat(e.target.value) || 0;
                              updatePropertyRow(row.id, {
                                unitValue: cost,
                                inventoryType: cost >= 50000 ? 'Capital Outlay' : 'Semi-Expendable'
                              });
                            }}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-right focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Location */}
                        <td className="p-2">
                          <input
                            type="text"
                            list={`property-locations-datalist-${row.id}`}
                            value={row.location}
                            onChange={(e) => updatePropertyRow(row.id, { location: e.target.value })}
                            placeholder="e.g. Science Laboratory"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                          <datalist id={`property-locations-datalist-${row.id}`}>
                            {locations.map(loc => (
                              <option key={loc} value={loc} />
                            ))}
                          </datalist>
                        </td>
                        {/* Condition */}
                        <td className="p-2">
                          <select
                            value={row.condition}
                            onChange={(e) => updatePropertyRow(row.id, { condition: e.target.value as PropertyCondition })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            {PROPERTY_CONDITIONS.map(cond => (
                              <option key={cond} value={cond}>
                                {cond}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Type */}
                        <td className="p-2">
                          <select
                            value={row.inventoryType}
                            onChange={(e) => updatePropertyRow(row.id, { inventoryType: e.target.value as PropertyInventoryType })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            {PROPERTY_INVENTORY_TYPES.map(t => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Fund Cluster */}
                        <td className="p-2">
                          <select
                            value={row.sourceOfFund}
                            onChange={(e) => updatePropertyRow(row.id, { sourceOfFund: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          >
                            {FUND_SOURCES.map(fund => (
                              <option key={fund} value={fund}>
                                {fund}
                              </option>
                            ))}
                          </select>
                        </td>
                        {/* Description */}
                        <td className="p-2">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updatePropertyRow(row.id, { description: e.target.value })}
                            placeholder="Brand, model, serial..."
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          />
                        </td>
                        {/* Remove */}
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => setPropertyRows(prev => prev.filter(r => r.id !== row.id))}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50"
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-white rounded-b-lg flex-shrink-0">
          <div className="text-xs text-gray-500">
            {rowCount > 0 ? (
              <span>Ready to import <strong className="text-gray-900">{rowCount}</strong> {isLab ? 'item(s)' : 'property asset(s)'}</span>
            ) : (
              <span>No items queued for import</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || rowCount === 0}
              className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import All Items ({rowCount})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
