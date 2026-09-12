import React, { useState } from 'react';
import { ReceivingOrder, PalletSSCC, RuleConfig } from '../types/wms';
import { generateSSCC, buildGS1128String, formatToGS1Date } from '../utils/gs1';
import { GS1LabelPrintModal } from './GS1LabelPrintModal';
import { OrderSelectorPanel } from './recepcao/OrderSelectorPanel';
import { SyncDocumentsModal } from './SyncDocumentsModal';
import { useSeriesConfig } from '../hooks/useSeriesConfig';
import {
  Boxes,
  Layers,
  Tag,
  Scale,
  Ruler,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ShieldCheck,
  Plus,
  Sparkles,
  Database,
  Calendar
} from 'lucide-react';

interface PaletizacaoModuleProps {
  orders: ReceivingOrder[];
  pallets: PalletSSCC[];
  ruleConfigs: RuleConfig[];
  selectedTenant: string;
  onPalletCreated: (pallet: PalletSSCC, orderId: string, lineId: string, boxesAdded: number) => void;
  preSelectedOrderAndLine?: { orderId: string; lineId: string } | null;
  onSyncDocuments?: (dataInicio?: string, dataFim?: string, series?: string[]) => Promise<void>;
  isSyncLoading?: boolean;
}

export const PaletizacaoModule: React.FC<PaletizacaoModuleProps> = ({
  orders,
  pallets,
  ruleConfigs,
  selectedTenant,
  onPalletCreated,
  preSelectedOrderAndLine,
  onSyncDocuments,
  isSyncLoading = false
}) => {
  const { receção: seriesReceção } = useSeriesConfig('receção');

  // Find order and line
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    preSelectedOrderAndLine?.orderId || orders[0]?.id || ''
  );

  const selectedOrder = orders.find(o => o.id === selectedOrderId) || orders[0];

  const [selectedLineId, setSelectedLineId] = useState<string>(
    preSelectedOrderAndLine?.lineId || selectedOrder?.linhas[0]?.id || ''
  );

  const activeLine = selectedOrder?.linhas.find(l => l.id === selectedLineId) || selectedOrder?.linhas[0];

  // Active Client Stacking Rule (Default to Sonae MC if tenant is Sonae MC)
  const activeRuleCode = selectedTenant.includes('Sonae') ? 'SONAE_MC' : 'SOVENA';
  const activeRule = ruleConfigs.find(r => r.cliente_id === activeRuleCode) || ruleConfigs[0];

  // Calculated Pallet Inputs
  const [caixasPorCamada, setCaixasPorCamada] = useState<number>(10);
  const [numCamadas, setNumCamadas] = useState<number>(4);
  const [activePrintPallet, setActivePrintPallet] = useState<PalletSSCC | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDataInicio, setSyncDataInicio] = useState('');
  const [syncDataFim, setSyncDataFim] = useState('');

  // Address pending item #3: Calculate remaining boxes available for palletization
  const caixasRecebidasTotal = activeLine ? activeLine.qtd_recebida_caixas : 0;
  const caixasJaPaletizadas = activeLine ? activeLine.qtd_ja_paletizada_caixas : 0;
  const caixasRestantesParaPaletizar = Math.max(0, caixasRecebidasTotal - caixasJaPaletizadas);

  // Calculated totals for proposed pallet
  const caixasNaPaleteProposta = caixasPorCamada * numCamadas;
  const alturaPaleteCm = (activeLine ? activeLine.altura_cm * numCamadas : 110) + 14; // 14cm for Euro-pallet base
  const pesoLiquidoKg = activeLine ? Math.round(caixasNaPaleteProposta * activeLine.peso_bruto_kg * 0.9 * 10) / 10 : 0;
  const pesoBrutoKg = activeLine ? Math.round((caixasNaPaleteProposta * activeLine.peso_bruto_kg + 22) * 10) / 10 : 0; // 22kg Euro-pallet wood

  // Height and Weight Rule Validation Check
  const excedeAltura = alturaPaleteCm > activeRule.altura_maxima_cm;
  const excedePeso = pesoBrutoKg > activeRule.peso_maximo_kg;
  const excedeQuantidadeRestante = caixasNaPaleteProposta > caixasRestantesParaPaletizar;

  // Guard: No orders loaded
  if (!orders || orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-900">Nenhuma Encomenda de Receção Disponível</h3>
              <p className="text-sm text-slate-600 mt-1">
                Sincroniza encomendas de receção da ARTSOFT ou do sistema logístico para começar a paletizar.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Guard: No rule configs loaded yet (async fetch ainda a decorrer ou API sem dados)
  if (!activeRule) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-900">A carregar regras de paletização…</h3>
              <p className="text-sm text-slate-600 mt-1">
                Se esta mensagem persistir, verifica se existem regras configuradas no Motor de Regras.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleMaterializePallet = () => {
    if (!activeLine || !selectedOrder) return;
    if (excedeQuantidadeRestante) {
      alert(`Erro: Não pode criar uma palete com ${caixasNaPaleteProposta} caixas. Apenas restam ${caixasRestantesParaPaletizar} caixas por paletizar nesta linha!`);
      return;
    }

    // Generate valid SSCC-18
    const { ssccFull, ssccFormatted } = generateSSCC(3, '5601234');
    const validadeGS1 = formatToGS1Date(activeLine.data_validade || '2027-12-31');
    const gs1128Str = buildGS1128String({
      sscc: ssccFull,
      gtinEan: activeLine.ean_barcode,
      lote: activeLine.lote || 'LOTE-STD',
      validadeYYMMDD: validadeGS1,
      qtdCaixas: caixasNaPaleteProposta
    });

    const newPallet: PalletSSCC = {
      sscc: ssccFull,
      guia_id: selectedOrder.id,
      artigo_codigo: activeLine.artigo_codigo,
      artigo_descricao: activeLine.artigo_descricao,
      ean_barcode: activeLine.ean_barcode,
      lote: activeLine.lote || 'LOTE-PADRAO',
      data_validade: activeLine.data_validade || '2027-12-31',
      caixas_na_palete: caixasNaPaleteProposta,
      unidades_totais: caixasNaPaleteProposta * activeLine.unidades_por_caixa,
      camadas: numCamadas,
      caixas_por_camada: caixasPorCamada,
      altura_total_cm: alturaPaleteCm,
      peso_liquido_kg: pesoLiquidoKg,
      peso_bruto_kg: pesoBrutoKg,
      regrac_cliente_aplicada: activeRule.cliente_id as any,
      empresa_owner: selectedTenant,
      localizacao_atual: 'EM_STAGING',
      estado_palete: 'EM_STAGING',
      data_criacao: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operador: 'Op. Terminal WMS',
      gs1_128_barcode_string: gs1128Str
    };

    onPalletCreated(newPallet, selectedOrder.id, activeLine.id, caixasNaPaleteProposta);

    setToastMsg(`Palete SSCC ${ssccFull} criada e materializada em Staging! (RPC fn_criar_palete_sscc ok)`);
    setTimeout(() => setToastMsg(null), 4000);
    setActivePrintPallet(newPallet);
  };

  const handleSync = async () => {
    console.log('[PaletizacaoModule] Iniciando sync', { seriesReceção, syncDataInicio, syncDataFim, onSyncDocumentsDef: typeof onSyncDocuments });
    try {
      if (!onSyncDocuments) {
        throw new Error('onSyncDocuments callback não definido');
      }
      await onSyncDocuments(syncDataInicio || undefined, syncDataFim || undefined, seriesReceção);
      setShowSyncModal(false);
      setSyncDataInicio('');
      setSyncDataFim('');
    } catch (err) {
      console.error('[PaletizacaoModule] Sync error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-amber-500 text-slate-950 font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-bounce border border-amber-400">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Label Print Modal */}
      {activePrintPallet && (
        <GS1LabelPrintModal
          pallet={activePrintPallet}
          onClose={() => setActivePrintPallet(null)}
        />
      )}

      {/* Module Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-blue-600" />
            Ecrã de Paletização & Geração SSCC GS1-128
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cálculo automático de paletização com restrições Sonae MC, tagging SSCC-18 e impressão de etiquetas GS1.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSyncModal(true)}
            disabled={isSyncLoading}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
          >
            <Calendar className="w-4 h-4" />
            {isSyncLoading ? 'A sincronizar…' : 'Sincronizar'}
          </button>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-mono text-blue-700">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>Regra Ativa: <strong>{activeRule.cliente_nome}</strong></span>
          </div>
        </div>
      </div>

      {/* Grid: Inputs Calculator & Visual Stack Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Form: Select Line & Packing Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
            
            <OrderSelectorPanel
              orders={orders}
              selectedOrderId={selectedOrderId}
              selectedLineId={selectedLineId}
              onSelectOrder={setSelectedOrderId}
              onSelectLine={setSelectedLineId}
            />

            {/* Line Summary Box with Pending Item #3 Reconciliation Notice */}
            {activeLine && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 font-mono text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Artigo: <strong>{activeLine.artigo_descricao}</strong></span>
                  <span>EAN: <strong className="text-blue-600">{activeLine.ean_barcode}</strong></span>
                </div>

                {/* Status Bar showing Ja Paletizado vs Remaining */}
                <div className="grid grid-cols-3 gap-2 bg-white p-2.5 rounded-lg border border-slate-200 text-center shadow-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">QTD RECEBIDA</span>
                    <span className="text-sm font-bold text-slate-800">{caixasRecebidasTotal} Cx</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-emerald-600 block">JÁ PALETIZADO</span>
                    <span className="text-sm font-bold text-emerald-600">{caixasJaPaletizadas} Cx</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-amber-600 block">RESTANTE PENDENTE</span>
                    <span className={`text-sm font-bold ${caixasRestantesParaPaletizar > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
                      {caixasRestantesParaPaletizar} Cx
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pallet Stacking Parameters */}
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-3 pt-2">
              <Layers className="w-4 h-4 text-blue-600" />
              2. Definir Plano de Empilhamento e Camadas
            </h3>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-medium">Caixas por Camada</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={caixasPorCamada}
                  onChange={(e) => setCaixasPorCamada(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-blue-700 font-bold focus:outline-none focus:border-blue-500 text-base shadow-xs"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-medium">Número de Camadas</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={numCamadas}
                  onChange={(e) => setNumCamadas(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-blue-700 font-bold focus:outline-none focus:border-blue-500 text-base shadow-xs"
                />
              </div>
            </div>

            {/* Rule Warnings */}
            <div className="space-y-2 pt-2">
              {excedeAltura && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Aviso Sonae MC:</strong> Altura da palete ({alturaPaleteCm} cm) excede o limite máximo permitido de {activeRule.altura_maxima_cm} cm!
                  </span>
                </div>
              )}

              {excedePeso && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Aviso Sonae MC:</strong> Peso bruto ({pesoBrutoKg} kg) excede o limite máximo de {activeRule.peso_maximo_kg} kg!
                  </span>
                </div>
              )}

              {excedeQuantidadeRestante && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    <strong>Erro de Validação:</strong> Esta palete requer {caixasNaPaleteProposta} caixas, mas apenas restam {caixasRestantesParaPaletizar} caixas não paletizadas nesta linha.
                  </span>
                </div>
              )}
            </div>

            {/* Materialize Button */}
            <button
              onClick={handleMaterializePallet}
              disabled={excedeQuantidadeRestante || caixasRestantesParaPaletizar === 0}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
              Materializar Palete SSCC & Gerar GS1-128
            </button>
          </div>
        </div>

        {/* Right Preview: 3D Visual Pallet Stack Diagram & Metrics (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Boxes className="w-4 h-4 text-blue-600" />
                Simulação Isométrica 3D da Palete
              </h3>
              <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-semibold">
                Euro 120x80
              </span>
            </div>

            {/* Visual Isometric Box Stack Representation */}
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden">
              
              {/* GS1 Badge preview overlay */}
              <div className="absolute top-3 right-3 bg-slate-800/90 border border-slate-700 p-2 rounded-md text-[10px] font-mono text-slate-300 shadow">
                <span className="text-amber-400 block font-bold">(00) SSCC GS1</span>
                <span>3 5601234 ...</span>
              </div>

              {/* Stack Visualizer */}
              <div className="w-full max-w-[200px] space-y-1.5 flex flex-col-reverse py-4">
                {/* Wood Base Euro Pallet */}
                <div className="h-5 bg-amber-900/80 border border-amber-700/60 rounded flex items-center justify-around px-2 text-[9px] font-mono text-amber-300 font-bold shadow-md">
                  <span>|||</span>
                  <span>EURO PALLET 120x80</span>
                  <span>|||</span>
                </div>

                {/* Layers */}
                {Array.from({ length: numCamadas }).map((_, layerIdx) => (
                  <div
                    key={layerIdx}
                    className="h-7 bg-amber-500/20 border border-amber-500/40 rounded flex items-center justify-center text-xs font-mono font-bold text-amber-300 transition-all hover:bg-amber-500/30"
                  >
                    Camada {layerIdx + 1}: {caixasPorCamada} caixas
                  </div>
                ))}
              </div>

              <span className="text-xs font-mono text-slate-400 mt-2">
                Total: {caixasNaPaleteProposta} Caixas • {numCamadas} Camadas
              </span>
            </div>

            {/* Physical Metrics Summary Card */}
            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-semibold uppercase">ALTURA TOTAL</span>
                <span className={`text-base font-bold ${excedeAltura ? 'text-rose-600' : 'text-slate-900'}`}>
                  {alturaPaleteCm} cm
                </span>
                <span className="text-[10px] text-slate-500 block">Máx: {activeRule.altura_maxima_cm} cm</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-500 block text-[10px] font-semibold uppercase">PESO BRUTO</span>
                <span className={`text-base font-bold ${excedePeso ? 'text-rose-600' : 'text-slate-900'}`}>
                  {pesoBrutoKg} kg
                </span>
                <span className="text-[10px] text-slate-500 block">Máx: {activeRule.peso_maximo_kg} kg</span>
              </div>
            </div>
          </div>

          {/* List of Materialized Pallets in Staging */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center justify-between border-b border-slate-200 pb-3">
              <span>Paletes Materializadas em Staging</span>
              <span className="text-xs font-mono text-blue-600 font-bold">{pallets.length} Paletes</span>
            </h4>

            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {pallets.map((p) => (
                <div
                  key={p.sscc}
                  className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-mono font-bold text-blue-600 block">SSCC: {p.sscc}</span>
                    <span className="text-slate-800 text-[11px] font-medium block">{(p.artigo_descricao || '').slice(0, 32)}...</span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {p.caixas_na_palete} Cx • Lote: {p.lote} • {p.localizacao_atual}
                    </span>
                  </div>

                  <button
                    onClick={() => setActivePrintPallet(p)}
                    className="p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg transition-colors border border-slate-200 shrink-0 shadow-xs"
                    title="Imprimir Etiqueta GS1"
                  >
                    <Printer className="w-4 h-4 text-blue-600" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
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
