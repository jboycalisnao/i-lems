import ExcelJS from 'exceljs';
import {
  InventoryItem,
  PropertyItem,
  Category,
  ItemCondition,
  PropertyCondition,
  PropertyInventoryType
} from '../types';
import {
  PROPERTY_CATEGORIES,
  FUND_SOURCES,
  generateNextPropertyNumbers,
  generateNextPISCodes
} from './propertyStorageService';
import { DEFAULT_LAB_LOCATIONS, getCachedLocations } from './locationService';

/**
 * Triggers browser download of a binary or text Blob as a file
 */
export const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Triggers browser download of text content as a CSV file
 */
export const triggerFileDownload = (content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') => {
  const blob = new Blob([content], { type: mimeType });
  triggerBlobDownload(blob, filename);
};

/**
 * Robust CSV and TSV string parser supporting quotes, escaped quotes, and multiple delimiters.
 */
export const parseDelimitedText = (text: string): string[][] => {
  const clean = text.replace(/^\uFEFF/, '').trim(); // Remove UTF-8 BOM
  if (!clean) return [];

  // Detect delimiter: comma, tab, or semicolon
  const firstLine = clean.split(/\r\n|\n|\r/)[0] || '';
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const nextChar = clean[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentVal += '"';
        i++; // skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        currentRow.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else if (char === '\n') {
        currentRow.push(currentVal.trim());
        rows.push(currentRow);
        currentRow = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    rows.push(currentRow);
  }

  return rows.filter(r => r.some(cell => cell.length > 0));
};

/**
 * Parses an Excel (.xlsx / .xls) buffer into a 2D string matrix
 */
export const parseExcelBuffer = async (buffer: ArrayBuffer): Promise<string[][]> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // Take the first visible worksheet
  const worksheet = workbook.worksheets.find(ws => ws.state !== 'hidden') || workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: string[][] = [];

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const rowValues: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      let val = cell.value;
      if (val !== null && val !== undefined && typeof val === 'object') {
        if ('richText' in val && Array.isArray((val as any).richText)) {
          val = (val as any).richText.map((t: any) => t.text).join('');
        } else if ('result' in val) {
          val = (val as any).result;
        } else if ('text' in val) {
          val = (val as any).text;
        } else if (val instanceof Date) {
          val = val.toISOString().split('T')[0];
        }
      }
      rowValues[colNumber - 1] = val !== null && val !== undefined ? String(val).trim() : '';
    });
    if (rowValues.some(c => c && c.length > 0)) {
      rows.push(rowValues);
    }
  });

  return rows;
};

// ==========================================
// LABORATORY INVENTORY TEMPLATES & EXPORT
// ==========================================

export const LAB_TEMPLATE_HEADERS = [
  'Item Name',
  'Category',
  'Quantity',
  'Unit',
  'Location / Cabinet',
  'Condition',
  'Description / Specs',
  'Safety Notes',
  'Is Consumable'
];

/**
 * Generates and downloads a blank formatted Excel (.xlsx) template for Laboratory Inventory
 * with Excel Defined Names enabling searchable dropdowns from database choices.
 */
