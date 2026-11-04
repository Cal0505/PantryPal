import React, { useState } from 'react';
import { Download, Share, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running in standalone mode, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-500 hover:bg-sky-400 text-white shadow-sm transition active:scale-95"
        title="Install PantryPal to your phone or tablet home screen"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-800/80 text-slate-200 hover:bg-slate-700/80 transition active:scale-95"
          title="Install PantryPal to your iPhone or iPad"
        >
          <Smartphone className="w-3.5 h-3.5 text-sky-400" />
          <span>Install PWA</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 text-slate-100 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-sky-400" />
                  Install on iPhone / iPad
                </h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-sm text-slate-300">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-sky-400 shrink-0 mt-0.5">
                    1
                  </div>
                  <p>
                    Tap the <strong className="text-white">Share</strong> button{' '}
                    <Share className="inline w-3.5 h-3.5 mx-1 text-sky-400" /> in Safari's bottom toolbar.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-sky-400 shrink-0 mt-0.5">
                    2
                  </div>
                  <p>
                    Scroll down and select <strong className="text-white">"Add to Home Screen"</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-sky-400 shrink-0 mt-0.5">
                    3
                  </div>
                  <p>
                    Tap <strong className="text-white">Add</strong> in the top right. Launch PantryPal completely offline with full-screen experience!
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm transition"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
