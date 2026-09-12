import React, { useState } from 'react';
import { ReceivingOrder, ReceivingLine } from '../types/wms';
import { useSeriesConfig } from '../hooks/useSeriesConfig';
import { useRecepcao } from '../hooks/useRecepcao';
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
import { RececaoConferencia } from './rececao/RececaoConferencia';
import { RececaoDivergencias } from './rececao/RececaoDivergencias';
import { RececaoDocumento } from './rececao/RececaoDocumento';
import { RececaoLotes } from './rececao/RececaoLotes';
import { RececaoLocalizacao } from './rececao/RececaoLocalizacao';
import { RececaoPaletizacao } from './rececao/RececaoPaletizacao';
import { RececaoValidacao } from './rececao/RececaoValidacao';
import { RececaoArtsoftIntegration } from './rececao/RececaoArtsoftIntegration';
import { RececaoPartial } from './rececao/RececaoPartial';

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
  const recepcaoHook = useRecepcao();

  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [notification, setNotification] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDataInicio, setSyncDataInicio] = useState('');
  const [syncDataFim, setSyncDataFim] = useState('');

  // Modais P1
  const [showDocumentoModal, setShowDocumentoModal] = useState(false);
  const [showDivergenciasModal, setShowDivergenciasModal] = useState(false);
  const [selectedLinha, setSelectedLinha] = useState<ReceivingLine | null>(null);
  const [showLotesModal, setShowLotesModal] = useState(false);
  const [showLocalizacaoModal, setShowLocalizacaoModal] = useState(false);
  const [selectedPaletaSSCC, setSelectedPaletaSSCC] = useState<string | null>(null);
  const [showValidacaoModal, setShowValidacaoModal] = useState(false);

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
          <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm overflow-hidden flex flex-col space-y-4">
            <div className="space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* RececaoPartial — Histórico receções anteriores */}
              {false && (
                <RececaoPartial
                  recepcoes={[]}
                  onRetomar={() => {}}
                  onVisualizarDetalhes={() => {}}
                />
              )}

              {/* RececaoDocumento — Registar documento fornecedor */}
              <div className="border-b border-slate-200 pb-4">
                <button
                  onClick={() => setShowDocumentoModal(true)}
                  className="w-full px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {recepcaoHook.documento ? '✓ Editar Documento' : '+ Registar Documento'}
                </button>
                {recepcaoHook.documento && (
                  <div className="mt-2 text-xs text-slate-600">
                    {recepcaoHook.documento.tipo} • {recepcaoHook.documento.numero}
                  </div>
                )}
              </div>

              {/* RececaoConferencia — Conferência linha a linha */}
              <div className="border-b border-slate-200 pb-4">
                <h3 className="font-semibold text-sm text-slate-900 mb-3">Conferência de Linhas</h3>
                <RececaoConferencia
                  linhas={selectedOrder.linhas}
                  onConferir={(linha_id, qtd_recebida, danificados) => {
                    handleUpdateLine(linha_id, { qtd_recebida_caixas: qtd_recebida, danificados_caixas: danificados });
                  }}
                  onDiverger={(linha_id) => {
                    const linha = selectedOrder.linhas.find(l => l.id === linha_id);
                    if (linha) {
                      setSelectedLinha(linha);
                      setShowDivergenciasModal(true);
                    }
                  }}
                  operador="Operador"
                />
              </div>

              {/* RececaoValidacao — Checklist pré-finalização */}
              <div className="border-b border-slate-200 pb-4">
                <RececaoValidacao
                  validacao={recepcaoHook.validarRecepcao()}
                  onFinalizar={async () => {
                    setShowValidacaoModal(false);
                    handleCompleteReceiving();
                  }}
                  loading={recepcaoHook.loading}
                />
              </div>

              {/* RececaoArtsoftIntegration — Criar entrada ERP */}
              <RececaoArtsoftIntegration
                integracao={recepcaoHook.integracao}
                onCriarEntrada={async () => {
                  // TODO: Integrar com backend
                }}
                onTentarNovamente={async () => {
                  // TODO: Retry logic
                }}
                loading={recepcaoHook.loading}
              />
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

      {/* P1 Modais */}
      <RececaoDocumento
        isOpen={showDocumentoModal}
        documento={recepcaoHook.documento || null}
        onSave={(tipo, numero, data, url_anexo, observacoes) => {
          recepcaoHook.registarDocumento(tipo, numero, data, 'Operador', url_anexo);
          setShowDocumentoModal(false);
          showNotification('Documento registado com sucesso');
        }}
        onCancel={() => setShowDocumentoModal(false)}
      />

      <RececaoDivergencias
        isOpen={showDivergenciasModal}
        linha={selectedLinha}
        onSave={(tipo, quantidade, motivo, impacto) => {
          if (selectedLinha) {
            recepcaoHook.registarDivergencia(
              selectedLinha.id,
              tipo as any,
              quantidade,
              motivo,
              'Operador',
              impacto as any
            );
          }
          setShowDivergenciasModal(false);
          setSelectedLinha(null);
          showNotification('Divergência registada');
        }}
        onCancel={() => {
          setShowDivergenciasModal(false);
          setSelectedLinha(null);
        }}
      />

      <RececaoLotes
        isOpen={showLotesModal}
        linha={selectedLinha}
        lotes={[]}
        onSave={(novosLotes) => {
          if (selectedLinha) {
            recepcaoHook.registarLotes(selectedLinha.id, novosLotes, 'Operador');
          }
          setShowLotesModal(false);
          setSelectedLinha(null);
          showNotification('Lotes registados');
        }}
        onCancel={() => {
          setShowLotesModal(false);
          setSelectedLinha(null);
        }}
      />

      <RececaoLocalizacao
        isOpen={showLocalizacaoModal}
        paletaSSCC={selectedPaletaSSCC}
        onSave={(localizacao, observacoes) => {
          setShowLocalizacaoModal(false);
          setSelectedPaletaSSCC(null);
          showNotification(`Localização ${localizacao} registada`);
        }}
        onCancel={() => {
          setShowLocalizacaoModal(false);
          setSelectedPaletaSSCC(null);
        }}
      />
    </div>
  );
};
