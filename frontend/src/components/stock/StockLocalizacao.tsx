import React, { useState } from 'react';
import { MapPin, Move, Archive } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface MovimentoLocalizacao {
  palete_sscc: string;
  artigo_codigo: string;
  quantidade: number;
  localizacao_anterior?: string;
  localizacao_nova: string;
  evento: 'ARMAZENADA' | 'MOVIDA' | 'RESERVADA';
  operador: string;
  timestamp: string;
}

interface StockLocalizacaoProps {
  movimentos: MovimentoLocalizacao[];
  filtroZona?: string;
  onFiltrar?: (zona: string) => void;
  loading?: boolean;
}

export const StockLocalizacao: React.FC<StockLocalizacaoProps> = ({
  movimentos,
  filtroZona,
  onFiltrar,
  loading = false,
}) => {
  const [expandido, setExpandido] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Localização Stock</h3>
        </div>
        <div className="text-center py-6 text-slate-500">A carregar…</div>
      </div>
    );
  }

  if (movimentos.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Localização Stock</h3>
        </div>
        <EmptyState
          icon={MapPin}
          title="Sem movimentos de localização"
          description="Paletes serão rastreadas aqui"
          compact
        />
      </div>
    );
  }

  const zonas = [...new Set(movimentos.map(m => m.localizacao_nova.split('-')[0]))];
  const movimentosFiltrados = filtroZona
    ? movimentos.filter(m => m.localizacao_nova.startsWith(filtroZona))
    : movimentos;

  const getEventoIcon = (evento: string) => {
    switch (evento) {
      case 'ARMAZENADA':
        return <Archive className="w-4 h-4 text-slate-600" />;
      case 'MOVIDA':
        return <Move className="w-4 h-4 text-blue-600" />;
      case 'RESERVADA':
        return <Move className="w-4 h-4 text-amber-600" />;
      default:
        return null;
    }
  };

  const getEventoLabel = (evento: string) => {
    switch (evento) {
      case 'ARMAZENADA':
        return 'Armazenada';
      case 'MOVIDA':
        return 'Movida';
      case 'RESERVADA':
        return 'Reservada';
      default:
        return evento;
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Localização Stock</h3>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          {movimentosFiltrados.length} movimentos
        </div>
      </div>

      {/* Filtro zonas */}
      {zonas.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => onFiltrar?.('')}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              !filtroZona
                ? 'bg-slate-900 text-white'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Todas
          </button>
          {zonas.map(zona => (
            <button
              key={zona}
              onClick={() => onFiltrar?.(zona)}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                filtroZona === zona
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              Zona {zona}
            </button>
          ))}
        </div>
      )}

      {/* Movimentos */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {movimentosFiltrados.map((mov, idx) => (
          <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <button
              onClick={() => setExpandido(expandido === idx ? null : idx)}
              className="w-full text-left flex items-start justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getEventoIcon(mov.evento)}
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {mov.palete_sscc.slice(0, 12)}…
                  </span>
                  <span className="text-xs bg-slate-200 px-2 py-1 rounded font-semibold text-slate-700">
                    {getEventoLabel(mov.evento)}
                  </span>
                </div>
                <div className="text-xs text-slate-600 mb-1">
                  {mov.artigo_codigo} • {mov.quantidade} un
                </div>
                <div className="text-xs font-mono text-slate-700">
                  📍 {mov.localizacao_nova}
                </div>
              </div>
              <div className="text-xs text-slate-500 whitespace-nowrap">
                {new Date(mov.timestamp).toLocaleString('pt-PT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </button>

            {/* Expandido */}
            {expandido === idx && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-700">SSCC:</span>
                  <span className="ml-2 font-mono text-slate-600">{mov.palete_sscc}</span>
                </div>
                {mov.localizacao_anterior && (
                  <div>
                    <span className="font-semibold text-slate-700">De:</span>
                    <span className="ml-2 font-mono text-slate-600">{mov.localizacao_anterior}</span>
                  </div>
                )}
                <div>
                  <span className="font-semibold text-slate-700">Para:</span>
                  <span className="ml-2 font-mono text-slate-600">{mov.localizacao_nova}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Operador:</span>
                  <span className="ml-2 text-slate-600">{mov.operador}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700">Hora:</span>
                  <span className="ml-2 text-slate-600">
                    {new Date(mov.timestamp).toLocaleString('pt-PT')}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Stats por zona */}
      {zonas.length > 0 && (
        <div className="p-3 bg-slate-100 rounded">
          <div className="text-xs font-semibold text-slate-900 mb-2">Distribuição por zona:</div>
          <div className="grid grid-cols-auto gap-4 text-xs">
            {zonas.map(zona => {
              const count = movimentos.filter(m => m.localizacao_nova.startsWith(zona)).length;
              return (
                <div key={zona} className="text-slate-700">
                  <strong>Zona {zona}:</strong> {count} movimentos
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
