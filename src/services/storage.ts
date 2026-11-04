import { InventoryItem, DateBatch, CategoryItem, StockMovement, ExpiryStatus, InventoryStats } from '../types/inventory';

const STORAGE_KEY = 'stocktrack_inventory_v3';
const CATEGORIES_KEY = 'stocktrack_categories_v3';
const MOVEMENTS_KEY = 'stocktrack_movements_v3';
const DB_NAME = 'StockTrackDB';
const DB_STORE_INVENTORY = 'inventory';
const DB_STORE_CATEGORIES = 'categories';
const DB_STORE_MOVEMENTS = 'movements';
const DB_VERSION = 3;

function getRelativeDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0];
}

export const INITIAL_CATEGORIES: CategoryItem[] = [
  { id: 'cat-pantry', name: 'Pantry', color: 'amber', description: 'Canned goods, grains, pasta, oils & sauces', createdAt: new Date().toISOString() },
  { id: 'cat-dairy', name: 'Dairy & Cold', color: 'sky', description: 'Milk, cheese, yogurt, eggs & refrigerated goods', createdAt: new Date().toISOString() },
  { id: 'cat-bakery', name: 'Bakery', color: 'orange', description: 'Fresh loaves, buns, pastries & bread', createdAt: new Date().toISOString() },
  { id: 'cat-produce', name: 'Produce', color: 'emerald', description: 'Fresh fruits, vegetables & herbs', createdAt: new Date().toISOString() },
  { id: 'cat-beverages', name: 'Beverages', color: 'blue', description: 'Water, juices, soda, coffee & tea', createdAt: new Date().toISOString() },
  { id: 'cat-snacks', name: 'Snacks', color: 'yellow', description: 'Chips, nuts, dried fruit & confectionery', createdAt: new Date().toISOString() },
  { id: 'cat-healthcare', name: 'Healthcare', color: 'rose', description: 'Medicines, first aid, vitamins & hygiene', createdAt: new Date().toISOString() },
  { id: 'cat-household', name: 'Household', color: 'purple', description: 'Cleaning supplies, paper towels & kitchenware', createdAt: new Date().toISOString() },
  { id: 'cat-warehouse', name: 'Warehouse / Parts', color: 'slate', description: 'Hardware, spare parts & packaging', createdAt: new Date().toISOString() },
];

export const PRESET_CATEGORIES = [
  'All',
  'Pantry',
  'Dairy & Cold',
  'Bakery',
  'Produce',
  'Beverages',
  'Snacks',
  'Healthcare',
  'Household',
  'Warehouse / Parts',
];

const UNITS_KEY = 'pantrypal_units_v1';
export const DEFAULT_UNITS = [
  'tins',
  'kg',
  'litres',
  'cans',
  'packs',
  'boxes',
  'bottles',
  'jars',
  'bags',
  'g',
  'ml',
  'units',
];

export function loadUnits(): string[] {
  try {
    const raw = localStorage.getItem(UNITS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const unique = Array.from(new Set([...DEFAULT_UNITS, ...parsed.map((u) => String(u).trim().toLowerCase())]));
        return unique.filter(Boolean);
      }
    }
  } catch {
    // fallback
  }
  return [...DEFAULT_UNITS];
}

export function saveUnit(unitName: string): string[] {
  const clean = unitName.trim().toLowerCase();
  if (!clean) return loadUnits();
  const current = loadUnits();
  if (!current.includes(clean)) {
    const updated = [...current, clean];
    try {
      localStorage.setItem(UNITS_KEY, JSON.stringify(updated));
    } catch {
      // ignore
    }
    return updated;
  }
  return current;
}

const CATEGORY_COLORS = ['amber', 'sky', 'orange', 'emerald', 'blue', 'yellow', 'rose', 'purple', 'slate'];

export function createNewCategoryItem(name: string, existingCategories: CategoryItem[] = []): CategoryItem {
  const cleanName = name.trim();
  const colorIndex = existingCategories.length % CATEGORY_COLORS.length;
  return {
    id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    color: CATEGORY_COLORS[colorIndex],
    description: `Custom category: ${cleanName}`,
    createdAt: new Date().toISOString(),
  };
}

