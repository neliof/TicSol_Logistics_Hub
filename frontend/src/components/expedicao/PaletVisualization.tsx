import React from 'react';
import { Sparkles, Ruler, Scale, Tag } from 'lucide-react';

interface PaletVisualizationProps {
  numCamadas: number;
  caixasPorCamada: number;
  alturaPaleteCm: number;
  pesoBrutoKg: number;
  pesoLiquidoKg: number;
  excedeAltura: boolean;
}

export const PaletVisualization: React.FC<PaletVisualizationProps> = ({
  numCamadas,
  caixasPorCamada,
  alturaPaleteCm,
  pesoBrutoKg,
  pesoLiquidoKg,
  excedeAltura,
}) => {
  const caixasNaPaleteProposta = caixasPorCamada * numCamadas;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-3">
        <Sparkles className="w-4 h-4 text-purple-600" />
        Visualização da Palete Proposta
      </h3>

      <div className="flex flex-col gap-1 bg-gradient-to-b from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-300 font-mono text-xs">
        <div className="h-5 bg-gradient-to-r from-purple-700 to-purple-900 border border-purple-600 rounded flex items-center justify-around px-2 text-[9px] font-mono text-purple-200 font-bold shadow-md">
          <span>|||</span>
          <span>EURO PALLET 120x80</span>
          <span>|||</span>
        </div>

        {Array.from({ length: numCamadas }).map((_, layerIdx) => (
          <div
            key={layerIdx}
            className="h-7 bg-gradient-to-r from-purple-400/30 to-purple-500/30 border border-purple-500/50 rounded flex items-center justify-center text-xs font-mono font-bold text-purple-700 transition-all hover:from-purple-400/50 hover:to-purple-500/50 shadow-sm"
          >
            Camada {layerIdx + 1}: {caixasPorCamada} caixas
          </div>
        ))}
      </div>

      <span className="text-xs font-mono text-slate-400 mt-2">
        Total: {caixasNaPaleteProposta} Caixas • {numCamadas} Camadas
      </span>

      <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200 space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Ruler className="w-4 h-4 text-slate-600" />
          <span className="font-mono font-bold text-slate-900">120 × 80 × {alturaPaleteCm} cm</span>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200">
          <Scale className="w-4 h-4 text-slate-600" />
          <span className="font-mono font-bold text-lg text-slate-900">{pesoBrutoKg} kg</span>
          <span className="text-xs text-slate-500 font-mono">({pesoLiquidoKg} kg líquido)</span>
        </div>

        <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200">
          <Tag className="w-4 h-4 text-slate-600" />
          <span className="font-mono font-bold text-sm text-slate-900">Volume: {(caixasNaPaleteProposta * 0.01).toFixed(2)} m³</span>
        </div>
      </div>
    </div>
  );
};
