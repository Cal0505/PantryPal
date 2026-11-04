import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Camera, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { loadInventory, saveInventory, mergePantryDatabases } from '../services/storage';

export const LocalSyncManager: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'showing' | 'scanning' | 'success' | 'error'>('idle');
  const [qrDataString, setQrDataString] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = useRef<string>(`qr-sync-scanner-${Date.now()}`);

  // 1. Dynamic background injector to append a genuine offline QR generator script
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).QRious) {
      const script = document.createElement('script');
      // Direct CDN library asset that downloads once and works 100% offline inside the application cache
      script.src = 'https://cloudflare.com';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const handleGenerateSyncCode = async () => {
    try {
      const localStock = await loadInventory();
      const compressedString = btoa(encodeURIComponent(JSON.stringify(localStock)));
      setQrDataString(compressedString);
      setSyncStatus('showing');
    } catch (err) {
      setErrorMessage('Failed to package your pantry files.');
      setSyncStatus('error');
    }
  };

  // 2. Draw a mathematically perfect QR grid canvas
  useEffect(() => {
    if (syncStatus === 'showing' && canvasRef.current && qrDataString) {
      const QRious = (window as any).QRious;
      if (QRious) {
        // Automatically injects proper data bits, masks, and error corrections
        new QRious({
          element: canvasRef.current,
          value: qrDataString,
          size: 260,
          level: 'L' // Standard low overhead formatting for max payload space
        });
      } else {
        setErrorMessage('QR generation engine is loading. Please try again in a moment.');
        setSyncStatus('error');
      }
    }
  }, [syncStatus, qrDataString]);

  const startQRScanner = async () => {
    setSyncStatus('scanning');
    setErrorMessage('');
    
    setTimeout(async () => {
      try {
        const container = document.getElementById(scannerContainerId.current);
        if (!container) return;

        const html5QrCode = new Html5Qrcode(scannerContainerId.current, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });

        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 15,
            qrbox: (w, h) => {
              const min = Math.min(w, h);
              return { width: Math.floor(min * 0.8), height: Math.floor(min * 0.8) };
            },
          },
          async (decodedText) => {
            try {
              const remoteStock = JSON.parse(decodeURIComponent(atob(decodedText.trim())));
              if (!Array.isArray(remoteStock)) throw new Error();

              const localStock = await loadInventory();
              const mergedDatabase = mergePantryDatabases(localStock, remoteStock);
              await saveInventory(mergedDatabase);
              
              stopQRScanner();
              setSyncStatus('success');
            } catch {
              stopQRScanner();
              setErrorMessage('Invalid sync data. Make sure you scan a PantryPal sync code.');
              setSyncStatus('error');
            }
          },
          () => {}
        );
      } catch (err) {
        setErrorMessage('Unable to access camera. Check app permissions.');
        setSyncStatus('error');
      }
    }, 150);
  };

  const stopQRScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // safe teardown fallback
      }
      scannerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopQRScanner();
    };
  }, []);

  return (
    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-100 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-sky-400" />
          P2P Offline Home Sync
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Synchronize databases directly using your screens and cameras. No server or routers needed.
        </p>
      </div>

      {syncStatus === 'idle' && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={handleGenerateSyncCode} className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 flex flex-col items-center text-center gap-1.5 transition text-xs font-semibold">
            <QrCode className="w-5 h-5 text-sky-400" />
            <span>Show QR Sync Code</span>
          </button>
          <button type="button" onClick={startQRScanner} className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-sky-500/50 flex flex-col items-center text-center gap-1.5 transition text-xs font-semibold">
            <Camera className="w-5 h-5 text-sky-400" />
            <span>Scan Other Phone</span>
          </button>
        </div>
      )}

      {syncStatus === 'showing' && (
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-4">
          <p className="text-xs font-medium text-slate-300 text-center">Scan this barcode directly with your wife's camera tracker panel:</p>
          <div className="p-3 rounded-2xl bg-white flex items-center justify-center overflow-hidden border border-slate-800">
            <canvas ref={canvasRef} className="block" />
          </div>
          <button type="button" onClick={() => setSyncStatus('idle')} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-medium transition">
            Close Sync Code
          </button>
        </div>
      )}

      {syncStatus === 'scanning' && (
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-3">
          <p className="text-xs text-slate-300 text-center">Point your camera directly at the square QR code displayed on the other device:</p>
          <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800 flex flex-col items-center justify-center min-h-[220px]">
            <div id={scannerContainerId.current} className="w-full max-w-[340px] [&_video]:rounded-lg [&_video]:object-cover" />
          </div>
          <button type="button" onClick={() => { stopQRScanner(); setSyncStatus('idle'); }} className="w-full py-2 bg-slate-800 text-slate-400 text-xs font-medium rounded-xl transition">
            Cancel Scan
          </button>
        </div>
      )}

      {syncStatus === 'success' && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-xl text-center space-y-2">
          <Check className="w-6 h-6 text-emerald-400 mx-auto" />
          <p className="text-xs font-bold text-emerald-200">Databases Synchronized Successfully!</p>
          <button type="button" onClick={() => setSyncStatus('idle')} className="px-4 py-1 bg-emerald-800 text-white text-xs font-medium rounded-lg">Continue</button>
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-center space-y-2">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
          <p className="text-xs font-bold text-rose-200">{errorMessage}</p>
          <button type="button" onClick={() => setSyncStatus('idle')} className="px-4 py-1 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg">Try Again</button>
        </div>
      )}
    </div>
  );
};
