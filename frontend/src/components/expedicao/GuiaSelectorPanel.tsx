import React, { useState } from 'react';
import { GuiaTransporte } from '../../types/expedicao';

interface GuiaSelectorPanelProps {
  guias: GuiaTransporte[];
  selectedGuiaId: string;
  onSelectGuia: (guiaId: string) => void;
}

export const GuiaSelectorPanel: React.FC<GuiaSelectorPanelProps> = ({
  guias,
  selectedGuiaId,
  onSelectGuia,
}) => {
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'numero' | 'cliente' | 'data'>('numero');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const guiasFiltered = guias.filter(g =>
    g.numero_guia.toLowerCase().includes(filterText.toLowerCase()) ||
    g.cliente_nome.toLowerCase().includes(filterText.toLowerCase())
  );

  const guiasSorted = [...guiasFiltered].sort((a, b) => {
    let cmp = 0;
    if (sortBy === 'numero') cmp = a.numero_guia.localeCompare(b.numero_guia);
    else if (sortBy === 'cliente') cmp = a.cliente_nome.localeCompare(b.cliente_nome);
    else cmp = new Date(a.data_criacao).getTime() - new Date(b.data_criacao).getTime();
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div>
      <label className="text-slate-700 block mb-2 font-medium text-sm">1. Selecionar Guia de Transporte</label>

      <div className="flex gap-1 mb-2">
        <input
          type="text"
          placeholder="Procura…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 bg-white border border-slate-300 rounded p-1.5 text-xs focus:outline-none focus:border-purple-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="bg-slate-50 border border-slate-300 rounded p-1.5 text-xs focus:outline-none focus:border-purple-500"
        >
          <option value="numero">Nº</option>
          <option value="cliente">Cliente</option>
          <option value="data">Data</option>
        </select>
        <button
          onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
          className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-semibold text-slate-700"
        >
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      <div className="border border-slate-300 rounded bg-white max-h-48 overflow-y-auto p-1">
        {guiasSorted.length === 0 ? (
          <div className="p-2 text-center text-xs text-slate-500">Nenhuma guia</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
            {guiasSorted.map(g => (
              <button
                key={g.id}
                onClick={() => onSelectGuia(g.id)}
                className={`text-left p-1.5 rounded text-xs border transition-all ${
                  selectedGuiaId === g.id
                    ? 'bg-purple-50 border-purple-400'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-mono font-bold text-purple-700 text-[11px]">{g.nome_documento || g.numero_guia}</div>
                <div className="text-[10px] text-slate-600 truncate">{g.cliente_nome}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
