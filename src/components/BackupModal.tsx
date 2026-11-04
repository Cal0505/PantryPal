import React, { useState } from 'react';
import { X, Download, Upload, RefreshCw, FileSpreadsheet, FileCode, Check, AlertCircle } from 'lucide-react';
import { InventoryItem } from '../types/inventory';
import { exportToJSON, exportToCSV, parseImportJSON, parseImportCSV, INITIAL_INVENTORY } from '../services/storage';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  onImport: (importedItems: InventoryItem[]) => void;
  onResetSample: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  items,
  onImport,
  onResetSample,
}) => {
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleDownloadJSON = () => {
    const jsonString = exportToJSON(items);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stocktrack-inventory-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSV = () => {
    const csvString = exportToCSV(items);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stocktrack-inventory-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        let parsedItems: InventoryItem[] = [];

        if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
          const result = parseImportCSV(content);
          parsedItems = result.items;
        } else {
          const result = parseImportJSON(content);
          parsedItems = result.items;
        }

        onImport(parsedItems);
        setImportStatus({
          success: true,
          message: `Successfully imported ${parsedItems.length} inventory items!`,
        });
        setTimeout(() => {
          onClose();
        }, 1500);
      } catch (err) {
        setImportStatus({
          success: false,
          message: err instanceof Error ? err.message : 'Failed to parse file.',
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 my-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Offline Data & Backup</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Export, restore, or transfer your local inventory
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {importStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                importStatus.success
                  ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-200'
                  : 'bg-rose-950/70 border border-rose-800 text-rose-200'
              }`}
            >
              {importStatus.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* Export Options */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
              Export Offline Backup
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDownloadJSON}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-left transition flex flex-col items-start gap-1"
              >
                <div className="flex items-center gap-1.5 text-sky-400 text-xs font-semibold">
                  <FileCode className="w-4 h-4" />
                  JSON Backup
                </div>
                <span className="text-[11px] text-slate-400">Complete item data & timestamps</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-left transition flex flex-col items-start gap-1"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                  <FileSpreadsheet className="w-4 h-4" />
                  CSV Spreadsheet
                </div>
                <span className="text-[11px] text-slate-400">Excel & Sheets compatible</span>
              </button>
            </div>
          </div>

          {/* Import JSON */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
              Restore / Import Backup
            </span>
            <label className="p-3 rounded-xl bg-slate-950 border border-slate-800 border-dashed hover:border-sky-500 hover:bg-slate-850 flex flex-col items-center justify-center gap-1 cursor-pointer transition">
              <Upload className="w-5 h-5 text-sky-400" />
              <span className="text-xs font-semibold text-slate-200">Select CSV or JSON File</span>
              <span className="text-[11px] text-slate-500">Loads products and updates your inventory</span>
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Reset Demo Data */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              <span className="text-slate-300 font-medium block">Reset to Sample Catalog</span>
              <span className="text-[11px] text-slate-500">Loads starter grocery & medical items</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Reset inventory to initial demo items?')) {
                  onResetSample();
                  onClose();
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Demo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
