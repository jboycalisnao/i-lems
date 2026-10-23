
export interface ItemAttachment {
  id: string; // Unique attachment ID
  name: string; // File name
  size: number; // File size in bytes
  fileCode: string; // DDownload file_code (e.g. gi4o0tlro01u)
  downloadUrl: string; // Direct link to DDownload (e.g. https://ddownload.com/gi4o0tlro01u)
  uploadedAt: string; // ISO date string
  category?: 'Manual' | 'MSDS' | 'Calibration' | 'Warranty' | 'Datasheet' | 'Guide' | 'Other';
}

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
  attachments?: ItemAttachment[]; // DDownload cloud-hosted manuals, safety sheets, and documents
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

  // DDownload Cloud Storage Integration (https://ddownload.com/api)
  ddownloadApiKey?: string; // DDownload API key for uploading and storing equipment files
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

// --- Role-Based Access Control (RBAC) Types ---

export type UserRole =
  | 'admin'          // Full system administrator (all modules, settings, users)
  | 'custodian'      // Property Custodian (Property Management, PIS tags, reports, inventory view)
  | 'lab_manager'    // Laboratory In-Charge (Inventory, Borrow requests, lending, boxes)
  | 'technician'     // Lab Technician / Staff (Lending, Scanner, view inventory/property)
  | 'borrower'       // Faculty / Borrower (View catalog, request equipment)
  | 'custom';        // Custom tailored permissions

export type UserPermission =
  | 'inventory:view'
  | 'inventory:manage'
  | 'property:view'
  | 'property:manage'
  | 'requests:view'
  | 'requests:manage'
  | 'lending:view'
  | 'lending:manage'
  | 'scanner:use'
  | 'settings:view'
  | 'settings:manage'
  | 'users:manage';

export interface AppUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  password?: string;
  permissions: UserPermission[];
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
  avatarUrl?: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, {
  label: string;
  title: string;
  description: string;
  badgeColor: { bg: string; text: string; border: string };
  defaultPermissions: UserPermission[];
}> = {
  admin: {
    label: 'System Administrator',
    title: 'Super Admin',
    description: 'Full unconstrained access to all modules, settings, database, and user RBAC controls.',
    badgeColor: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
    defaultPermissions: [
      'inventory:view', 'inventory:manage',
      'property:view', 'property:manage',
      'requests:view', 'requests:manage',
      'lending:view', 'lending:manage',
      'scanner:use',
      'settings:view', 'settings:manage',
      'users:manage'
    ]
  },
  custodian: {
    label: 'Property Custodian',
    title: 'Asset Officer',
    description: 'Manages Property Management articles, PIS & Cable sticker tagging, DepEd reports, and equipment valuation.',
    badgeColor: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
    defaultPermissions: [
      'property:view', 'property:manage',
      'inventory:view',
      'scanner:use',
      'settings:view'
    ]
  },
  lab_manager: {
    label: 'Laboratory In-Charge',
    title: 'Lab Manager',
    description: 'Full management of laboratory equipment, borrow request approvals, lending, box packaging, and audits.',
    badgeColor: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
    defaultPermissions: [
      'inventory:view', 'inventory:manage',
      'requests:view', 'requests:manage',
      'lending:view', 'lending:manage',
      'scanner:use',
      'settings:view'
    ]
  },
  technician: {
    label: 'Lab Technician / Staff',
    title: 'Technical Staff',
    description: 'Operates equipment lending, returns, scanner check-in/out, and viewing inventory records.',
    badgeColor: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
    defaultPermissions: [
      'inventory:view',
      'property:view',
      'lending:view', 'lending:manage',
      'scanner:use'
    ]
  },
  borrower: {
    label: 'Teacher / Faculty Requester',
    title: 'Borrower',
    description: 'Browse available science equipment catalog, monitor borrow requests, and view assigned articles.',
    badgeColor: { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-300' },
    defaultPermissions: [
      'inventory:view',
      'requests:view'
    ]
  },
  custom: {
    label: 'Custom Role',
    title: 'Custom RBAC',
    description: 'Tailored permissions configured specifically for this user account.',
    badgeColor: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
    defaultPermissions: [
      'inventory:view'
    ]
  }
};


