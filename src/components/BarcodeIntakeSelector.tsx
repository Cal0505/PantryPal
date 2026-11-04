import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Barcode,
  Camera,
  Keyboard,
  Sparkles,
  Check,
  AlertCircle,
  Flashlight,
  SwitchCamera,
  RotateCcw,
  X,
} from 'lucide-react';
import { playAddBeep, playErrorBeep } from '../services/sound';

interface BarcodeIntakeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  idPrefix?: string;
}

export const BarcodeIntakeSelector: React.FC<BarcodeIntakeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  required = true,
  idPrefix = 'reg-barcode',
}) => {
  // Method: 'manual' vs 'camera'
  const [intakeMethod, setIntakeMethod] = useState<'manual' | 'camera'>('manual');

  // Camera scanner states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [justScannedCode, setJustScannedCode] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = useRef<string>(`${idPrefix}-scanner-container-${Date.now()}`);

  // Stop camera stream safely
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
    }
    setIsCameraActive(false);
    setTorchOn(false);
  }, []);

  // Start camera scanner
  const startCamera = useCallback(async (facing: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setJustScannedCode(null);
    try {
      if (scannerRef.current) {
        await stopCamera();
      }

      const container = document.getElementById(scannerContainerId.current);
      if (!container) return;

      const html5QrCode = new Html5Qrcode(scannerContainerId.current, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });

      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: facing },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.8),
              height: Math.floor(minEdge * 0.5),
            };
          },
          aspectRatio: 1.6,
        },
        (decodedText) => {
          const cleanCode = decodedText.trim();
          if (!cleanCode) return;

          playAddBeep();
          onChange(cleanCode);
          setJustScannedCode(cleanCode);

          // Stop camera after successful scan so user sees result
          stopCamera();
        },
        () => {
          // Frame scan failure - noop
        }
      );

      setIsCameraActive(true);

      // Check flashlight support
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities && 'torch' in capabilities) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
        setCameraError('Camera access denied. Please grant camera permissions or type the barcode manually.');
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFoundError')) {
        setCameraError('No camera found on this device. Please use manual input.');
      } else {
        setCameraError('Unable to start camera scanner. Please use manual input or test barcodes.');
      }
      playErrorBeep();
      setIsCameraActive(false);
    }
  }, [facingMode, onChange, stopCamera]);

  // Flip camera between environment and user
  const handleToggleCamera = async () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    if (isCameraActive) {
      await startCamera(nextFacing);
    }
  };

  // Toggle torch
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextTorch = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      // Torch not supported
    }
  };

  // Auto-generate random SKU barcode
  const handleGenerateBarcode = () => {
    const randomCode = `MAN-${Math.floor(100000 + Math.random() * 900000)}`;
    onChange(randomCode);
    setJustScannedCode(null);
  };

  // Cleanup on unmount or tab switch
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // When switching to camera mode, launch scanner
  const handleSwitchToCamera = () => {
    setIntakeMethod('camera');
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  // When switching to manual mode, stop camera
  const handleSwitchToManual = () => {
    stopCamera();
    setIntakeMethod('manual');
  };

  return (
    <div className="space-y-2.5">
      {/* Header with Segmented Choice: Manual vs Scan */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Barcode className="w-4 h-4 text-sky-400" />
          <span>Barcode ID / SKU</span>
        </label>

        {!disabled && (
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={handleSwitchToManual}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                intakeMethod === 'manual'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Keyboard className="w-3 h-3" />
              <span>Manual Input</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchToCamera}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold transition ${
                intakeMethod === 'camera'
                  ? 'bg-sky-500 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Camera className="w-3 h-3" />
              <span>Scan with Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* METHOD 1: MANUAL INPUT VIEW */}
      {intakeMethod === 'manual' ? (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setJustScannedCode(null);
              }}
              placeholder="e.g. 012000000133 or MAN-482910"
              readOnly={disabled}
              autoFocus={autoFocus}
              required={required}
              className={`w-full pl-3 pr-24 py-2.5 rounded-xl font-mono text-sm bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-hidden focus:ring-2 focus:ring-sky-500 ${
                disabled ? 'opacity-70 cursor-not-allowed bg-slate-900/50' : ''
              }`}
            />

            {!disabled && (
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSwitchToCamera}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 hover:text-sky-300 text-[10px] font-semibold transition"
                  title="Switch to Camera Barcode Scanner"
                >
                  <Camera className="w-3 h-3" />
                  <span>Scan</span>
                </button>
              </div>
            )}
          </div>
        {!disabled && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            {/* Auto Generate Button for items without manufacturer barcodes */}
            <button
              type="button"
              onClick={handleGenerateBarcode}
              className="text-[11px] text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1"
              title="Generate an internal SKU barcode for homemade items or produce"
            >
              <Sparkles className="w-3 h-3" />
              <span>Auto-Generate SKU (No Barcode on Package)</span>
            </button>
          </div>
        )}
        </div>
      ) : (


        /* METHOD 2: CAMERA SCANNER VIEW */
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
          {/* Scanned Success Banner */}
          {justScannedCode && (
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] text-emerald-400 uppercase font-semibold block leading-tight">
                    Barcode Scanned Successfully
                  </span>
                  <span className="font-mono font-bold text-white text-sm">
                    {justScannedCode}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Rescan</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchToManual}
                  className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition"
                >
                  Keep & Continue
                </button>
              </div>
            </div>
          )}

          {/* Camera Viewfinder Box */}
          <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800 flex flex-col items-center justify-center min-h-[190px]">
            {/* HTML5 QR Code Mount Element */}
            <div
              id={scannerContainerId.current}
              className="w-full max-w-[340px] [&_video]:rounded-lg [&_video]:object-cover"
            />

            {/* Target Reticle Overlay */}
            {isCameraActive && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="relative w-48 h-28 border-2 border-dashed border-sky-400/80 rounded-xl flex items-center justify-center shadow-lg">
                  {/* Glowing scanline */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-sky-400 to-transparent animate-pulse" />
                  {/* Corner accents */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-sky-300" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-sky-300" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-sky-300" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-sky-300" />
                </div>
                <span className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded-full mt-2 font-medium tracking-wide">
                  Align product barcode inside frame
                </span>
              </div>
            )}

            {/* Inactive State or Camera Error */}
            {!isCameraActive && !justScannedCode && (
              <div className="p-4 text-center space-y-2">
                {cameraError ? (
                  <>
                    <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                    <p className="text-xs text-rose-200 max-w-xs mx-auto">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-white font-medium hover:bg-slate-700"
                    >
                      Try Again
                    </button>
                  </>
                ) : (
                  <>
                    <Camera className="w-8 h-8 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300">Camera scanner is ready</p>
                    <button
                      type="button"
                      onClick={() => startCamera()}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-xs text-white font-semibold transition"
                    >
                      Start Camera Scanner
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Scanner Controls Toolbar */}
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              {isCameraActive && (
                <>
                  <button
                    type="button"
                    onClick={handleToggleCamera}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 flex items-center gap-1 transition"
                    title="Flip camera"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span className="text-[10px] hidden sm:inline">Flip</span>
                  </button>

                  {hasTorch && (
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      className={`p-1.5 rounded-lg border flex items-center gap-1 transition ${
                        torchOn
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                      title="Toggle Flashlight"
                    >
                      <Flashlight className="w-3.5 h-3.5" />
                      <span className="text-[10px] hidden sm:inline">{torchOn ? 'Torch On' : 'Torch'}</span>
                    </button>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSwitchToManual}
                className="text-[11px] text-slate-400 hover:text-white underline"
              >
                Switch to Manual Typing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
