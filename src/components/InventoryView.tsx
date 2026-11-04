import React, { useState, useMemo, useRef } from 'react';
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Plus,
  Minus,
  Barcode,
  Calendar,
  AlertTriangle,
  Package,
  Layers,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  Copy,
  Check,
  Edit2,
  Trash2,
  Download,
  MapPin,
  Camera,
  RefreshCw,
  PlusCircle,
  FileSpreadsheet,
  FolderOpen,
} from 'lucide-react';
import {
  InventoryItem,
  CategoryItem,
  InventoryStats,
  ViewSortOption,
  formatUnitLabel,
} from '../types/inventory';
import {
  getExpiryStatus,
  getDaysRemaining,
  formatBatchDate,
  addBatchToItem,
  removeBatchFromItem,
} from '../services/storage';
import { playAddBeep, playRemoveBeep } from '../services/sound';
import { UnifiedActionStation } from './UnifiedActionStation';
import { ShoppingList } from './ShoppingList';

interface InventoryViewProps {
  items: InventoryItem[];
  categories: CategoryItem[];
  stats: InventoryStats;
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  viewSortFilter: ViewSortOption;
  setViewSortFilter: (filter: ViewSortOption) => void;
  onUpdateItem: (item: InventoryItem) => void;
  onRegisterNewItem: (item: InventoryItem) => void;
  onDeleteItem: (itemId: string) => void;
  onOpenDetail: (item: InventoryItem) => void;
  onOpenEditItem: (item: InventoryItem) => void;
  onOpenManualStock: (preselectedCategory?: string) => void;
  onOpenCSVImport: () => void;
  onAddCategory?: (category: Omit<CategoryItem, 'id' | 'createdAt'>) => void;
  onEditCategory?: (id: string, updated: Partial<CategoryItem>, oldName: string) => void;
  onDeleteCategory?: (id: string, categoryName: string, reassignTo: string) => void;
}

