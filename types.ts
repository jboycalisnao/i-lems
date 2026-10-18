
export interface InventoryBox {
  id: string; // Unique Box ID (e.g. CHE-101-BOX-001)
  label: string; // Friendly label "Box 1"
  quantity: number; // Qty inside this box
  status: 'Sealed' | 'Opened';
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string; // Changed from Enum to string for dynamic categories
  quantity: number;
  borrowedQuantity: number;
  unit: string;
  location: string;
  condition: ItemCondition;
  description: string;
  safetyNotes: string;
  lastUpdated: string;
  shortId?: string; // Unique short identifier for barcode generation (e.g., BIO-1024)
  isConsumable?: boolean;
  maxBorrowable?: number | null; // Limit the number of items available for loan (e.g. unboxed stock)
  boxes?: InventoryBox[]; // Boxed inventory tracking
}

export enum ItemCondition {
  Good = 'Good',
  Fair = 'Fair',
  Repairable = 'Repairable',
  Defective = 'Defective',
  Condemned = 'Condemned'
}

export interface Stats {
  totalItems: number;
  totalQuantity: number;
  lowStockItems: number;
  valueByCategory: { name: string; value: number }[];
  conditionBreakdown: { name: string; value: number }[];
  borrowedCount: number;
}

export interface AIAnalysisResult {
  name: string;
  category: string;
  description: string;
  safetyNotes: string;
}

export type BorrowStatus = 'Borrowed' | 'Returned' | 'Overdue';

export interface BorrowRecord {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  borrowerName: string;
  borrowerId: string;
  borrowerEmail?: string; // New field to persist email for return notifications
  quantity: number;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  status: BorrowStatus;
  specificId?: string; // The specific unit ID (e.g. CHE-100-001)
}

export interface AppSettings {
  appName: string;
  logoUrl?: string;
  customFooterText?: string;
  adminUsername?: string;
  adminPassword?: string;
  recoveryEmail?: string;
  labInCharge?: string; // New field for the signatory
  
  // Administrator recipients for SMTP notifications
  notificationEmails?: string; // Comma-separated list of emails to notify on new requests
}

export interface Category {
  id: string;
  name: string;
  isDefault?: boolean;
}

// --- Audit Logging Types ---

export interface AuditDetail {
  uniqueId: string;
  seq: string;
  status: 'present' | 'missing' | 'borrowed';
}

export interface AuditLog {
  id: string;
  date: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  itemLocation: string;
  stats: {
    total: number;
    present: number;
    borrowed: number;
    missing: number;
    accuracy: number;
  };
  details: AuditDetail[];
}

// --- Borrow Request Types ---

export type RequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Completed' | 'Cancelled' | 'Released' | 'Returned';

export interface RequestItem {
  itemId: string;
  itemName: string;
  quantity: number;
  linkedRecordId?: string; // ID of the actual borrow record created from this item
}

export interface BorrowRequest {
  id: string;
  referenceCode: string;
  borrowerName: string;
  borrowerId: string;
  borrowerEmail?: string; 
  instructorName?: string; // New field for supervisor tracking
  requestDate: string;
  returnDate: string;
  status: RequestStatus;
  items: RequestItem[];
  adminNotes?: string;
  reservationSlot?: string; // Time slot
  reservationDate?: string; // Date of reservation
}

// --- Property Management Types ---

export type PropertyCondition = 'Serviceable' | 'Needs Repair' | 'Unserviceable' | 'For Condemnation' | 'Disposed';

export type PropertyInventoryType = 'Semi-Expendable' | 'Capital Outlay' | 'Donated';

export interface PropertyItem {
  id: string;
  propertyNumber: string; // e.g. "PROP-2026-001" or "LNHS-DCP-042"
  name: string; // e.g. "Acer TravelMate Laptop 14-inch"
  category: string; // e.g. "IT & Digital Equipment", "School Furniture", "Audio-Visual", "Appliances & HVAC", etc.
  description: string; // Specs, model, brand, color
  serialNumber?: string;
  quantity: number;
  unit: string; // "unit", "set", "pc", "lot"
  unitValue: number; // Cost in ₱
  totalValue: number; // unitValue * quantity
  location: string; // Room / building / office
  custodian: string; // Accountable teacher or staff officer
  condition: PropertyCondition;
  acquisitionDate: string; // YYYY-MM-DD
  sourceOfFund: string; // "School MOOE", "DepEd DCP", "PTA Donation", "SEF / LGU", "GAA"
  inventoryType: PropertyInventoryType;
  parNumber?: string; // PAR / ICS Reference No.
  notes?: string;
  lastInspected?: string;
  shortId?: string; // For barcode tag
  pisCode?: string; // Property Inventory Sticker Code (e.g. PIS-26-04928)
}

export interface PropertyStats {
  totalAssets: number;
  totalQuantity: number;
  totalValuation: number;
  serviceableCount: number;
  repairCount: number;
  unserviceableCount: number;
  condemnedCount: number;
  capitalOutlayCount: number;
  semiExpendableCount: number;
  valueByCategory: { name: string; value: number }[];
  countByCondition: { name: string; value: number }[];
  valueByFundSource: { name: string; value: number }[];
}

