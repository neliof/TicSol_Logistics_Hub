import React from 'react';
import { LinhaGuia } from '../../types/expedicao';
import { RuleConfig } from '../../types/wms';
import { Layers, AlertTriangle, Plus, Scale, Ruler, Tag } from 'lucide-react';

interface PaletCalculatorProps {
  linhasSelecionadas: LinhaGuia[];
  activeRule: RuleConfig;
  caixasPorCamada: number;
  numCamadas: number;
  onCaixasPorCamadaChange: (value: number) => void;
  onNumCamadasChange: (value: number) => void;
  onMaterializePallet: () => void;
}

export const PaletCalculator: React.FC<PaletCalculatorProps> = ({
  linhasSelecionadas,
  activeRule,
  caixasPorCamada,
  numCamadas,
  onCaixasPorCamadaChange,
  onNumCamadasChange,
  onMaterializePallet,
}) => {
  const caixasSolicitadas = linhasSelecionadas.reduce((sum, l) => sum + l.quantidade_solicitada, 0);
  const caixasNaPaleteProposta = caixasPorCamada * numCamadas;
  const pesoUnitario =
    caixasSolicitadas > 0
      ? linhasSelecionadas.reduce((sum, l) => sum + (l.peso_unitario_kg || 0.5) * l.quantidade_solicitada, 0) /
        caixasSolicitadas
      : 0.5;
  const alturaPaleteCm = (pesoUnitario > 0 ? (numCamadas * 25) : 110) + 14;
  const pesoLiquidoKg = Math.round(caixasNaPaleteProposta * pesoUnitario * 0.9 * 10) / 10;
  const pesoBrutoKg = Math.round((caixasNaPaleteProposta * pesoUnitario + 22) * 10) / 10;

  const excedeAltura = alturaPaleteCm > activeRule.altura_maxima_cm;
  const excedePeso = pesoBrutoKg > activeRule.peso_maximo_kg;
  const excedeQuantidade = caixasNaPaleteProposta > caixasSolicitadas;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
      <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-3 pt-2">
        <Layers className="w-4 h-4 text-purple-600" />
        2. Definir Plano de Empilhamento
      </h3>

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <label className="text-slate-700 block mb-1 font-medium">Caixas por Camada</label>
          <input
            type="number"
            min="1"
            max="30"
            value={caixasPorCamada}
            onChange={(e) => onCaixasPorCamadaChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-purple-700 font-bold focus:outline-none focus:border-purple-500 text-base shadow-xs"
          />
        </div>
        <div>
          <label className="text-slate-700 block mb-1 font-medium">Número de Camadas</label>
          <input
            type="number"
            min="1"
            max="10"
            value={numCamadas}
            onChange={(e) => onNumCamadasChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-purple-700 font-bold focus:outline-none focus:border-purple-500 text-base shadow-xs"
          />
        </div>
      </div>

      <div className="space-y-2 pt-2">
        {excedeAltura && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Aviso:</strong> Altura ({alturaPaleteCm} cm) excede limite {activeRule.altura_maxima_cm} cm!</span>
          </div>
        )}
        {excedePeso && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Aviso:</strong> Peso ({pesoBrutoKg} kg) excede limite {activeRule.peso_maximo_kg} kg!</span>
          </div>
        )}
        {excedeQuantidade && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span><strong>Erro:</strong> Palete requer {caixasNaPaleteProposta} caixas, mas guia tem só {caixasSolicitadas}!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 font-mono text-xs">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-slate-500 block text-[10px] font-semibold uppercase">ALTURA TOTAL</span>
          <span className={`text-base font-bold ${excedeAltura ? 'text-rose-600' : 'text-slate-900'}`}>
            {alturaPaleteCm} cm
          </span>
          <span className="text-[10px] text-slate-500 block">Máx: {activeRule.altura_maxima_cm} cm</span>
        </div>
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
          <span className="text-slate-500 block text-[10px] font-semibold uppercase">PESO BRUTO</span>
          <span className={`text-base font-bold ${excedePeso ? 'text-rose-600' : 'text-slate-900'}`}>
            {pesoBrutoKg} kg
          </span>
          <span className="text-[10px] text-slate-500 block">Máx: {activeRule.peso_maximo_kg} kg</span>
        </div>
      </div>

      <button
        onClick={onMaterializePallet}
        disabled={excedeQuantidade || excedeAltura || excedePeso}
        className={`w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
          excedeQuantidade || excedeAltura || excedePeso
            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
            : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md active:scale-95'
        }`}
      >
        <Plus className="w-5 h-5" />
        Materializar Palete + Imprimir Etiqueta
      </button>
    </div>
  );
};
