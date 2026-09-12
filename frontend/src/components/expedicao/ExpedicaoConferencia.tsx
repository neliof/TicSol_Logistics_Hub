import React, { useState } from 'react';
import { Truck, CheckCircle2, AlertCircle, Package } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface PaletePedido {
  sscc: string;
  artigo_codigo: string;
  quantidade_caixas: number;
  quantidade_unidades: number;
  localizacao: string;
  estado: 'PENDENTE' | 'CONFERIDA' | 'EXPEDIDA';
  data_conferencia?: string;
  operador_conferencia?: string;
}

interface ExpedicaoConferenciaProps {
  numero_guia: string;
  paletes: PaletePedido[];
  onConferir: (sscc: string, quantidade: number, observacoes?: string) => void;
  onConfirmarExpedicao: () => Promise<void>;
  loading?: boolean;
}

export const ExpedicaoConferencia: React.FC<ExpedicaoConferenciaProps> = ({
  numero_guia,
  paletes,
  onConferir,
  onConfirmarExpedicao,
  loading = false,
}) => {
  const [expandido, setExpandido] = useState<string | null>(null);
  const [qtdConferida, setQtdConferida] = useState<Record<string, number>>({});
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});

  if (paletes.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Conferência Expedição</h3>
        </div>
        <EmptyState
          icon={Package}
          title="Sem paletes para expedir"
          compact
        />
      </div>
    );
  }

  const handleConferir = (sscc: string, palete: PaletePedido) => {
    const qtd = qtdConferida[sscc] ?? palete.quantidade_caixas;
    const obs = observacoes[sscc] || '';
    onConferir(sscc, qtd, obs);
    setExpandido(null);
    setQtdConferida({ ...qtdConferida, [sscc]: 0 });
    setObservacoes({ ...observacoes, [sscc]: '' });
  };

  const conferidas = paletes.filter(p => p.estado === 'CONFERIDA').length;
  const totalCaixas = paletes.reduce((sum, p) => sum + p.quantidade_caixas, 0);

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Conferência Expedição</h3>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          Guia: {numero_guia}
        </div>
      </div>

      {/* Resumo */}
      <div className="p-3 bg-slate-100 rounded grid grid-cols-3 gap-2 text-xs text-center">
        <div>
          <div className="font-semibold text-slate-900">{paletes.length}</div>
          <div className="text-slate-600">Paletes</div>
        </div>
        <div>
          <div className="font-semibold text-slate-900">{conferidas}</div>
          <div className="text-slate-600">Conferidas</div>
        </div>
        <div>
          <div className="font-semibold text-slate-900">{totalCaixas}</div>
          <div className="text-slate-600">Total caixas</div>
        </div>
      </div>

      {/* Paletes */}
      <div className="space-y-3">
        {paletes.map((palete) => {
          const isExpanded = expandido === palete.sscc;
          const qtd = qtdConferida[palete.sscc] ?? palete.quantidade_caixas;
          const isConferida = palete.estado === 'CONFERIDA';

          return (
            <div
              key={palete.sscc}
              className={`border rounded-lg p-4 transition-all ${
                isConferida
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <button
                onClick={() => setExpandido(isExpanded ? null : palete.sscc)}
                className="w-full text-left flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm text-slate-900">
                      {palete.sscc.slice(0, 16)}…
                    </span>
                    {isConferida ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mb-1">
                    {palete.artigo_codigo} • {palete.quantidade_caixas} cx
                  </div>
                  <div className="text-xs text-slate-500">
                    📍 {palete.localizacao}
                  </div>
                </div>
              </button>

              {/* Expanded */}
              {isExpanded && !isConferida && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                  {/* Quantidade conferida */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Quantidade conferida (caixas)
                    </label>
                    <input
                      type="number"
                      value={qtd}
                      onChange={(e) =>
                        setQtdConferida({
                          ...qtdConferida,
                          [palete.sscc]: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="0"
                      max={palete.quantidade_caixas}
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      Esperado: {palete.quantidade_caixas}
                      {qtd !== palete.quantidade_caixas && (
                        <span className="ml-2 text-amber-600 font-semibold">
                          Diferença: {qtd - palete.quantidade_caixas}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Observações
                    </label>
                    <textarea
                      value={observacoes[palete.sscc] || ''}
                      onChange={(e) =>
                        setObservacoes({
                          ...observacoes,
                          [palete.sscc]: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="Ex: Palete danificada, falta 2 cx, etc"
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConferir(palete.sscc, palete)}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-semibold transition-colors"
                    >
                      ✓ Conferir
                    </button>
                    <button
                      onClick={() => setExpandido(null)}
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-sm font-semibold transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Conferida info */}
              {isConferida && (
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <div className="text-xs text-emerald-700 font-semibold">
                    ✓ Conferida por {palete.operador_conferencia}
                    {palete.data_conferencia &&
                      ` em ${new Date(palete.data_conferencia).toLocaleString('pt-PT')}`}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmar expedição */}
      <button
        onClick={onConfirmarExpedicao}
        disabled={loading || conferidas < paletes.length}
        className={`w-full px-4 py-2 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
          conferidas === paletes.length
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
        }`}
      >
        <Truck className="w-4 h-4" />
        {loading ? 'A expedir…' : `Confirmar Expedição (${conferidas}/${paletes.length})`}
      </button>
    </div>
  );
};
