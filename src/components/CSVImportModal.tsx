import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  Check,
  AlertCircle,
  AlertTriangle,
  Layers,
  Package,
  Calendar,
  Sparkles,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { InventoryItem, CategoryItem, formatUnitLabel } from '../types/inventory';
import {
  parseImportCSV,
  generateCSVTemplate,
  formatBatchDate,
  normalizeItem,
} from '../services/storage';
import { playNewItemBeep, playErrorBeep } from '../services/sound';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingItems: InventoryItem[];
  existingCategories: CategoryItem[];
  onImportComplete: (items: InventoryItem[], newCategories?: CategoryItem[]) => void;
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  existingItems,
  existingCategories,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedData, setParsedData] = useState<{
    items: InventoryItem[];
    categories: string[];
    warnings: string[];
  } | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle template download
  const handleDownloadTemplate = () => {
    const csvContent = generateCSVTemplate();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pantry_inventory_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Process a selected or dropped file
  const processFile = (selectedFile: File) => {
    setError(null);
    setParsedData(null);

    if (!selectedFile.name.toLowerCase().endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setError('Please upload a valid .csv spreadsheet file.');
      playErrorBeep();
      return;
    }

    setFile(selectedFile);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseImportCSV(text);
        setParsedData(result);
        playNewItemBeep();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to parse CSV file.';
        setError(msg);
        playErrorBeep();
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      setError('Error reading file from disk.');
      setIsProcessing(false);
      playErrorBeep();
    };
    reader.readAsText(selectedFile);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  // Perform import
  const handleCommitImport = () => {
    if (!parsedData || parsedData.items.length === 0) return;

    let finalItems: InventoryItem[] = [];

    if (importMode === 'replace') {
      finalItems = parsedData.items;
    } else {
      // Merge mode
      const itemMap = new Map<string, InventoryItem>();
      // Put existing items in map
      existingItems.forEach((i) => {
        itemMap.set(i.id.toLowerCase(), { ...i });
      });

      // Merge imported items
      parsedData.items.forEach((imported) => {
        const key = imported.id.toLowerCase();
        if (itemMap.has(key)) {
          const existing = itemMap.get(key)!;
          // Combine batches
          const combinedBatches = [...existing.batches, ...imported.batches];
          const totalQty = combinedBatches.reduce((sum, b) => sum + b.quantity, 0);
          itemMap.set(key, {
            ...existing,
            quantity: totalQty,
            batches: combinedBatches,
            location: imported.location || existing.location,
            notes: imported.notes || existing.notes,
            updatedAt: new Date().toISOString(),
          });
        } else {
          itemMap.set(key, imported);
        }
      });

      finalItems = Array.from(itemMap.values()).map(normalizeItem);
    }

    // Register any new categories
    const existingCatNames = new Set(existingCategories.map((c) => c.name.toLowerCase()));
    const newCategoriesToCreate: CategoryItem[] = [];

    parsedData.categories.forEach((catName) => {
      const trimmed = catName.trim();
      if (trimmed && !existingCatNames.has(trimmed.toLowerCase())) {
        existingCatNames.add(trimmed.toLowerCase());
        newCategoriesToCreate.push({
          id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: trimmed,
          color: 'sky',
          createdAt: new Date().toISOString(),
        });
      }
    });

    const allCategories = [...existingCategories, ...newCategoriesToCreate];
    onImportComplete(finalItems, allCategories);
    onClose();
  };

  const resetSelection = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100 my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight leading-none">
                Upload & Import CSV
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Bulk import inventory from Excel, Sheets, or warehouse CSV files.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: DROPZONE & TEMPLATE DOWNLOAD (When no file parsed yet) */}
          {!parsedData ? (
            <div className="space-y-3.5">
              {/* Dropzone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 sm:p-8 rounded-2xl border-2 border-dashed text-center transition cursor-pointer flex flex-col items-center justify-center gap-2.5 ${
                  isDragging
                    ? 'border-sky-400 bg-sky-950/30'
                    : 'border-slate-700 bg-slate-950/60 hover:border-slate-500 hover:bg-slate-900/60'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center shadow-xs">
                  <Upload className="w-6 h-6" />
                </div>

                <div>
                  <span className="font-bold text-white text-sm block">
                    Choose a CSV file or drag and drop here
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    Supports comma-separated values (.csv) with headers
                  </span>
                </div>

                <button
                  type="button"
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                >
                  Browse Computer
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Download CSV Template Helper */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-white block truncate">
                      Need the standard CSV layout?
                    </span>
                    <span className="text-[11px] text-slate-400 truncate block">
                      Download pre-formatted sample with barcodes, quantities & expiry dates.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold border border-emerald-500/30 transition shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Template</span>
                </button>
              </div>

              {/* Supported Columns Guide */}
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs space-y-1.5 text-slate-400">
                <span className="font-semibold text-slate-300 block text-[11px] uppercase tracking-wider">
                  Supported Column Headers
                </span>
                <p className="text-[11px] leading-relaxed">
                  <strong className="text-slate-200">Barcode ID</strong>,{' '}
                  <strong className="text-slate-200">Name</strong>,{' '}
                  <strong className="text-slate-200">Category</strong>,{' '}
                  <strong className="text-slate-200">Quantity</strong>,{' '}
                  <strong className="text-slate-200">Unit</strong> (e.g. tins, kg, cans),{' '}
                  <strong className="text-slate-200">Best-By Date</strong> (YYYY-MM-DD or MM/DD/YYYY),{' '}
                  <strong className="text-slate-200">Location</strong>,{' '}
                  <strong className="text-slate-200">Notes</strong>.
                </p>
              </div>
            </div>
          ) : (
            /* STEP 2: PREVIEW & IMPORT CONFIGURATION */
            <div className="space-y-4">
              {/* File Info Bar with Change button */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-sky-400" />
                  <div>
                    <span className="font-semibold text-white block">{file?.name}</span>
                    <span className="text-[11px] text-slate-400">
                      {(file ? file.size / 1024 : 0).toFixed(1)} KB ·{' '}
                      <strong className="text-emerald-400">{parsedData.items.length} items parsed</strong>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={resetSelection}
                  className="text-xs text-slate-400 hover:text-white underline"
                >
                  Choose Different File
                </button>
              </div>

              {/* Import Strategy: Merge vs Replace */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Import Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      importMode === 'merge'
                        ? 'bg-sky-500/20 text-white border-sky-500/50 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-semibold text-xs block">Merge with Pantry</span>
                    <span className="text-[11px] opacity-80 block mt-0.5">
                      Updates matching barcodes, adds new products. Keeps existing stock.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      importMode === 'replace'
                        ? 'bg-rose-500/20 text-white border-rose-500/50 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="font-semibold text-xs block text-rose-300">Replace Entire Inventory</span>
                    <span className="text-[11px] opacity-80 block mt-0.5">
                      Clears current catalog and loads strictly the items from this CSV.
                    </span>
                  </button>
                </div>
              </div>

              {/* Warnings (if any) */}
              {parsedData.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1 max-h-24 overflow-y-auto">
                  <div className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>{parsedData.warnings.length} Notices:</span>
                  </div>
                  {parsedData.warnings.slice(0, 4).map((w, idx) => (
                    <div key={idx} className="text-[11px] text-amber-300/80">
                      • {w}
                    </div>
                  ))}
                  {parsedData.warnings.length > 4 && (
                    <div className="text-[10px] text-amber-400 font-semibold">
                      +{parsedData.warnings.length - 4} more rows adjusted automatically
                    </div>
                  )}
                </div>
              )}

              {/* Data Table Preview (First 5 Items) */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-300">
                    Preview (First {Math.min(5, parsedData.items.length)} of {parsedData.items.length} items)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Total Units:{' '}
                    <strong className="text-white font-mono">
                      {parsedData.items.reduce((s, i) => s + i.quantity, 0).toLocaleString()}
                    </strong>
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900/80 text-[10px] uppercase font-semibold text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="px-3 py-2">Barcode</th>
                          <th className="px-3 py-2">Product Name</th>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Qty</th>
                          <th className="px-3 py-2">Best-By</th>
                          <th className="px-3 py-2">Shelf</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-sans">
                        {parsedData.items.slice(0, 5).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/40">
                            <td className="px-3 py-2 font-mono text-[11px] text-sky-400 whitespace-nowrap">
                              {item.id}
                            </td>
                            <td className="px-3 py-2 font-medium text-white max-w-[140px] truncate">
                              {item.name}
                            </td>
                            <td className="px-3 py-2 text-slate-300 whitespace-nowrap">
                              {item.category}
                            </td>
                            <td className="px-3 py-2 font-mono font-semibold text-white whitespace-nowrap">
                              {item.quantity} {formatUnitLabel(item.quantity, item.unit)}
                            </td>
                            <td className="px-3 py-2 text-slate-400 whitespace-nowrap text-[11px]">
                              {item.bestByDate ? formatBatchDate(item.bestByDate) : '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-[11px]">
                              {item.location || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Cancel
          </button>

          {parsedData ? (
            <button
              type="button"
              onClick={handleCommitImport}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md transition active:scale-95"
            >
              <Check className="w-4 h-4 font-bold" />
              <span>Import {parsedData.items.length} Products</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select File</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
