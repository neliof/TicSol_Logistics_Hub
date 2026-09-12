import React, { useState } from 'react';
import { Layers, Play, Pause, CheckCircle2, AlertCircle, Loader } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface PaletizacaoItem {
  palete_sscc: string;
  artigo_codigo: string;
  quantidade: number;
  lotes: string[];
  localizacao?: string;
}

interface RececaoPaletizacaoProps {
  paletes: PaletizacaoItem[];
  estado: 'PENDENTE' | 'EM_PROCESSAMENTO' | 'CONCLUIDA' | 'ERRO';
  onIniciar: () => void;
  onConfirmar: (palete_sscc: string) => void;
  loading?: boolean;
  erro?: string | null;
}

export const RececaoPaletizacao: React.FC<RececaoPaletizacaoProps> = ({
  paletes,
  estado,
  onIniciar,
  onConfirmar,
  loading = false,
  erro,
}) => {
  const [expandedPalete, setExpandedPalete] = useState<string | null>(null);

  if (paletes.length === 0) {
    return <EmptyState icon={Layers} title="Sem paletes para paletizar" compact />;
  }

  const statusIcon = {
    PENDENTE: Pause,
    EM_PROCESSAMENTO: Loader,
    CONCLUIDA: CheckCircle2,
    ERRO: AlertCircle,
  };

  const statusColor = {
    PENDENTE: 'text-slate-600',
    EM_PROCESSAMENTO: 'text-blue-600',
    CONCLUIDA: 'text-emerald-600',
    ERRO: 'text-rose-600',
  };

  const StatusIcon = statusIcon[estado];

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">
            Paletização Automática ({paletes.length} paletes)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-5 h-5 ${statusColor[estado]} ${estado === 'EM_PROCESSAMENTO' ? 'animate-spin' : ''}`} />
          <span className="text-sm font-semibold text-slate-700">{estado}</span>
        </div>
      </div>

      {/* Ação iniciar */}
      {estado === 'PENDENTE' && (
        <button
          onClick={onIniciar}
          disabled={loading}
          className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          {loading ? 'A processar...' : 'Iniciar Paletização'}
        </button>
      )}

      {/* Erro */}
      {erro && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <div className="text-xs font-semibold text-rose-900">✕ Erro</div>
          <div className="text-xs text-rose-800 mt-1">{erro}</div>
        </div>
      )}

      {/* Lista paletes */}
      <div className="space-y-3">
        {paletes.map((palete) => {
          const isExpanded = expandedPalete === palete.palete_sscc;

          return (
            <div
              key={palete.palete_sscc}
              className={`border rounded-lg p-3 transition-all ${
                palete.localizacao
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-slate-300 bg-slate-50'
              }`}
            >
              {/* Header */}
              <button
                onClick={() => setExpandedPalete(isExpanded ? null : palete.palete_sscc)}
                className="w-full text-left flex items-center justify-between gap-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-sm text-slate-900">
                    {palete.palete_sscc}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600 mt-1">
                    <span>{palete.artigo_codigo}</span>
                    <span>{palete.quantidade} unidades</span>
                    {palete.localizacao && (
                      <span className="text-emerald-700 font-semibold">{palete.localizacao}</span>
                    )}
                  </div>
                </div>
                {palete.localizacao ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-slate-300 space-y-2">
                  {/* Lotes */}
                  <div>
                    <div className="text-xs font-semibold text-slate-700 mb-1">Lotes</div>
                    <div className="space-y-1">
                      {palete.lotes.map((lote, idx) => (
                        <div
                          key={idx}
                          className="text-xs px-2 py-1 bg-white rounded border border-slate-200"
                        >
                          {lote}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ação confirmar localização */}
                  {!palete.localizacao && estado === 'EM_PROCESSAMENTO' && (
                    <button
                      onClick={() => onConfirmar(palete.palete_sscc)}
                      className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-semibold transition-colors"
                    >
                      Confirmar Localização
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumo paletização */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="font-semibold text-slate-900">{paletes.length}</div>
            <div className="text-slate-600">Total paletes</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              {paletes.filter((p) => p.localizacao).length}
            </div>
            <div className="text-slate-600">Localizadas</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">
              {paletes.reduce((sum, p) => sum + p.quantidade, 0)}
            </div>
            <div className="text-slate-600">Total unidades</div>
          </div>
        </div>
      </div>
    </div>
  );
};
