import React from 'react';
import { encodeCode128C } from '../utils/gs1';

interface BarcodeRendererProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
  formattedText?: string;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  height = 50,
  showText = true,
  className = '',
  formattedText
}) => {
  // Extract numbers only for Code128-C encoding
  const digitsOnly = value.replace(/\D/g, '');
  const barPattern = encodeCode128C(digitsOnly.length > 0 ? digitsOnly : '000000000000');

  // Convert width pattern into list of rect bars with quiet zones
  const bars: { x: number; width: number; isBlack: boolean }[] = [];
  let currentX = 12; // Quiet zone (left)
  let isBlack = true;

  for (let i = 0; i < barPattern.length; i++) {
    const widthMultiplier = parseInt(barPattern[i], 10) || 1;
    const width = widthMultiplier * 1.6; // High-density scaling
    bars.push({ x: currentX, width, isBlack });
    currentX += width;
    isBlack = !isBlack;
  }

  const totalWidth = currentX + 12; // Quiet zone (right)

  return (
    <div className={`flex flex-col items-center select-none w-full ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-auto max-h-24 bg-white p-1 rounded border border-slate-300"
        preserveAspectRatio="none"
        style={{ shapeRendering: 'crispEdges' }}
      >
        {bars.map((bar, idx) =>
          bar.isBlack ? (
            <rect
              key={idx}
              x={bar.x}
              y={2}
              width={bar.width}
              height={height - 4}
              fill="#000000"
            />
          ) : null
        )}
      </svg>
      {showText && (
        <span className="font-mono text-[11px] font-semibold text-slate-900 mt-0.5 tracking-wider text-center break-all">
          {formattedText || value}
        </span>
      )}
    </div>
  );
};
