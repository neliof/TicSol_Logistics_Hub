import React from 'react';
import { History, Package, Truck, MapPin, RotateCw, Archive, CheckCircle2 } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface Movimento {
  id: string;
  evento: 'CRIADA' | 'MOVIDA' | 'ARMAZENADA' | 'RESERVADA' | 'EXPEDIDA' | 'DEVOLVIDA';
  localizacao_anterior?: string;
  localizacao_nova?: string;
  quantidade_anterior?: number;
  quantidade_nova?: number;
  operador: string;
  observacoes?: string;
  evento_em: string;
}

interface PaletizacaoHistoricoProps {
  sscc: string;
  movimentos: Movimento[];
  loading?: boolean;
}

export const PaletizacaoHistorico: React.FC<PaletizacaoHistoricoProps> = ({
  sscc,
  movimentos,
  loading = false,
}) => {
  const getEventoIcon = (evento: string) => {
    switch (evento) {
      case 'CRIADA':
        return Package;
      case 'MOVIDA':
        return Truck;
      case 'ARMAZENADA':
        return Archive;
      case 'RESERVADA':
        return RotateCw;
      case 'EXPEDIDA':
        return CheckCircle2;
      case 'DEVOLVIDA':
        return RotateCw;
      default:
        return History;
    }
  };

  const getEventoColor = (evento: string) => {
    switch (evento) {
      case 'CRIADA':
        return 'text-purple-600';
      case 'MOVIDA':
        return 'text-blue-600';
      case 'ARMAZENADA':
        return 'text-slate-600';
      case 'RESERVADA':
        return 'text-amber-600';
      case 'EXPEDIDA':
        return 'text-emerald-600';
      case 'DEVOLVIDA':
        return 'text-rose-600';
      default:
        return 'text-slate-600';
    }
  };

  if (loading) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Histórico Movimentos</h3>
        </div>
        <div className="text-center py-6 text-slate-500">A carregar…</div>
      </div>
    );
  }

  if (movimentos.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Histórico Movimentos</h3>
        </div>
        <EmptyState
          icon={History}
          title="Sem movimentos registados"
          description={`SSCC: ${sscc}`}
          compact
        />
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-slate-600" />
        <h3 className="font-semibold text-slate-900">Histórico Movimentos</h3>
        <span className="ml-auto text-xs font-semibold text-slate-500">{movimentos.length}</span>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {movimentos.map((mov, idx) => {
          const EventoIcon = getEventoIcon(mov.evento);
          const color = getEventoColor(mov.evento);
          const timestamp = new Date(mov.evento_em);

          return (
            <div key={mov.id} className="flex gap-3">
              {/* Linha timeline */}
              <div className="flex flex-col items-center gap-1">
                <div className={`p-1.5 rounded-full bg-white border-2 ${color.replace('text', 'border')}`}>
                  <EventoIcon className={`w-3 h-3 ${color}`} />
                </div>
                {idx < movimentos.length - 1 && (
                  <div className="w-0.5 h-8 bg-slate-200"></div>
                )}
              </div>

              {/* Conteúdo */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className={`font-semibold text-sm ${color}`}>
                    {mov.evento}
                  </div>
                  <div className="text-xs text-slate-500 whitespace-nowrap">
                    {timestamp.toLocaleString('pt-PT')}
                  </div>
                </div>

                {/* Detalhes */}
                <div className="text-xs text-slate-600 space-y-0.5">
                  <div>Operador: {mov.operador}</div>
                  {mov.localizacao_anterior && (
                    <div>
                      De: <span className="font-mono text-slate-700">{mov.localizacao_anterior}</span>
                    </div>
                  )}
                  {mov.localizacao_nova && (
                    <div>
                      Para: <span className="font-mono text-slate-700">{mov.localizacao_nova}</span>
                    </div>
                  )}
                  {mov.quantidade_anterior !== undefined && (
                    <div>
                      Quantidade: {mov.quantidade_anterior}
                      {mov.quantidade_nova !== undefined && ` → ${mov.quantidade_nova}`}
                    </div>
                  )}
                  {mov.observacoes && (
                    <div className="italic text-slate-500">"{mov.observacoes}"</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