export const downloadLaboratoryBlankTemplateExcel = async (
  databaseItems: InventoryItem[] = [],
  databaseLocations: string[] = [],
  databaseCategories: string[] = []
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'I-LEMS - Integrated Laboratory Equipment Management System';
  workbook.created = new Date();

  // 1. Main Sheet
  const worksheet = workbook.addWorksheet('Laboratory Inventory Template', {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'Item / Equipment Name', key: 'name', width: 36 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Quantity', key: 'quantity', width: 14 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'Location / Cabinet', key: 'location', width: 30 },
    { header: 'Condition', key: 'condition', width: 20 },
    { header: 'Description / Specs', key: 'description', width: 40 },
    { header: 'Safety Notes', key: 'safetyNotes', width: 32 },
    { header: 'Is Consumable', key: 'isConsumable', width: 18 }
  ];

  // Header format (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const labHeaderDefs = [
    { title: 'Item / Equipment Name', required: true },
    { title: 'Category', required: true },
    { title: 'Quantity', required: true },
    { title: 'Unit', required: true },
    { title: 'Location / Cabinet', required: true },
    { title: 'Condition', required: true },
    { title: 'Description / Specs', required: false },
    { title: 'Safety Notes', required: false },
    { title: 'Is Consumable', required: false }
  ];

  labHeaderDefs.forEach((def, idx) => {
    const cell = headerRow.getCell(idx + 1);
    if (def.required) {
      cell.value = {
        richText: [
          { text: def.title + ' ', font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } } },
          { text: '*', font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFDC2626' } } }
        ]
      };
    } else {
      cell.value = def.title;
    }
  });

  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // 2. Reference Data Sheet for Searchable Dropdowns
  const refSheet = workbook.addWorksheet('ReferenceData', { state: 'hidden' });

  // Distinct Equipment names
  const equipSet = new Set<string>();
  databaseItems.forEach(i => {
    if (i.name?.trim()) equipSet.add(i.name.trim());
  });
  if (equipSet.size === 0) {
    equipSet.add('Alcohol Lamp Glass 150mL');
    equipSet.add('Beaker 250mL Borosilicate');
    equipSet.add('Digital Analytical Balance 220g');
    equipSet.add('Graduated Cylinder 100mL');
    equipSet.add('Microscope Compound Binocular');
    equipSet.add('Test Tube 16x150mm Borosilicate');
  }
  const equipList = Array.from(equipSet).sort((a, b) => a.localeCompare(b));

  // Distinct Locations
  const locSet = new Set<string>(databaseLocations);
  DEFAULT_LAB_LOCATIONS.forEach(l => locSet.add(l));
  databaseItems.forEach(i => {
    if (i.location?.trim()) locSet.add(i.location.trim());
  });
  const locList = Array.from(locSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

  // Distinct Categories
  const catSet = new Set<string>(databaseCategories);
  ['Equipment', 'Glassware', 'Chemicals', 'Specimens', 'Safety', 'Consumables', 'General'].forEach(c => catSet.add(c));
  const catList = Array.from(catSet).filter(Boolean);

  // Conditions
  const condList = ['Good', 'Fair', 'Repairable', 'Defective', 'Condemned'];
  const consumableList = ['No', 'Yes'];

  // Populate ReferenceData columns
  equipList.forEach((name, idx) => { refSheet.getCell(`A${idx + 2}`).value = name; });
  locList.forEach((loc, idx) => { refSheet.getCell(`B${idx + 2}`).value = loc; });
  catList.forEach((cat, idx) => { refSheet.getCell(`C${idx + 2}`).value = cat; });
  condList.forEach((cond, idx) => { refSheet.getCell(`D${idx + 2}`).value = cond; });
  consumableList.forEach((c, idx) => { refSheet.getCell(`E${idx + 2}`).value = c; });

  const equipEnd = Math.max(2, equipList.length + 1);
  const locEnd = Math.max(2, locList.length + 1);
  const catEnd = Math.max(2, catList.length + 1);
  const condEnd = Math.max(2, condList.length + 1);
  const consEnd = Math.max(2, consumableList.length + 1);

  // Register Excel Defined Names for native searchability in Excel 365/2021+
  workbook.definedNames.add(`ReferenceData!$A$2:$A$${equipEnd}`, 'LabEquipmentList');
  workbook.definedNames.add(`ReferenceData!$B$2:$B$${locEnd}`, 'LabLocationList');
  workbook.definedNames.add(`ReferenceData!$C$2:$C$${catEnd}`, 'LabCategoryList');
  workbook.definedNames.add(`ReferenceData!$D$2:$D$${condEnd}`, 'LabConditionList');
  workbook.definedNames.add(`ReferenceData!$E$2:$E$${consEnd}`, 'LabConsumableList');

  // Format 50 blank rows
  for (let r = 2; r <= 50; r++) {
    const row = worksheet.getRow(r);
    row.height = 22;
    row.font = { name: 'Calibri', size: 10 };

    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }

    // A: Searchable Equipment Name Dropdown
    const equipCell = row.getCell(1);
    equipCell.alignment = { vertical: 'middle', horizontal: 'left' };
    equipCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['LabEquipmentList'],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: 'Search Equipment Name',
      prompt: 'Type letters to search or click the dropdown arrow to select registered laboratory equipment.'
    };

    // B: Category Dropdown
    const catCell = row.getCell(2);
    catCell.alignment = { vertical: 'middle', horizontal: 'left' };
    catCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['LabCategoryList'],
      showErrorMessage: false
    };

    // C: Quantity
    const qtyCell = row.getCell(3);
    qtyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    qtyCell.numFmt = '#,##0';

    // D: Unit
    const unitCell = row.getCell(4);
    unitCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // E: Searchable Location Dropdown
    const locCell = row.getCell(5);
    locCell.alignment = { vertical: 'middle', horizontal: 'left' };
    locCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['LabLocationList'],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: 'Select Location / Cabinet',
      prompt: 'Type or click to choose assigned cabinet or room.'
    };

    // F: Condition Dropdown
    const condCell = row.getCell(6);
    condCell.alignment = { vertical: 'middle', horizontal: 'center' };
    condCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['LabConditionList'],
      showErrorMessage: false
    };

    // G: Description
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'left' };

    // H: Safety Notes
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' };

    // I: Is Consumable Dropdown
    const consCell = row.getCell(9);
    consCell.alignment = { vertical: 'middle', horizontal: 'center' };
    consCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['LabConsumableList'],
      showErrorMessage: false
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  triggerBlobDownload(blob, 'LNHS_Laboratory_Inventory_Blank_Template.xlsx');
};

