import React, { useState, useRef } from 'react';
import {
  ShieldCheck,
  Database,
  Download,
  Upload,
  RotateCcw,
  Trash2,
  FileSpreadsheet,
  FileJson,
  Check,
  AlertTriangle,
  Layers,
  Package,
  History,
  HardDrive,
} from 'lucide-react';
import { InventoryItem, CategoryItem } from '../types/inventory';
import {
  exportToJSON,
  exportToCSV,
  parseImportJSON,
} from '../services/storage';
import { LocalSyncManager } from '../components/LocalSyncManager';
import { Filesystem, Directory } from '@capacitor/filesystem';


interface AdminViewProps {
  items: InventoryItem[];
  categories: CategoryItem[];
  movementsCount: number;
  onImportData: (items: InventoryItem[], categories?: CategoryItem[]) => void;
  onResetDemoData: () => void;
  onClearAllData: () => void;
  onOpenCSVImport?: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  items,
  categories,
  movementsCount,
  onImportData,
  onResetDemoData,
  onClearAllData,
  onOpenCSVImport,
}) => {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Android-compatible JSON exporter
  const handleDownloadJSON = async () => {
    try {
      const filename = `pantrypal-backup-${new Date().toISOString().split('T')[0]}.json`;
      const jsonString = exportToJSON(items, categories);

      // Check if running on Android/Capacitor environment
      if (window.hasOwnProperty('Capacitor')) {
        await Filesystem.writeFile({
          path: filename,
          data: jsonString,
          directory: Directory.Documents,
          encoding: 'utf8' as any
        });
        showFeedback('success', `Backup saved to your device "Documents" folder as ${filename}`);
      } else {
        // Standard Web Browser Fallback
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showFeedback('success', 'Full JSON backup downloaded successfully.');
      }
    } catch {
      showFeedback('error', 'Failed to generate JSON backup.');
    }
  };

  // Android-compatible CSV exporter with a native overwrite popup alert box
  const handleDownloadCSV = async () => {
    try {
      const filename = `pantrypal-inventory-${new Date().toISOString().split('T')[0]}.csv`;
      const csvString = exportToCSV(items);

      // Check if running on Android/Capacitor environment
      if (window.hasOwnProperty('Capacitor')) {
        let proceedToSave = true;

        try {
          // 1. Check if the file already exists in your phone's Documents folder
          await Filesystem.stat({
            path: filename,
            directory: Directory.Documents
          });
          
          // 2. If it didn't throw an error, the file exists! Pop up the confirm box
          proceedToSave = window.confirm(
            `A file named "${filename}" already exists.\n\nDo you want to overwrite it?`
          );
        } catch {
          // File does not exist yet, so we can safely skip the popup dialog box
          proceedToSave = true;
        }

        // 3. If user tapped "Yes" (true), write the file. If "No" (false), stop cleanly
        if (proceedToSave) {
          await Filesystem.writeFile({
            path: filename,
            data: csvString,
            directory: Directory.Documents,
            encoding: 'utf8' as any
          });
          showFeedback('success', `Spreadsheet updated successfully as ${filename}`);
        } else {
          showFeedback('error', 'Export cancelled by user.');
        }
      } else {
        // Standard Web Browser Fallback (Browsers handle duplicate names safely)
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showFeedback('success', 'CSV spreadsheet exported successfully.');
      }
    } catch {
      showFeedback('error', 'Failed to export CSV file.');
    }
  };


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const { items: parsedItems, categories: parsedCats } = parseImportJSON(content);
        onImportData(parsedItems, parsedCats);
        showFeedback(
          'success',
          `Restored ${parsedItems.length} products${
            parsedCats ? ` and ${parsedCats.length} categories` : ''
          } from backup.`
        );
      } catch (err) {
        showFeedback(
          'error',
          err instanceof Error ? err.message : 'Invalid JSON backup file.'
        );
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* 1. Header Banner */}
      <section className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sky-400" />
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Admin & Data Portal</h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Local Storage
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage database backups, import/export spreadsheets, and configure pantry catalogs.
          </p>
        </div>
      </section>

      {/* Alert / Feedback Notification */}
      {feedback && (
        <div
          role="status"
          className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 transition-all shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-200'
              : 'bg-rose-950/70 border border-rose-800 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Key Metrics Overview */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[11px] font-medium">Products</span>
            <Package className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{items.length}</div>
          <span className="text-[10px] text-slate-500">tracked items</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[11px] font-medium">Categories</span>
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{categories.length}</div>
          <span className="text-[10px] text-slate-500">active groups</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[11px] font-medium">Audit Events</span>
            <History className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">{movementsCount}</div>
          <span className="text-[10px] text-slate-500">stock logs</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span className="text-[11px] font-medium">Storage Engine</span>
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xs font-bold text-emerald-400 mt-1">IndexedDB</div>
          <span className="text-[10px] text-slate-500">persistent offline</span>
        </div>
      </section>

      {/* 3. Data Import & Export Section */}
      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-4 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            Data Portability & Backups
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Export spreadsheets or create complete database snapshots that can be restored anytime.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* CSV Spreadsheet Management Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>CSV Spreadsheet</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Standard format for Excel, Apple Numbers, and Google Sheets.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={handleDownloadCSV}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-semibold transition"
                title="Download inventory as a CSV spreadsheet"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              {onOpenCSVImport && (
                <button
                  type="button"
                  onClick={onOpenCSVImport}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Import CSV</span>
                </button>
              )}
            </div>
          </div>

          {/* JSON Full System Snapshot Card */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <FileJson className="w-4 h-4 text-sky-400" />
                <span>Full System Backup (JSON)</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Preserves all product batches, expiry dates, locations, and custom categories.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
              <button
                type="button"
                onClick={handleDownloadJSON}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-700/80 text-white text-xs font-semibold transition"
                title="Download complete JSON snapshot"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Backup JSON</span>
              </button>

              <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 text-xs font-semibold transition cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                <span>Restore JSON</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* 3.5 Local P2P Sync */}
       <section className="mt-4">
       <LocalSyncManager />
       </section> 

      {/* 4. Danger Zone / Catalog Maintenance */}
      <section className="rounded-2xl bg-slate-900 border border-rose-900/30 p-4 space-y-3 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Maintenance & Danger Zone
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Reset catalog to defaults or wipe local records. These actions cannot be undone.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          {/* Reset Demo Data */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-xs text-white block">Reset to Sample Catalog</span>
              <span className="text-[11px] text-slate-400">
                Restores starter pantry goods and default categories with current best-by dates.
              </span>
            </div>

            {confirmReset ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onResetDemoData();
                    setConfirmReset(false);
                    showFeedback('success', 'Reset catalog to default sample items.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold transition shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset to Sample Data</span>
              </button>
            )}
          </div>

          {/* Wipe All Data */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="font-semibold text-xs text-rose-300 block">Clear All Inventory</span>
              <span className="text-[11px] text-slate-400">
                Permanently deletes all stored pantry items and individual batches from local storage.
              </span>
            </div>

            {confirmClear ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onClearAllData();
                    setConfirmClear(false);
                    showFeedback('success', 'All inventory records have been cleared.');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-800/60 text-xs font-semibold transition shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Clear Inventory</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
