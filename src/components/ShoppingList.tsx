// ============================================================================
// PART 1 OF 3: CONFIGURATION, LIFECYCLE HOOKS AND DATA FILTER POOLS
// ============================================================================
import React, { useMemo, useState } from 'react';
import { 
  ShoppingCart, 
  FileSpreadsheet,
  CheckCircle2,
  Package,
  Layers,
  MapPin
} from 'lucide-react';
import { InventoryItem, CategoryItem, formatUnitLabel } from '../types/inventory';

interface ShoppingListProps {
  items: InventoryItem[];
  categories: CategoryItem[];
  onQuickIncrement?: (item: InventoryItem) => void;
}

export const ShoppingList: React.FC<ShoppingListProps> = ({
  items,
  categories,
  onQuickIncrement
}) => {
  const [completedItems, setCompletedItems] = useState<Set<string>>(new Set());

  // 1. Live Filter: Extract items currently at or below their alert triggers
const lowStockItems = useMemo(() => {
  return items.filter(item => item.quantity < (item.minStockLevel ?? 2));
}, [items]);

  // 2. Interactive Checklist Toggle
  const toggleCartCheck = (itemId: string) => {
    setCompletedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };
// ============================================================================
// PART 2 OF 3: CATEGORY GROUPING ENGINE AND CSV BULK EXPORTER
// ============================================================================
  // 3. Category Categorization Engine
  const groupedShoppingList = useMemo(() => {
    const groups: {
      category: CategoryItem;
      items: InventoryItem[];
    }[] = [];

    categories.forEach(cat => {
      const catItems = lowStockItems.filter(
        i => (i.category || 'General').toLowerCase() === cat.name.toLowerCase()
      );
      if (catItems.length > 0) {
        groups.push({
          category: cat,
          items: catItems,
        });
      }
    });

    // Catch unlisted loose products outside standard profiles
    const assignedCatNames = new Set(categories.map(c => c.name.toLowerCase()));
    const unlistedItems = lowStockItems.filter(
      i => !assignedCatNames.has((i.category || 'General').toLowerCase())
    );

    if (unlistedItems.length > 0) {
      groups.push({
        category: {
          id: 'cat-unlisted-shopping',
          name: 'Other Essentials',
          color: 'slate',
          createdAt: new Date().toISOString()
        },
        items: unlistedItems
      });
    }

    return groups;
  }, [lowStockItems, categories]);

  // 4. One-Click Bulk CSV Sheet Exporter
  const handleExportShoppingListCSV = () => {
    if (lowStockItems.length === 0) return;

    const headers = ['Product Name', 'Category', 'Current Qty', 'Min Alert Threshold', 'Target Restock Qty', 'Unit', 'Storage Shelf Location'];
    const rows = lowStockItems.map(item => {
      const minLevel = item.minStockLevel ?? 2;
      const suggestedReorder = Math.max(1, (minLevel * 2) - item.quantity); 
      return [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${item.category}"`,
        item.quantity,
        minLevel,
        suggestedReorder,
        `"${item.unit || 'units'}"`,
        `"${(item.location || '').replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Pantry_Shopping_List_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
// ============================================================================
// PART 3 OF 3: USER INTERFACE RENDER BLOCK & COMPONENT CLOSURE
// ============================================================================
  return (
    <div className="space-y-4 max-w-4xl mx-auto p-1 font-sans text-slate-100">
      
      {/* Header Metric Panel Banner */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950/20">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-sky-400 shrink-0" />
            <span>Automated Shopping List</span>
            <span className="text-xs font-mono font-normal bg-sky-500/10 border border-sky-500/20 text-sky-400 px-2 py-0.5 rounded-full shrink-0">
              {lowStockItems.length} items short
            </span>
          </h1>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
            Items show up here dynamically whenever their total quantity drops below their individual reorder values.
          </p>
        </div>

        {lowStockItems.length > 0 && (
          <button
            type="button"
            onClick={handleExportShoppingListCSV}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold shadow-md transition active:scale-95 shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Shopping Sheet</span>
          </button>
        )}
      </div>

      {/* Empty List Fallback State */}
      {lowStockItems.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800/60 text-center space-y-3">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-xs">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-white text-base">Pantry fully provisioned!</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            All your quantities are sitting safely above your low stock alert levels.
          </p>
        </div>
      ) : (
        /* Accordion Row Category Render Wrapper */
        <div className="space-y-4">
          {groupedShoppingList.map(group => (
            <div key={group.category.id} className="rounded-2xl bg-slate-900 border border-slate-800/80 overflow-hidden shadow-xs">
              
              <div className="p-3 bg-slate-950/70 border-b border-slate-800/80 flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-sky-400" />
                <h2 className="font-bold text-white text-xs sm:text-sm tracking-wide uppercase">
                  {group.category.name}
                </h2>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded-md border border-slate-800">
                  {group.items.length} missing
                </span>
              </div>

              <div className="divide-y divide-slate-800/50 font-sans">
                {group.items.map(item => {
                  const isChecked = completedItems.has(item.id);
                  const minThreshold = item.minStockLevel ?? 2;
                  
                  return (
                    <div 
                      key={item.id} 
                      className={`p-3.5 flex items-center justify-between gap-3 transition ${
                        isChecked ? 'bg-slate-950/40 opacity-40' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleCartCheck(item.id)}
                          className={`w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                            isChecked 
                              ? 'bg-sky-500 border-sky-400 text-white' 
                              : 'border-slate-700 bg-slate-950 hover:border-slate-500'
                          }`}
                        >
                          {isChecked && <CheckCircle2 className="w-4 h-4" />}
                        </button>

                        <div className="min-w-0">
                          <span className={`font-bold text-xs sm:text-sm block text-white truncate ${
                            isChecked ? 'line-through text-slate-500' : ''
                          }`}>
                            {item.name}
                          </span>
                          
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                            <span className="font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Stock: {item.quantity} / {minThreshold} {formatUnitLabel(item.quantity, item.unit)}
                            </span>
                            {item.location && (
                              <span className="flex items-center gap-0.5 truncate max-w-[120px] text-slate-400">
                                <MapPin className="w-3 h-3 text-slate-500" />
                                <span className="truncate">{item.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-sans">
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] font-mono text-slate-400 block leading-none">Suggested Restock</span>
                          <span className="text-xs font-bold text-emerald-400 block mt-1">
                            +{Math.max(1, minThreshold - item.quantity)} {item.unit || 'units'}
                          </span>
                        </div>

                        {onQuickIncrement && (
                          <button
                            type="button"
                            onClick={() => onQuickIncrement(item)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-sky-500/20 text-slate-400 hover:text-sky-400 border border-slate-700/60 transition active:scale-95"
                            title="Add 1 restocked unit directly into database"
                          >
                            <Package className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
