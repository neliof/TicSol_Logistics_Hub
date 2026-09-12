import React, { useState } from 'react';
import { ReceivingOrder, ReceivingLine } from '../types/wms';
import { useSeriesConfig } from '../hooks/useSeriesConfig';
import { SyncDocumentsModal } from './SyncDocumentsModal';
import { EmptyState } from './EmptyState';
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
  AlertCircle,
  Inbox
} from 'lucide-react';

interface RececaoModuleProps {
  orders: ReceivingOrder[];
  onUpdateOrders: (orders: ReceivingOrder[]) => void;
  onNavigateToPaletizacao: (guiaId: string, lineId: string) => void;
  onOpenScanner: () => void;
  scannedCode: string | null;
  clearScannedCode: () => void;
  onSyncDocuments?: (dataInicio?: string, dataFim?: string, series?: string[]) => Promise<void>;
  isSyncLoading?: boolean;
}

export const RececaoModule: React.FC<RececaoModuleProps> = ({
  orders,
  onUpdateOrders,
  onNavigateToPaletizacao,
  onOpenScanner,
  scannedCode,
  clearScannedCode,
  onSyncDocuments,
  isSyncLoading = false
}) => {
  const { receção: seriesReceção } = useSeriesConfig('receção');

  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDataInicio, setSyncDataInicio] = useState('');
  const [syncDataFim, setSyncDataFim] = useState('');

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

  const handleSync = async () => {
    console.log('[RececaoModule] Iniciando sync', { seriesReceção, syncDataInicio, syncDataFim, onSyncDocumentsDef: typeof onSyncDocuments });
    try {
      if (!onSyncDocuments) {
        throw new Error('onSyncDocuments callback não definido');
      }
      await onSyncDocuments(syncDataInicio || undefined, syncDataFim || undefined, seriesReceção);
      setShowSyncModal(false);
      setSyncDataInicio('');
      setSyncDataFim('');
    } catch (err) {
      console.error('[RececaoModule] Sync error:', err);
    }
  };

  const filteredOrders = statusFilter === 'TODOS' ? orders : orders.filter(ord => ord.estado === statusFilter);

  return (
    <div className="flex flex-col gap-4 h-screen">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-emerald-400 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-lg shrink-0">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6" />
            <h1 className="text-2xl font-bold">Receção — Cais WMS</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSyncModal(true)}
              disabled={isSyncLoading}
              className="px-3 py-1.5 bg-white text-blue-600 font-semibold text-sm rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-all"
            >
              {isSyncLoading ? 'A sincronizar…' : 'Sincronizar Documentos'}
            </button>
            <button
              onClick={onOpenScanner}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
            >
              <Scan className="w-4 h-4 text-amber-400" />
              Escanear
            </button>
          </div>
        </div>
        <p className="text-blue-100">Verificação de lotes/validade, controlo de danos e encaminhamento</p>
      </div>

      {/* Main 3-Column Layout — Responsive */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Column 1: Orders List */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Recepções
            </h2>
            <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-mono font-bold">
              {filteredOrders.length}
            </span>
          </div>

          {/* Status Filter */}
          <div className="px-4 py-2 border-b border-slate-100 bg-white">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="TODOS">Todos status</option>
              <option value="EM_RECECAO">Em Receção</option>
              <option value="PENDENTE">Pendente</option>
              <option value="CONCLUIDO">Concluído</option>
            </select>
          </div>

          {/* Orders Scroll */}
          <div className="flex-1 overflow-y-auto">
            {filteredOrders.length > 0 ? filteredOrders.map((ord) => (
              <button
                key={ord.id}
                onClick={() => setSelectedOrderId(ord.id)}
                className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-blue-50 transition-all ${
                  selectedOrderId === ord.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="font-mono font-bold text-xs text-slate-900">{ord.numero_guia}</span>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      ord.estado === 'EM_RECECAO'
                        ? 'bg-amber-100 text-amber-700'
                        : ord.estado === 'CONCLUIDO'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {ord.estado.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-600 truncate">{ord.fornecedor_nome}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {ord.linhas.length} linhas • {ord.linhas.reduce((sum, l) => sum + l.qtd_recebida_caixas, 0)}/{ord.linhas.reduce((sum, l) => sum + l.qtd_esperada_caixas, 0)} Cx
                </div>
              </button>
            )) : (
              <EmptyState
                icon={Inbox}
                title="Sem receções"
                description={statusFilter !== 'TODOS' ? `Nenhuma receção com status "${statusFilter}"` : 'Nenhuma receção disponível'}
                compact
              />
            )}
          </div>
        </div>

        {/* Column 2: Order Details */}
        {selectedOrder ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-6 overflow-y-auto h-full">
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
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
            Selecione uma guia na lista à esquerda para conferir e receber artigos.
          </div>
        )}

        {/* Column 3: Product Lines */}
        {selectedOrder && (
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col">
            <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
              <FileText className="w-4 h-4 text-blue-600" />
              Linhas ({selectedOrder.linhas.length})
            </h3>

            <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
              {selectedOrder.linhas.map((line) => {
                const remainingToPalletize = line.qtd_recebida_caixas - line.qtd_ja_paletizada_caixas;

                return (
                  <div
                    key={line.id}
                    className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-blue-600 font-bold shrink-0">{line.artigo_codigo}</span>
                          <span className="text-xs font-mono text-slate-500 truncate">EAN: {line.ean_barcode}</span>
                        </div>
                        <h5 className="font-bold text-xs text-slate-900 line-clamp-2">{line.artigo_descricao}</h5>
                      </div>
                      <button
                        onClick={() => onNavigateToPaletizacao(selectedOrder.id, line.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[10px] rounded-md whitespace-nowrap shrink-0"
                      >
                        <Boxes className="w-3 h-3" />
                        Paletizar ({remainingToPalletize})
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-slate-500 block mb-0.5">Esperado</label>
                        <input
                          type="number"
                          disabled
                          value={line.qtd_esperada_caixas}
                          className="w-full bg-slate-200/60 border border-slate-300 rounded px-2 py-1 font-mono text-slate-600 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-slate-700 font-semibold block mb-0.5">Recebido (Cx)</label>
                        <input
                          type="number"
                          min="0"
                          value={line.qtd_recebida_caixas}
                          onChange={(e) =>
                            handleUpdateLine(line.id, {
                              qtd_recebida_caixas: parseInt(e.target.value, 10) || 0
                            })
                          }
                          className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2 py-1 font-mono text-blue-700 font-bold text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-700 block mb-0.5">Lote</label>
                        <input
                          type="text"
                          value={line.lote || ''}
                          onChange={(e) =>
                            handleUpdateLine(line.id, { lote: e.target.value })
                          }
                          placeholder="LOTE"
                          className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2 py-1 font-mono text-slate-800 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-slate-700 block mb-0.5">Validade</label>
                        <input
                          type="date"
                          value={line.data_validade || ''}
                          onChange={(e) =>
                            handleUpdateLine(line.id, { data_validade: e.target.value })
                          }
                          className="w-full bg-white border border-slate-300 focus:border-blue-500 rounded px-2 py-1 font-mono text-slate-800 text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-rose-600 font-medium block mb-0.5">Danificados</label>
                        <input
                          type="number"
                          min="0"
                          value={line.danificados_caixas}
                          onChange={(e) =>
                            handleUpdateLine(line.id, {
                              danificados_caixas: parseInt(e.target.value, 10) || 0
                            })
                          }
                          className="w-full bg-white border border-slate-300 focus:border-rose-500 rounded px-2 py-1 font-mono text-rose-600 font-bold text-xs focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-emerald-700 font-medium block mb-0.5">Já Paletizado</label>
                        <div className="w-full bg-emerald-50 border border-emerald-200 rounded px-2 py-1 font-mono text-emerald-700 font-bold text-xs">
                          {line.qtd_ja_paletizada_caixas}
                        </div>
                      </div>
                    </div>

                    {line.danificados_caixas > 0 && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                        <span><strong>Anomalia:</strong> {line.danificados_caixas} cx danificadas</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sync Modal */}
      <SyncDocumentsModal
        isOpen={showSyncModal}
        isLoading={isSyncLoading}
        seriesLabel={seriesReceção.length > 0 ? `séries: ${seriesReceção.join(', ')}` : 'sem séries configuradas'}
        dataInicio={syncDataInicio}
        dataFim={syncDataFim}
        onDataInicioChange={setSyncDataInicio}
        onDataFimChange={setSyncDataFim}
        onSync={handleSync}
        onClose={() => setShowSyncModal(false)}
      />
    </div>
  );
};
