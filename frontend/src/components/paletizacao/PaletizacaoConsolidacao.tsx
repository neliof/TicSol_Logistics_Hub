import React, { useState } from 'react';
import { Merge, Plus, X } from 'lucide-react';

interface PaletaDisponivel {
  sscc: string;
  artigo_codigo: string;
  quantidade_caixas: number;
  localizacao?: string;
}

interface PaletizacaoConsolidacaoProps {
  paletasDisponiveis: PaletaDisponivel[];
  onConsolidar: (ssccOrigem: string[], novoSSCC: string) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const PaletizacaoConsolidacao: React.FC<PaletizacaoConsolidacaoProps> = ({
  paletasDisponiveis,
  onConsolidar,
  onCancel,
  loading = false,
}) => {
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [novoSSCC, setNovoSSCC] = useState('');

  const handleSelecionar = (sscc: string) => {
    if (selecionadas.includes(sscc)) {
      setSelecionadas(selecionadas.filter(s => s !== sscc));
    } else {
      setSelecionadas([...selecionadas, sscc]);
    }
  };

  const handleConsolidar = async () => {
    if (selecionadas.length < 2) {
      alert('Selecione pelo menos 2 paletes para consolidar');
      return;
    }

    if (!novoSSCC.trim()) {
      alert('Novo SSCC obrigatório');
      return;
    }

    await onConsolidar(selecionadas, novoSSCC);
    setSelecionadas([]);
    setNovoSSCC('');
  };

  const totalCaixas = paletasDisponiveis
    .filter(p => selecionadas.includes(p.sscc))
    .reduce((sum, p) => sum + p.quantidade_caixas, 0);

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Merge className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-slate-900">Consolidar Paletes</h3>
        </div>
        {selecionadas.length > 0 && (
          <div className="text-xs font-semibold text-emerald-600">
            {selecionadas.length} selecionadas
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
        <div className="text-sm font-semibold text-slate-900 mb-1">
          Combinar múltiplas paletes numa só
        </div>
        <div className="text-xs text-slate-600">
          {paletasDisponiveis.length} paletes disponíveis para consolidação
        </div>
      </div>

      {/* Lista paletes */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto border border-slate-200 rounded p-2">
        {paletasDisponiveis.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            Sem paletes disponíveis para consolidação
          </div>
        ) : (
          paletasDisponiveis.map((palete) => (
            <label
              key={palete.sscc}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                selecionadas.includes(palete.sscc)
                  ? 'bg-emerald-100 border border-emerald-300'
                  : 'bg-white border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="checkbox"
                checked={selecionadas.includes(palete.sscc)}
                onChange={() => handleSelecionar(palete.sscc)}
                className="w-4 h-4 accent-emerald-600"
              />
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-bold text-slate-900">{palete.sscc}</div>
                <div className="text-xs text-slate-600">
                  {palete.artigo_codigo} • {palete.quantidade_caixas} cx
                  {palete.localizacao && ` • ${palete.localizacao}`}
                </div>
              </div>
            </label>
          ))
        )}
      </div>

      {/* Novo SSCC */}
      {selecionadas.length >= 2 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded space-y-2">
          <label className="block text-sm font-medium text-slate-900">Novo SSCC da consolidação</label>
          <input
            type="text"
            value={novoSSCC}
            onChange={(e) => setNovoSSCC(e.target.value)}
            placeholder="Ex: 123456789012345678901234"
            className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <div className="text-xs text-slate-600">
            Total consolidado: {totalCaixas} caixas de {selecionadas.length} paletes
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-3 pt-3 border-t border-slate-200">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          onClick={handleConsolidar}
          disabled={loading || selecionadas.length < 2 || !novoSSCC.trim()}
          className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Merge className="w-4 h-4" />
          {loading ? 'A consolidar…' : `Consolidar ${selecionadas.length}`}
        </button>
      </div>
    </div>
  );
};