/**
 * Generates and downloads a full Excel (.xlsx) export of all Laboratory Inventory items
 */
export const exportLaboratoryFullExcel = async (
  items: InventoryItem[],
  customFilename?: string,
  sheetTitle = 'Laboratory Inventory'
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'I-LEMS';

  // Sanitize worksheet name (max 31 chars, no forbidden chars: \ / ? * : [ ])
  const sanitizedSheet = (sheetTitle || 'Laboratory Inventory')
    .replace(/[\\/?*:[\]]/g, '')
    .trim()
    .slice(0, 31) || 'Laboratory Inventory';

  const worksheet = workbook.addWorksheet(sanitizedSheet, {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'Item / Equipment Name', key: 'name', width: 36 },
    { header: 'Category', key: 'category', width: 24 },
    { header: 'Quantity', key: 'quantity', width: 14 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'Location / Cabinet', key: 'location', width: 30 },
    { header: 'Condition', key: 'condition', width: 20 },
    { header: 'Description / Specs', key: 'description', width: 40 },
    { header: 'Safety Notes', key: 'safetyNotes', width: 32 },
    { header: 'Is Consumable', key: 'isConsumable', width: 18 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  items.forEach((item) => {
    const row = worksheet.addRow({
      name: item.name || '',
      category: item.category || 'General',
      quantity: item.quantity ?? 1,
      unit: item.unit || 'pcs',
      location: item.location || '',
      condition: item.condition || 'Good',
      description: item.description || '',
      safetyNotes: item.safetyNotes || '',
      isConsumable: item.isConsumable ? 'Yes' : 'No'
    });

    row.height = 22;
    row.font = { name: 'Calibri', size: 10 };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'center' };

    for (let c = 1; c <= 9; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const date = new Date().toISOString().split('T')[0];
  const filename = customFilename || `LNHS_Laboratory_Inventory_${date}.xlsx`;
  triggerBlobDownload(blob, filename);
};

// ==========================================
// PROPERTY INVENTORY TEMPLATES & EXPORT
// ==========================================

export const PROPERTY_TEMPLATE_HEADERS = [
  'Article / Property Name',
  'Classification / Category',
  'Description / Specs',
  'Serial Number',
  'Quantity',
  'Unit',
  'Unit Cost (PHP)',
  'Assigned Location',
  'PIS Sticker Number (Optional)',
  'Accountable Officer / Custodian',
  'Condition',
  'Date Acquired (YYYY-MM-DD)',
  'Source of Fund',
  'Inventory Type',
  'PAR / ICS Reference No.',
  'Property Number (Auto-Generated on Upload)',
  'Remarks'
];

/**
 * Generates and downloads a blank formatted Excel (.xlsx) template for Property Inventory
 * with:
 * 1. Searchable Defined Name dropdown for Article / Property Name (populated from database items)
 * 2. Dedicated PIS Sticker Number column
 * 3. Auto-generated Property Number specification upon upload
 * 4. Searchable Assigned Location dropdown
 */
export const downloadPropertyBlankTemplateExcel = async (
  databaseItems: PropertyItem[] = [],
  databaseLocations: string[] = []
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'I-LEMS - Integrated Laboratory Equipment Management System';
  workbook.created = new Date();

  // 1. Main Template Sheet
  const worksheet = workbook.addWorksheet('Property Inventory Template', {
    views: [{ showGridLines: true }]
  });

  // Columns ordered with Article Name first, PIS Sticker Number column, and Auto-generated Property Number
  worksheet.columns = [
    { header: 'Article / Property Name', key: 'name', width: 38 },
    { header: 'Classification / Category', key: 'category', width: 26 },
    { header: 'Description / Specs', key: 'description', width: 38 },
    { header: 'Serial Number', key: 'serialNumber', width: 22 },
    { header: 'Quantity', key: 'quantity', width: 14 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'Unit Cost (PHP)', key: 'unitValue', width: 20 },
    { header: 'Assigned Location', key: 'location', width: 30 },
    { header: 'PIS Sticker Number (Optional)', key: 'pisCode', width: 26 },
    { header: 'Accountable Officer / Custodian', key: 'custodian', width: 30 },
    { header: 'Condition', key: 'condition', width: 22 },
    { header: 'Date Acquired (YYYY-MM-DD)', key: 'acquisitionDate', width: 26 },
    { header: 'Source of Fund', key: 'sourceOfFund', width: 24 },
    { header: 'Inventory Type', key: 'inventoryType', width: 22 },
    { header: 'PAR / ICS Reference No.', key: 'parNumber', width: 26 },
    { header: 'Property Number (Auto-Generated on Upload)', key: 'propertyNumber', width: 34 },
    { header: 'Remarks', key: 'notes', width: 32 }
  ];

  // Header formatting (Row 1)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const propHeaderDefs = [
    { title: 'Article / Property Name', required: true },
    { title: 'Classification / Category', required: true },
    { title: 'Description / Specs', required: false },
    { title: 'Serial Number', required: false },
    { title: 'Quantity', required: true },
    { title: 'Unit', required: true },
    { title: 'Unit Cost (PHP)', required: true },
    { title: 'Assigned Location', required: true },
    { title: 'PIS Sticker Number (Optional)', required: false },
    { title: 'Accountable Officer / Custodian', required: false },
    { title: 'Condition', required: true },
    { title: 'Date Acquired (YYYY-MM-DD)', required: true },
    { title: 'Source of Fund', required: false },
    { title: 'Inventory Type', required: false },
    { title: 'PAR / ICS Reference No.', required: false },
    { title: 'Property Number (Auto-Generated on Upload)', required: false },
    { title: 'Remarks', required: false }
  ];

  propHeaderDefs.forEach((def, idx) => {
    const cell = headerRow.getCell(idx + 1);
    if (def.required) {
      cell.value = {
        richText: [
          { text: def.title + ' ', font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } } },
          { text: '*', font: { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFDC2626' } } }
        ]
      };
    } else {
      cell.value = def.title;
    }
  });

  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  // 2. Reference Data Sheet for Defined Name Searchable Dropdowns
  const refSheet = workbook.addWorksheet('ReferenceData', { state: 'hidden' });

  // Distinct Property / Equipment names sorted alphabetically for search autocomplete
  const propertyNameSet = new Set<string>();
  databaseItems.forEach(i => {
    if (i.name?.trim()) propertyNameSet.add(i.name.trim());
  });
  if (propertyNameSet.size === 0) {
    propertyNameSet.add('Centrifuge 8-Place Angle Rotor');
    propertyNameSet.add('Digital Analytical Balance 220g x 0.0001g');
    propertyNameSet.add('Hot Plate Magnetic Stirrer');
    propertyNameSet.add('Microscope Compound Binocular LED');
    propertyNameSet.add('Triple Beam Mechanical Balance 2610g');
  }
  const propertyNameList = Array.from(propertyNameSet).sort((a, b) => a.localeCompare(b));

  // Distinct Locations
  const locSet = new Set<string>(databaseLocations);
  DEFAULT_LAB_LOCATIONS.forEach(l => locSet.add(l));
  databaseItems.forEach(i => {
    if (i.location?.trim()) locSet.add(i.location.trim());
  });
  const locList = Array.from(locSet).filter(Boolean).sort((a, b) => a.localeCompare(b));

  // Categories
  const catList = [...PROPERTY_CATEGORIES];

  // Conditions
  const condList: PropertyCondition[] = [
    'Serviceable',
    'Needs Repair',
    'Unserviceable',
    'For Condemnation',
    'Disposed'
  ];

  // Fund Sources
  const fundList = [...FUND_SOURCES];

  // Inventory Types
  const invTypeList: PropertyInventoryType[] = ['Semi-Expendable', 'Capital Outlay', 'Donated'];

  // Populate ReferenceData columns
  propertyNameList.forEach((name, idx) => { refSheet.getCell(`A${idx + 2}`).value = name; });
  locList.forEach((loc, idx) => { refSheet.getCell(`B${idx + 2}`).value = loc; });
  catList.forEach((cat, idx) => { refSheet.getCell(`C${idx + 2}`).value = cat; });
  condList.forEach((cond, idx) => { refSheet.getCell(`D${idx + 2}`).value = cond; });
  fundList.forEach((fund, idx) => { refSheet.getCell(`E${idx + 2}`).value = fund; });
  invTypeList.forEach((t, idx) => { refSheet.getCell(`F${idx + 2}`).value = t; });

  const nameEnd = Math.max(2, propertyNameList.length + 1);
  const locEnd = Math.max(2, locList.length + 1);
  const catEnd = Math.max(2, catList.length + 1);
  const condEnd = Math.max(2, condList.length + 1);
  const fundEnd = Math.max(2, fundList.length + 1);
  const typeEnd = Math.max(2, invTypeList.length + 1);

  // Register Excel Defined Names enabling native search bar in dropdowns
  workbook.definedNames.add(`ReferenceData!$A$2:$A$${nameEnd}`, 'ArticleNameList');
  workbook.definedNames.add(`ReferenceData!$B$2:$B$${locEnd}`, 'PropertyLocationList');
  workbook.definedNames.add(`ReferenceData!$C$2:$C$${catEnd}`, 'PropertyCategoryList');
  workbook.definedNames.add(`ReferenceData!$D$2:$D$${condEnd}`, 'PropertyConditionList');
  workbook.definedNames.add(`ReferenceData!$E$2:$E$${fundEnd}`, 'PropertyFundList');
  workbook.definedNames.add(`ReferenceData!$F$2:$F$${typeEnd}`, 'PropertyTypeList');

  // Format 50 blank rows
  for (let r = 2; r <= 50; r++) {
    const row = worksheet.getRow(r);
    row.height = 22;
    row.font = { name: 'Calibri', size: 10 };

    for (let c = 1; c <= 17; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }

    // A (Col 1): Article / Property Name Searchable Dropdown
    const nameCell = row.getCell(1);
    nameCell.alignment = { vertical: 'middle', horizontal: 'left' };
    nameCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['ArticleNameList'],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: 'Search Article / Property',
      prompt: 'Type letters to search or click the dropdown arrow to select registered items.'
    };

    // B (Col 2): Classification / Category Dropdown
    const catCell = row.getCell(2);
    catCell.alignment = { vertical: 'middle', horizontal: 'left' };
    catCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['PropertyCategoryList'],
      showErrorMessage: false
    };

    // C (Col 3): Description / Specs
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'left' };

    // D (Col 4): Serial Number
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    // E (Col 5): Quantity
    const qtyCell = row.getCell(5);
    qtyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    qtyCell.numFmt = '#,##0';

    // F (Col 6): Unit
    const unitCell = row.getCell(6);
    unitCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // G (Col 7): Unit Cost (PHP)
    const costCell = row.getCell(7);
    costCell.alignment = { vertical: 'middle', horizontal: 'right' };
    costCell.numFmt = '₱#,##0.00';

    // H (Col 8): Assigned Location Dropdown
    const locCell = row.getCell(8);
    locCell.alignment = { vertical: 'middle', horizontal: 'left' };
    locCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['PropertyLocationList'],
      showErrorMessage: false,
      showInputMessage: true,
      promptTitle: 'Assigned Location',
      prompt: 'Type or click to choose assigned room or laboratory.'
    };

    // I (Col 9): PIS Sticker Number (Optional)
    const pisCell = row.getCell(9);
    pisCell.alignment = { vertical: 'middle', horizontal: 'center' };
    pisCell.dataValidation = {
      type: 'custom',
      allowBlank: true,
      formulae: ['TRUE'],
      showInputMessage: true,
      promptTitle: 'PIS Sticker Code (Optional)',
      prompt: 'Enter physical sticker barcode code (e.g. PIS-26-04928) or leave blank to auto-generate.'
    };

    // J (Col 10): Custodian
    row.getCell(10).alignment = { vertical: 'middle', horizontal: 'left' };

    // K (Col 11): Condition Dropdown
    const condCell = row.getCell(11);
    condCell.alignment = { vertical: 'middle', horizontal: 'center' };
    condCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['PropertyConditionList'],
      showErrorMessage: false
    };

    // L (Col 12): Date Acquired
    const dateCell = row.getCell(12);
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' };

    // M (Col 13): Source of Fund Dropdown
    const fundCell = row.getCell(13);
    fundCell.alignment = { vertical: 'middle', horizontal: 'left' };
    fundCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['PropertyFundList'],
      showErrorMessage: false
    };

    // N (Col 14): Inventory Type Dropdown
    const typeCell = row.getCell(14);
    typeCell.alignment = { vertical: 'middle', horizontal: 'center' };
    typeCell.dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: ['PropertyTypeList'],
      showErrorMessage: false
    };

    // O (Col 15): PAR / ICS Reference No
    row.getCell(15).alignment = { vertical: 'middle', horizontal: 'center' };

    // P (Col 16): Property Number (Auto-Generated on Upload)
    const propNumCell = row.getCell(16);
    propNumCell.alignment = { vertical: 'middle', horizontal: 'center' };
    propNumCell.dataValidation = {
      type: 'custom',
      allowBlank: true,
      formulae: ['TRUE'],
      showInputMessage: true,
      promptTitle: 'Auto-Generated on Upload',
      prompt: 'Leave blank! Official sequential code (e.g. LNHS-SE-SCI-2026-001) is auto-assigned upon upload.'
    };

    // Q (Col 17): Remarks
    row.getCell(17).alignment = { vertical: 'middle', horizontal: 'left' };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  triggerBlobDownload(blob, 'LNHS_Property_Inventory_Blank_Template.xlsx');
};

