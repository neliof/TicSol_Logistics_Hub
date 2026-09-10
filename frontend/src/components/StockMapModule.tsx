import React, { useState } from 'react';
import { StockPosition, WarehouseLocation } from '../types/wms';
import { 
  Layers, 
  Search, 
  MapPin, 
  Calendar, 
  AlertTriangle, 
  ArrowRightLeft, 
  Building2, 
  CheckCircle2, 
  Thermometer, 
  Box, 
  X,
  Filter
} from 'lucide-react';

interface StockMapModuleProps {
  stockList: StockPosition[];
  locations: WarehouseLocation[];
  selectedTenant: string;
  onTransferStock: (stockId: string, newLocationCode: string) => void;
}

export const StockMapModule: React.FC<StockMapModuleProps> = ({
  stockList,
  locations,
  selectedTenant,
  onTransferStock
}) => {
  const [selectedLocationCode, setSelectedLocationCode] = useState<string>('A-01-02-3');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fefoFilter, setFefoFilter] = useState<string>('TODOS');
  const [transferModalStock, setTransferModalStock] = useState<StockPosition | null>(null);
  const [targetLocInput, setTargetLocInput] = useState<string>('A-01-01-1');

  // Filtered Stock list
  const filteredStock = stockList.filter(item => {
    const matchesSearch = 
      item.artigo_descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.artigo_codigo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.ean_barcode.includes(searchQuery) ||
      item.lote.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.localizacao_codigo.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFefo = fefoFilter === 'TODOS' || item.fefo_status === fefoFilter;
    return matchesSearch && matchesFefo;
  });

  const selectedLocData = locations.find(l => l.codigo === selectedLocationCode) || locations[0];
  const itemsInSelectedLoc = stockList.filter(s => s.localizacao_codigo === selectedLocationCode);

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalStock || !targetLocInput) return;
    onTransferStock(transferModalStock.id, targetLocInput);
    setTransferModalStock(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Transfer Stock Modal */}
      {transferModalStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-slate-800 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" />
                Transferência de Stock / Putaway
              </h3>
              <button onClick={() => setTransferModalStock(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
              <p className="text-blue-700 font-bold">{transferModalStock.artigo_descricao}</p>
              <p className="text-slate-500">SSCC: {transferModalStock.sscc || 'N/D'}</p>
              <p className="text-slate-500">Lote: {transferModalStock.lote} • Localização Atual: <strong className="text-slate-900">{transferModalStock.localizacao_codigo}</strong></p>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Nova Localização Alvo
                </label>
                <select
                  value={targetLocInput}
                  onChange={(e) => setTargetLocInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-sm text-blue-700 font-bold focus:outline-none focus:border-blue-500"
                >
                  {locations.map(loc => (
                    <option key={loc.codigo} value={loc.codigo}>
                      {loc.codigo} ({loc.zona} - {loc.status})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Confirmar Transferência de Localização
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Module Title Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-600" />
            Gestão de Stock & Mapa de Armazém em Tempo Real
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Visualização 2D de Racks, FEFO (First Expired First Out) e Isolamento por Empresa (RLS).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="text-slate-500">Proprietário:</span>
            <strong className="text-blue-600">{selectedTenant}</strong>
          </div>
        </div>
      </div>

      {/* Interactive 2D Warehouse Map Grid Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-3">
          <MapPin className="w-4 h-4 text-blue-600" />
          Mapa Interativo do Armazém TicSol (Clique numa Prateleira/Célula)
        </h3>

        {/* 2D Grid Representation */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {locations.map(loc => {
            const isSelected = loc.codigo === selectedLocationCode;
            const isFull = loc.status === 'CHEIO';

            return (
              <button
                key={loc.codigo}
                onClick={() => setSelectedLocationCode(loc.codigo)}
                className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-blue-600 text-sm">{loc.codigo}</span>
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      isFull ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-emerald-500'
                    }`}
                  />
                </div>

                <p className="text-[11px] text-slate-600 font-medium line-clamp-1">{loc.zona}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{loc.temperatura_zona}</p>

                <div className="mt-3 flex items-center justify-between text-[11px] font-mono border-t border-slate-200/80 pt-2 text-slate-500">
                  <span>Ocupação:</span>
                  <span className="font-bold text-slate-800">{loc.ocupacao_atual}/{loc.capacidade_paletes} Pal.</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Location Details Card */}
        {selectedLocData && (
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 mt-4">
            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="font-mono text-xs text-blue-600 font-bold">
                Detalhes da Posição: {selectedLocData.codigo} ({selectedLocData.zona})
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Capacidade: {selectedLocData.capacidade_paletes} Paletes
              </span>
            </div>

            {itemsInSelectedLoc.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {itemsInSelectedLoc.map(stk => (
                  <div key={stk.id} className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1 shadow-xs">
                    <div className="flex justify-between font-mono font-bold">
                      <span className="text-slate-900">{stk.artigo_descricao}</span>
                      <span className="text-blue-600">{stk.qtd_caixas} Cx</span>
                    </div>
                    <p className="font-mono text-slate-500 text-[11px]">SSCC: {stk.sscc || 'Sem SSCC'}</p>
                    <p className="font-mono text-slate-500 text-[11px]">
                      Lote: {stk.lote} • Validade: <strong className="text-slate-800">{stk.data_validade}</strong>
                    </p>
                    <div className="pt-2 flex justify-between items-center">
                      <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-mono text-slate-600 rounded border border-slate-200">
                        Proprietário: {stk.empresa_owner}
                      </span>
                      <button
                        onClick={() => setTransferModalStock(stk)}
                        className="text-[11px] font-mono text-blue-600 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" /> Transferir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">Nenhuma palete armazenada atualmente nesta posição.</p>
            )}
          </div>
        )}
      </div>

      {/* Stock Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-600" />
            Tabela Completa de Inventário Físico (FEFO Alert System)
          </h3>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filtrar por EAN, Lote, Descrição..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* FEFO Filter */}
            <select
              value={fefoFilter}
              onChange={(e) => setFefoFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-mono focus:outline-none"
            >
              <option value="TODOS">Todos os Estados FEFO</option>
              <option value="OK">FEFO Ok (&gt;30d)</option>
              <option value="ALERTA_30D">Alerta Validade (&lt;30d)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50">
                <th className="p-3">Localização</th>
                <th className="p-3">Artigo & EAN</th>
                <th className="p-3">SSCC / Lote</th>
                <th className="p-3">Validade (FEFO)</th>
                <th className="p-3">Qtd (Caixas)</th>
                <th className="p-3">Proprietário RLS</th>
                <th className="p-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock.map(stk => (
                <tr key={stk.id} className="hover:bg-slate-50/80 transition-colors font-mono">
                  <td className="p-3 font-bold text-blue-600">{stk.localizacao_codigo}</td>
                  <td className="p-3">
                    <span className="font-semibold text-slate-900 block font-sans">{stk.artigo_descricao}</span>
                    <span className="text-slate-500 text-[11px]">{stk.artigo_codigo} • EAN: {stk.ean_barcode}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-slate-700 block">{stk.sscc || 'N/A'}</span>
                    <span className="text-slate-500 text-[11px]">Lote: {stk.lote}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-slate-800 block">{stk.data_validade}</span>
                    <span
                      className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${
                        stk.fefo_status === 'ALERTA_30D'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {stk.dias_para_validade} dias ({stk.fefo_status})
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-900">{stk.qtd_caixas} Cx</td>
                  <td className="p-3 text-slate-500">{stk.empresa_owner}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setTransferModalStock(stk)}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-blue-600 rounded text-[11px] font-bold border border-slate-200 transition-colors cursor-pointer"
                    >
                      Mover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
