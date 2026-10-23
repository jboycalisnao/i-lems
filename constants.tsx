import React from 'react';
import { 
  Beaker, Microscope, Atom, Globe, Archive, HandPlatter, Hand, Tag, 
  Scale, Zap, Box, Compass, Flame, Shield, Laptop, Armchair, Tv, Wind, 
  Cpu, Wrench, ShieldCheck, Briefcase
} from 'lucide-react';

// Default categories for Laboratory Inventory (Items without Physical Property Stickers - PIS)
export const DEFAULT_CATEGORIES = [
  'Chemistry',
  'Biology',
  'Physics',
  'Earth Science',
  'General'
];

const STATIC_COLORS: Record<string, string> = {
  // Laboratory Inventory Categories (Non-PIS)
  'Chemistry': '#3b82f6', // blue-500
  'Biology': '#10b981',   // emerald-500
  'Physics': '#8b5cf6',   // violet-500
  'Earth Science': '#f59e0b', // amber-500
  'General': '#6b7280',   // gray-500

  // Property Inventory Categories (PIS Tagged)
  'Science Lab - Apparatus & Instruments': '#2563eb',
  'Science Lab - Balances & Measurement': '#059669',
  'Science Lab - Electrical & Electronic Equipment': '#7c3aed',
  'Science Lab - Experimental Kits & Mechanics': '#d97706',
  'Science Lab - Earth & Space Science': '#0891b2',
  'Science Laboratory Equipment (General)': '#4f46e5',
  'IT & Digital Equipment': '#0284c7',
  'School Furniture & Fixtures': '#b45309',
  'Audio-Visual & Electronics': '#9333ea',
  'Appliances & HVAC': '#0d9488',
  'Sports & Physical Education': '#ea580c',
  'Facility & Maintenance Tools': '#ca8a04',
  'Security & Safety Equipment': '#dc2626',
  'Office & Administrative': '#64748b'
};

const STATIC_ICONS: Record<string, React.ReactNode> = {
  // Laboratory Inventory Categories
  'Chemistry': <Beaker className="w-5 h-5" />,
  'Biology': <Microscope className="w-5 h-5" />,
  'Physics': <Atom className="w-5 h-5" />,
  'Earth Science': <Globe className="w-5 h-5" />,
  'General': <Archive className="w-5 h-5" />,

  // Property Inventory Categories
  'Science Lab - Apparatus & Instruments': <Atom className="w-5 h-5" />,
  'Science Lab - Balances & Measurement': <Scale className="w-5 h-5" />,
  'Science Lab - Electrical & Electronic Equipment': <Zap className="w-5 h-5" />,
  'Science Lab - Experimental Kits & Mechanics': <Box className="w-5 h-5" />,
  'Science Lab - Earth & Space Science': <Compass className="w-5 h-5" />,
  'Science Laboratory Equipment (General)': <Microscope className="w-5 h-5" />,
  'IT & Digital Equipment': <Laptop className="w-5 h-5" />,
  'School Furniture & Fixtures': <Armchair className="w-5 h-5" />,
  'Audio-Visual & Electronics': <Tv className="w-5 h-5" />,
  'Appliances & HVAC': <Wind className="w-5 h-5" />,
  'Sports & Physical Education': <Shield className="w-5 h-5" />,
  'Facility & Maintenance Tools': <Wrench className="w-5 h-5" />,
  'Security & Safety Equipment': <ShieldCheck className="w-5 h-5" />,
  'Office & Administrative': <Briefcase className="w-5 h-5" />
};

// Fallback color palette for custom categories
const COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#6366f1', // indigo
];

export const getCategoryColor = (category: string): string => {
  if (STATIC_COLORS[category]) return STATIC_COLORS[category];
  
  // Simple hash to pick a color consistently
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
};

export const getCategoryIcon = (category: string): React.ReactNode => {
  if (STATIC_ICONS[category]) return STATIC_ICONS[category];
  return <Tag className="w-5 h-5" />;
};

export const LENDING_ICON = <HandPlatter className="w-5 h-5" />;
export const BORROW_ICON = <Hand className="w-5 h-5" />;