import React from 'react';
import { Package, Hash, AlertTriangle, Layers } from 'lucide-react';
import { InventoryStats } from '../types/inventory';

interface InventorySummaryProps {
  stats: InventoryStats;
  onFilterExpiring?: () => void;
  onFilterAll?: () => void;
  activeFilter?: string;
}

export const InventorySummary: React.FC<InventorySummaryProps> = ({
  stats,
  onFilterExpiring,
  onFilterAll,
  activeFilter,
}) => {
  return (
    <div className="rounded-xl bg-slate-900 border border-slate-800 p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xs">
      {/* Primary Metric: Collective Qty */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-sky-400" />
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
            Collective Quantity In Stock
          </span>
          <div className="flex items-baseline gap-1.5 leading-none mt-0.5">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              {stats.collectiveQty.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-medium">total units</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Strip: Unique IDs, Categories, Expiry Watch */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs overflow-x-auto py-1 sm:py-0 border-t sm:border-t-0 border-slate-800/80">
        {/* Tracked Barcodes */}
        <button
          type="button"
          onClick={onFilterAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 hover:text-white transition shrink-0"
          title="Click to reset filters and view all SKUs"
        >
          <Hash className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-bold font-mono text-white">{stats.totalItems}</span>
          <span className="text-slate-400 text-[11px]">SKUs</span>
        </button>

        {/* Categories */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 shrink-0">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold font-mono text-white">{stats.categoriesCount}</span>
          <span className="text-slate-400 text-[11px]">Groups</span>
        </div>

        {/* Expiry Alerts Button */}
        <button
          type="button"
          onClick={onFilterExpiring}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition shrink-0 ${
            activeFilter === 'expiring'
              ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-xs'
              : stats.expiredCount > 0
              ? 'bg-rose-950/40 border-rose-800/70 text-rose-300 hover:bg-rose-900/50'
              : stats.expiringSoonCount > 0
              ? 'bg-amber-950/40 border-amber-800/70 text-amber-300 hover:bg-amber-900/50'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Filter items needing expiry attention"
        >
          <AlertTriangle
            className={`w-3.5 h-3.5 ${
              stats.expiredCount > 0
                ? 'text-rose-400'
                : stats.expiringSoonCount > 0
                ? 'text-amber-400'
                : 'text-slate-500'
            }`}
          />
          <span className="font-bold font-mono text-white">
            {stats.expiredCount + stats.expiringSoonCount}
          </span>
          <span className="text-[11px]">
            {stats.expiredCount > 0 ? 'Expired' : 'Expiring'}
          </span>
        </button>
      </div>
    </div>
  );
};
