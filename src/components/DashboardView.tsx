import React from 'react';
import {
  Package,
  Hash,
  AlertTriangle,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  Camera,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { InventoryItem, CategoryItem, StockMovement, InventoryStats, NavTab, formatUnitLabel } from '../types/inventory';
import { formatBatchDate, getExpiryStatus, getDaysRemaining } from '../services/storage';

interface DashboardViewProps {
  stats: InventoryStats;
  items: InventoryItem[];
  categories: CategoryItem[];
  movements: StockMovement[];
  onNavigate: (tab: NavTab) => void;
  onOpenManualStock: () => void;
  onOpenItemDetail: (item: InventoryItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  items,
  categories,
  movements,
  onNavigate,
  onOpenManualStock,
  onOpenItemDetail,
}) => {
  // Find all batches requiring expiry attention (<= 7 days or expired)
  const expiringBatches = React.useMemo(() => {
    const list: { item: InventoryItem; batchId: string; date: string; qty: number; status: 'expired' | 'expiring-soon'; days: number | null }[] = [];

    items.forEach((item) => {
      item.batches.forEach((b) => {
        if (b.quantity > 0 && b.bestByDate) {
          const status = getExpiryStatus(b.bestByDate);
          if (status === 'expired' || status === 'expiring-soon') {
            list.push({
              item,
              batchId: b.id,
              date: b.bestByDate,
              qty: b.quantity,
              status,
              days: getDaysRemaining(b.bestByDate),
            });
          }
        }
      });
    });

    // Sort by days ascending (expired first)
    list.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    return list;
  }, [items]);

  // Stock distribution per category
  const categoryDistribution = React.useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach((item) => {
      const cat = item.category || 'General';
      map[cat] = (map[cat] || 0) + item.quantity;
    });

    return Object.entries(map)
      .map(([name, units]) => ({
        name,
        units,
        percentage: stats.collectiveQty > 0 ? Math.round((units / stats.collectiveQty) * 100) : 0,
      }))
      .sort((a, b) => b.units - a.units);
  }, [items, stats.collectiveQty]);

  return (
    <div className="space-y-4">
      {/* 1. Metric Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* Collective Qty */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Collective Qty</span>
            <Package className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {stats.collectiveQty.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">units in stock</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Across all inventory batches</span>
        </div>

        {/* Distinct SKUs */}
        <div
          onClick={() => onNavigate('inventory')}
          className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-700 transition"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Tracked SKUs</span>
            <Hash className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {stats.totalItems}
            </span>
            <span className="text-xs text-slate-400">products</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Click to view inventory</span>
        </div>

        {/* Active Categories */}
        <div
          onClick={() => onNavigate('categories')}
          className="p-3.5 sm:p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-xs flex flex-col justify-between cursor-pointer hover:border-slate-700 transition"
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Categories</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {categories.length}
            </span>
            <span className="text-xs text-slate-400">active groups</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-1">Click to manage categories</span>
        </div>

        {/* Expiry Attention Alert */}
        <div
          className={`p-3.5 sm:p-4 rounded-xl border transition flex flex-col justify-between ${
            stats.expiredCount > 0
              ? 'bg-rose-950/30 border-rose-900/50'
              : stats.expiringSoonCount > 0
              ? 'bg-amber-950/30 border-amber-900/50'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Expiry Watch</span>
            <AlertTriangle
              className={`w-4 h-4 ${
                stats.expiredCount > 0
                  ? 'text-rose-400 animate-pulse'
                  : stats.expiringSoonCount > 0
                  ? 'text-amber-400'
                  : 'text-slate-500'
              }`}
            />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-2xl sm:text-3xl font-extrabold font-mono ${
                stats.expiredCount > 0
                  ? 'text-rose-400'
                  : stats.expiringSoonCount > 0
                  ? 'text-amber-400'
                  : 'text-slate-300'
              }`}
            >
              {stats.expiredCount + stats.expiringSoonCount}
            </span>
            <span className="text-xs text-slate-400">batches to review</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-1">
            {stats.expiredCount > 0 ? `${stats.expiredCount} expired` : `${stats.expiringSoonCount} within 7 days`}
          </span>
        </div>
      </div>

      {/* 2. Quick Action Launcher */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onOpenManualStock}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500/60 hover:bg-slate-850 transition text-left flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white group-hover:text-sky-300 block">
                Add Item
              </span>
              <span className="text-[11px] text-slate-400">
                Restock units or register new product
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('inventory')}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-850 transition text-left flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white group-hover:text-emerald-300 block">
                Barcode Scan Station
              </span>
              <span className="text-[11px] text-slate-400">
                Rapid camera & gun scanner In/Out
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('categories')}
          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/60 hover:bg-slate-850 transition text-left flex items-center justify-between group active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-white group-hover:text-indigo-300 block">
                Manage Categories
              </span>
              <span className="text-[11px] text-slate-400">
                Add, rename, or reorganize groups
              </span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white" />
        </button>
      </div>

      {/* 3. Two-Column Layout: Expiry Attention & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 sm:gap-4">
        {/* Expiry Watchlist */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Expiry Watchlist (Next 7 Days)
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              {expiringBatches.length} {expiringBatches.length === 1 ? 'batch' : 'batches'}
            </span>
          </div>

          {expiringBatches.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <span>All stored batches have good expiry standing!</span>
            </div>
          ) : (
            <div className="space-y-2">
              {expiringBatches.slice(0, 5).map((exp, idx) => (
                <div
                  key={`${exp.item.id}-${exp.batchId}-${idx}`}
                  onClick={() => onOpenItemDetail(exp.item)}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 cursor-pointer hover:border-slate-700 transition"
                >
                  <div className="min-w-0">
                    <span className="font-semibold text-xs text-white truncate block">
                      {exp.item.name}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      ID: {exp.item.id} · {exp.item.category}
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-md inline-block ${
                        exp.status === 'expired'
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {exp.status === 'expired' ? 'Expired' : `${exp.days}d left`}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                      {exp.qty} {formatUnitLabel(exp.qty, exp.item.unit)} ({formatBatchDate(exp.date)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Stock Movements / Audit Feed */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-sky-400" />
              Recent Stock Movements
            </h3>
            <span className="text-[10px] text-slate-500">Live Audit Log</span>
          </div>

          {movements.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
              <Package className="w-8 h-8 text-slate-600" />
              <span>No stock movements recorded yet. In/Out actions will appear here.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.slice(0, 5).map((mov) => (
                <div
                  key={mov.id}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                        mov.type === 'in'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {mov.type === 'in' ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                    </div>

                    <div className="min-w-0">
                      <span className="font-semibold text-white truncate block">
                        {mov.itemName}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {mov.type === 'in' ? `+${mov.quantity}` : `-${mov.quantity}`} {formatUnitLabel(mov.quantity, mov.unit)} {mov.type === 'in' ? 'In' : 'Out'}{' '}
                        {mov.batchDate ? `(${formatBatchDate(mov.batchDate)})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-white block">
                      Total: {mov.resultingTotal} {formatUnitLabel(mov.resultingTotal, mov.unit)}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(mov.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Category Stock Distribution */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Stock Units by Category
          </h3>
          <button
            type="button"
            onClick={() => onNavigate('categories')}
            className="text-xs text-sky-400 hover:text-sky-300 font-medium"
          >
            View all categories →
          </button>
        </div>

        {categoryDistribution.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            No items in inventory yet. Add your first item to see category distribution.
          </div>
        ) : (
          <div className="space-y-2.5">
            {categoryDistribution.slice(0, 6).map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">{cat.name}</span>
                  <span className="font-mono text-slate-400">
                    {cat.units} units ({cat.percentage}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(4, cat.percentage))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
