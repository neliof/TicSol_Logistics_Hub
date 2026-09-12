import React from 'react';
import { AlertTriangle, Calendar, TrendingUp } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface LoteFEFO {
  lote: string;
  artigo_codigo: string;
  quantidade: number;
  data_validade: string;
  data_entrada: string;
  dias_restantes: number;
  status: 'OK' | 'ALERTA' | 'CRITICO';
  localizacao?: string;
}

interface StockFEFOProps {
  lotes: LoteFEFO[];
  loading?: boolean;
}

export const StockFEFO: React.FC<StockFEFOProps> = ({ lotes, loading = false }) => {
  if (loading) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Gestão FEFO</h3>
        </div>
        <div className="text-center py-6 text-slate-500">A carregar…</div>
      </div>
    );
  }

  if (lotes.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Gestão FEFO</h3>
        </div>
        <EmptyState
          icon={Calendar}
          title="Sem lotes em stock"
          description="Recepcione items para gerenciar FEFO"
          compact
        />
      </div>
    );
  }

  const lotesSorted = [...lotes].sort((a, b) => {
    const dataA = new Date(a.data_validade).getTime();
    const dataB = new Date(b.data_validade).getTime();
    return dataA - dataB; // Lote que expira primeiro fica em primeiro
  });

  const criticos = lotesSorted.filter(l => l.status === 'CRITICO');
  const alertas = lotesSorted.filter(l => l.status === 'ALERTA');
  const ok = lotesSorted.filter(l => l.status === 'OK');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return '✓';
      case 'ALERTA':
        return '⚠';
      case 'CRITICO':
        return '✕';
      default:
        return '◯';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-emerald-50 border-emerald-200';
      case 'ALERTA':
        return 'bg-amber-50 border-amber-200';
      case 'CRITICO':
        return 'bg-rose-50 border-rose-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  const renderLote = (lote: LoteFEFO, isPriority: boolean = false) => (
    <div
      key={`${lote.lote}-${lote.artigo_codigo}`}
      className={`border rounded-lg p-2 ${getStatusBg(lote.status)} ${isPriority ? 'ring-2 ring-offset-1 ring-rose-600' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-slate-900">{getStatusIcon(lote.status)}</span>
            <span className="font-mono text-xs font-bold text-slate-900">{lote.lote}</span>
          </div>
          <div className="text-xs text-slate-600">
            {lote.artigo_codigo} • {lote.quantidade} un
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono font-bold text-slate-900">
            {lote.dias_restantes}d
          </div>
          <div className="text-xs text-slate-600">
            {new Date(lote.data_validade).toLocaleDateString('pt-PT')}
          </div>
        </div>
      </div>

      {lote.localizacao && (
        <div className="text-xs text-slate-600 mt-1 pt-1 border-t border-white border-opacity-50">
          Loc: {lote.localizacao}
        </div>
      )}
    </div>
  );

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Gestão FEFO</h3>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          {lotes.length} lotes
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-2 p-2 bg-slate-100 rounded text-xs font-semibold">
        <div className="text-center">
          <div className="text-rose-600">{criticos.length}</div>
          <div className="text-slate-600">Críticos</div>
        </div>
        <div className="text-center">
          <div className="text-amber-600">{alertas.length}</div>
          <div className="text-slate-600">Alertas</div>
        </div>
        <div className="text-center">
          <div className="text-emerald-600">{ok.length}</div>
          <div className="text-slate-600">OK</div>
        </div>
      </div>

      {/* Lotes críticos destacados */}
      {criticos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-rose-700">
            <AlertTriangle className="w-4 h-4" />
            Críticos (Priority):
          </div>
          <div className="space-y-2">
            {criticos.map(lote => renderLote(lote, true))}
          </div>
        </div>
      )}

      {/* Lotes alerta */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold text-amber-700">
            ⚠ Alertas:
          </div>
          <div className="space-y-2">
            {alertas.map(lote => renderLote(lote))}
          </div>
        </div>
      )}

      {/* Lotes OK */}
      {ok.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-bold text-emerald-700">
            ✓ OK:
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {ok.map(lote => renderLote(lote))}
          </div>
        </div>
      )}

      {/* Recomendação */}
      {criticos.length > 0 && (
        <div className="p-3 bg-rose-100 border border-rose-300 rounded text-xs text-rose-800">
          <strong>Ação recomendada:</strong> Priorizar expedição dos lotes críticos nas próximas 48h
        </div>
      )}
    </div>
  );
};
