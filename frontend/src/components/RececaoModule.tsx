import React, { useState } from 'react';
import { ReceivingOrder, ReceivingLine } from '../types/wms';
import { 
  Truck, 
  Search, 
  Scan, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Building2, 
  Thermometer, 
  ArrowRight, 
  Save, 
  Plus, 
  FileText,
  Boxes,
  ShieldCheck,
  Calendar,
  AlertCircle
} from 'lucide-react';

interface RececaoModuleProps {
  orders: ReceivingOrder[];
  onUpdateOrders: (orders: ReceivingOrder[]) => void;
  onNavigateToPaletizacao: (guiaId: string, lineId: string) => void;
  onOpenScanner: () => void;
  scannedCode: string | null;
  clearScannedCode: () => void;
}

export const RececaoModule: React.FC<RececaoModuleProps> = ({
  orders,
  onUpdateOrders,
  onNavigateToPaletizacao,
  onOpenScanner,
  scannedCode,
  clearScannedCode
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || orders[0];

  // React to barcode scanner input if active
  React.useEffect(() => {
    if (scannedCode && selectedOrder) {
      const matchedLine = selectedOrder.linhas.find(
        l => l.ean_barcode === scannedCode || l.artigo_codigo === scannedCode
      );
      if (matchedLine) {
        showNotification(`Artigo Encontrado por Barcode: ${matchedLine.artigo_descricao}`);
      } else {
        showNotification(`Código de Barras ${scannedCode} lido com sucesso (não associado a esta guia).`);
      }
      clearScannedCode();
    }
  }, [scannedCode, selectedOrder]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleUpdateLine = (lineId: string, updates: Partial<ReceivingLine>) => {
    const updatedOrders = orders.map(ord => {
      if (ord.id !== selectedOrderId) return ord;
      return {
        ...ord,
        linhas: ord.linhas.map(line => {
          if (line.id !== lineId) return line;
          const newRec = updates.qtd_recebida_caixas !== undefined ? updates.qtd_recebida_caixas : line.qtd_recebida_caixas;
          const newExp = line.qtd_esperada_caixas;
          let newStatus = line.estado_linha;
          if (newRec >= newExp) newStatus = 'CONCLUIDO';
          else if (newRec > 0) newStatus = 'PARCIAL';
          
          return {
            ...line,
            ...updates,
            estado_linha: newStatus
          };
        })
      };
    });

    onUpdateOrders(updatedOrders);
  };

  const handleCompleteReceiving = () => {
    const updatedOrders = orders.map(ord => {
      if (ord.id !== selectedOrderId) return ord;
      return {
        ...ord,
        estado: 'CONCLUIDO' as const,
        linhas: ord.linhas.map(l => ({ ...l, estado_linha: 'CONCLUIDO' as const }))
      };
    });
    onUpdateOrders(updatedOrders);
    showNotification(`Receção da Guia ${selectedOrder.numero_guia} concluída com sucesso! RPC fn_registar_rececao_linha executado.`);
  };

  const filteredOrders = orders.filter(ord => {
    const matchesStatus = statusFilter === 'TODOS' || ord.estado === statusFilter;
    const matchesQuery = 
      ord.numero_guia.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.fornecedor_nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ord.doc_origem.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-6 h-6 text-blue-600" />
            Ecrã de Receção de Mercadoria (Cais WMS)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Registo de chegada, verificação de lotes/validade, controlo de danos e encaminhamento para paletização.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenScanner}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
          >
            <Scan className="w-4 h-4 text-amber-400" />
            Escanear Artigo EAN
          </button>
        </div>
      </div>

      {/* Main Grid: Orders Sidebar + Detailed Order Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Orders List (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Pesquisar por Guia ou Fornecedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Status Filter Badges */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {['TODOS', 'EM_RECECAO', 'PENDENTE', 'CONCLUIDO'].map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded-md whitespace-nowrap transition-colors ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white font-semibold shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Cards List */}
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredOrders.map(ord => {
              const isSelected = ord.id === selectedOrderId;
              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrderId(ord.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/60 border-blue-500 shadow-sm ring-1 ring-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600 block">{ord.numero_guia}</span>
                      <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">{ord.fornecedor_nome}</h4>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                        ord.estado === 'CONCLUIDO'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : ord.estado === 'EM_RECECAO'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {ord.estado}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span>Doc Origem:</span>
                      <span className="text-slate-800 font-medium">{ord.doc_origem}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cais Atribuído:</span>
                      <span className="text-slate-800 font-medium">{ord.cais_atribuido || 'Cais 01'}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-100 text-[11px] mt-1">
                      <span>Linhas: {ord.linhas.length}</span>
                      <span className="text-blue-600 font-bold">
                        {ord.linhas.reduce((acc, l) => acc + l.qtd_recebida_caixas, 0)} / {ord.linhas.reduce((acc, l) => acc + l.qtd_esperada_caixas, 0)} Cx
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Order Details & Receiving Lines Form (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {selectedOrder ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
              
              {/* Order Metadata Bar */}
              <div className="border-b border-slate-200 pb-5">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono font-bold rounded border border-blue-200">
                        {selectedOrder.numero_guia}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Encomenda ARTSOFT: {selectedOrder.numero_encomenda_artsoft}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-1">{selectedOrder.fornecedor_nome}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedOrder.estado !== 'CONCLUIDO' && (
                      <button
                        onClick={handleCompleteReceiving}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        Concluir Receção na Guia
                      </button>
                    )}
                  </div>
                </div>

                {/* Grid Metadata details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs font-mono">
                  <div>
                    <span className="text-slate-500 block">Motorista:</span>
                    <span className="text-slate-800 font-semibold">{selectedOrder.motorista || 'N/D'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Matrícula:</span>
                    <span className="text-slate-800 font-semibold">{selectedOrder.matricula_veiculo || 'N/D'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Temperatura Cais:</span>
                    <span className="text-amber-700 font-semibold flex items-center gap-1">
                      <Thermometer className="w-3.5 h-3.5 text-amber-600" />
                      {selectedOrder.temperatura_veiculo_c ?? 18}°C
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Chegada:</span>
                    <span className="text-slate-800 font-semibold">{selectedOrder.data_chegada || 'Em curso'}</span>
                  </div>
                </div>
              </div>

              {/* Receiving Lines Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    Linhas de Mercadoria a Conferir
                  </h4>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedOrder.linhas.length} artigo(s)
                  </span>
                </div>

                <div className="space-y-4">
                  {selectedOrder.linhas.map((line) => {
                    const remainingToPalletize = line.qtd_recebida_caixas - line.qtd_ja_paletizada_caixas;

                    return (
                      <div
                        key={line.id}
                        className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4"
                      >
                        {/* Line Header */}
                        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-blue-600 font-bold">{line.artigo_codigo}</span>
                              <span className="text-xs font-mono text-slate-500">EAN: {line.ean_barcode}</span>
                            </div>
                            <h5 className="font-bold text-sm text-slate-900 mt-0.5">{line.artigo_descricao}</h5>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-600 font-mono bg-white px-2.5 py-1 rounded border border-slate-200 shadow-xs">
                              Sugestão: <strong className="text-blue-600">{line.localizacao_sugerida}</strong>
                            </span>
                            
                            {/* Palletize Direct Action */}
                            <button
                              onClick={() => onNavigateToPaletizacao(selectedOrder.id, line.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-md shadow-xs transition-colors"
                              title="Ir para o Ecrã de Paletização com este artigo"
                            >
                              <Boxes className="w-3.5 h-3.5" />
                              Paletizar ({remainingToPalletize} Cx)
                            </button>
                          </div>
                        </div>

                        {/* Input Fields Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                          {/* Qtd Esperada */}
                          <div>
                            <label className="text-[11px] text-slate-500 block mb-1">Esperado (Cx)</label>
                            <input
                              type="number"
                              disabled
                              value={line.qtd_esperada_caixas}
                              className="w-full bg-slate-200/60 border border-slate-300 rounded px-2.5 py-1.5 font-mono text-slate-600"
                            />
                          </div>

                          {/* Qtd Recebida (Editable) */}
                          <div>
                            <label className="text-[11px] text-slate-700 font-semibold block mb-1">
                              Recebido (Cx)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={line.qtd_recebida_caixas}
                              onChange={(e) =>
                                handleUpdateLine(line.id, {
                                  qtd_recebida_caixas: parseInt(e.target.value, 10) || 0
                                })
                              }
                              className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2.5 py-1.5 font-mono text-blue-700 font-bold focus:outline-none shadow-xs"
                            />
                          </div>

                          {/* Lote */}
                          <div>
                            <label className="text-[11px] text-slate-700 block mb-1">Lote Fornecedor</label>
                            <input
                              type="text"
                              value={line.lote || ''}
                              onChange={(e) =>
                                handleUpdateLine(line.id, { lote: e.target.value })
                              }
                              placeholder="LOTE-..."
                              className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none shadow-xs"
                            />
                          </div>

                          {/* Data Validade */}
                          <div>
                            <label className="text-[11px] text-slate-700 block mb-1">Data Validade</label>
                            <input
                              type="date"
                              value={line.data_validade || ''}
                              onChange={(e) =>
                                handleUpdateLine(line.id, { data_validade: e.target.value })
                              }
                              className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2.5 py-1.5 font-mono text-slate-800 focus:outline-none shadow-xs"
                            />
                          </div>

                          {/* Danificados */}
                          <div>
                            <label className="text-[11px] text-rose-600 font-medium block mb-1">Danificados (Cx)</label>
                            <input
                              type="number"
                              min="0"
                              value={line.danificados_caixas}
                              onChange={(e) =>
                                handleUpdateLine(line.id, {
                                  danificados_caixas: parseInt(e.target.value, 10) || 0
                                })
                              }
                              className="w-full bg-white border border-slate-300 focus:border-rose-500 rounded px-2.5 py-1.5 font-mono text-rose-600 font-bold focus:outline-none shadow-xs"
                            />
                          </div>

                          {/* Já Paletizado (Read-only) */}
                          <div>
                            <label className="text-[11px] text-emerald-700 font-medium block mb-1">Já Paletizado</label>
                            <div className="w-full bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5 font-mono text-emerald-700 font-bold">
                              {line.qtd_ja_paletizada_caixas} Cx
                            </div>
                          </div>
                        </div>

                        {/* Damage notes if any */}
                        {line.danificados_caixas > 0 && (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>
                              <strong>Anomalia Registada:</strong> {line.danificados_caixas} caixa(s) com avaria. Insira notas de não-conformidade no relatório.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
              Selecione uma guia na lista à esquerda para conferir e receber artigos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