const CATEGORY_COLOR_MAP: Record<string, { bg: string; dot: string; text: string; border: string }> = {
  amber: { bg: 'bg-amber-500/15', dot: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-500/30' },
  sky: { bg: 'bg-sky-500/15', dot: 'bg-sky-400', text: 'text-sky-300', border: 'border-sky-500/30' },
  emerald: { bg: 'bg-emerald-500/15', dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-500/30' },
  rose: { bg: 'bg-rose-500/15', dot: 'bg-rose-400', text: 'text-rose-300', border: 'border-rose-500/30' },
  purple: { bg: 'bg-purple-500/15', dot: 'bg-purple-400', text: 'text-purple-300', border: 'border-purple-500/30' },
  blue: { bg: 'bg-blue-500/15', dot: 'bg-blue-400', text: 'text-blue-300', border: 'border-blue-500/30' },
  orange: { bg: 'bg-orange-500/15', dot: 'bg-orange-400', text: 'text-orange-300', border: 'border-orange-500/30' },
  slate: { bg: 'bg-slate-800', dot: 'bg-slate-400', text: 'text-slate-300', border: 'border-slate-700' },
};

function getCategoryColorStyle(colorName?: string) {
  const c = (colorName || 'sky').toLowerCase();
  return CATEGORY_COLOR_MAP[c] || CATEGORY_COLOR_MAP.slate;
}

const COLOR_OPTIONS = [
  { name: 'Amber', value: 'amber' },
  { name: 'Sky Blue', value: 'sky' },
  { name: 'Emerald', value: 'emerald' },
  { name: 'Rose', value: 'rose' },
  { name: 'Purple', value: 'purple' },
  { name: 'Blue', value: 'blue' },
  { name: 'Orange', value: 'orange' },
  { name: 'Slate', value: 'slate' },
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  items,
  categories,
  stats,
  isLoading,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  viewSortFilter,
  setViewSortFilter,
  onUpdateItem,
  onRegisterNewItem,
  onDeleteItem,
  onOpenDetail,
  onOpenEditItem,
  onOpenManualStock,
  onOpenCSVImport,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [groupingMode, setGroupingMode] = useState<'category' | 'flat'>('category');
  const [activeView, setActiveView] = useState<'inventory' | 'shopping'>('inventory');
  const [expandedCatIds, setExpandedCatIds] = useState<Set<string>>(new Set());
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedBatchIds, setExpandedBatchIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [catModalMode, setCatModalMode] = useState<'create' | 'edit' | 'delete' | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryItem | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormDescription, setCatFormDescription] = useState('');
  const [catFormColor, setCatFormColor] = useState('sky');
  const [catReassignTarget, setCatReassignTarget] = useState('General');
  const [catError, setCatError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchesId = item.id.toLowerCase().includes(q);
          const matchesName = item.name.toLowerCase().includes(q);
          const matchesCategory = item.category.toLowerCase().includes(q);
          const matchesLocation = (item.location || '').toLowerCase().includes(q);
          const matchesNotes = (item.notes || '').toLowerCase().includes(q);
          const matchesBatchDates = item.batches.some((b) => (b.bestByDate || '').includes(q));
          if (!matchesId && !matchesName && !matchesCategory && !matchesLocation && !matchesNotes && !matchesBatchDates) {
            return false;
          }
        }
        if (selectedCategory !== 'All' && item.category.toLowerCase() !== selectedCategory.toLowerCase()) {
          return false;
        }
        if (viewSortFilter === 'expired-only') {
          const hasExpired = item.batches.some((b) => b.quantity > 0 && getExpiryStatus(b.bestByDate) === 'expired');
          if (!hasExpired) return false;
        } else if (viewSortFilter === 'expiring-only') {
          const hasExpiring = item.batches.some((b) => b.quantity > 0 && getExpiryStatus(b.bestByDate) === 'expiring-soon');
          if (!hasExpiring) return false;
        } else if (viewSortFilter === 'out-of-stock') {
          if (item.quantity > 0) return false;
        }
        return true;
      })
      .sort((a, b) => {
        switch (viewSortFilter) {
          case 'qty-desc': return b.quantity - a.quantity;
          case 'qty-asc': return a.quantity - b.quantity;
          case 'expiry-soon':
          case 'expired-only':
          case 'expiring-only': {
            if (!a.bestByDate) return 1;
            if (!b.bestByDate) return -1;
            return a.bestByDate.localeCompare(b.bestByDate);
          }
          case 'name-asc': return a.name.localeCompare(b.name);
          case 'id-asc': return a.id.localeCompare(b.id);
          case 'all':
          default: return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }
      });
  }, [items, searchQuery, selectedCategory, viewSortFilter]);


  // Group filtered items by category so all items are directly under their category
  const groupedCategories = useMemo(() => {
    const groups: {
      category: CategoryItem;
      items: InventoryItem[];
      totalUnits: number;
    }[] = [];

    // Target categories to display
    const targetCategories =
      selectedCategory !== 'All'
        ? categories.filter((c) => c.name.toLowerCase() === selectedCategory.toLowerCase())
        : categories;

    targetCategories.forEach((cat) => {
      const catItems = filteredItems.filter(
        (i) => (i.category || 'General').toLowerCase() === cat.name.toLowerCase()
      );
      groups.push({
        category: cat,
        items: catItems,
        totalUnits: catItems.reduce((sum, item) => sum + item.quantity, 0),
      });
    });

    // Also check for items with unlisted or custom categories
    if (selectedCategory === 'All') {
      const existingNames = new Set(categories.map((c) => c.name.toLowerCase()));
      const extraItems = filteredItems.filter(
        (i) => !existingNames.has((i.category || 'General').toLowerCase())
      );

      if (extraItems.length > 0) {
        const extraMap = new Map<string, InventoryItem[]>();
        extraItems.forEach((item) => {
          const catName = item.category || 'Other';
          if (!extraMap.has(catName)) extraMap.set(catName, []);
          extraMap.get(catName)!.push(item);
        });

        extraMap.forEach((cItems, cName) => {
          groups.push({
            category: {
              id: `custom-${cName}`,
              name: cName,
              color: 'slate',
              createdAt: new Date().toISOString(),
            },
            items: cItems,
            totalUnits: cItems.reduce((sum, item) => sum + item.quantity, 0),
          });
        });
      }
    }

    return groups;
  }, [filteredItems, categories, selectedCategory]);

  // Quick increment collective / earliest batch
  const handleQuickIncrement = (item: InventoryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const targetDate = item.bestByDate || '';
    const updated = addBatchToItem(item, targetDate, 1);
    onUpdateItem(updated);
    playAddBeep();
  };

  // Quick decrement collective / earliest batch
  const handleQuickDecrement = (item: InventoryItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (item.quantity <= 0) return;
    const targetBatch =
      item.batches.find((b) => b.quantity > 0 && b.bestByDate) ||
      item.batches.find((b) => b.quantity > 0) ||
      item.batches[0];

    if (!targetBatch) return;
    const { updatedItem } = removeBatchFromItem(item, targetBatch.id, 1);
    onUpdateItem(updatedItem);
    playRemoveBeep();
  };

  // Batch-specific stepper
  const handleBatchStep = (item: InventoryItem, batchId: string, delta: 1 | -1, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (delta === 1) {
      const batch = item.batches.find((b) => b.id === batchId);
      const targetDate = batch ? batch.bestByDate : '';
      const updated = addBatchToItem(item, targetDate, 1);
      onUpdateItem(updated);
      playAddBeep();
    } else {
      const { updatedItem } = removeBatchFromItem(item, batchId, 1);
      onUpdateItem(updatedItem);
      playRemoveBeep();
    }
  };

  // Toggle inline batch drawer
  const toggleBatchDrawer = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Copy barcode to clipboard
  const handleCopyBarcode = (barcode: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(barcode);
    setCopiedId(barcode);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Multi-select toggle
  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  // Bulk deduct
  const handleBulkDeduct = () => {
    selectedIds.forEach((id) => {
      const item = items.find((i) => i.id === id);
      if (item && item.quantity > 0) {
        handleQuickDecrement(item);
      }
    });
  };

  // Bulk export to CSV
  const handleBulkExportCSV = () => {
    const selectedList = items.filter((i) => selectedIds.has(i.id));
    if (selectedList.length === 0) return;

    const headers = ['Barcode ID', 'Name', 'Category', 'Quantity', 'Unit', 'Earliest Best-By', 'Location'];
    const rows = selectedList.map((item) => [
      `"${item.id}"`,
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      item.quantity,
      `"${item.unit || 'units'}"`,
      `"${item.bestByDate || ''}"`,
      `"${(item.location || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PantryPal_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk delete
  const handleBulkDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} selected items?`)) {
      selectedIds.forEach((id) => onDeleteItem(id));
      setSelectedIds(new Set());
      setIsSelectMode(false);
    }
  };

  // Collapse / Expand Category Accordions
  const toggleCollapseCategory = (catId: string) => {
    setExpandedCatIds((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const expandAllCategories = () => {
    setExpandedCatIds(new Set(groupedCategories.map((g) => g.category.id)));
  };

  const collapseAllCategories = () => {
    setExpandedCatIds(new Set());
  };

  // In-place Category Management Handlers
  const openCreateCategoryModal = () => {
    setCatFormName('');
    setCatFormDescription('');
    setCatFormColor('sky');
    setCatError(null);
    setCatModalMode('create');
  };

  const openEditCategoryModal = (cat: CategoryItem) => {
    setActiveCategory(cat);
    setCatFormName(cat.name);
    setCatFormDescription(cat.description || '');
    setCatFormColor(cat.color || 'sky');
    setCatError(null);
    setCatModalMode('edit');
  };

  const openDeleteCategoryModal = (cat: CategoryItem) => {
    setActiveCategory(cat);
    const other = categories.find((c) => c.id !== cat.id);
    setCatReassignTarget(other ? other.name : 'General');
    setCatError(null);
    setCatModalMode('delete');
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = catFormName.trim();
    if (!cleanName) {
      setCatError('Category name is required.');
      return;
    }

    if (catModalMode === 'create') {
      const exists = categories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase());
      if (exists) {
        setCatError('A category with this name already exists.');
        return;
      }
      onAddCategory?.({
        name: cleanName,
        description: catFormDescription.trim(),
        color: catFormColor,
      });
    } else if (catModalMode === 'edit' && activeCategory) {
      onEditCategory?.(
        activeCategory.id,
        {
          name: cleanName,
          description: catFormDescription.trim(),
          color: catFormColor,
        },
        activeCategory.name
      );
    }
    setCatModalMode(null);
  };

  const handleDeleteCategoryConfirm = () => {
    if (!activeCategory || !onDeleteCategory) return;
    onDeleteCategory(activeCategory.id, activeCategory.name, catReassignTarget);
    setCatModalMode(null);
  };

  const hasActiveFilters = searchQuery !== '' || selectedCategory !== 'All' || viewSortFilter !== 'all';

  // Render an individual item card (Grid mode)
  const renderItemCard = (item: InventoryItem) => {
    const earliestBatch = item.batches.find((b) => b.quantity > 0 && b.bestByDate) || item.batches[0];
    const earliestExpiryStatus = earliestBatch ? getExpiryStatus(earliestBatch.bestByDate) : 'none';
    const daysRemaining = earliestBatch ? getDaysRemaining(earliestBatch.bestByDate) : null;
    const activeBatchCount = item.batches.filter((b) => b.quantity > 0).length;
    const isSelected = selectedIds.has(item.id);
    const isDrawerExpanded = expandedBatchIds.has(item.id);

    return (
      <div
        key={item.id}
        onClick={() => onOpenDetail(item)}
        className={`p-3.5 rounded-2xl bg-slate-900 border transition cursor-pointer flex flex-col justify-between shadow-xs hover:border-slate-700 group relative ${
          isSelected ? 'border-sky-500 bg-sky-950/20' : 'border-slate-800'
        }`}
      >
        <div>
          {/* Top Row: Barcode & Shelf Location */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {isSelectMode && (
                <button
                  type="button"
                  onClick={(e) => toggleSelectItem(item.id, e)}
                  className="text-sky-400 hover:text-sky-300 shrink-0"
                >
                  {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </button>
              )}

              {item.location && (
                <span className="flex items-center gap-1 text-slate-400 truncate text-[10px] bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                  <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </span>
              )}
            </div>

            {/* Barcode with 1-tap copy */}
            <button
              type="button"
              onClick={(e) => handleCopyBarcode(item.id, e)}
              className="flex items-center gap-1 font-mono text-[10px] text-slate-400 hover:text-sky-400 transition shrink-0 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800"
              title="Click to copy barcode ID"
            >
              <Barcode className="w-3 h-3 text-sky-400" />
              <span>{item.id.length > 10 ? `${item.id.slice(0, 8)}...` : item.id}</span>
              {copiedId === item.id ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 opacity-60" />
              )}
            </button>
          </div>

          {/* Product Name */}
          <h3 className="font-bold text-white text-sm leading-snug group-hover:text-sky-300 transition line-clamp-2">
            {item.name}
          </h3>

          {/* Freshness Status & Batches Strip */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {earliestBatch && earliestBatch.bestByDate ? (
              earliestExpiryStatus === 'expired' ? (
                <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Expired {Math.abs(daysRemaining || 0)}d ago</span>
                </span>
              ) : earliestExpiryStatus === 'expiring-soon' ? (
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <span>Expires in {daysRemaining}d</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700/60 text-[10px] font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>Best by: {formatBatchDate(earliestBatch.bestByDate)}</span>
                </span>
              )
            ) : (
              <span className="text-[10px] text-slate-500">No use-by date</span>
            )}

            {/* Batches count toggle button */}
            <button
              type="button"
              onClick={(e) => toggleBatchDrawer(item.id, e)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border transition flex items-center gap-1 ${
                isDrawerExpanded
                  ? 'bg-sky-500 text-white border-sky-400'
                  : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
              title="Toggle individual batch breakdown"
            >
              <Calendar className="w-3 h-3 text-sky-400" />
              <span>
                {activeBatchCount} {activeBatchCount === 1 ? 'batch' : 'batches'}
              </span>
              {isDrawerExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* Stock level visual bar */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
            <span className="font-medium text-[11px]">
              {item.quantity === 0
                ? '❌ Out of Stock'
                : item.quantity < (item.minStockLevel ?? 2)
                ? '⚠️ Low Stock Warning'
                : '✅ Stocked'}
            </span>
              <span className="font-mono">{item.quantity} units</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  item.quantity === 0
                    ? 'w-0'
                    : item.quantity < (typeof item.minStockLevel === 'number' ? item.minStockLevel : 2)
                    ? 'bg-amber-500 shadow-sm animate-pulse'
                    : 'bg-emerald-500'
                }`}
                style={{ 
                  width: `${Math.min(100, (item.quantity / (typeof item.minStockLevel === 'number' && item.minStockLevel > 0 ? item.minStockLevel : 2)) * 100)}%` 
                }}
              />
            </div>
          </div>

          {/* Inline Batch Date Breakdown Drawer */}
          {isDrawerExpanded && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 animate-in fade-in duration-150"
            >
              <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 block">
                Use-By Date Batches
              </span>
              {item.batches.length === 0 ? (
                <span className="text-xs text-slate-500">No active batches</span>
              ) : (
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {item.batches.map((batch) => {
                    const status = getExpiryStatus(batch.bestByDate);
                    return (
                      <div
                        key={batch.id}
                        className="p-1.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              status === 'expired'
                                ? 'bg-rose-400'
                                : status === 'expiring-soon'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                          />
                          <span className="font-mono text-[11px] text-slate-200 truncate">
                            {formatBatchDate(batch.bestByDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleBatchStep(item, batch.id, -1, e)}
                            className="w-5 h-5 rounded-md bg-slate-800 hover:bg-rose-950 hover:text-rose-300 flex items-center justify-center text-slate-300 transition"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <span className="font-mono font-bold text-xs text-white min-w-6 text-center">
                            {batch.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleBatchStep(item, batch.id, 1, e)}
                            className="w-5 h-5 rounded-md bg-slate-800 hover:bg-emerald-950 hover:text-emerald-300 flex items-center justify-center text-slate-300 transition"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Actions Row: Total Quantity Stepper & Edit */}
        <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
          {/* Collective Quantity with Unit of Measurement */}
          <div className="flex items-baseline gap-1">
            <span
              className={`font-mono text-xl font-extrabold tabular-nums ${
                item.quantity === 0 ? 'text-slate-500' : 'text-white'
              }`}
            >
              {item.quantity}
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {formatUnitLabel(item.quantity, item.unit)}
            </span>
          </div>

          {/* Stepper Buttons: Quick -1 and +1 */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={(e) => handleQuickDecrement(item, e)}
              disabled={item.quantity <= 0}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-800 text-slate-300 border border-slate-700/60 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition active:scale-90"
              title="Deduct -1 unit"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => handleQuickIncrement(item, e)}
              className="w-8 h-8 rounded-xl bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center font-bold shadow-xs transition active:scale-90"
              title="Add +1 unit"
            >
              <Plus className="w-4 h-4 font-bold" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditItem(item);
              }}
              className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700/60 transition"
              title="Edit product info"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render an individual item row (Compact List mode)
  const renderItemListRow = (item: InventoryItem) => {
    const earliestBatch = item.batches.find((b) => b.quantity > 0 && b.bestByDate) || item.batches[0];
    const earliestExpiryStatus = earliestBatch ? getExpiryStatus(earliestBatch.bestByDate) : 'none';
    const daysRemaining = earliestBatch ? getDaysRemaining(earliestBatch.bestByDate) : null;
    const isSelected = selectedIds.has(item.id);

    return (
      <div
        key={item.id}
        onClick={() => onOpenDetail(item)}
        className={`p-3 rounded-xl bg-slate-900 border transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 shadow-xs ${
          isSelected ? 'border-sky-500 bg-sky-950/20' : 'border-slate-800'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          {isSelectMode && (
            <button
              type="button"
              onClick={(e) => toggleSelectItem(item.id, e)}
              className="text-sky-400 hover:text-sky-300 shrink-0"
            >
              {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-xs sm:text-sm truncate">{item.name}</h3>
              <span className="font-mono text-[10px] text-slate-500 shrink-0">#{item.id}</span>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
              {item.location && <span>Shelf: {item.location}</span>}
              {earliestBatch && earliestBatch.bestByDate && (
                <span
                  className={
                    earliestExpiryStatus === 'expired'
                      ? 'text-rose-400 font-semibold'
                      : earliestExpiryStatus === 'expiring-soon'
                      ? 'text-amber-400 font-semibold'
                      : 'text-slate-400'
                  }
                >
                  Best by: {formatBatchDate(earliestBatch.bestByDate)}{' '}
                  {daysRemaining !== null ? `(${daysRemaining}d)` : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="text-right">
            <span className="font-mono text-base font-bold text-white block leading-tight">
              {item.quantity}
            </span>
            <span className="text-[10px] text-slate-400 font-medium block">
              {formatUnitLabel(item.quantity, item.unit)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => handleQuickDecrement(item, e)}
              disabled={item.quantity <= 0}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-300 text-slate-300 flex items-center justify-center disabled:opacity-30 transition"
              title="Deduct -1 unit"
            >
              <Minus className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={(e) => handleQuickIncrement(item, e)}
              className="w-7 h-7 rounded-lg bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center transition"
              title="Add +1 unit"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditItem(item);
              }}
              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              title="Edit product"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Main Unified Control Console */}
      <section aria-label="Inventory Controls" className="rounded-2xl bg-slate-900 border border-slate-800 p-3.5 sm:p-4 shadow-xs space-y-3">
        {/* Top Header Row: Title & Metrics */}
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-sky-400 shrink-0" />
            <span>Inventory & Categories</span>
            <span className="text-xs font-mono font-normal text-slate-400">
              · {stats.totalItems} items ({stats.collectiveQty.toLocaleString()} units)
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Items organized under their categories with batch dates and stock tracking.
          </p>
        </div>

                {/* 1. View Navigation Tabs (Stock vs Shopping List) */}
        <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setActiveView('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeView === 'inventory' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            📦 Stock Catalog
          </button>
          <button
            type="button"
            onClick={() => setActiveView('shopping')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeView === 'shopping' ? 'bg-slate-800 text-sky-400 shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
          🛒 Shopping List
          {items.filter(i => i.quantity <= (i.minStockLevel ?? 2)).length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shadow-xs" />
          )}
          </button>
        </div>

        {/* 2. Search Bar & View Mode Toggles Row */}
        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search barcode, product name, category, shelf..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-1 focus:ring-sky-500 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grouping Mode Toggle: Grouped by Category vs Flat List */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setGroupingMode('category')}
              className={`p-1.5 rounded-lg transition ${
                groupingMode === 'category' ? 'bg-slate-800 text-sky-400 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Group items by Category"
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setGroupingMode('flat')}
              className={`p-1.5 rounded-lg transition ${
                groupingMode === 'flat' ? 'bg-slate-800 text-sky-400 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Flat inventory list"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Toggle: Grid vs List */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'grid' ? 'bg-slate-800 text-sky-400 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-slate-800 text-sky-400 shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
              title="Compact List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Multi-Select Mode Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              setSelectedIds(new Set());
            }}
            className={`p-2 rounded-xl text-xs font-medium border transition shrink-0 ${
              isSelectMode
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
            title="Toggle multi-select mode"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dropdown Filters Row (Moved Under Search Bar) */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Dropdown 1: Dates & Quantity sort */}
          <div className="relative min-w-0 w-full sm:w-1/2">
            <select
              value={viewSortFilter}
              onChange={(e) => setViewSortFilter(e.target.value as ViewSortOption)}
              className="w-full min-w-0 appearance-none pl-3 pr-7 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-sky-500 truncate cursor-pointer shadow-xs font-medium"
              aria-label="Sort and filter by date and quantity"
            >
              <option value="all">Sort: Recent First</option>
              <option value="expiry-soon">Expiring / Expired</option>
              <option value="expired-only">Expired Only</option>
              <option value="expiring-only">Expiring in 7 Days</option>
              <option value="qty-desc">Qty: High to Low</option>
              <option value="qty-asc">Qty: Low to High</option>
              <option value="out-of-stock">Out of Stock (0)</option>
              <option value="name-asc">Name: A to Z</option>
              <option value="id-asc">Barcode ID</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Dropdown 2: Filter by Category */}
          <div className="relative min-w-0 w-full sm:w-1/2 flex items-center gap-1.5">
            <div className="relative flex-1 min-w-0">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    openCreateCategoryModal();
                  } else {
                    setSelectedCategory(e.target.value);
                  }
                }}
                className="w-full min-w-0 appearance-none pl-3 pr-7 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-sky-500 truncate cursor-pointer shadow-xs font-medium"
                aria-label="Filter by category"
              >
                <option value="All">All Categories ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
                {onAddCategory && (
                  <option value="__new__">+ New Category...</option>
                )}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
            {onAddCategory && (
              <button
                type="button"
                onClick={openCreateCategoryModal}
                className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-sky-300 border border-slate-800 transition shrink-0"
                title="Create New Category"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Status / Items Count & Reset Row */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-xs">
          <span className="text-[11px] font-mono text-slate-400">
            Showing <strong className="text-white">{filteredItems.length}</strong> of {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>

          <div className="flex items-center gap-2.5">
            {groupingMode === 'category' && (
              <button
                type="button"
                onClick={expandedCatIds.size > 0 ? collapseAllCategories : expandAllCategories}
                className="text-[11px] text-slate-400 hover:text-sky-300 font-medium transition cursor-pointer"
              >
                {expandedCatIds.size > 0 ? 'Collapse All' : 'Expand All'}
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                  setViewSortFilter('all');
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-medium underline underline-offset-2 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 2. On-Demand Barcode Scanner Drawer */}
      {scannerOpen && (
        <section aria-label="Barcode Scanner Viewport" className="rounded-2xl bg-slate-900 border border-sky-500/40 overflow-hidden shadow-md animate-in fade-in duration-200">
          <div className="p-3 bg-sky-950/40 border-b border-sky-900/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white">Live Barcode Scanner Station</span>
            </div>
            <button
              type="button"
              onClick={() => setScannerOpen(false)}
              className="text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
            >
              Close Scanner ✕
            </button>
          </div>
          <div className="p-3 sm:p-4 bg-slate-900/90">
            <UnifiedActionStation
              items={items}
              categories={categories}
              onUpdateItem={onUpdateItem}
              onRegisterNewItem={onRegisterNewItem}
              onOpenDetail={onOpenDetail}
              onAddCategory={onAddCategory}
            />
          </div>
        </section>
      )}

      {/* 3. Multi-Select Floating Action Bar (if active) */}
      {isSelectMode && (
        <section aria-label="Bulk Selection Controls" className="sticky top-16 z-20 animate-in fade-in">
          <div className="rounded-xl bg-sky-950/90 border border-sky-700/80 p-2.5 backdrop-blur-md flex items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="font-semibold text-white hover:underline flex items-center gap-1"
              >
                <CheckSquare className="w-4 h-4" />
                <span>
                  {selectedIds.size === filteredItems.length && filteredItems.length > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </span>
              </button>
              <span className="text-sky-300 font-mono">({selectedIds.size} selected)</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkDeduct}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium disabled:opacity-40 transition"
              >
                <Minus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Deduct -1</span>
              </button>

              <button
                type="button"
                onClick={handleBulkExportCSV}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium disabled:opacity-40 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-rose-200 font-medium disabled:opacity-40 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelectMode(false);
                  setSelectedIds(new Set());
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4. Main Active Workspace View Switch */}
      <section aria-label="Inventory Catalog Items">
        {activeView === 'shopping' ? (
          <ShoppingList 
            items={items} 
            categories={categories} 
            onQuickIncrement={(item) => handleQuickIncrement(item)} 
          />
        ) : (
          /* Your original multi-mode catalog list loop renders here cleanly */
          <>
            {isLoading ? (
              <div className="p-12 text-center text-slate-500 text-xs">Loading offline inventory...</div>
            ) : filteredItems.length === 0 ? (
              /* Empty / No Match State */
              <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800/80 text-center space-y-3">
                <Package className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="font-bold text-white text-base">No inventory items found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {hasActiveFilters
                    ? 'No items matched your search query or filters. Clear your filters to see all pantry items.'
                    : 'Your pantry inventory is currently empty. Scan or add your first item to get started!'}
                </p>
                <div className="pt-2 flex justify-center gap-2.5">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('All');
                        setViewSortFilter('all');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
                    >
                      Reset Filters
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenManualStock()}
                    className="px-3.5 py-2 rounded-xl bg-sky-500 text-xs font-semibold text-white hover:bg-sky-400 transition"
                  >
                    + Add Item
                  </button>
                </div>
              </div>
            ) : groupingMode === 'category' ? (
              /* ========================================================= */
              /* GROUPED BY CATEGORY VIEW: All items under their category  */
              /* ========================================================= */
              <div className="space-y-4">
                {groupedCategories.map((group) => {
                  const isCollapsed = searchQuery.trim() ? false : !expandedCatIds.has(group.category.id);
                  const badgeStyle = getCategoryColorStyle(group.category.color);

                  if (searchQuery.trim() && group.items.length === 0) {
                    return null;
                  }

                  return (
                    <div
                      key={group.category.id}
                      className="rounded-2xl bg-slate-900/90 border border-slate-800/90 overflow-hidden shadow-xs transition"
                    >
                      {/* Category Header Banner */}
                      <div className="p-3 sm:p-3.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5">
                        <div
                          onClick={() => toggleCollapseCategory(group.category.id)}
                          className="flex items-center gap-2.5 min-w-0 cursor-pointer select-none group/cat"
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapseCategory(group.category.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 group-hover/cat:text-white group-hover/cat:bg-slate-800 transition shrink-0"
                            title={isCollapsed ? 'Expand category items' : 'Collapse category items'}
                          >
                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${badgeStyle.dot}`} />
                            <h2 className="font-bold text-white text-sm sm:text-base tracking-tight truncate group-hover/cat:text-sky-300 transition">
                              {group.category.name}
                            </h2>
                            <span className="text-[11px] font-mono text-slate-400 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 shrink-0">
                              {group.items.length} {group.items.length === 1 ? 'item' : 'items'} · {group.totalUnits} {formatUnitLabel(group.totalUnits, 'units')}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => onOpenManualStock(group.category.name)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 hover:text-sky-300 text-xs font-semibold border border-sky-500/20 transition active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Add Item</span>
                          </button>

                        {/* 🗑️ Trash Can Deletion Button */}
                        {onDeleteCategory && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteCategoryModal(group.category);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                            title={`Delete ${group.category.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="p-3 sm:p-4">
                          {viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {group.items.map((item) => renderItemCard(item))}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {group.items.map((item) => renderItemListRow(item))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ========================================================= */
              /* FLAT VIEW: Direct cards/rows without category section box */
              /* ========================================================= */
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredItems.map((item) => renderItemCard(item))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredItems.map((item) => renderItemListRow(item))}
                </div>
              )
            )}
          </>
        )}
      </section>
      {/* 5. In-Place Category Create / Edit / Delete Modal */}
      {(catModalMode === 'create' || catModalMode === 'edit') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-base text-white">
                {catModalMode === 'create' ? 'Create New Category' : `Edit Category: ${activeCategory?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalMode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              {catError && (
                <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-200 text-xs">
                  {catError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  placeholder="e.g. Frozen Foods, Condiments, Sauces"
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Badge Accent Color
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLOR_OPTIONS.map((c) => {
                    const st = getCategoryColorStyle(c.value);
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setCatFormColor(c.value)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition flex items-center justify-center gap-1.5 ${
                          catFormColor === c.value
                            ? `${st.bg} ${st.border} ${st.text} ring-2 ring-white/60 font-bold`
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={catFormDescription}
                  onChange={(e) => setCatFormDescription(e.target.value)}
                  placeholder="Notes about what goes into this category..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCatModalMode(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-xs"
                >
                  {catModalMode === 'create' ? 'Create Category' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {catModalMode === 'delete' && activeCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-base text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Delete Category: {activeCategory.name}
              </h3>
              <button
                type="button"
                onClick={() => setCatModalMode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Are you sure you want to delete <strong className="text-white">{activeCategory.name}</strong>?
              </p>
              <p className="text-slate-400">
                Any existing items in this category will be automatically reassigned to the selected category below:
              </p>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Reassign Existing Items To:
                </label>
                <select
                  value={catReassignTarget}
                  onChange={(e) => setCatReassignTarget(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {categories
                    .filter((c) => c.id !== activeCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setCatModalMode(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCategoryConfirm}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
