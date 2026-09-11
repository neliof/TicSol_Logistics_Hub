import React, { useState, useEffect } from 'react';
import { AppTab, ReceivingOrder, PalletSSCC, StockPosition, RuleConfig, AuditLog } from './types/wms';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_LOCATIONS
} from './data/mockData';
import { lerSessao, terminarSessao, Utilizador, api } from './api';
import { useRegras } from './hooks/useRegras';
import { useSeriesConfig } from './hooks/useSeriesConfig';
import { Navbar } from './components/Navbar';
import { RececaoModule } from './components/RececaoModule';
import { PaletizacaoModule } from './components/PaletizacaoModule';
import { StockMapModule } from './components/StockMapModule';
import { ArtsoftSyncModule } from './components/ArtsoftSyncModule';
import { RegrasEngineModule } from './components/RegrasEngineModule';
import { AuditoriaModule } from './components/AuditoriaModule';
import { ExpedicaoModule } from './components/ExpedicaoModule';
import { ExpedicaoPaletizacaoModule } from './components/ExpedicaoPaletizacaoModule';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import SeriesConfig from './components/SeriesConfig';
import ArtsoftConfig from './components/ArtsoftConfig';
import GestaoDadosModule from './components/GestaoDadosModule';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { useWMSData } from './hooks/useWMSData';
import { useExpedicaoData } from './hooks/useExpedicaoData';
import { useToast } from './hooks/useToast';
import { GuiaTransporte, PaletaExpedicao, ChecklistExpedicao, ComprovanteEmbarque } from './types/expedicao';

