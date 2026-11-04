import React, { useState } from 'react';
import { WifiOff, CheckCircle2, Info } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [showInfo, setShowInfo] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <div
            onClick={() => setShowInfo(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium cursor-pointer"
            title="Running completely offline from local storage"
          >
            <WifiOff className="w-3.5 h-3.5 animate-pulse" />
            <span>Offline Active</span>
          </div>
        ) : (
          <div
            onClick={() => setShowInfo(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium cursor-pointer hover:bg-emerald-500/20 transition"
            title="Local storage enabled. Works without internet"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Offline Ready</span>
          </div>
        )}
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-semibold text-white">100% Offline Architecture</h3>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              PantryPal is engineered specifically for mobile devices and tablets working without internet connectivity.
            </p>
            <ul className="text-xs text-slate-400 space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                All barcode scans, stock counts, and items are stored inside your device's high-speed local database.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                The camera scanner and sound synthesizer run client-side without any network latency.
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                Use the Export / Backup tool anytime to save copies to JSON or CSV.
              </li>
            </ul>
            <button
              onClick={() => setShowInfo(false)}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
