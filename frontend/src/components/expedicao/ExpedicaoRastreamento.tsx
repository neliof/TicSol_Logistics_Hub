import React from 'react';
import { Truck, Clock, MapPin, CheckCircle2, AlertCircle } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface EventoRastreamento {
  id: string;
  numero_guia: string;
  evento: 'PREPARADA' | 'EXPEDIDA' | 'EM_TRANSITO' | 'ENTREGUE' | 'DEVOLVIDA';
  localizacao?: string;
  descricao: string;
  data_hora: string;
  operador?: string;
  status: 'OK' | 'ALERTA' | 'ERRO';
}

interface ExpedicaoRastreamentoProps {
  numero_guia: string;
  eventos: EventoRastreamento[];
  status_atual: 'PREPARACAO' | 'EXPEDIDO' | 'TRANSITO' | 'ENTREGUE' | 'DEVOLVIDO';
  loading?: boolean;
}

export const ExpedicaoRastreamento: React.FC<ExpedicaoRastreamentoProps> = ({
  numero_guia,
  eventos,
  status_atual,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Rastreamento</h3>
        </div>
        <div className="text-center py-6 text-slate-500">A carregar…</div>
      </div>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Rastreamento</h3>
        </div>
        <EmptyState
          icon={Clock}
          title="Sem eventos de rastreamento"
          description="Expedição ainda não iniciada"
          compact
        />
      </div>
    );
  }

  const getEventoIcon = (evento: string) => {
    switch (evento) {
      case 'PREPARADA':
        return <Clock className="w-5 h-5 text-slate-600" />;
      case 'EXPEDIDA':
        return <Truck className="w-5 h-5 text-blue-600" />;
      case 'EM_TRANSITO':
        return <Truck className="w-5 h-5 text-amber-600" />;
      case 'ENTREGUE':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'DEVOLVIDA':
        return <AlertCircle className="w-5 h-5 text-rose-600" />;
      default:
        return null;
    }
  };

  const getEventoLabel = (evento: string) => {
    switch (evento) {
      case 'PREPARADA':
        return 'Preparada';
      case 'EXPEDIDA':
        return 'Expedida';
      case 'EM_TRANSITO':
        return 'Em Trânsito';
      case 'ENTREGUE':
        return 'Entregue';
      case 'DEVOLVIDA':
        return 'Devolvida';
      default:
        return evento;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PREPARACAO':
        return 'text-slate-700';
      case 'EXPEDIDO':
        return 'text-blue-700';
      case 'TRANSITO':
        return 'text-amber-700';
      case 'ENTREGUE':
        return 'text-emerald-700';
      case 'DEVOLVIDO':
        return 'text-rose-700';
      default:
        return 'text-slate-700';
    }
  };

  const eventosOrdenados = [...eventos].sort(
    (a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime()
  );

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Rastreamento</h3>
        </div>
        <div className={`text-sm font-bold ${getStatusColor(status_atual)}`}>
          {status_atual.replace('_', ' ')}
        </div>
      </div>

      {/* Status resumo */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded">
        <div className="text-sm font-semibold text-slate-900 mb-1">
          Guia: {numero_guia}
        </div>
        <div className="text-xs text-slate-600">
          {eventos.length} evento(s) registado(s)
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {eventosOrdenados.map((evt, idx) => (
          <div key={evt.id} className="flex gap-3">
            {/* Ícone timeline */}
            <div className="flex flex-col items-center gap-1">
              <div className="p-1.5 rounded-full bg-white border-2 border-slate-300">
                {getEventoIcon(evt.evento)}
              </div>
              {idx < eventosOrdenados.length - 1 && (
                <div className="w-0.5 h-8 bg-slate-200"></div>
              )}
            </div>

            {/* Conteúdo */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="font-semibold text-sm text-slate-900">
                  {getEventoLabel(evt.evento)}
                </div>
                <div className="text-xs text-slate-500 whitespace-nowrap">
                  {new Date(evt.data_hora).toLocaleString('pt-PT')}
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-0.5">
                <div>{evt.descricao}</div>
                {evt.localizacao && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="font-mono">{evt.localizacao}</span>
                  </div>
                )}
                {evt.operador && (
                  <div>
                    <span className="text-slate-500">Operador:</span>
                    <span className="ml-2 font-semibold">{evt.operador}</span>
                  </div>
                )}
              </div>

              {evt.status === 'ALERTA' && (
                <div className="mt-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                  ⚠ Atenção necessária
                </div>
              )}
              {evt.status === 'ERRO' && (
                <div className="mt-1 text-xs text-rose-700 bg-rose-50 px-2 py-1 rounded">
                  ✕ Erro registado
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
