export interface DateBatch {
  id: string; // Unique identifier for this batch
  bestByDate: string; // ISO format "YYYY-MM-DD" or empty string
  quantity: number; // Units for this specific use-by date
  createdAt: string;
}

export interface InventoryItem {
  id: string; // Barcode ID (e.g., "7613035411209", "012000000133")
  name: string;
  category: string;
  unit?: string; // Unit of measurement: e.g. "kg", "tins", "litres", "packs", "bottles", "units"
  batches: DateBatch[]; // Multiple entries with different use-by dates!
  quantity: number; // Collective quantity = sum of all batch quantities
  bestByDate?: string; // Earliest upcoming best by date for quick sorting
  location?: string; // Shelf, bin, or room (optional)
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // 🔥 ADDED THE MINIMUM ALERT STOCK LEVEL PROPERTY:
  minStockLevel?: number; 
}

export interface CategoryItem {
  id: string;
  name: string;
  color?: string; // Tailwind color token or hex
  description?: string;
  createdAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  barcode: string;
  type: 'in' | 'out';
  batchDate?: string;
  quantity: number;
  unit?: string;
  resultingTotal: number;
  timestamp: string;
}

export type NavTab = 'dashboard' | 'inventory' | 'categories' | 'admin' | 'guides' | 'checklists' | 'maps';

export type ScanMode = 'add' | 'remove';

export interface ScanResultNotice {
  id: string;
  itemName: string;
  barcode: string;
  mode: ScanMode;
  batchDate?: string;
  previousQty: number;
  newQty: number;
  unit?: string;
  timestamp: number;
}

export type ExpiryStatus = 'fresh' | 'expiring-soon' | 'expired' | 'none';

export type ViewSortOption =
  | 'all'
  | 'expiry-soon'
  | 'expired-only'
  | 'expiring-only'
  | 'qty-desc'
  | 'qty-asc'
  | 'out-of-stock'
  | 'name-asc'
  | 'id-asc';

export interface InventoryStats {
  totalItems: number; // Total distinct barcode IDs
  collectiveQty: number; // Sum of all quantities across all batches
  expiringSoonCount: number; // Batches within 7 days
  expiredCount: number; // Batches past best-by date
  categoriesCount: number;
}

export const COMMON_UNITS = [
  'tins',
  'cans',
  'kg',
  'g',
  'litres',
  'ml',
  'packs',
  'boxes',
  'bottles',
  'jars',
  'bags',
  'units',
  'items',
  'pieces',
  'rolls',
];

export function formatUnitLabel(qty: number, rawUnit?: string): string {
  const unit = (rawUnit || 'units').trim().toLowerCase();
  if (qty === 1) {
    if (unit === 'tins') return 'tin';
    if (unit === 'cans') return 'can';
    if (unit === 'litres' || unit === 'liters') return 'litre';
    if (unit === 'bottles') return 'bottle';
    if (unit === 'boxes') return 'box';
    if (unit === 'packs') return 'pack';
    if (unit === 'bags') return 'bag';
    if (unit === 'jars') return 'jar';
    if (unit === 'rolls') return 'roll';
    if (unit === 'pieces') return 'piece';
    if (unit === 'items') return 'item';
    if (unit === 'units') return 'unit';
    return unit;
  }
  return unit;
}

export function formatQuantityWithUnit(qty: number, rawUnit?: string): string {
  const label = formatUnitLabel(qty, rawUnit);
  return `${qty} ${label}`;
}