export const SAMPLE_DEMO_INVENTORY: InventoryItem[] = [
  {
    id: '012000000133',
    name: 'Can of Black Beans 400g',
    category: 'Pantry',
    unit: 'tins',
    location: 'Pantry Shelf A2',
    notes: 'Organic black beans, rich in fiber',
    quantity: 2,
    bestByDate: '2026-08-15',
    batches: [
      {
        id: 'batch-beans-1',
        bestByDate: '2026-08-15', // Aug 2026
        quantity: 1,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        id: 'batch-beans-2',
        bestByDate: '2026-09-20', // Sep 2026
        quantity: 1,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '028400064082',
    name: 'Organic Whole Milk 1L',
    category: 'Dairy & Cold',
    unit: 'litres',
    location: 'Fridge 1 - Top Shelf',
    notes: 'Keep chilled below 4°C',
    quantity: 5,
    bestByDate: getRelativeDate(3),
    batches: [
      {
        id: 'batch-milk-1',
        bestByDate: getRelativeDate(3),
        quantity: 2,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
      {
        id: 'batch-milk-2',
        bestByDate: getRelativeDate(8),
        quantity: 3,
        createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '071100001004',
    name: 'Sparkling Mineral Water 750ml',
    category: 'Beverages',
    unit: 'bottles',
    location: 'Drinks Crate C',
    notes: 'Glass bottles',
    quantity: 12,
    bestByDate: getRelativeDate(180),
    batches: [
      {
        id: 'batch-water-1',
        bestByDate: getRelativeDate(180),
        quantity: 12,
        createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '041196910759',
    name: 'Extra Virgin Olive Oil 500ml',
    category: 'Pantry',
    unit: 'bottles',
    location: 'Pantry Shelf C3',
    notes: 'Cold pressed',
    quantity: 6,
    bestByDate: getRelativeDate(365),
    batches: [
      {
        id: 'batch-oil-1',
        bestByDate: getRelativeDate(365),
        quantity: 6,
        createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 14).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '030000061201',
    name: 'Rolled Oats 1kg Box',
    category: 'Pantry',
    unit: 'kg',
    location: 'Pantry Shelf A1',
    notes: 'Whole grain',
    quantity: 3,
    bestByDate: getRelativeDate(-2), // 1 box expired
    batches: [
      {
        id: 'batch-oats-expired',
        bestByDate: getRelativeDate(-2),
        quantity: 1,
        createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      },
      {
        id: 'batch-oats-fresh',
        bestByDate: getRelativeDate(150),
        quantity: 2,
        createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '043000014028',
    name: 'Dark Roast Ground Coffee 250g',
    category: 'Beverages',
    unit: 'bags',
    location: 'Coffee Station',
    notes: '100% Arabica',
    quantity: 8,
    bestByDate: getRelativeDate(90),
    batches: [
      {
        id: 'batch-coffee-1',
        bestByDate: getRelativeDate(90),
        quantity: 8,
        createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Production initial inventory is empty for real user data
export const INITIAL_INVENTORY: InventoryItem[] = [];

// Open IndexedDB connection
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(DB_STORE_INVENTORY)) {
        db.createObjectStore(DB_STORE_INVENTORY, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DB_STORE_CATEGORIES)) {
        db.createObjectStore(DB_STORE_CATEGORIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(DB_STORE_MOVEMENTS)) {
        db.createObjectStore(DB_STORE_MOVEMENTS, { keyPath: 'id' });
      }
    };
  });
}

// Normalize any item: recalculate total collective quantity and sort batches chronologically
export function normalizeItem(raw: Partial<InventoryItem>): InventoryItem {
  const id = String(raw.id || '').trim();
  const name = String(raw.name || 'Unnamed Item').trim();
  const category = String(raw.category || 'General').trim();

  let batches: DateBatch[] = [];

  if (Array.isArray(raw.batches) && raw.batches.length > 0) {
    batches = raw.batches.map((b, idx) => ({
      id: b.id || `batch-${idx}-${Date.now()}`,
      bestByDate: (b.bestByDate || '').trim(),
      quantity: Math.max(0, typeof b.quantity === 'number' ? b.quantity : 1),
      createdAt: b.createdAt || new Date().toISOString(),
    }));
  } else {
    const legacyDate = (raw.bestByDate || '').trim();
    const legacyQty = Math.max(0, typeof raw.quantity === 'number' ? raw.quantity : 1);
    batches = [
      {
        id: `batch-${Date.now()}`,
        bestByDate: legacyDate,
        quantity: legacyQty,
        createdAt: raw.createdAt || new Date().toISOString(),
      },
    ];
  }

  const positiveBatches = batches.filter((b) => b.quantity > 0);
  if (positiveBatches.length > 0) {
    batches = positiveBatches;
  }

  batches.sort((a, b) => {
    if (!a.bestByDate) return 1;
    if (!b.bestByDate) return -1;
    return a.bestByDate.localeCompare(b.bestByDate);
  });

  const totalQuantity = batches.reduce((sum, b) => sum + b.quantity, 0);
  const earliestDate = batches.find((b) => Boolean(b.bestByDate && b.quantity > 0))?.bestByDate || batches[0]?.bestByDate || '';
  const unit = raw.unit && String(raw.unit).trim() ? String(raw.unit).trim() : 'units';

  return {
    id,
    name,
    category,
    unit,
    batches,
    quantity: totalQuantity,
    bestByDate: earliestDate,
    location: raw.location ? String(raw.location).trim() : undefined,
    notes: raw.notes ? String(raw.notes).trim() : undefined,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    // Explicitly retain your custom threshold values safely in database syncs!
    minStockLevel: typeof raw.minStockLevel === 'number' ? raw.minStockLevel : 2,
  };
}

// Add batch
export function addBatchToItem(item: InventoryItem, bestByDate: string, qtyToAdd: number = 1): InventoryItem {
  const cleanDate = (bestByDate || '').trim();
  const existingBatches = [...(item.batches || [])];

  const matchIndex = existingBatches.findIndex((b) => (b.bestByDate || '').trim() === cleanDate);

  if (matchIndex >= 0) {
    existingBatches[matchIndex] = {
      ...existingBatches[matchIndex],
      quantity: existingBatches[matchIndex].quantity + qtyToAdd,
    };
  } else {
    existingBatches.push({
      id: `batch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      bestByDate: cleanDate,
      quantity: qtyToAdd,
      createdAt: new Date().toISOString(),
    });
  }

  return normalizeItem({
    ...item,
    batches: existingBatches,
    updatedAt: new Date().toISOString(),
  });
}

// Remove batch (FIFO or specific)
export function removeBatchFromItem(
  item: InventoryItem,
  targetBatchId?: string,
  qtyToRemove: number = 1
): { updatedItem: InventoryItem; deductedBatch?: DateBatch } {
  const existingBatches = item.batches.map((b) => ({ ...b }));

  let batchToDeductIndex = -1;

  if (targetBatchId) {
    batchToDeductIndex = existingBatches.findIndex((b) => b.id === targetBatchId && b.quantity > 0);
  }

  if (batchToDeductIndex === -1) {
    const sortedIndices = existingBatches
      .map((b, idx) => ({ b, idx }))
      .filter((x) => x.b.quantity > 0)
      .sort((a, b) => {
        if (!a.b.bestByDate) return 1;
        if (!b.b.bestByDate) return -1;
        return a.b.bestByDate.localeCompare(b.b.bestByDate);
      });

    if (sortedIndices.length > 0) {
      batchToDeductIndex = sortedIndices[0].idx;
    }
  }

  if (batchToDeductIndex === -1) {
    return { updatedItem: item };
  }

  const targetBatch = existingBatches[batchToDeductIndex];
  const deductedQty = Math.min(targetBatch.quantity, qtyToRemove);
  targetBatch.quantity -= deductedQty;

  const updatedItem = normalizeItem({
    ...item,
    batches: existingBatches,
    updatedAt: new Date().toISOString(),
  });

  return {
    updatedItem,
    deductedBatch: {
      ...targetBatch,
      quantity: targetBatch.quantity,
    },
  };
}

// Purge leftover testing data on first load to make app production-ready
const PURGE_KEY = 'pantrypal_purged_test_data_v1';

export async function purgeInitialTestingData(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const alreadyPurged = localStorage.getItem(PURGE_KEY);
    if (!alreadyPurged) {
      // Clear localStorage testing keys
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(MOVEMENTS_KEY);
      localStorage.setItem(PURGE_KEY, 'true');

      // Clear IndexedDB stores
      const db = await openDB();
      const transaction = db.transaction([DB_STORE_INVENTORY, DB_STORE_MOVEMENTS], 'readwrite');
      transaction.objectStore(DB_STORE_INVENTORY).clear();
      transaction.objectStore(DB_STORE_MOVEMENTS).clear();
      await new Promise<void>((resolve) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    }
  } catch {
    // fallback safe
  }
}

// Load inventory
export async function loadInventory(): Promise<InventoryItem[]> {
  try {
    const db = await openDB();
    return new Promise<InventoryItem[]>((resolve) => {
      const transaction = db.transaction(DB_STORE_INVENTORY, 'readonly');
      const store = transaction.objectStore(DB_STORE_INVENTORY);
      const request = store.getAll();

      request.onsuccess = () => {
        const rawItems = request.result as Partial<InventoryItem>[];
        if (rawItems && rawItems.length > 0) {
          resolve(rawItems.map(normalizeItem));
        } else {
          const localData = localStorage.getItem(STORAGE_KEY);
          if (localData) {
            try {
              const parsed = JSON.parse(localData);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const norm = parsed.map(normalizeItem);
                saveInventory(norm);
                resolve(norm);
                return;
              }
            } catch {
              // ignore
            }
          }
          resolve([]);
        }
      };

      request.onerror = () => {
        resolve(loadFromLocalStorageFallback());
      };
    });
  } catch {
    return loadFromLocalStorageFallback();
  }
}

function loadFromLocalStorageFallback(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeItem);
      }
    }
  } catch {
    // ignore
  }
  return [];
}

// Save inventory
export async function saveInventory(items: InventoryItem[]): Promise<void> {
  const normalized = items.map(normalizeItem);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }

  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DB_STORE_INVENTORY, 'readwrite');
      const store = transaction.objectStore(DB_STORE_INVENTORY);
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        normalized.forEach((item) => store.put(item));
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // ignore
  }
}

// ======================== CATEGORY STORAGE ========================

export async function loadCategories(): Promise<CategoryItem[]> {
  try {
    const db = await openDB();
    return new Promise<CategoryItem[]>((resolve) => {
      const transaction = db.transaction(DB_STORE_CATEGORIES, 'readonly');
      const store = transaction.objectStore(DB_STORE_CATEGORIES);
      const request = store.getAll();

      request.onsuccess = () => {
        const cats = request.result as CategoryItem[];
        if (cats && cats.length > 0) {
          resolve(cats);
        } else {
          const localCats = localStorage.getItem(CATEGORIES_KEY);
          if (localCats) {
            try {
              const parsed = JSON.parse(localCats);
              if (Array.isArray(parsed) && parsed.length > 0) {
                saveCategories(parsed);
                resolve(parsed);
                return;
              }
            } catch {
              // ignore
            }
          }
          saveCategories(INITIAL_CATEGORIES);
          resolve(INITIAL_CATEGORIES);
        }
      };

      request.onerror = () => {
        resolve(loadCategoriesFromLocalStorageFallback());
      };
    });
  } catch {
    return loadCategoriesFromLocalStorageFallback();
  }
}

function loadCategoriesFromLocalStorageFallback(): CategoryItem[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(INITIAL_CATEGORIES));
  } catch {
    // ignore
  }
  return INITIAL_CATEGORIES;
}

export async function saveCategories(categories: CategoryItem[]): Promise<void> {
  try {
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
  } catch {
    // ignore
  }

  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DB_STORE_CATEGORIES, 'readwrite');
      const store = transaction.objectStore(DB_STORE_CATEGORIES);
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        categories.forEach((cat) => store.put(cat));
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // ignore
  }
}

// Rename category across all inventory items
export function renameCategoryInItems(items: InventoryItem[], oldName: string, newName: string): InventoryItem[] {
  return items.map((item) => {
    if (item.category.trim().toLowerCase() === oldName.trim().toLowerCase()) {
      return {
        ...item,
        category: newName.trim(),
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
}

// Delete category and reassign items to replacement
export function reassignCategoryInItems(items: InventoryItem[], oldName: string, replacementName: string = 'General'): InventoryItem[] {
  return items.map((item) => {
    if (item.category.trim().toLowerCase() === oldName.trim().toLowerCase()) {
      return {
        ...item,
        category: replacementName.trim(),
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
}

// ======================== MOVEMENT / AUDIT LOG STORAGE ========================

export async function loadMovements(): Promise<StockMovement[]> {
  try {
    const raw = localStorage.getItem(MOVEMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 100);
    }
  } catch {
    // ignore
  }
  return [];
}

export async function recordMovement(movement: Omit<StockMovement, 'id' | 'timestamp'>): Promise<StockMovement[]> {
  const newEntry: StockMovement = {
    ...movement,
    id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  let list = await loadMovements();
  list = [newEntry, ...list].slice(0, 100); // keep recent 100

  try {
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
  return list;
}

export function clearMovements(): void {
  try {
    localStorage.removeItem(MOVEMENTS_KEY);
  } catch {
    // ignore
  }
}

// Statistics
export function computeInventoryStats(items: InventoryItem[]): InventoryStats {
  let collectiveQty = 0;
  let expiringSoonCount = 0;
  let expiredCount = 0;
  const categories = new Set<string>();

  items.forEach((item) => {
    collectiveQty += Math.max(0, item.quantity);
    if (item.category) categories.add(item.category.trim());

    item.batches.forEach((b) => {
      if (b.quantity > 0 && b.bestByDate) {
        const status = getExpiryStatus(b.bestByDate);
        if (status === 'expired') expiredCount++;
        else if (status === 'expiring-soon') expiringSoonCount++;
      }
    });
  });

  return {
    totalItems: items.length,
    collectiveQty,
    expiringSoonCount,
    expiredCount,
    categoriesCount: categories.size,
  };
}

export function getExpiryStatus(bestByDate: string): ExpiryStatus {
  if (!bestByDate || bestByDate.trim() === '') return 'none';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = bestByDate.split('-');
  if (parts.length !== 3) return 'none';

  const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 7) return 'expiring-soon';
  return 'fresh';
}

export function getDaysRemaining(bestByDate: string): number | null {
  if (!bestByDate || bestByDate.trim() === '') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parts = bestByDate.split('-');
  if (parts.length !== 3) return null;

  const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  targetDate.setHours(0, 0, 0, 0);

  return Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatBatchDate(dateString: string): string {
  if (!dateString) return 'No Date';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;

  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function exportToJSON(items: InventoryItem[], categories?: CategoryItem[]): string {
  return JSON.stringify(
    {
      app: 'PantryPal',
      exportedAt: new Date().toISOString(),
      itemCount: items.length,
      collectiveQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      categories: categories || INITIAL_CATEGORIES,
      items: items.map(normalizeItem),
    },
    null,
    2
  );
}

export function exportToCSV(items: InventoryItem[]): string {
  const headers = ['ID (Barcode)', 'Name', 'Category', 'Unit', 'Collective Qty', 'Batch Use-By Dates & Qty', 'Location', 'Min Alert Threshold', 'Notes'];
  const rows = items.map((item) => {
    const batchesSummary = item.batches
      .map((b: DateBatch) => `${b.bestByDate || 'No Date'} (${b.quantity} ${item.unit || 'units'})`)
      .join('; ');

    return [
      `"${item.id.replace(/"/g, '""')}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      `"${(item.unit || 'units').replace(/"/g, '""')}"`,
      item.quantity,
      `"${batchesSummary.replace(/"/g, '""')}"`,
      `"${(item.location || '').replace(/"/g, '""')}"`,
      item.minStockLevel ?? 2,
      `"${(item.notes || '').replace(/"/g, '""')}"`,
    ];
  });
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}



export function parseImportJSON(jsonText: string): { items: InventoryItem[]; categories?: CategoryItem[] } {
  const parsed = JSON.parse(jsonText);
  const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(rawItems)) {
    throw new Error('Invalid JSON format: expected an array of inventory items.');
  }

  const items = rawItems.map((raw) => {
    if (!raw.id) throw new Error('Each item must have a valid string "id" (barcode).');
    return normalizeItem(raw);
  });

  let categories: CategoryItem[] | undefined;
  if (parsed.categories && Array.isArray(parsed.categories)) {
    categories = parsed.categories.map((c: any) => ({
      id: String(c.id || `cat-${Date.now()}`),
      name: String(c.name || 'General').trim(),
      color: c.color || 'slate',
      description: c.description || '',
      createdAt: c.createdAt || new Date().toISOString(),
    }));
  }

  return { items, categories };
}

// ======================== CSV PARSING & IMPORT ========================

// Standard RFC 4180 CSV Parser
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentCell += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\r') {
        // ignore carriage return
      } else if (char === '\n') {
        currentRow.push(currentCell.trim());
        if (currentRow.length > 0 && currentRow.some((c) => c !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Normalize various date formats to "YYYY-MM-DD"
export function normalizeDateToISO(rawDate: string): string {
  if (!rawDate) return '';
  const trimmed = rawDate.trim();
  if (!trimmed) return '';

  // Case 1: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  // Case 2: DD/MM/YYYY or DD-MM-YYYY or MM/DD/YYYY
  const slashParts = trimmed.split(/[/.-]/);
  if (slashParts.length === 3) {
    if (slashParts[0].length === 4) {
      const y = slashParts[0];
      const m = slashParts[1].padStart(2, '0');
      const d = slashParts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (slashParts[2].length === 4) {
      const y = slashParts[2];
      const p1 = parseInt(slashParts[0], 10);
      const p2 = parseInt(slashParts[1], 10);
      let m = p2;
      let d = p1;
      if (p1 > 12) {
        d = p1;
        m = p2;
      } else if (p2 > 12) {
        m = p1;
        d = p2;
      }
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // Case 3: Try standard JS Date parse
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return '';
}

export interface CSVParseResult {
  items: InventoryItem[];
  categories: string[];
  warnings: string[];
}

// 🔄 HELPER RE-ADDED: Decodes complex multi-batch strings like "2028-10-06 (4 tins)" safely
function parseBatchSummaryString(batchString: string, rowIndex: number): DateBatch[] {
  if (!batchString || batchString.trim() === "" || batchString.toLowerCase().includes("no date")) {
    return [];
  }

  const segments = batchString.split(';');
  return segments.map((segment, segmentIdx) => {
    const cleanSegment = segment.trim();
    if (!cleanSegment) return null;

    // FIXED REGEX LAYOUT: Removed the broken trailing dollar sign anchor completely
    const match = cleanSegment.match(/^(\d{4}-\d{2}-\d{2})\s*\((\d+)\s*[^)]+\)/);
    if (match) {
      return {
        id: `batch-${Date.now()}-${rowIndex}-${segmentIdx}`,
        bestByDate: match[1],         // ✅ Extracted matching YYYY-MM-DD string group
        quantity: parseInt(match[2], 10), // ✅ Extracted matching quantity integer group
        createdAt: new Date().toISOString()
      };
    }

    const isoDate = normalizeDateToISO(cleanSegment);
    if (isoDate) {
      return {
        id: `batch-${Date.now()}-${rowIndex}-${segmentIdx}`,
        bestByDate: isoDate,
        quantity: 1,
        createdAt: new Date().toISOString()
      };
    }

    return null;
  }).filter((b): b is DateBatch => b !== null);
}

export function parseImportCSV(csvText: string): CSVParseResult {
  const rows = parseCSV(csvText);
  if (rows.length === 0) {
    throw new Error('CSV file is empty.');
  }

  const firstRow = rows[0].map((c) => c.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const hasHeaders = firstRow.some((h) =>
    ['id', 'barcode', 'sku', 'code', 'name', 'product', 'item', 'quantity', 'qty', 'category', 'batchusebydatesqty'].includes(h)
  );

  let idIdx = -1, nameIdx = -1, categoryIdx = -1, unitIdx = -1, qtyIdx = -1, bestByDateIdx = -1, locationIdx = -1, notesIdx = -1;
  let minAlertIdx = -1;
  let startRow = 0;

  if (hasHeaders) {
    startRow = 1;
    firstRow.forEach((col, idx) => {
      if (['id', 'barcode', 'barcodeid', 'sku', 'code', 'upc', 'ean'].includes(col) && idIdx === -1) idIdx = idx;
      else if (['name', 'product', 'productname', 'item', 'itemname', 'title', 'description'].includes(col) && nameIdx === -1) nameIdx = idx;
      else if (['category', 'cat', 'group', 'type', 'department'].includes(col) && categoryIdx === -1) categoryIdx = idx;
      else if (['unit', 'units', 'measure', 'uom'].includes(col) && unitIdx === -1) unitIdx = idx;
      else if (['quantity', 'qty', 'count', 'unitsinstock', 'amount', 'stock', 'collectiveqty'].includes(col) && qtyIdx === -1) qtyIdx = idx;
      else if (['bestbydate', 'bestby', 'expiry', 'expirydate', 'expiration', 'expirationdate', 'useby', 'usebydate', 'date', 'batchusebydatesqty'].includes(col) && bestByDateIdx === -1) bestByDateIdx = idx;
      else if (['location', 'shelf', 'bin', 'place', 'storage', 'aisle'].includes(col) && locationIdx === -1) locationIdx = idx;
      else if (['minalertthreshold', 'alertnumber', 'reorderlevel', 'minstock'].includes(col) && minAlertIdx === -1) minAlertIdx = idx;
      else if (['notes', 'note', 'memo', 'details', 'comments'].includes(col) && notesIdx === -1) notesIdx = idx;
    });
  } else {
    idIdx = 0; nameIdx = 1; categoryIdx = 2; qtyIdx = 3; unitIdx = 4; bestByDateIdx = 5; locationIdx = 6;
  }

  if (idIdx === -1) idIdx = 0;
  if (nameIdx === -1) nameIdx = 1 >= rows[0].length ? 0 : 1;

  const items: InventoryItem[] = [];
  const categoriesSet = new Set<string>();
  const warnings: string[] = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 0 || row.every((c) => !c.trim())) continue;

    let id = (row[idIdx] || '').trim();
    let name = (nameIdx !== -1 && row[nameIdx] ? row[nameIdx] : '').trim();
    const category = (categoryIdx !== -1 && row[categoryIdx] ? row[categoryIdx] : 'General').trim() || 'General';
    const unit = (unitIdx !== -1 && row[unitIdx] ? row[unitIdx] : 'units').trim().toLowerCase() || 'units';
    
    // 🔥 STRIP TEXT CHARACTERS: Cleans fields like "4 tins" or "3 litres" down to pure digits
    const rawQty = qtyIdx !== -1 ? row[qtyIdx].replace(/[^0-9]/g, '') : '1';
    let qty = parseInt(rawQty, 10);
    if (isNaN(qty) || qty < 0) qty = 1;

    const rawDate = bestByDateIdx !== -1 ? row[bestByDateIdx] : '';
    const location = locationIdx !== -1 && row[locationIdx] ? row[locationIdx].trim() : undefined;
    const notes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx].trim() : undefined;

    const rawMinAlert = minAlertIdx !== -1 ? row[minAlertIdx] : '2';
    let parsedMinAlert = parseInt(rawMinAlert, 10);
    if (isNaN(parsedMinAlert) || parsedMinAlert < 0) parsedMinAlert = 2;

    let parsedBatches = parseBatchSummaryString(rawDate, r);
    if (parsedBatches.length === 0) {
      const singleIsoDate = normalizeDateToISO(rawDate);
      parsedBatches = [
        {
          id: `batch-${Date.now()}-${r}`,
          bestByDate: singleIsoDate,
          quantity: qty, // Keeps your exact spreadsheet input numbers (e.g., 4 or 3)
          createdAt: new Date().toISOString(),
        },
      ];
    } else {
      qty = parsedBatches.reduce((sum, b: DateBatch) => sum + b.quantity, 0);
    }

    if (!id) {
      id = `MAN-${Math.floor(100000 + Math.random() * 900000)}`;
      warnings.push(`Row ${r + 1}: Generated ID "${id}" for item with missing barcode.`);
    }

    if (!name) {
      name = `Item ${id}`;
      warnings.push(`Row ${r + 1}: Missing name, defaulted to "${name}".`);
    }

    categoriesSet.add(category);

    const item: InventoryItem = normalizeItem({
      id,
      name,
      category,
      unit,
      quantity: qty,
      batches: parsedBatches,
      location,
      notes,
      minStockLevel: parsedMinAlert,
    });

    items.push(item);
  }

  if (items.length === 0) {
    throw new Error('No valid items found in CSV file.');
  }

  return {
    items,
    categories: Array.from(categoriesSet),
    warnings,
  };
}


export function generateCSVTemplate(): string {
  return [
    'ID (Barcode),Name,Category,Quantity,Unit,Best-By Date,Location,Notes',
    '012000000133,Pepsi Can 330ml,Beverages,24,cans,2026-12-31,Pantry Shelf 1,Cold storage preferred',
    '7613035411209,Nescafé Gold Blend 200g,Beverages,3,jars,2027-05-15,Top Cupboard,Instant coffee',
    '5000159407236,Snickers 4-Pack,Snacks,6,packs,2026-10-30,Snack Box,Peanut candy bars',
    '041196910759,Organic Black Beans 400g,Canned Goods,12,tins,2028-01-20,Pantry Shelf 2,High protein',
    'MAN-582910,Whole Grain Rolled Oats 1kg,Baking & Grains,2,kg,2027-03-01,Lower Bin,Breakfast cereal',
  ].join('\n');
}

// ======================== P2P OFFLINE BLUETOOTH SYNC LOGIC ========================

/**
 * Merges a remote list of pantry items received over Bluetooth from your wife's phone
 * with your own local list. It matches items by barcode ID and always keeps whichever
 * device has the newer 'updatedAt' millisecond timestamp.
 */
export function mergePantryDatabases(localItems: InventoryItem[], remoteItems: InventoryItem[]): InventoryItem[] {
  const itemMap = new Map<string, InventoryItem>();
  
  // 1. Load all of your phone's local stock items into the temporary map
  localItems.forEach(item => {
    itemMap.set(item.id, normalizeItem(item));
  });

  // 2. Loop through the incoming items received from her phone
  remoteItems.forEach(remoteItem => {
    const normalizedRemote = normalizeItem(remoteItem);
    const localItem = itemMap.get(normalizedRemote.id);

    if (!localItem) {
      // If she registered a brand new item you don't have yet, add it straight to your list
      itemMap.set(normalizedRemote.id, normalizedRemote);
    } else {
      // If the item exists on both phones, parse and compare their exact timestamp times
      const localTime = new Date(localItem.updatedAt || 0).getTime();
      const remoteTime = new Date(normalizedRemote.updatedAt || 0).getTime();

      // Keep whichever phone performed the most recent edit (Last-Write-Wins rule)
      if (remoteTime > localTime) {
        itemMap.set(normalizedRemote.id, normalizedRemote);
      }
    }
  });

  // 3. Convert the smart merged dataset back into a clean array ready for the catalog view
  return Array.from(itemMap.values());
}
