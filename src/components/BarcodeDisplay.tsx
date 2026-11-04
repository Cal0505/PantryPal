import React from 'react';

interface BarcodeDisplayProps {
  code: string;
  className?: string;
  height?: number;
}

export const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
  code,
  className = '',
  height = 42,
}) => {
  // Deterministic pseudo-barcode bar widths based on char codes
  const bars: { width: number; isSpace: boolean }[] = [];

  // Guard guard patterns
  bars.push({ width: 2, isSpace: false });
  bars.push({ width: 1, isSpace: true });
  bars.push({ width: 2, isSpace: false });

  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const w1 = (charCode % 3) + 1;
    const w2 = ((charCode >> 1) % 2) + 1;
    const w3 = ((charCode >> 2) % 3) + 1;

    bars.push({ width: w1, isSpace: true });
    bars.push({ width: w2, isSpace: false });
    bars.push({ width: w3, isSpace: false });
  }

  // End guard
  bars.push({ width: 1, isSpace: true });
  bars.push({ width: 2, isSpace: false });
  bars.push({ width: 1, isSpace: true });
  bars.push({ width: 2, isSpace: false });

  let currentX = 4;
  const elements = bars.map((b, idx) => {
    const x = currentX;
    currentX += b.width * 2.2;
    if (b.isSpace) return null;
    return (
      <rect
        key={idx}
        x={x}
        y={4}
        width={b.width * 1.8}
        height={height - 18}
        fill="currentColor"
        rx={0.5}
      />
    );
  });

  return (
    <div className={`flex flex-col items-center select-none font-mono ${className}`}>
      <svg
        viewBox={`0 0 ${Math.max(120, currentX + 8)} ${height}`}
        className="w-full max-w-[200px] h-auto text-slate-800 dark:text-slate-300"
        preserveAspectRatio="xMidYMid meet"
      >
        {elements}
      </svg>
      <span className="text-[11px] tracking-widest text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
        {code}
      </span>
    </div>
  );
};