/**
 * Generates and downloads a full Excel (.xlsx) export of all Property Inventory items
 */
export const exportPropertyFullExcel = async (
  items: PropertyItem[],
  customFilename?: string,
  sheetTitle = 'Property Inventory'
) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'I-LEMS';

  // Sanitize worksheet name (max 31 chars, no forbidden chars: \ / ? * : [ ])
  const sanitizedSheet = (sheetTitle || 'Property Inventory')
    .replace(/[\\/?*:[\]]/g, '')
    .trim()
    .slice(0, 31) || 'Property Inventory';

  const worksheet = workbook.addWorksheet(sanitizedSheet, {
    views: [{ showGridLines: true }]
  });

  worksheet.columns = [
    { header: 'Property Number', key: 'propertyNumber', width: 28 },
    { header: 'PIS Sticker Code', key: 'pisCode', width: 22 },
    { header: 'Article / Property Name', key: 'name', width: 38 },
    { header: 'Classification / Category', key: 'category', width: 26 },
    { header: 'Description / Specs', key: 'description', width: 38 },
    { header: 'Serial Number', key: 'serialNumber', width: 22 },
    { header: 'Quantity', key: 'quantity', width: 14 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'Unit Cost (PHP)', key: 'unitValue', width: 20 },
    { header: 'Total Value (PHP)', key: 'totalValue', width: 22 },
    { header: 'Assigned Location', key: 'location', width: 30 },
    { header: 'Accountable Officer / Custodian', key: 'custodian', width: 30 },
    { header: 'Condition', key: 'condition', width: 22 },
    { header: 'Date Acquired', key: 'acquisitionDate', width: 24 },
    { header: 'Source of Fund', key: 'sourceOfFund', width: 24 },
    { header: 'Inventory Type', key: 'inventoryType', width: 22 },
    { header: 'PAR / ICS Reference No.', key: 'parNumber', width: 26 },
    { header: 'Remarks', key: 'notes', width: 32 }
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E293B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });

  items.forEach((item) => {
    const qty = item.quantity ?? 1;
    const unitVal = item.unitValue ?? 0;
    const totalVal = item.totalValue ?? (unitVal * qty);

    const row = worksheet.addRow({
      propertyNumber: item.propertyNumber || '',
      pisCode: item.pisCode || '',
      name: item.name || '',
      category: item.category || '',
      description: item.description || '',
      serialNumber: item.serialNumber || 'N/A',
      quantity: qty,
      unit: item.unit || 'unit',
      unitValue: unitVal,
      totalValue: totalVal,
      location: item.location || '',
      custodian: item.custodian || '',
      condition: item.condition || 'Serviceable',
      acquisitionDate: item.acquisitionDate || '',
      sourceOfFund: item.sourceOfFund || '',
      inventoryType: item.inventoryType || '',
      parNumber: item.parNumber || '',
      notes: item.notes || ''
    });

    row.height = 22;
    row.font = { name: 'Calibri', size: 10 };
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(6).alignment = { horizontal: 'center' };
    row.getCell(7).alignment = { horizontal: 'center' };
    row.getCell(8).alignment = { horizontal: 'center' };
    row.getCell(9).alignment = { horizontal: 'right' };
    row.getCell(9).numFmt = '₱#,##0.00';
    row.getCell(10).alignment = { horizontal: 'right' };
    row.getCell(10).numFmt = '₱#,##0.00';
    row.getCell(13).alignment = { horizontal: 'center' };
    row.getCell(14).alignment = { horizontal: 'center' };
    row.getCell(16).alignment = { horizontal: 'center' };
    row.getCell(17).alignment = { horizontal: 'center' };

    for (let c = 1; c <= 18; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const date = new Date().toISOString().split('T')[0];
  const filename = customFilename || `LNHS_Property_Inventory_${date}.xlsx`;
  triggerBlobDownload(blob, filename);
};

/**
 * Filters Property Inventory items by property name and exports to an Excel (.xlsx) file.
 * The exported file name and worksheet title automatically reflect the specific property name.
 */
export const exportPropertyByNameExcel = async (
  propertyName: string,
  allItems: PropertyItem[]
) => {
  const cleanFilterName = (propertyName || '').trim();
  if (!cleanFilterName) return;

  const targetItems = cleanFilterName.toLowerCase() === 'all'
    ? allItems
    : allItems.filter(i => (i.name || '').trim().toLowerCase() === cleanFilterName.toLowerCase());

  if (targetItems.length === 0) {
    throw new Error(`No property items found with name "${cleanFilterName}"`);
  }

  // Format clean filename e.g. LNHS_Property_Microscope_2026-11-07.xlsx
  const cleanNameForFile = cleanFilterName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
  const date = new Date().toISOString().split('T')[0];
  const filename = cleanFilterName.toLowerCase() === 'all'
    ? `LNHS_Property_Inventory_All_${date}.xlsx`
    : `LNHS_Property_${cleanNameForFile || 'Item'}_${date}.xlsx`;

  await exportPropertyFullExcel(targetItems, filename, cleanFilterName);
};

// ==========================================
// ROW MAPPERS & PARSERS
// ==========================================

export interface ParsedLabItemRow {
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
  isValid: boolean;
  error?: string;
}

export interface ParsedPropertyItemRow {
  id: string;
  propertyNumber: string;
  pisCode?: string;
  name: string;
  category: string;
  description: string;
  serialNumber: string;
  quantity: number;
  unit: string;
  unitValue: number;
  location: string;
  custodian: string;
  condition: PropertyCondition;
  acquisitionDate: string;
  sourceOfFund: string;
  inventoryType: PropertyInventoryType;
  parNumber: string;
  notes: string;
  isValid: boolean;
  error?: string;
}

const findColIndex = (headers: string[], matchers: string[]): number => {
  return headers.findIndex(h => {
    const clean = (h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return matchers.some(m => clean.includes(m.toLowerCase().replace(/[^a-z0-9]/g, '')));
  });
};

export const mapRowsToLabItems = (
  rawRows: string[][],
  defaultCategory = 'General'
): ParsedLabItemRow[] => {
  if (rawRows.length === 0) return [];

  const headers = rawRows[0];
  const nameIdx = findColIndex(headers, ['itemname', 'name', 'article', 'description']);
  const catIdx = findColIndex(headers, ['category', 'classification', 'type']);
  const qtyIdx = findColIndex(headers, ['quantity', 'qty', 'count']);
  const unitIdx = findColIndex(headers, ['unit', 'uom']);
  const locIdx = findColIndex(headers, ['location', 'cabinet', 'room', 'venue']);
  const condIdx = findColIndex(headers, ['condition', 'status', 'state']);
  const descIdx = findColIndex(headers, ['description', 'specs', 'specification']);
  const safetyIdx = findColIndex(headers, ['safety', 'safetynotes', 'precaution']);
  const consumIdx = findColIndex(headers, ['consumable', 'isconsumable']);

  const dataRows = rawRows.slice(1);

  return dataRows.map((row, idx) => {
    const name = (nameIdx >= 0 ? row[nameIdx] : row[0]) || '';
    const category = (catIdx >= 0 ? row[catIdx] : row[1]) || defaultCategory;
    const rawQty = qtyIdx >= 0 ? parseFloat(row[qtyIdx]) : parseFloat(row[2]);
    const quantity = isNaN(rawQty) || rawQty <= 0 ? 1 : rawQty;
    const unit = (unitIdx >= 0 ? row[unitIdx] : row[3]) || 'pcs';
    const location = (locIdx >= 0 ? row[locIdx] : row[4]) || 'Science Laboratory';

    const rawCond = (condIdx >= 0 ? row[condIdx] : row[5]) || 'Good';
    let condition = ItemCondition.Good;
    if (/fair/i.test(rawCond)) condition = ItemCondition.Fair;
    else if (/repair/i.test(rawCond)) condition = ItemCondition.Repairable;
    else if (/defect|poor|damage/i.test(rawCond)) condition = ItemCondition.Defective;
    else if (/condemn/i.test(rawCond)) condition = ItemCondition.Condemned;

    const description = (descIdx >= 0 ? row[descIdx] : row[6]) || '';
    const safetyNotes = (safetyIdx >= 0 ? row[safetyIdx] : row[7]) || '';
    const rawConsum = (consumIdx >= 0 ? row[consumIdx] : row[8]) || '';
    const isConsumable = /yes|true|1|consumable/i.test(rawConsum);

    const isValid = Boolean(name.trim());
    const error = !isValid ? 'Item Name is required' : undefined;

    return {
      id: crypto.randomUUID(),
      name: name.trim(),
      category: category.trim() || defaultCategory,
      quantity,
      unit: unit.trim(),
      location: location.trim(),
      condition,
      description: description.trim(),
      safetyNotes: safetyNotes.trim(),
      isConsumable,
      isValid,
      error
    };
  });
};

export const mapRowsToPropertyItems = (
  rawRows: string[][],
  existingProperties: PropertyItem[] = []
): ParsedPropertyItemRow[] => {
  if (rawRows.length === 0) return [];

  const headers = rawRows[0];
  const nameIdx = findColIndex(headers, ['article', 'name', 'articlename', 'propertyname']);
  const catIdx = findColIndex(headers, ['category', 'classification']);
  const descIdx = findColIndex(headers, ['description', 'specs', 'specification']);
  const snIdx = findColIndex(headers, ['serialnumber', 'serial', 'sn']);
  const qtyIdx = findColIndex(headers, ['quantity', 'qty']);
  const unitIdx = findColIndex(headers, ['unit', 'uom']);
  const costIdx = findColIndex(headers, ['unitcost', 'cost', 'unitvalue', 'price', 'value']);
  const locIdx = findColIndex(headers, ['location', 'room', 'office', 'venue']);
  const pisIdx = findColIndex(headers, ['pis', 'piscode', 'pissticker', 'stickerno', 'sticker']);
  const custIdx = findColIndex(headers, ['custodian', 'accountable', 'officer']);
  const condIdx = findColIndex(headers, ['condition', 'state', 'status']);
  const dateIdx = findColIndex(headers, ['dateacquired', 'acquisitiondate', 'date']);
  const fundIdx = findColIndex(headers, ['fundsource', 'sourceoffund', 'fund']);
  const classIdx = findColIndex(headers, ['inventorytype', 'inventoryclassification', 'type']);
  const parIdx = findColIndex(headers, ['parnumber', 'par', 'ics', 'parics']);
  const propNumIdx = findColIndex(headers, ['propertynumber', 'propno', 'propertyno']);
  const notesIdx = findColIndex(headers, ['remarks', 'notes', 'comment']);

  const dataRows = rawRows.slice(1);
  const nextPISCodes = generateNextPISCodes(existingProperties, Math.max(1, dataRows.length));
  const runningProperties = [...existingProperties];

  return dataRows.map((row, idx) => {
    const name = (nameIdx >= 0 ? row[nameIdx] : row[0]) || '';
    const category = (catIdx >= 0 ? row[catIdx] : row[1]) || PROPERTY_CATEGORIES[0];
    const description = (descIdx >= 0 ? row[descIdx] : row[2]) || '';
    const serialNumber = (snIdx >= 0 ? row[snIdx] : row[3]) || 'N/A';

    const rawQty = qtyIdx >= 0 ? parseFloat(row[qtyIdx]) : parseFloat(row[4]);
    const quantity = isNaN(rawQty) || rawQty <= 0 ? 1 : rawQty;
    const unit = (unitIdx >= 0 ? row[unitIdx] : row[5]) || 'unit';

    const rawCost = costIdx >= 0 ? parseFloat(String(row[costIdx]).replace(/[^0-9.-]/g, '')) : parseFloat(row[6]);
    const unitValue = isNaN(rawCost) || rawCost < 0 ? 0 : rawCost;

    const location = (locIdx >= 0 ? row[locIdx] : row[7]) || 'Science Laboratory';

    // PIS Sticker Number: if user provided one in the uploaded file, use it. Do NOT auto-populate.
    const rawPis = pisIdx >= 0 ? String(row[pisIdx] || '').trim() : '';
    const pisCode = rawPis && !/auto|leave|opt|generated/i.test(rawPis) ? rawPis : '';

    const custodian = (custIdx >= 0 ? row[custIdx] : row[9]) || 'Jeebs M. Sabidalas';

    const rawCond = (condIdx >= 0 ? row[condIdx] : row[10]) || 'Serviceable';
    let condition: PropertyCondition = 'Serviceable';
    if (/repair/i.test(rawCond)) condition = 'Needs Repair';
    else if (/unserviceable/i.test(rawCond)) condition = 'Unserviceable';
    else if (/condemn/i.test(rawCond)) condition = 'For Condemnation';
    else if (/disposed/i.test(rawCond)) condition = 'Disposed';

    const acquisitionDate = (dateIdx >= 0 ? row[dateIdx] : row[11]) || new Date().toISOString().split('T')[0];
    const sourceOfFund = (fundIdx >= 0 ? row[fundIdx] : row[12]) || FUND_SOURCES[0];

    let inventoryType: PropertyInventoryType = unitValue >= 50000 ? 'Capital Outlay' : 'Semi-Expendable';
    const rawClass = classIdx >= 0 ? row[classIdx] : row[13];
    if (rawClass) {
      if (/capital|ppe/i.test(rawClass)) inventoryType = 'Capital Outlay';
      else if (/semi/i.test(rawClass)) inventoryType = 'Semi-Expendable';
      else if (/donat/i.test(rawClass)) inventoryType = 'Donated';
    }

    const parNumber = (parIdx >= 0 ? row[parIdx] : row[14]) || '';

    // Property Number: Always auto-generated using actual row category & inventoryType if left blank or placeholder
    const rawPropNum = propNumIdx >= 0 ? String(row[propNumIdx] || '').trim() : '';
    let propertyNumber = '';
    if (rawPropNum && !/auto|leave|opt|generated/i.test(rawPropNum)) {
      propertyNumber = rawPropNum;
    } else {
      const generated = generateNextPropertyNumbers(runningProperties, 1, inventoryType, category);
      propertyNumber = generated[0] || `LNHS-PROP-${Date.now()}-${idx + 1}`;
    }

    // Append to running pool to guarantee consecutive non-colliding sequential numbers across rows
    runningProperties.push({
      id: crypto.randomUUID(),
      propertyNumber,
      name,
      category,
      quantity,
      unit,
      unitValue,
      location,
      condition,
      acquisitionDate,
      sourceOfFund,
      inventoryType
    } as PropertyItem);

    const notes = (notesIdx >= 0 ? row[notesIdx] : row[16]) || '';

    const isValid = Boolean(name.trim());
    const error = !isValid ? 'Article / Property name is required' : undefined;

    return {
      id: crypto.randomUUID(),
      propertyNumber: propertyNumber.trim(),
      pisCode: pisCode ? pisCode.trim() : undefined,
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      serialNumber: serialNumber.trim(),
      quantity,
      unit: unit.trim(),
      unitValue,
      location: location.trim(),
      custodian: custodian.trim(),
      condition,
      acquisitionDate: acquisitionDate.trim(),
      sourceOfFund: sourceOfFund.trim(),
      inventoryType,
      parNumber: parNumber.trim(),
      notes: notes.trim(),
      isValid,
      error
    };
  });
};
