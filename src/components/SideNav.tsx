import React from 'react';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShieldCheck,
  X,
  Barcode,
  CheckCircle2,
  Download,
  BookOpen,
} from 'lucide-react';
import { NavTab } from '../types/inventory';
import { PWAInstallButton } from './PWAInstallButton';

interface SideNavProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  totalItems: number;
  collectiveQty: number;
  categoriesCount: number;
}

export const SideNav: React.FC<SideNavProps> = ({
  isOpen,
  onClose,
  activeTab,
  onSelectTab,
  totalItems,
  collectiveQty,
  categoriesCount,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }>; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Package, badge: totalItems },
    { id: 'guides', label: 'Guides Hub', icon: BookOpen }, // 📖 Maps your renamed vault panel
    { id: 'checklists', label: 'Checklists', icon: CheckCircle2 }, // ✅ Maps your sequential checklists component
    { id: 'admin', label: 'Admin & Backup', icon: ShieldCheck },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Side Nav Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header */}
        <div>
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-white shadow-md shadow-sky-500/20 shrink-0">
                <Barcode className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-white tracking-tight leading-none">
                  PantryPal
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-slate-400 font-medium">100% Offline</span>
                </div>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition"
              aria-label="Close Navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items List */}
          <nav className="p-3 space-y-1" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition active:scale-[0.98] ${
                    isActive
                      ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info card & Quick stats */}
        <div className="p-4 border-t border-slate-800 space-y-3 bg-slate-950/40">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block">
              Stock Summary
            </span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="font-mono text-lg font-bold text-white">
                {collectiveQty.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400">total units</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Across {totalItems} SKUs in {categoriesCount} categories
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <PWAInstallButton />
            <span className="text-[10px] text-slate-500">v3.0 Offline</span>
          </div>
        </div>
      </aside>
    </>
  );
};
