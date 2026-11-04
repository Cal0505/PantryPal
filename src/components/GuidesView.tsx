import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Upload, X, AlertCircle, RefreshCw } from 'lucide-react';

export const GuidesView: React.FC = () => {
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStatus, setProgressStatus] = useState<string>('');
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const currentRenderTaskRef = useRef<any>(null);
  const activeFileRef = useRef<File | null>(null);

  // 🚀 FALLBACK INLINE BRIDGE LOGIC: Uses native object fallback if local scripts are blocked
  const renderPdfFallback = (file: File) => {
    try {
      const blobUrl = URL.createObjectURL(file);
      if (canvasContainerRef.current) {
        canvasContainerRef.current.innerHTML = '';
        
        // Create an embed node dynamically to satisfy strict Android engine security contexts
        const embed = document.createElement('embed');
        embed.src = blobUrl;
        embed.type = 'application/pdf';
        embed.className = "w-full rounded-xl bg-white border border-slate-800 min-h-[58vh]";
        
        canvasContainerRef.current.appendChild(embed);
      }
      setIsProcessing(false);
      setProgressStatus('');
    } catch (err) {
      setUploadError("Android sandboxing policies completely blocked the file view stream.");
      setIsProcessing(false);
    }
  };

  // Main Canvas Processing Framework
  const renderPdfPages = async (file: File) => {
    const pdfjsLib = (window as any).pdfjsLib;
    
    // If the local script files aren't loading, execute the native fallback stream immediately 
    if (!pdfjsLib) {
      console.warn("PDF.js not initialized in global window context. Executing hardware fallback channel.");
      renderPdfFallback(file);
      return;
    }

    setIsProcessing(true);
    setUploadError(null);
    setProgressStatus("Reading handbook structure...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      if (!canvasContainerRef.current) return;
      canvasContainerRef.current.innerHTML = ''; 

      // Draw all image page layers sequentially inside your scroll container workspace
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        setProgressStatus(`Drawing page ${pageNum} of ${pdf.numPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.25 }); // Scaled for mobile performance

        const canvas = document.createElement('canvas');
        canvas.className = "w-full max-w-2xl rounded-xl bg-white shadow-2xl mb-4 block border border-slate-800";
        const context = canvas.getContext('2d');

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          const renderContext = { canvasContext: context, viewport: viewport };
          currentRenderTaskRef.current = page.render(renderContext);
          await currentRenderTaskRef.current.promise;
        }
      }
      setProgressStatus('');
    } catch (err) {
      console.error("Canvas processor hit an error, jumping to hardware layer:", err);
      renderPdfFallback(file);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setUploadError('Please target a valid .pdf reference guide book.');
      return;
    }

    setFileName(file.name);
    setFileSize((file.size / (1024 * 1024)).toFixed(2) + ' MB');
    activeFileRef.current = file;
    
    setIsProcessing(true);
    setTimeout(() => renderPdfPages(file), 150);
  };

  const handleCloseViewer = () => {
    if (currentRenderTaskRef.current && typeof currentRenderTaskRef.current.cancel === 'function') {
      currentRenderTaskRef.current.cancel(); 
    }
    setFileName('');
    setFileSize('');
    setProgressStatus('');
    activeFileRef.current = null;
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto p-1 font-sans text-slate-100 min-h-[75vh] flex flex-col w-full">
      
      {fileName ? (
        /* 📱 ROBUST VISUAL WORKSPACE VIEWPORT LAYER */
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden min-h-[70vh] w-full">
          
          {/* Top Control Header Bar (Always locked at the top layer so the screen can't lock up) */}
          <div className="h-14 bg-slate-950 px-4 flex justify-between items-center shrink-0 border-b border-slate-800 shadow-md z-50">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[9px] font-mono font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
                {fileSize}
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-[160px] sm:max-w-md">{fileName}</h2>
            </div>

            <button
              type="button"
              onClick={handleCloseViewer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold border border-rose-700 transition active:scale-95 shadow-md"
            >
              <X className="w-3.5 h-3.5 text-white" />
              <span>Close Document</span>
            </button>
          </div>

          {/* Canvas Display Center */}
          <div className="flex-1 bg-slate-950 p-2 sm:p-4 overflow-y-auto WebkitOverflowScrolling-touch max-h-[62vh] flex flex-col items-center">
            {isProcessing && progressStatus && (
              <div className="w-full py-8 flex flex-col items-center justify-center text-center space-y-3 sticky top-0 bg-slate-950/90 backdrop-blur-sm rounded-xl border border-slate-800/50 z-40 mb-4 p-4">
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                <div className="text-xs text-slate-200 font-bold tracking-wide">{progressStatus}</div>
              </div>
            )}

            {/* Target structural mount element for full canvas generation passes */}
            <div 
              ref={canvasContainerRef} 
              className="w-full flex flex-col items-center justify-start min-h-[55vh]" 
            />

            {uploadError && (
              <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2 font-medium max-w-md my-4">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

        </div>
      ) : (
        /* STANDARD UPLOAD SELECTOR LANDING SCREEN */
        <>
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 shadow-xs">
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Offline PDF Guides &amp; Manual Library</span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Open appliance manuals, survival references, or trail documents stored directly on your phone/tablet memory safely.
            </p>
          </div>

          <div className="p-10 border border-dashed border-slate-700 hover:border-slate-500 bg-slate-900 rounded-2xl flex flex-col items-center justify-center text-center shadow-inner">
            <label className="flex flex-col items-center justify-center cursor-pointer group w-full py-6">
              <Upload className="w-10 h-10 text-emerald-400 mb-3 animate-pulse group-hover:scale-105 transition-transform" />
              <span className="text-xs font-bold text-white tracking-wide">Target Phone Internal PDF Path</span>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                Tap to explore device files. High-density layouts decode and compile completely offline into the canvas structure dashboard.
              </p>
              <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
            </label>
          </div>

          {uploadError && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-[10px] flex items-center justify-center gap-1.5 font-medium max-w-md animate-shake mx-auto">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>{uploadError}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};
