import React from 'react';
import { History, RotateCcw, Eye } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface RecepcaoPartialRecord {
  id: string;
  numero_guia: string;
  fornecedor_nome: string;
  linhas_totais: number;
  linhas_conferidas: number;
  data_inicio: string;
  data_ultima_atualizacao: string;
  operador_inicio: string;
  operador_ultima_atualizacao: string;
  divergencias_count: number;
  estado: 'RASCUNHO' | 'EM_CONFERENCIA' | 'CONFERIDA';
}

interface RececaoPartialProps {
  recepcoes: RecepcaoPartialRecord[];
  onRetomar: (recepcao_id: string) => void;
  onVisualizarDetalhes: (recepcao_id: string) => void;
  loading?: boolean;
}

export const RececaoPartial: React.FC<RececaoPartialProps> = ({
  recepcoes,
  onRetomar,
  onVisualizarDetalhes,
  loading = false,
}) => {
  if (recepcoes.length === 0) {
    return <EmptyState icon={History} title="Sem receções em progresso" compact />;
  }

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'RASCUNHO':
        return 'bg-slate-100 text-slate-700';
      case 'EM_CONFERENCIA':
        return 'bg-blue-100 text-blue-700';
      case 'CONFERIDA':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Receções em Progresso</h3>
        <span className="ml-auto text-xs font-semibold text-slate-500">{recepcoes.length}</span>
      </div>

      {/* List */}
      <div className="space-y-3">
        {recepcoes.map((rec) => (
          <div
            key={rec.id}
            className="flex items-start justify-between gap-3 p-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              {/* Guia + Fornecedor */}
              <div className="mb-1">
                <div className="font-mono font-bold text-sm text-slate-900">{rec.numero_guia}</div>
                <div className="text-xs text-slate-600">{rec.fornecedor_nome}</div>
              </div>

              {/* Status + Progresso */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getEstadoColor(rec.estado)}`}>
                  {rec.estado}
                </span>
                <span className="text-xs text-slate-600">
                  {rec.linhas_conferidas}/{rec.linhas_totais} linhas
                </span>
                {rec.divergencias_count > 0 && (
                  <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
                    ⚠ {rec.divergencias_count} divergências
                  </span>
                )}
              </div>

              {/* Timestamps */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>
                  <div className="font-semibold">Início:</div>
                  <div>{new Date(rec.data_inicio).toLocaleString('pt-PT')}</div>
                  <div className="text-xs text-slate-400">por {rec.operador_inicio}</div>
                </div>
                <div>
                  <div className="font-semibold">Última atualização:</div>
                  <div>{new Date(rec.data_ultima_atualizacao).toLocaleString('pt-PT')}</div>
                  <div className="text-xs text-slate-400">por {rec.operador_ultima_atualizacao}</div>
                </div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex-shrink-0 flex flex-col gap-2">
              <button
                onClick={() => onRetomar(rec.id)}
                disabled={loading}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                Retomar
              </button>
              <button
                onClick={() => onVisualizarDetalhes(rec.id)}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <Eye className="w-3 h-3" />
                Detalhes
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
