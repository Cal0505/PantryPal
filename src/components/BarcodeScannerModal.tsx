import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  X,
  Camera,
  Plus,
  Minus,
  Flashlight,
  SwitchCamera,
  Keyboard,
  Barcode as BarcodeIcon,
  Check,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { InventoryItem, ScanMode } from '../types/inventory';
import { playAddBeep, playRemoveBeep, playNewItemBeep, playErrorBeep } from '../services/sound';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: InventoryItem[];
  onAddExisting: (item: InventoryItem) => void;
  onRemoveExisting: (item: InventoryItem) => void;
  onPromptNewItem: (scannedBarcode: string) => void;
  defaultMode?: ScanMode;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  items,
  onAddExisting,
  onRemoveExisting,
  onPromptNewItem,
  defaultMode = 'add',
}) => {
  const [scanMode, setScanMode] = useState<ScanMode>(defaultMode);
  const [continuousMode, setContinuousMode] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScanned, setLastScanned] = useState<{
    code: string;
    name: string;
    qty: number;
    mode: ScanMode;
    timestamp: number;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanTimestamp = useRef<number>(0);
  const lastScannedCode = useRef<string>('');
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Sync mode with prop
  useEffect(() => {
    if (isOpen) {
      setScanMode(defaultMode);
    }
  }, [isOpen, defaultMode]);

  // Handle a processed barcode
  const handleBarcodeDetected = useCallback(
    (barcode: string) => {
      const cleanCode = barcode.trim();
      if (!cleanCode) return;

      const now = Date.now();
      // Debounce if same barcode is scanned within 1.5 seconds
      if (cleanCode === lastScannedCode.current && now - lastScanTimestamp.current < 1500) {
        return;
      }
      lastScanTimestamp.current = now;
      lastScannedCode.current = cleanCode;

      // Check if item exists in inventory
      const existingItem = items.find((i) => i.id.toLowerCase() === cleanCode.toLowerCase());

      if (existingItem) {
        if (scanMode === 'add') {
          playAddBeep();
          onAddExisting(existingItem);
          setLastScanned({
            code: cleanCode,
            name: existingItem.name,
            qty: existingItem.quantity + 1,
            mode: 'add',
            timestamp: now,
          });
        } else {
          // Remove mode
          playRemoveBeep();
          onRemoveExisting(existingItem);
          setLastScanned({
            code: cleanCode,
            name: existingItem.name,
            qty: Math.max(0, existingItem.quantity - 1),
            mode: 'remove',
            timestamp: now,
          });
        }

        if (!continuousMode) {
          stopCamera();
          onClose();
        }
      } else {
        // Item is NOT in inventory yet
        if (scanMode === 'remove') {
          playErrorBeep();
          setLastScanned({
            code: cleanCode,
            name: 'Not found in inventory',
            qty: 0,
            mode: 'remove',
            timestamp: now,
          });
        } else {
          // In Add mode: open new item registration
          playNewItemBeep();
          stopCamera();
          onPromptNewItem(cleanCode);
        }
      }
    },
    [items, scanMode, continuousMode, onAddExisting, onRemoveExisting, onPromptNewItem, onClose]
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
        // Ignore teardown errors
      }
      scannerRef.current = null;
      setCameraActive(false);
      setTorchOn(false);
    }
  }, []);

  // Start camera helper
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      if (scannerRef.current) {
        await stopCamera();
      }

      const scannerId = 'barcode-scanner-view';
      const container = document.getElementById(scannerId);
      if (!container) return;

      const html5QrCode = new Html5Qrcode(scannerId, {
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
            width: Math.floor(edge * 0.78),
            height: Math.floor(edge * 0.48), // Wider aspect ratio for standard barcodes
          };
        },
        aspectRatio: 1.3333,
      };

      await html5QrCode.start(
        { facingMode: facingMode },
        config,
        (decodedText) => {
          handleBarcodeDetected(decodedText);
        },
        () => {
          // Frame scan error, expected during searching
        }
      );

      setCameraActive(true);

      // Check torch capability
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCameraError(
        message.includes('Permission')
          ? 'Camera permission denied. You can still scan using manual entry or sample barcodes.'
          : 'Unable to start camera stream. Use manual entry or check camera permissions.'
      );
      setCameraActive(false);
    }
  }, [facingMode, handleBarcodeDetected, stopCamera]);

  // Toggle torch / flashlight
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextState);
    } catch {
      // Torch not supported by hardware
    }
  };

  // Flip camera between front & back
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Initialize camera when modal opens
  useEffect(() => {
    if (isOpen) {
      // Delay camera start slightly to allow DOM mount
      const timer = setTimeout(() => {
        startCamera();
      }, 150);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen, startCamera, stopCamera]);

  // Re-start camera when facingMode changes
  useEffect(() => {
    if (isOpen && cameraActive) {
      startCamera();
    }
  }, [facingMode]);

  // Handle manual code submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeDetected(manualCode.trim());
    setManualCode('');
    manualInputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-2 sm:p-4 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col max-h-[96vh] overflow-hidden text-slate-100">
        {/* Header with Mode Toggle & Close */}
        <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarcodeIcon className="w-5 h-5 text-sky-400" />
            <h2 className="font-semibold text-base text-white">Barcode Scanner</h2>
          </div>

          {/* Mode Switcher: Add (+1) vs Remove (-1) */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setScanMode('add')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition ${
                scanMode === 'add'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add (+1)</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMode('remove')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md transition ${
                scanMode === 'remove'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Remove (-1)</span>
            </button>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative bg-black flex-1 min-h-[260px] max-h-[380px] overflow-hidden flex flex-col items-center justify-center">
          {/* HTML5 QrCode video element mount point */}
          <div id="barcode-scanner-view" className="w-full h-full" />

          {/* Overlay Aiming Reticle (Laser Box) */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div
                className={`relative w-[76%] h-[52%] border-2 rounded-xl transition-colors duration-300 ${
                  scanMode === 'add' ? 'border-emerald-400/80 shadow-[0_0_15px_rgba(52,211,153,0.3)]' : 'border-rose-400/80 shadow-[0_0_15px_rgba(251,113,133,0.3)]'
                }`}
              >
                {/* Center Animated Laser Line */}
                <div
                  className={`absolute left-0 right-0 h-0.5 top-1/2 -translate-y-1/2 animate-pulse ${
                    scanMode === 'add' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                  }`}
                />
                <div className="absolute -top-7 left-0 right-0 text-center">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      scanMode === 'add'
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {scanMode === 'add' ? 'Align barcode to ADD (+1)' : 'Align barcode to REMOVE (-1)'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Camera Error or Loading Fallback */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-sm text-slate-300 max-w-xs">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-sky-400 text-xs font-semibold hover:bg-slate-700 transition"
              >
                <Camera className="w-4 h-4" />
                Retry Camera
              </button>
            </div>
          )}

          {/* Camera Control Overlays (Torch & Flip) */}
          {cameraActive && (
            <div className="absolute bottom-3 right-3 flex items-center gap-2 z-10">
              {hasTorch && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-full text-white backdrop-blur-md transition ${
                    torchOn ? 'bg-amber-500 shadow-lg' : 'bg-black/60 hover:bg-black/80'
                  }`}
                  title="Flashlight"
                >
                  <Flashlight className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleFacingMode}
                className="p-2.5 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition"
                title="Switch Camera"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Continuous Mode Indicator & Toggle */}
          <div className="absolute bottom-3 left-3 z-10">
            <button
              type="button"
              onClick={() => setContinuousMode(!continuousMode)}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-full backdrop-blur-md transition border ${
                continuousMode
                  ? 'bg-slate-900/80 text-sky-300 border-sky-500/40'
                  : 'bg-black/60 text-slate-300 border-slate-700'
              }`}
            >
              Continuous: {continuousMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Live Feedback Toast for last scan */}
        {lastScanned && Date.now() - lastScanned.timestamp < 4000 && (
          <div
            className={`px-4 py-2 border-b text-xs flex items-center justify-between transition-all animate-in slide-in-from-top-2 ${
              lastScanned.mode === 'add'
                ? 'bg-emerald-950/70 border-emerald-800/60 text-emerald-200'
                : 'bg-rose-950/70 border-rose-800/60 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Check className="w-4 h-4 shrink-0 font-bold" />
              <span className="font-semibold truncate">{lastScanned.name}</span>
              <span className="opacity-80 font-mono">({lastScanned.code})</span>
            </div>
            <span className="font-bold shrink-0 ml-2 font-mono">
              {lastScanned.mode === 'add' ? `+1 (Now: ${lastScanned.qty})` : `-1 (Now: ${lastScanned.qty})`}
            </span>
          </div>
        )}

        {/* Manual Barcode Entry & Bluetooth / USB Scanner Input */}
        <div className="p-3 sm:p-4 space-y-3 bg-slate-900">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                ref={manualInputRef}
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Scan with USB gun or type barcode ID..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-sky-400 font-semibold text-xs transition active:scale-95 shrink-0"
            >
              Enter
            </button>
          </form>

          {/* Instant Sample Barcodes for 1-Tap Demo Testing */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="w-3 h-3 text-amber-400" />
                Tap sample to test scanner {scanMode === 'add' ? '(+1)' : '(-1)'}:
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleBarcodeDetected(item.id)}
                  className="px-2.5 py-1 text-xs rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition text-left truncate max-w-[155px]"
                  title={`Barcode: ${item.id} (Qty: ${item.quantity})`}
                >
                  <span className="font-medium truncate block">{item.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">
                    ID: {item.id.slice(-6)} · Qty {item.quantity}
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleBarcodeDetected('880912345678')}
                className="px-2.5 py-1 text-xs rounded-lg bg-sky-950/40 hover:bg-sky-900/40 border border-sky-800/50 text-sky-300 transition text-left"
                title="Simulates scanning an item that is not in the system yet"
              >
                <span className="font-semibold block">+ Brand New Item</span>
                <span className="text-[10px] text-sky-400/80 font-mono block">ID: 880912345678</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