export default function App() {
  const [utilizador, setUtilizador] = useState<Utilizador | null>(lerSessao()?.utilizador ?? null);

  // Dev phase: login automático se sem sessão
  useEffect(() => {
    if (!utilizador) {
      fetch('/auth/dev-token')
        .then(r => r.json())
        .then(({ token, usuario }) => {
          const { guardarSessao } = require('./api');
          guardarSessao(token, usuario);
          setUtilizador(usuario);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <AppAutenticada
      utilizador={utilizador}
      aoSair={() => {
        terminarSessao();
        setUtilizador(null);
      }}
    />
  );
}

function AppAutenticada({
  utilizador,
  aoSair
}: {
  utilizador: Utilizador | null;
  aoSair: () => void;
}) {
  const [activeTab, setActiveTab] = useState<AppTab>('rececao');
  const [selectedTenant, setSelectedTenant] = useState<string>('TicSol_HuB (Sonae MC)');

  // Toast notifications
  const { toasts, removeToast, success: showSuccess, error: showError, info: showInfo } = useToast();

  // Series Config — Load configurations for both modules
  const receçãoConfig = useSeriesConfig('receção');
  const expedicãoConfig = useSeriesConfig('expedição');

  // WMS Main State Collections — Real data from API + fallback to mock
  const { orders, pallets, stock: stockList, loading: wmsLoading, error: wmsError, setOrders, setPallets, setStock: setStockList } = useWMSData();
  const { rules, setRules } = useRegras();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [locations] = useState(INITIAL_LOCATIONS);

  // Expedição State — Imefar distribui para clientes via Guias de Transporte (ARTSOFT)
  const { pedidos: guiasEntrada, paletas: paletasExpedicao, guias: comprovantesEmbarque, loading: expedicaoLoading, error: expedicaoError, setPedidos: setGuiasEntrada, setPaletas: setPaletasExpedicao, setGuias: setComprovantesEmbarque, carregarLinhas } = useExpedicaoData();

  // Scanner & Navigation Helpers
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [preSelectedOrderAndLine, setPreSelectedOrderAndLine] = useState<{
    orderId: string;
    lineId: string;
  } | null>(null);

  // Loading states for async operations
  const [isSyncLoading, setIsSyncLoading] = useState(false);

  // Handler: Navigate directly from Receção to Paletização
  const handleNavigateToPaletizacao = (guiaId: string, lineId: string) => {
    setPreSelectedOrderAndLine({ orderId: guiaId, lineId });
    setActiveTab('paletizacao');
  };

  // Handler: When a pallet SSCC is created (materialized)
  const handlePalletCreated = (
    newPallet: PalletSSCC,
    orderId: string,
    lineId: string,
    boxesAdded: number
  ) => {
    // 1. Append Pallet to SSCC list
    setPallets(prev => [newPallet, ...prev]);

    // 2. CRITICAL FIX for Pending Item #3: Increment `qtd_ja_paletizada_caixas`
    setOrders(prevOrders =>
      prevOrders.map(ord => {
        if (ord.id !== orderId) return ord;
        return {
          ...ord,
          linhas: ord.linhas.map(line => {
            if (line.id !== lineId) return line;
            const updatedJaPaletizado = line.qtd_ja_paletizada_caixas + boxesAdded;
            return {
              ...line,
              qtd_ja_paletizada_caixas: updatedJaPaletizado
            };
          })
        };
      })
    );

    // 3. Create initial Stock Position in Staging
    const newStockPos: StockPosition = {
      id: `STK-${Date.now()}`,
      localizacao_codigo: 'EM_STAGING',
      zona: 'Cais de Receção',
      sscc: newPallet.sscc,
      artigo_codigo: newPallet.artigo_codigo,
      artigo_descricao: newPallet.artigo_descricao,
      ean_barcode: newPallet.ean_barcode,
      lote: newPallet.lote,
      data_validade: newPallet.data_validade,
      dias_para_validade: 365,
      fefo_status: 'OK',
      qtd_caixas: newPallet.caixas_na_palete,
      qtd_unidades: newPallet.unidades_totais,
      peso_kg: newPallet.peso_bruto_kg,
      empresa_owner: selectedTenant,
      reservado_pedido: false,
      data_entrada: new Date().toISOString().replace('T', ' ').slice(0, 19)
    };
    setStockList(prev => [newStockPos, ...prev]);

    // 4. Record Audit Log for PostgREST RPC
    const newLog: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operador: 'Op. Terminal WMS (ID: 104)',
      empresa_tenant: selectedTenant,
      acao: 'MATERIALIZAR_PALETE_SSCC',
      tabela_afetada: 'logistics.palete_sscc',
      postgrest_rpc: 'fn_criar_palete_sscc(guia_id, artigo, lote, sscc)',
      detalhes_json: JSON.stringify({
        sscc: newPallet.sscc,
        caixas: newPallet.caixas_na_palete,
        lote: newPallet.lote,
        validade: newPallet.data_validade,
        altura_cm: newPallet.altura_total_cm
      }),
      ip_terminal: '192.168.1.105 (Terminal Cais)'
    };
    setAuditLogs(prev => [newLog, ...prev]);

    // 5. Show success notification
    showSuccess(`Palete ${newPallet.sscc} criada com sucesso`);
  };

  // Handler: Relocate Stock Position
  const handleTransferStock = (stockId: string, newLocationCode: string) => {
    setStockList(prev =>
      prev.map(stk => (stk.id === stockId ? { ...stk, localizacao_codigo: newLocationCode } : stk))
    );

    const log: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operador: 'Op. Empilhador',
      empresa_tenant: selectedTenant,
      acao: 'REMANEJAMENTO_STOCK',
      tabela_afetada: 'logistics.posicao_stock',
      postgrest_rpc: 'fn_transferir_localizacao(stock_id, loc_nova)',
      detalhes_json: JSON.stringify({ stockId, novaLocalizacao: newLocationCode }),
      ip_terminal: '192.168.1.112 (Terminal RF)'
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // Handler: Confirm Guia Paletization & ready to ship
  const handleConfirmGuiaPaletizacao = (guiaId: string) => {
    setGuiasEntrada(prev =>
      prev.map(g => (g.id === guiaId ? { ...g, status: 'PRONTA_EMBARQUE' } : g))
    );
    const log: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operador: 'Op. Expedição',
      empresa_tenant: selectedTenant,
      acao: 'CONFIRMAR_PALETIZACAO_GUIA',
      tabela_afetada: 'logistics.guia_transporte',
      postgrest_rpc: 'fn_confirmar_paletizacao(guia_id)',
      detalhes_json: JSON.stringify({ guia_id: guiaId }),
      ip_terminal: '192.168.1.115 (Terminal Expedição)'
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // Handler: Create Palete Expedição (from PaletizacaoModule)
  const handleCreatePaletaExpedicao = (palete: PaletaExpedicao) => {
    setPaletasExpedicao(prev => [palete, ...prev]);
    setGuiasEntrada(prev =>
      prev.map(g => (g.id === palete.guia_id ? { ...g, status: 'PALETIZADA' } : g))
    );
    const log: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operador: 'Op. Paletização',
      empresa_tenant: selectedTenant,
      acao: 'CRIAR_PALETE_EXPEDICAO_AUTO',
      tabela_afetada: 'logistics.palete_expedicao',
      postgrest_rpc: 'fn_criar_palete_expedicao(guia_id, linhas, temperatura)',
      detalhes_json: JSON.stringify({ sscc: palete.sscc, guia_id: palete.guia_id, temperatura: palete.temperatura_zona }),
      ip_terminal: '192.168.1.110 (Terminal Paletização)'
    };
    setAuditLogs(prev => [log, ...prev]);
    showSuccess(`Palete ${palete.sscc} (Expedição) criada com sucesso`);
  };

  // Handler: Create Embarque Comprovante
  const handleCreateEmbarque = (comprovante: ComprovanteEmbarque) => {
    setComprovantesEmbarque(prev => [comprovante, ...prev]);
    setGuiasEntrada(prev =>
      prev.map(g => (g.id === comprovante.guia_id ? { ...g, status: 'EXPEDIDA' } : g))
    );
    const log: AuditLog = {
      id: `LOG-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operador: 'Op. Expedição',
      empresa_tenant: selectedTenant,
      acao: 'REGISTAR_EMBARQUE_SAIDA',
      tabela_afetada: 'logistics.comprovante_embarque',
      postgrest_rpc: 'fn_registar_embarque(guia_id, paletas, transportador)',
      detalhes_json: JSON.stringify({ numero_guia: comprovante.guia_id, transportador: comprovante.transportador_nome }),
      ip_terminal: '192.168.1.115 (Terminal Expedição)'
    };
    setAuditLogs(prev => [log, ...prev]);
  };

  // Handler: Sync documents (Receção/Paletização/Expedição)
  const handleSyncDocuments = async (dataInicio?: string, dataFim?: string, series?: string[]) => {
    console.log('[App] handleSyncDocuments called', { activeTab, dataInicio, dataFim, series });
    setIsSyncLoading(true);
    try {
      console.log('[App] Calling api.sincronizarGuias...');
      const result = await api.sincronizarGuias(dataInicio, dataFim, series);
      console.log('[App] Sync result:', result);
      // Reload documents after sync
      if (activeTab === 'rececao') {
        console.log('[App] Reloading receção orders');
        setOrders([...orders]); // Trigger reload via hook
      } else if (activeTab === 'paletizacao' || activeTab === 'paletizacao_expedicao' || activeTab === 'expedicao') {
        console.log('[App] Reloading expedição guias');
        setGuiasEntrada([...guiasEntrada]); // Trigger reload via hook
      }
      showSuccess('Sincronização de documentos concluída com sucesso');
    } catch (err) {
      console.error('[App] Sync failed:', err);
      showError(`Erro ao sincronizar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      throw err;
    } finally {
      setIsSyncLoading(false);
    }
  };

  // Filter documents by active module's configured series
  const getFilteredGuias = () => {
    // Determine which config to use based on active tab
    const config = activeTab === 'paletizacao_expedicao' || activeTab === 'expedicao'
      ? expedicãoConfig
      : receçãoConfig;

    // Get the series filter for the current module
    const seriesFilter = config.modulo === 'expedição' ? config.expedição : config.receção;

    // If no series configured for this module, show all (backward compatibility)
    if (seriesFilter.length === 0) return guiasEntrada;

    // Filter guias by configured series
    return guiasEntrada.filter(g => g.serie && seriesFilter.includes(g.serie));
  };

  // Filter receiving orders by series (extract series from numero_guia format: "GR-88421/2026" → "GR")
  const getFilteredOrders = () => {
    const seriesFilter = receçãoConfig.receção;

    // If no series configured for receção, show all (backward compatibility)
    if (seriesFilter.length === 0) return orders;

    // Extract series from numero_guia (e.g., "GR-88421/2026" → "GR")
    return orders.filter(o => {
      const seriePart = o.numero_guia?.split('-')[0]; // Get first part before dash
      return seriePart && seriesFilter.includes(seriePart);
    });
  };

  const filteredGuias = getFilteredGuias();
  const filteredOrders = getFilteredOrders();

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      
      {/* Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScannerModal
          onClose={() => setIsScannerOpen(false)}
          onScan={(code) => {
            setScannedCode(code);
            setIsScannerOpen(false);
          }}
        />
      )}

      {/* Primary WMS Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedTenant={selectedTenant}
        setSelectedTenant={setSelectedTenant}
        onOpenScanner={() => setIsScannerOpen(true)}
        nomeUtilizador={utilizador ? utilizador.nome || utilizador.email : 'Utilizador'}
        aoSair={aoSair}
      />

      {/* Status Alert */}
      {wmsError && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <span className="text-sm">⚠️ {wmsError}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* KPI Dashboard Stat Cards Row (Sleek Interface Theme) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Stock em Armazém</div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-slate-900">{stockList.length.toLocaleString('pt-PT')}</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">Real-time</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Receções Pendentes</div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-slate-900">{orders.length}</span>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">{orders.filter(o => o.status === 'PENDENTE').length} Pendentes</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Paletes SSCC Criadas</div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-slate-900">{pallets.length}</span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{wmsLoading ? 'Sincronizando...' : 'Atualizado'}</span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sync Latency (ARTSOFT)</div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-bold text-slate-900">42ms</span>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">REST Ativo</span>
            </div>
          </div>
        </div>

        {/* Tab 1: Receção */}
        {activeTab === 'rececao' && (
          <RececaoModule
            orders={filteredOrders}
            onUpdateOrders={setOrders}
            onNavigateToPaletizacao={handleNavigateToPaletizacao}
            onOpenScanner={() => setIsScannerOpen(true)}
            scannedCode={scannedCode}
            clearScannedCode={() => setScannedCode(null)}
            onSyncDocuments={handleSyncDocuments}
            isSyncLoading={isSyncLoading}
          />
        )}

        {/* Tab 2: Paletização Receção */}
        {activeTab === 'paletizacao' && (
          <ErrorBoundary>
            <PaletizacaoModule
              orders={orders}
              pallets={pallets}
              ruleConfigs={rules}
              selectedTenant={selectedTenant}
              onPalletCreated={handlePalletCreated}
              preSelectedOrderAndLine={preSelectedOrderAndLine}
              onSyncDocuments={handleSyncDocuments}
              isSyncLoading={isSyncLoading}
            />
          </ErrorBoundary>
        )}

        {/* Tab 2.5: Paletização Expedição (Auto-grupo temperatura) */}
        {activeTab === 'paletizacao_expedicao' && (
          <ExpedicaoPaletizacaoModule
            guias={filteredGuias}
            ruleConfigs={rules}
            selectedTenant={selectedTenant}
            onPalletCreated={handleCreatePaletaExpedicao}
            onSelectGuia={carregarLinhas}
          />
        )}

        {/* Tab 3: Stock & Mapa de Armazém */}
        {activeTab === 'stock_mapa' && (
          <StockMapModule
            stockList={stockList}
            locations={locations}
            selectedTenant={selectedTenant}
            onTransferStock={handleTransferStock}
          />
        )}

        {/* Tab 4: Expedição (Imefar → Clientes) */}
        {activeTab === 'expedicao' && (
          <ExpedicaoModule
            guias={filteredGuias}
            paletas={paletasExpedicao}
            comprovantes={comprovantesEmbarque}
            onConfirmGuia={handleConfirmGuiaPaletizacao}
            onCreateEmbarque={handleCreateEmbarque}
            onSelectGuia={carregarLinhas}
            onSyncDocuments={handleSyncDocuments}
            isSyncLoading={isSyncLoading}
          />
        )}

        {/* Tab 5: Sync ARTSOFT */}
        {activeTab === 'artsoft_sync' && <ArtsoftSyncModule />}

        {/* Tab 6: Configuração de Séries */}
        {activeTab === 'series_config' && <SeriesConfig />}

        {/* Tab 6b: Ligação ARTSOFT */}
        {activeTab === 'artsoft_config' && <ArtsoftConfig />}

        {/* Tab 6c: Gestão de Dados de Teste */}
        {activeTab === 'gestao_dados' && (
          <ErrorBoundary>
            <GestaoDadosModule />
          </ErrorBoundary>
        )}

        {/* Tab 7: Motor de Regras */}
        {activeTab === 'regras' && (
          <RegrasEngineModule
            rules={rules}
            onUpdateRule={(updated) => {
              setRules(prev => prev.map(r => r.cliente_id === updated.cliente_id ? updated : r));
            }}
          />
        )}

        {/* Tab 8: Auditoria */}
        {activeTab === 'auditoria' && (
          <AuditoriaModule logs={auditLogs} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 font-mono shadow-inner">
        <p>TicSol Logistics Hub B2B • WMS v2.4 • Base de Dados: <code className="text-blue-600 font-bold">ticsol_wms</code> (PostgreSQL / PostgREST)</p>
      </footer>

      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
