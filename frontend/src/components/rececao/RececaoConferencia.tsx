import React, { useState } from 'react';
import { ReceivingLine } from '../../types/wms';
import { EmptyState } from '../EmptyState';
import { AlertTriangle, CheckCircle2, Package, AlertCircle } from 'lucide-react';

interface RececaoConferenciaProps {
  linhas: ReceivingLine[];
  onConferir: (linha_id: string, qtd_recebida: number, danificados: number) => void;
  onDiverger: (linha_id: string) => void;
  operador: string;
}

export const RececaoConferencia: React.FC<RececaoConferenciaProps> = ({
  linhas,
  onConferir,
  onDiverger,
  operador,
}) => {
  const [expandedLinha, setExpandedLinha] = useState<string | null>(null);
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [danificados, setDanificados] = useState<Record<string, number>>({});

  if (linhas.length === 0) {
    return <EmptyState icon={Package} title="Sem linhas para conferir" compact />;
  }

  const handleConferir = (linha_id: string, linha: ReceivingLine) => {
    const qtd = quantidades[linha_id] ?? linha.qtd_esperada_caixas;
    const dan = danificados[linha_id] ?? 0;
    onConferir(linha_id, qtd, dan);
    setExpandedLinha(null);
    setQuantidades({ ...quantidades, [linha_id]: 0 });
    setDanificados({ ...danificados, [linha_id]: 0 });
  };

  return (
    <div className="space-y-3">
      {linhas.map((linha) => {
        const qtd_recebida = quantidades[linha.id] ?? linha.qtd_recebida_caixas ?? 0;
        const dan = danificados[linha.id] ?? linha.danificados_caixas ?? 0;
        const diferenca = qtd_recebida - linha.qtd_esperada_caixas;
        const temDiferenca = diferenca !== 0 || dan > 0;
        const isExpanded = expandedLinha === linha.id;

        return (
          <div
            key={linha.id}
            className={`border rounded-lg p-4 transition-all ${
              temDiferenca ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'
            }`}
          >
            {/* Header — Linha info */}
            <button
              onClick={() => setExpandedLinha(isExpanded ? null : linha.id)}
              className="w-full text-left flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-sm text-slate-900">{linha.artigo_codigo}</span>
                  <span className="text-xs text-slate-500">{linha.artigo_descricao}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span>Encomendado: {linha.qtd_esperada_caixas}</span>
                  <span>Recebido: {qtd_recebida}</span>
                  {temDiferenca && (
                    <span
                      className={`font-semibold ${
                        diferenca < 0
                          ? 'text-rose-600'
                          : diferenca > 0
                            ? 'text-amber-600'
                            : 'text-slate-600'
                      }`}
                    >
                      {diferenca < 0 ? `Faltam ${Math.abs(diferenca)}` : `Excesso +${diferenca}`}
                      {dan > 0 && ` | ${dan} danificados`}
                    </span>
                  )}
                </div>
              </div>

              {/* Status indicator */}
              <div>
                {linha.estado_linha === 'CONCLUIDO' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : temDiferenca ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </button>

            {/* Expanded content — Input fields */}
            {isExpanded && linha.estado_linha !== 'CONCLUIDO' && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                {/* Quantidade recebida */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Quantidade recebida (caixas)
                  </label>
                  <input
                    type="number"
                    value={qtd_recebida}
                    onChange={(e) =>
                      setQuantidades({
                        ...quantidades,
                        [linha.id]: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                  <div className="mt-1 text-xs text-slate-500">
                    Esperado: {linha.qtd_esperada_caixas} | Diferença:{' '}
                    <span
                      className={
                        diferenca < 0
                          ? 'text-rose-600 font-semibold'
                          : diferenca > 0
                            ? 'text-amber-600 font-semibold'
                            : ''
                      }
                    >
                      {diferenca > 0 ? '+' : ''}
                      {diferenca}
                    </span>
                  </div>
                </div>

                {/* Caixas danificadas */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Caixas danificadas
                  </label>
                  <input
                    type="number"
                    value={dan}
                    onChange={(e) =>
                      setDanificados({
                        ...danificados,
                        [linha.id]: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>

                {/* Lote info */}
                {linha.lote && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Lote</label>
                    <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-mono text-slate-600">
                      {linha.lote}
                      {linha.data_validade && (
                        <span className="ml-2 text-xs text-slate-500">
                          (Validade: {linha.data_validade})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleConferir(linha.id, linha)}
                    className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors"
                  >
                    ✓ Conferir
                  </button>
                  {temDiferenca && (
                    <button
                      onClick={() => {
                        onDiverger(linha.id);
                        setExpandedLinha(null);
                      }}
                      className="flex-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      ⚠ Divergência
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedLinha(null)}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Concluded state */}
            {linha.estado_linha === 'CONCLUIDO' && (
              <div className="mt-3 pt-3 border-t border-emerald-200">
                <div className="text-xs text-emerald-700 font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Conferida por {operador}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
