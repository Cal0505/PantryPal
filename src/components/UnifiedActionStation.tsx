import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  Barcode as BarcodeIcon,
  Plus,
  Minus,
  Check,
  AlertCircle,
  X,
  Flashlight,
  SwitchCamera,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { InventoryItem, ScanMode, DateBatch, CategoryItem, formatUnitLabel } from '../types/inventory';
import { playAddBeep, playRemoveBeep, playNewItemBeep, playErrorBeep } from '../services/sound';
import { PRESET_CATEGORIES, formatBatchDate, addBatchToItem, removeBatchFromItem, loadUnits, saveUnit } from '../services/storage';

interface UnifiedActionStationProps {
  items: InventoryItem[];
  categories?: CategoryItem[];
  onUpdateItem: (item: InventoryItem) => void;
  onRegisterNewItem: (item: InventoryItem) => void;
  onOpenDetail: (item: InventoryItem) => void;
  onAddCategory?: (newCat: Omit<CategoryItem, 'id' | 'createdAt'>) => CategoryItem | void;
}

export const UnifiedActionStation: React.FC<UnifiedActionStationProps> = ({
  items,
  categories,
  onUpdateItem,
  onRegisterNewItem,
  onOpenDetail,
  onAddCategory,
}) => {
  // Stock In (+1) vs Stock Out (-1) mode
  const [mode, setMode] = useState<ScanMode>('add');

  // Input field (types or USB scanner input)
  const [barcodeInput, setBarcodeInput] = useState('');

  // Active / default date for continuous adding
  const [selectedAddDate, setSelectedAddDate] = useState<string>('');

  // Camera scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [continuousScan, setContinuousScan] = useState(true);

  // Combined Output State: shows result of last scan or manual action
  const [outputResult, setOutputResult] = useState<{
    status: 'success' | 'not-found' | 'new-item-prompt' | 'pick-batch-add';
    mode: ScanMode;
    barcode: string;
    item?: InventoryItem;
    affectedBatch?: DateBatch;
    previousQty?: number;
    newQty?: number;
    message?: string;
    timestamp: number;
  } | null>(null);

  // Inline New Item Form State (when a barcode is not found in Add mode)
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(PRESET_CATEGORIES[1]);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [inlineNewCategoryName, setInlineNewCategoryName] = useState('');
  const [unitsList, setUnitsList] = useState<string[]>(() => loadUnits());
  const [newUnit, setNewUnit] = useState('tins');
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [inlineNewUnitName, setInlineNewUnitName] = useState('');
  const [newBestByDate, setNewBestByDate] = useState('');
  const [newQuantity, setNewQuantity] = useState(1);
  const [showSampleBarcodes, setShowSampleBarcodes] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimestamp = useRef<number>(0);
  const lastScannedCode = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Process a barcode
  const processBarcode = useCallback(
    (codeToProcess: string, overrideMode?: ScanMode, specificDate?: string) => {
      const cleanCode = codeToProcess.trim();
      if (!cleanCode) return;

      const activeMode = overrideMode || mode;
      const now = Date.now();

      // Debounce camera multi-reads on the exact same barcode
      if (cleanCode === lastScannedCode.current && now - lastScanTimestamp.current < 1500) {
        return;
      }
      lastScanTimestamp.current = now;
      lastScannedCode.current = cleanCode;

      // Check if item exists in inventory
      const existing = items.find((i) => i.id.toLowerCase() === cleanCode.toLowerCase());

      if (existing) {
        if (activeMode === 'add') {
          playAddBeep();
          const targetDate = specificDate || selectedAddDate || existing.batches[0]?.bestByDate || '';
          const updated = addBatchToItem(existing, targetDate, 1);
          onUpdateItem(updated);

          const addedBatch = updated.batches.find((b) => (b.bestByDate || '').trim() === targetDate.trim());

          setOutputResult({
            status: 'success',
            mode: 'add',
            barcode: cleanCode,
            item: updated,
            affectedBatch: addedBatch,
            previousQty: existing.quantity,
            newQty: updated.quantity,
            message: `Added +1 to ${existing.name} (${formatBatchDate(targetDate)})`,
            timestamp: now,
          });
        } else {
          // Remove mode: deduct from earliest batch (FIFO)
          if (existing.quantity <= 0) {
            playErrorBeep();
            setOutputResult({
              status: 'not-found',
              mode: 'remove',
              barcode: cleanCode,
              message: `${existing.name} is already out of stock (0 units).`,
              timestamp: now,
            });
            return;
          }

          playRemoveBeep();
          const { updatedItem, deductedBatch } = removeBatchFromItem(existing);
          onUpdateItem(updatedItem);

          setOutputResult({
            status: 'success',
            mode: 'remove',
            barcode: cleanCode,
            item: updatedItem,
            affectedBatch: deductedBatch,
            previousQty: existing.quantity,
            newQty: updatedItem.quantity,
            message: `Deducted -1 from ${existing.name} (${formatBatchDate(deductedBatch?.bestByDate || '')})`,
            timestamp: now,
          });
        }

        setBarcodeInput('');

        if (isCameraActive && !continuousScan) {
          stopCamera();
        }
      } else {
        // Item is not in inventory
        if (activeMode === 'remove') {
          playErrorBeep();
          setOutputResult({
            status: 'not-found',
            mode: 'remove',
            barcode: cleanCode,
            message: `Barcode "${cleanCode}" is not in inventory. Cannot deduct.`,
            timestamp: now,
          });
        } else {
          // Add mode: prompt quick inline registration
          playNewItemBeep();
          setOutputResult({
            status: 'new-item-prompt',
            mode: 'add',
            barcode: cleanCode,
            timestamp: now,
          });
          setNewName('');
          setNewCategory(PRESET_CATEGORIES[1]);
          setNewBestByDate('');
          setNewQuantity(1);

          if (isCameraActive) {
            stopCamera();
          }
        }
      }
    },
    [items, mode, selectedAddDate, onUpdateItem, isCameraActive, continuousScan]
  );

  // Stop camera helper
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // Ignore teardown error
      }
      scannerRef.current = null;
    }
    setIsCameraActive(false);
    setTorchOn(false);
  }, []);

  // Start camera helper
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (scannerRef.current) {
        await stopCamera();
      }

      const scannerElementId = 'unified-scanner-viewport';
      const container = document.getElementById(scannerElementId);
      if (!container) return;

      const html5QrCode = new Html5Qrcode(scannerElementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const edge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.floor(edge * 0.8),
            height: Math.floor(edge * 0.45),
          };
        },
        aspectRatio: 1.5,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
          processBarcode(decodedText);
        },
        () => {
          // Searching frame
        }
      );

      setIsCameraActive(true);

      try {
        const caps = html5QrCode.getRunningTrackCapabilities();
        if (caps && 'torch' in caps) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(
        msg.includes('Permission')
          ? 'Camera permission denied. Use manual barcode input.'
          : 'Could not access camera. Check device permissions.'
      );
      setIsCameraActive(false);
    }
  }, [facingMode, processBarcode, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (isCameraActive) {
      startCamera();
    }
  }, [facingMode]);

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch {
      // Ignore torch error
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processBarcode(barcodeInput.trim());
  };

  // Save new registered item from output station
  const handleSaveNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outputResult || outputResult.status !== 'new-item-prompt') return;
    if (!newName.trim()) return;

    const initialDate = newBestByDate.trim();
    const initQty = Math.max(1, newQuantity);

    // Resolve Category
    let finalCategory = newCategory;
    if (isAddingNewCategory && inlineNewCategoryName.trim()) {
      const cleanCat = inlineNewCategoryName.trim();
      if (onAddCategory && (!categories || !categories.some((c) => c.name.toLowerCase() === cleanCat.toLowerCase()))) {
        const created = onAddCategory({
          name: cleanCat,
          color: 'indigo',
          description: `Custom category: ${cleanCat}`,
        });
        finalCategory = created ? created.name : cleanCat;
      } else {
        finalCategory = cleanCat;
      }
    }

    // Resolve Unit
    let finalUnit = newUnit.trim().toLowerCase();
    if (isAddingNewUnit && inlineNewUnitName.trim()) {
      const cleanUnit = inlineNewUnitName.trim().toLowerCase();
      saveUnit(cleanUnit);
      finalUnit = cleanUnit;
    } else if (finalUnit) {
      saveUnit(finalUnit);
    }

    const newItem: InventoryItem = {
      id: outputResult.barcode,
      name: newName.trim(),
      category: finalCategory || 'General',
      unit: finalUnit || 'units',
      quantity: initQty,
      bestByDate: initialDate,
      batches: [
        {
          id: `batch-${Date.now()}`,
          bestByDate: initialDate,
          quantity: initQty,
          createdAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onRegisterNewItem(newItem);
    setNewName('');
    setIsAddingNewCategory(false);
    setInlineNewCategoryName('');
    setIsAddingNewUnit(false);
    setInlineNewUnitName('');
    setNewBestByDate('');
    setNewQuantity(1);
    setBarcodeInput('');
    setOutputResult({
      status: 'success',
      mode: 'add',
      barcode: newItem.id,
      item: newItem,
      affectedBatch: newItem.batches[0],
      previousQty: 0,
      newQty: newItem.quantity,
      message: `Registered & Added ${newItem.name} (${formatBatchDate(initialDate)})`,
      timestamp: Date.now(),
    });
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 shadow-md overflow-hidden">
      {/* 1. Header: Mode Switcher & Camera Toggle */}
      <div className="p-3 border-b border-slate-800/80 flex items-center justify-between gap-2 bg-slate-950/60">
        <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('add')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition active:scale-95 ${
              mode === 'add'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5 font-bold" />
            <span>Stock In (+1)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('remove')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition active:scale-95 ${
              mode === 'remove'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Minus className="w-3.5 h-3.5 font-bold" />
            <span>Stock Out (-1)</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (isCameraActive) {
              stopCamera();
            } else {
              startCamera();
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 border ${
            isCameraActive
              ? 'bg-sky-500/20 text-sky-300 border-sky-500/50'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700/80'
          }`}
          title="Toggle camera barcode scanner"
        >
          <Camera className="w-3.5 h-3.5 text-sky-400" />
          <span>{isCameraActive ? 'Close Camera' : 'Camera Scan'}</span>
        </button>
      </div>

      {/* 2. Integrated Camera Viewfinder */}
      <div className={`${isCameraActive ? 'relative' : 'hidden'} bg-black w-full min-h-[220px] max-h-[300px] flex flex-col items-center justify-center overflow-hidden border-b border-slate-800`}>
        <div id="unified-scanner-viewport" className="w-full h-full" />

        {/* Aiming Reticle with Mode Color */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            className={`relative w-[78%] h-[56%] border-2 rounded-xl transition-all ${
              mode === 'add'
                ? 'border-emerald-400/90 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                : 'border-rose-400/90 shadow-[0_0_12px_rgba(251,113,133,0.3)]'
            }`}
          >
            <div
              className={`absolute left-0 right-0 h-0.5 top-1/2 -translate-y-1/2 animate-pulse ${
                mode === 'add' ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500 shadow-[0_0_6px_#f43f5e]'
              }`}
            />
            <span
              className={`absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                mode === 'add'
                  ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-950/90 text-rose-300 border border-rose-500/40'
              }`}
            >
              {mode === 'add' ? 'Align barcode to ADD (+1)' : 'Align barcode to DEDUCT (-1)'}
            </span>
          </div>
        </div>

        {/* Camera Controls Overlay */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 z-10">
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`p-2 rounded-full text-white backdrop-blur-md transition ${
                torchOn ? 'bg-amber-500 shadow-md' : 'bg-black/60 hover:bg-black/80'
              }`}
              title="Torch"
            >
              <Flashlight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
            className="p-2 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition"
            title="Flip camera"
          >
            <SwitchCamera className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="absolute bottom-2.5 left-2.5 z-10">
          <button
            type="button"
            onClick={() => setContinuousScan(!continuousScan)}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/70 text-slate-300 border border-slate-700"
          >
            Continuous: {continuousScan ? 'ON' : 'OFF'}
          </button>
        </div>

        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 text-center space-y-2">
            <AlertCircle className="w-7 h-7 text-amber-400" />
            <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
            <button
              type="button"
              onClick={startCamera}
              className="px-3 py-1 rounded-lg bg-slate-800 text-sky-400 text-xs font-semibold hover:bg-slate-700"
            >
              Retry Camera
            </button>
          </div>
        )}
      </div>

      {/* 3. Combined Input Bar: Scan Gun / Manual Input */}
      <div className="p-3 sm:p-4 space-y-2.5">
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <BarcodeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              placeholder="Scan barcode gun or type barcode ID..."
              className="w-full pl-10 pr-8 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono"
            />
            {barcodeInput && (
              <button
                type="button"
                onClick={() => setBarcodeInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={!barcodeInput.trim()}
            className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition active:scale-95 disabled:opacity-40 flex items-center gap-1.5 shrink-0 text-white ${
              mode === 'add'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-500 shadow-sm shadow-rose-600/20'
            }`}
          >
            {mode === 'add' ? <Plus className="w-4 h-4 font-bold" /> : <Minus className="w-4 h-4 font-bold" />}
            <span>{mode === 'add' ? 'Process In (+1)' : 'Process Out (-1)'}</span>
          </button>
        </form>

        {/* 4. Combined Output Station (Real-time Feedback with Use-By Dates) */}
        {outputResult && (
          <div className="rounded-xl border overflow-hidden animate-in fade-in slide-in-from-top-1 text-xs">
            {/* Success Output */}
            {outputResult.status === 'success' && outputResult.item && (
              <div
                className={`p-3 space-y-2.5 ${
                  outputResult.mode === 'add'
                    ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-100'
                    : 'bg-rose-950/70 border-rose-800/80 text-rose-100'
                }`}
              >
                {/* Header row: Product Title, Collective Qty & Transition */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 font-extrabold" />
                        {outputResult.mode === 'add' ? '+1 Added' : '-1 Deducted'}
                      </span>
                      <span className="font-semibold text-white truncate text-sm">
                        {outputResult.item.name}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                      <span>ID: {outputResult.barcode}</span>
                      <span>·</span>
                      <span>{outputResult.item.category}</span>
                      {outputResult.affectedBatch && (
                        <>
                          <span>·</span>
                          <span className="text-white font-medium">
                            Use by: {formatBatchDate(outputResult.affectedBatch.bestByDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Collective Qty transition */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-1 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Collective Qty
                      </span>
                      <div className="font-mono text-base font-bold text-white flex items-center gap-1.5">
                        <span className="opacity-60 text-xs">{outputResult.previousQty}</span>
                        <span>→</span>
                        <span className="text-emerald-300 font-extrabold text-lg">
                          {outputResult.newQty} units
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (outputResult.item) onOpenDetail(outputResult.item);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-xs font-semibold text-sky-300 hover:text-white"
                    >
                      View Batches
                    </button>
                  </div>
                </div>

                {/* Multiple Batches Breakdown: allows picking or adjusting other dates directly! */}
                {outputResult.item.batches.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-medium flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        Stocked batches for this item:
                      </span>
                      <span className="text-[10px] text-slate-500">Tap +/- per date</span>
                    </div>

                    <div className="space-y-1">
                      {outputResult.item.batches.map((batch) => (
                        <div
                          key={batch.id}
                          className="flex items-center justify-between py-1 px-2 rounded-md bg-slate-900 border border-slate-800/60 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-medium text-white">
                              {formatBatchDate(batch.bestByDate)}
                            </span>
                            <span className="font-mono font-bold text-sky-400">
                              {batch.quantity} {batch.quantity === 1 ? 'can/unit' : 'cans/units'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (!outputResult.item) return;
                                const { updatedItem } = removeBatchFromItem(outputResult.item, batch.id, 1);
                                onUpdateItem(updatedItem);
                                setOutputResult({
                                  ...outputResult,
                                  item: updatedItem,
                                  newQty: updatedItem.quantity,
                                  previousQty: outputResult.item.quantity,
                                });
                              }}
                              className="w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 text-rose-400 flex items-center justify-center font-bold"
                              title="Deduct 1 from this date"
                            >
                              -
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!outputResult.item) return;
                                const updated = addBatchToItem(outputResult.item, batch.bestByDate, 1);
                                onUpdateItem(updated);
                                setOutputResult({
                                  ...outputResult,
                                  item: updated,
                                  newQty: updated.quantity,
                                  previousQty: outputResult.item.quantity,
                                });
                              }}
                              className="w-7 h-7 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 flex items-center justify-center font-bold"
                              title="Add 1 to this date"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Not Found in Remove Mode */}
            {outputResult.status === 'not-found' && (
              <div className="p-3 bg-amber-950/60 border-amber-800/60 text-amber-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{outputResult.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setOutputResult(null)}
                  className="p-1 hover:text-white text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Inline Quick Add Form for New Barcodes */}
            {outputResult.status === 'new-item-prompt' && (
              <div className="p-3 sm:p-4 bg-slate-950 border-sky-800/60 text-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                    <span className="font-semibold text-white">
                      New Barcode: <span className="font-mono text-sky-400">{outputResult.barcode}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOutputResult(null)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveNewItem} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Product Name
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Can of Baked Beans"
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                        autoFocus
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                          Category
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNewCategory(true);
                            setInlineNewCategoryName('');
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                          + New
                        </button>
                      </div>
                      <select
                        value={isAddingNewCategory ? '__NEW_CATEGORY__' : newCategory}
                        onChange={(e) => {
                          if (e.target.value === '__NEW_CATEGORY__') {
                            setIsAddingNewCategory(true);
                            setInlineNewCategoryName('');
                          } else {
                            setIsAddingNewCategory(false);
                            setNewCategory(e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      >
                        {categories && categories.length > 0
                          ? categories.map((cat) => (
                              <option key={cat.id} value={cat.name}>
                                {cat.name}
                              </option>
                            ))
                          : PRESET_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                        <option value="__NEW_CATEGORY__">+ New Category...</option>
                      </select>

                      {isAddingNewCategory && (
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="text"
                            value={inlineNewCategoryName}
                            onChange={(e) => setInlineNewCategoryName(e.target.value)}
                            placeholder="New category..."
                            className="flex-1 px-2 py-1 text-xs bg-slate-950 border border-indigo-500 rounded-lg text-white"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const clean = inlineNewCategoryName.trim();
                              if (clean) {
                                if (onAddCategory) {
                                  onAddCategory({ name: clean, color: 'indigo', description: `Custom category: ${clean}` });
                                }
                                setNewCategory(clean);
                              }
                              setIsAddingNewCategory(false);
                              setInlineNewCategoryName('');
                            }}
                            className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewCategory(false);
                              setInlineNewCategoryName('');
                            }}
                            className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold text-slate-400 uppercase">
                          Unit of Measure
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingNewUnit(true);
                            setInlineNewUnitName('');
                          }}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-medium"
                        >
                          + New
                        </button>
                      </div>
                      <select
                        value={isAddingNewUnit ? '__NEW_UNIT__' : newUnit}
                        onChange={(e) => {
                          if (e.target.value === '__NEW_UNIT__') {
                            setIsAddingNewUnit(true);
                            setInlineNewUnitName('');
                          } else {
                            setIsAddingNewUnit(false);
                            setNewUnit(e.target.value);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                      >
                        {unitsList.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        <option value="__NEW_UNIT__">+ New Unit...</option>
                      </select>

                      {isAddingNewUnit && (
                        <div className="mt-1 flex items-center gap-1">
                          <input
                            type="text"
                            value={inlineNewUnitName}
                            onChange={(e) => setInlineNewUnitName(e.target.value)}
                            placeholder="New unit (e.g. rolls)..."
                            className="flex-1 px-2 py-1 text-xs bg-slate-950 border border-sky-500 rounded-lg text-white"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const clean = inlineNewUnitName.trim().toLowerCase();
                              if (clean) {
                                const updated = saveUnit(clean);
                                setUnitsList(updated);
                                setNewUnit(clean);
                              }
                              setIsAddingNewUnit(false);
                              setInlineNewUnitName('');
                            }}
                            className="px-2 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsAddingNewUnit(false);
                              setInlineNewUnitName('');
                            }}
                            className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        First Use-By Date
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="date"
                          value={newBestByDate}
                          onChange={(e) => setNewBestByDate(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 30);
                            setNewBestByDate(d.toISOString().split('T')[0]);
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shrink-0"
                        >
                          +1m
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + 180);
                            setNewBestByDate(d.toISOString().split('T')[0]);
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shrink-0"
                        >
                          +6m
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setFullYear(d.getFullYear() + 1);
                            setNewBestByDate(d.toISOString().split('T')[0]);
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shrink-0"
                        >
                          +1yr
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setFullYear(d.getFullYear() + 2);
                            setNewBestByDate(d.toISOString().split('T')[0]);
                          }}
                          className="px-2 py-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shrink-0"
                        >
                          +2yr
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 uppercase mb-1">
                        Initial Quantity
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNewQuantity(Math.max(1, newQuantity - 1))}
                          className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={newQuantity}
                          onChange={(e) => setNewQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                          className="w-16 text-center py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-white font-mono font-bold text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => setNewQuantity(newQuantity + 1)}
                          className="w-8 h-8 rounded-lg bg-slate-800 text-white font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setOutputResult(null)}
                      className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newName.trim()}
                      className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-sm transition active:scale-95 disabled:opacity-40"
                    >
                      Save Item & Add to Stock
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* 5. Quick Test Barcode Chips */}
        <div className="pt-0.5">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
            <button
              type="button"
              onClick={() => setShowSampleBarcodes(!showSampleBarcodes)}
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition font-medium"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Quick Test Barcodes ({mode === 'add' ? '+1' : '-1'})</span>
              {showSampleBarcodes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <span className="text-[10px] text-slate-500">Tap to test In / Out</span>
          </div>

          {showSampleBarcodes && (
            <div className="flex flex-wrap gap-1.5 animate-in fade-in">
              {items.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => processBarcode(item.id)}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800/90 text-slate-300 transition text-left flex items-center gap-1.5"
                  title={`Process ${item.name} (${item.id})`}
                >
                  <span className="truncate max-w-[120px] font-medium">{item.name}</span>
                  <span className="font-mono text-[10px] text-sky-400">Qty: {item.quantity}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => processBarcode('999011223344', 'add')}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-sky-950/40 hover:bg-sky-900/40 border border-sky-800/50 text-sky-300 transition flex items-center gap-1"
                title="Simulates scanning a brand new barcode"
              >
                <span>+ Brand New SKU</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
