import React, { useState } from 'react';
import { GuiaTransporte, PaletaExpedicao } from '../types/expedicao';
import { PalletSSCC, RuleConfig } from '../types/wms';
import { api } from '../api';
import { generateSSCC, buildGS1128String, formatToGS1Date } from '../utils/gs1';
import { GS1LabelPrintModal } from './GS1LabelPrintModal';
import { GuiaSelectorPanel } from './expedicao/GuiaSelectorPanel';
import { PaletCalculator } from './expedicao/PaletCalculator';
import { PaletVisualization } from './expedicao/PaletVisualization';
import { Boxes, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ExpedicaoPaletizacaoModuleProps {
  guias: GuiaTransporte[];
  ruleConfigs: RuleConfig[];
  selectedTenant: string;
  onPalletCreated: (pallet: PaletaExpedicao, guiaId: string, linhaId: string, qtdAdicionada: number) => void;
  onSelectGuia?: (guiaId: string) => void;
}

export const ExpedicaoPaletizacaoModule: React.FC<ExpedicaoPaletizacaoModuleProps> = ({
  guias,
  ruleConfigs,
  selectedTenant,
  onPalletCreated,
  onSelectGuia
}) => {
  // Select Guia e Linha
  const [selectedGuiaId, setSelectedGuiaId] = useState<string>(guias[0]?.id || '');
  const selectedGuia = guias.find(g => g.id === selectedGuiaId) || guias[0];

  // Carrega as linhas quando guia muda
  React.useEffect(() => {
    if (selectedGuia && onSelectGuia) onSelectGuia(selectedGuia.id);
  }, [selectedGuia?.id, onSelectGuia]);

  const [selectedLinhaId, setSelectedLinhaId] = useState<string>(selectedGuia?.linhas[0]?.id || '');
  const activeLinha = selectedGuia?.linhas.find(l => l.id === selectedLinhaId) || selectedGuia?.linhas[0];

  // Packing List mode: multi-produto (default true)
  const [packingMode, setPackingMode] = useState(true);
  const [selectedLinhasIds, setSelectedLinhasIds] = useState<Set<string>>(new Set([selectedLinhaId]));

  // Sync modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncDataInicio, setSyncDataInicio] = useState('');
  const [syncDataFim, setSyncDataFim] = useState('');
  const [syncLoading, setSyncLoading] = useState(false);



  // Rule: Sonae MC caderno de encargos
  const defaultRule: RuleConfig = {
    cliente_id: 'DEFAULT',
    cliente_nome: 'Regra Padrão',
    altura_maxima_cm: 200,
    peso_maximo_kg: 1500,
    vida_util_minima_porcentagem: 70,
    permitir_palete_mista: true,
    tipo_palete: 'EURO_120x80',
    obriga_sscc_gs1128: true,
    etiqueta_formato: 'A5_105x148mm',
    regras_empilhamento: 'Sem restrições'
  };
  const activeRule = ruleConfigs.find(r => r.cliente_id === 'SONAE_MC') || ruleConfigs[0] || defaultRule;

  // Guard: ensure activeRule exists (should never fail now)
  if (!activeRule) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-900">Erro ao carregar regras</h3>
              <p className="text-sm text-slate-600 mt-1">Sistema não conseguiu inicializar regras de paletização.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Paletização inputs
  const [caixasPorCamada, setCaixasPorCamada] = useState<number>(10);
  const [numCamadas, setNumCamadas] = useState<number>(4);
  const [activePrintPallet, setActivePrintPallet] = useState<PalletSSCC | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Linhas efetivamente em jogo: em packing mode são todas as selecionadas
  // (várias), não só a "linha ativa" — a mesma lista usada no resumo e em
  // handleMaterializePallet, para os três lugares concordarem.
  const linhasSelecionadas = packingMode
    ? selectedGuia?.linhas.filter(l => selectedLinhasIds.has(l.id)) || []
    : activeLinha ? [activeLinha] : [];

  // Cálculos
  const caixasSolicitadas = linhasSelecionadas.reduce((sum, l) => sum + l.quantidade_solicitada, 0);
  const caixasNaPaleteProposta = caixasPorCamada * numCamadas;
  // Peso médio ponderado por quantidade: com produtos de pesos diferentes na
  // mesma palete, usar só o peso do primeiro produto sub/sobrestimava o
  // peso bruto total consoante qual ficasse "ativo".
  const pesoUnitario =
    caixasSolicitadas > 0
      ? linhasSelecionadas.reduce((sum, l) => sum + (l.peso_unitario_kg || 0.5) * l.quantidade_solicitada, 0) /
        caixasSolicitadas
      : 0.5;
  const alturaPaleteCm = (pesoUnitario > 0 ? (numCamadas * 25) : 110) + 14; // 14cm Euro-pallet
  const pesoLiquidoKg = Math.round(caixasNaPaleteProposta * pesoUnitario * 0.9 * 10) / 10;
  const pesoBrutoKg = Math.round((caixasNaPaleteProposta * pesoUnitario + 22) * 10) / 10;

  const excedeAltura = alturaPaleteCm > activeRule.altura_maxima_cm;
  const excedePeso = pesoBrutoKg > activeRule.peso_maximo_kg;
  const excedeQuantidade = caixasNaPaleteProposta > caixasSolicitadas;

  const handleSync = async () => {
    setSyncLoading(true);
    try {
      await api.sincronizarGuias(syncDataInicio || undefined, syncDataFim || undefined);
      alert('Guias sincronizadas com sucesso!');
      setShowSyncModal(false);
      setSyncDataInicio('');
      setSyncDataFim('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao sincronizar');
    } finally {
      setSyncLoading(false);
    }
  };

  const handleMaterializePallet = () => {
    if (!selectedGuia) return;

    // Packing List: múltiplas linhas (mesma lista usada nos cálculos e no
    // resumo — linhasSelecionadas, definida acima).
    const linhasApalete = linhasSelecionadas;

    if (linhasApalete.length === 0) {
      alert('Seleciona pelo menos uma linha!');
      return;
    }

    // Validar compatibilidade temperatura (packing list)
    if (packingMode) {
      const temps = new Set(linhasApalete.map(l => l.temperatura_armazenamento));
      if (temps.size > 1) {
        const hasIsolated = linhasApalete.some(l => l.requer_palote_separada);
        if (hasIsolated) {
          alert('Erro: Não pode misturar produtos com isolamento forçado (requer_palote_separada) com outras temperaturas!');
          return;
        }
      }
    }

    // Calcular totais packing list
    const totalCaixas = linhasApalete.reduce((sum, l) => sum + l.quantidade_solicitada, 0);
    const totalPeso = linhasApalete.reduce((sum, l) => sum + l.quantidade_solicitada * l.peso_unitario_kg, 0);
    const totalVolume = linhasApalete.reduce((sum, l) => sum + l.quantidade_solicitada * l.volume_unitario_m3, 0);

    if (packingMode && caixasNaPaleteProposta > totalCaixas) {
      alert(`Erro: Palete requer ${caixasNaPaleteProposta} caixas mas packing tem só ${totalCaixas}!`);
      return;
    }

    // Gerar SSCC
    const { ssccFull } = generateSSCC(3, '5601234');
    const primeiraLinha = linhasApalete[0];
    const validadeGS1 = formatToGS1Date(primeiraLinha.data_validade || '2027-12-31');
    const gs1128Str = buildGS1128String({
      sscc: ssccFull,
      gtinEan: primeiraLinha.ean_barcode,
      lote: primeiraLinha.lote || 'LOTE-STD',
      validadeYYMMDD: validadeGS1,
      qtdCaixas: caixasNaPaleteProposta
    });

    // Criar palete para impressão (modal único, com packing list se aplicável)
    const palletaToPrint: PalletSSCC = {
      sscc: ssccFull,
      guia_id: selectedGuia.id,
      artigo_codigo: primeiraLinha.artigo_codigo,
      artigo_descricao: primeiraLinha.artigo_descricao,
      ean_barcode: primeiraLinha.ean_barcode,
      lote: primeiraLinha.lote || 'LOTE-PADRAO',
      data_validade: primeiraLinha.data_validade || '2027-12-31',
      caixas_na_palete: caixasNaPaleteProposta,
      unidades_totais: caixasNaPaleteProposta * 10,
      camadas: numCamadas,
      caixas_por_camada: caixasPorCamada,
      altura_total_cm: alturaPaleteCm,
      peso_liquido_kg: totalPeso * 0.9,
      peso_bruto_kg: totalPeso + 22,
      regrac_cliente_aplicada: 'SONAE_MC',
      empresa_owner: selectedGuia.cliente_nome,
      localizacao_atual: 'EM_STAGING',
      estado_palete: 'EM_STAGING',
      data_criacao: new Date().toISOString().replace('T', ' ').slice(0, 19),
      operador: 'Op. Paletização Expedição',
      gs1_128_barcode_string: gs1128Str,
      packingListProducts: packingMode ? linhasApalete.map(l => ({
        artigo_codigo: l.artigo_codigo,
        artigo_descricao: l.artigo_descricao,
        quantidade: l.quantidade_solicitada,
        lote: l.lote,
        ean_barcode: l.ean_barcode,
        data_validade: l.data_validade
      })) : undefined
    };

    // Criar palete expedição
    const paletaExpedicao: PaletaExpedicao = {
      id: `pal-${Date.now()}`,
      sscc: ssccFull,
      guia_id: selectedGuia.id,
      linhas_guia: linhasApalete.map(l => l.id),
      produtos: linhasApalete.map(l => ({
        artigo_codigo: l.artigo_codigo,
        artigo_descricao: l.artigo_descricao,
        quantidade: l.quantidade_solicitada,
        lote: l.lote
      })),
      temperatura_zona: primeiraLinha.temperatura_armazenamento,
      peso_total_kg: totalPeso + 22,
      volume_total_m3: totalVolume,
      altura_palete_cm: alturaPaleteCm,
      dimensoes_palete_cm: `120x80x${alturaPaleteCm}`,
      status: 'PREPARANDO',
      data_criacao: new Date().toISOString(),
      operador_criacao: 'Op. Paletização Expedição'
    };

    onPalletCreated(paletaExpedicao, selectedGuia.id, primeiraLinha.id, caixasNaPaleteProposta);

    setToastMsg(`Palete SSCC ${ssccFull} criada!`);
    setTimeout(() => setToastMsg(null), 4000);

    setActivePrintPallet(palletaToPrint);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 animate-bounce border border-purple-400">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Label Print Modal - Identical to Receção */}
      {activePrintPallet && (
        <GS1LabelPrintModal
          pallet={activePrintPallet}
          onClose={() => setActivePrintPallet(null)}
          packingListProducts={packingMode ? activePrintPallet.packingListProducts : undefined}
        />
      )}

      {/* Module Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-purple-600" />
            Paletização Expedição — Geração SSCC GS1-128
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Paletização de Guias de Transporte com restrições Sonae MC, tagging SSCC-18 e impressão de etiquetas GS1.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg text-xs font-mono text-purple-700">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            <span>Regra: <strong>{activeRule.cliente_nome}</strong></span>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            disabled={syncLoading}
            className="px-3 py-1.5 bg-purple-600 text-white font-semibold text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all whitespace-nowrap"
          >
            {syncLoading ? 'Sincronizando…' : 'Sincronizar Documentos'}
          </button>
        </div>
      </div>

      {/* Seleção de Guia + Produtos */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
        <GuiaSelectorPanel
          guias={guias}
          selectedGuiaId={selectedGuiaId}
          onSelectGuia={setSelectedGuiaId}
        />

        {/* Modo: Single-produto vs Packing List */}
        {selectedGuia && selectedGuia.linhas.length > 1 && (
          <div>
            <label className="text-slate-700 block mb-2 font-medium text-sm">Modo Paletização</label>
            <div className="flex gap-3 max-w-md">
              <button
                onClick={() => setPackingMode(false)}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  !packingMode
                    ? 'bg-purple-600 text-white border-2 border-purple-700'
                    : 'bg-slate-100 text-slate-700 border-2 border-transparent hover:bg-slate-200'
                }`}
              >
                Mono-Produto
              </button>
              <button
                onClick={() => setPackingMode(true)}
                className={`flex-1 py-2 px-3 rounded-lg font-semibold text-sm transition-all ${
                  packingMode
                    ? 'bg-purple-600 text-white border-2 border-purple-700'
                    : 'bg-slate-100 text-slate-700 border-2 border-transparent hover:bg-slate-200'
                }`}
              >
                Packing List (Multi)
              </button>
            </div>
          </div>
        )}

        {/* Seleção Linha(s) */}
        {selectedGuia && !packingMode && (
          <div className="max-w-md">
            <label className="text-slate-700 block mb-2 font-medium text-sm">Linha de Produto</label>
            <select
              value={selectedLinhaId}
              onChange={(e) => {
                setSelectedLinhaId(e.target.value);
                setSelectedLinhasIds(new Set([e.target.value]));
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-purple-700 font-bold focus:outline-none focus:border-purple-500"
            >
              {selectedGuia.linhas.map(l => (
                <option key={l.id} value={l.id}>
                  {l.artigo_codigo} - {(l.artigo_descricao || '').slice(0, 30)}...
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Packing List: Multi-selection — layout flexbox proporcional */}
        {selectedGuia && packingMode && (
          <div>
            <label className="text-slate-700 block mb-2 font-medium text-sm">2. Selecionar Produtos</label>
            <div className="border border-slate-300 rounded-lg bg-white max-h-56 overflow-y-auto">
              <div className="text-xs">
                {/* Header */}
                <div className="flex gap-2 bg-slate-100 border-b border-slate-300 sticky top-0 p-2 font-bold text-slate-700">
                  <div className="w-5 shrink-0">✓</div>
                  <div className="w-6 shrink-0">NR.</div>
                  <div className="w-28 shrink-0">CÓDIGO</div>
                  <div className="flex-1 min-w-40">DESCRIÇÃO</div>
                  <div className="w-14 shrink-0 text-right">QTD</div>
                </div>
                {/* Rows */}
                {selectedGuia.linhas.map(l => (
                  <label key={l.id} className="flex gap-2 items-start cursor-pointer hover:bg-slate-50 p-1.5 border-b border-slate-100 min-h-10">
                    <input
                      type="checkbox"
                      checked={selectedLinhasIds.has(l.id)}
                      onChange={(e) => {
                        const newIds = new Set(selectedLinhasIds);
                        if (e.target.checked) {
                          newIds.add(l.id);
                        } else {
                          newIds.delete(l.id);
                        }
                        setSelectedLinhasIds(newIds);
                      }}
                      className="w-4 h-4 cursor-pointer shrink-0 mt-0.5"
                    />
                    <div className="w-6 shrink-0 font-mono font-bold text-slate-700 text-[11px] mt-0.5">{l.nr_linha || '—'}</div>
                    <div className="w-28 shrink-0 font-mono text-slate-700 text-[11px] break-words leading-tight">{l.artigo_codigo}</div>
                    <div className="flex-1 min-w-40 text-slate-600 break-words text-[11px]">{l.artigo_descricao}</div>
                    <div className="w-14 shrink-0 text-right text-purple-600 font-bold text-[11px] mt-0.5">{l.quantidade_solicitada}</div>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-600">
              ✓ Selecionadas: {selectedLinhasIds.size} | Total: {Array.from(selectedLinhasIds).reduce((sum, id) => {
                const l = selectedGuia.linhas.find(x => x.id === id);
                return sum + (l?.quantidade_solicitada || 0);
              }, 0)} un
            </div>
          </div>
        )}

        {/* Produtos Selecionados — tabela flexbox proporcional */}
        {linhasSelecionadas.length > 0 && (
          <div>
            <label className="text-slate-700 block mb-2 font-medium text-sm">3. Produtos Selecionados</label>
            <div className="border border-slate-300 rounded-lg bg-white max-h-64 overflow-y-auto">
              <div className="text-xs font-mono">
                {/* Header */}
                <div className="flex gap-2 bg-slate-100 border-b border-slate-300 sticky top-0 p-2 font-bold text-slate-700 text-[11px]">
                  <div className="w-6 shrink-0">NR.</div>
                  <div className="w-28 shrink-0">CÓDIGO</div>
                  <div className="flex-1 min-w-40">DESCRIÇÃO</div>
                  <div className="w-24 shrink-0">EAN</div>
                  <div className="w-12 shrink-0 text-right">QTD</div>
                  <div className="w-18 shrink-0">LOTE</div>
                  <div className="w-20 shrink-0">VALIDADE</div>
                </div>
                {/* Rows */}
                {linhasSelecionadas.map(linha => (
                  <div key={linha.id} className="flex gap-2 border-b border-slate-200 p-1.5 hover:bg-slate-50 items-start min-h-10 text-[11px]">
                    <div className="w-6 shrink-0 mt-0.5">{linha.nr_linha || '—'}</div>
                    <div className="w-28 shrink-0 text-purple-600 font-bold break-words leading-tight">{linha.artigo_codigo}</div>
                    <div className="flex-1 min-w-40 text-slate-700 break-words">{linha.artigo_descricao}</div>
                    <div className="w-24 shrink-0 text-slate-600 mt-0.5">{linha.ean_barcode || '—'}</div>
                    <div className="w-12 shrink-0 text-right text-purple-700 font-bold mt-0.5">{linha.quantidade_solicitada}</div>
                    <div className="w-18 shrink-0 mt-0.5">{linha.lote || '—'}</div>
                    <div className="w-20 shrink-0 mt-0.5">{linha.data_validade || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Grid: Calculator & Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <PaletCalculator
            linhasSelecionadas={linhasSelecionadas}
            activeRule={activeRule}
            caixasPorCamada={caixasPorCamada}
            numCamadas={numCamadas}
            onCaixasPorCamadaChange={setCaixasPorCamada}
            onNumCamadasChange={setNumCamadas}
            onMaterializePallet={handleMaterializePallet}
          />
        </div>
        <div className="lg:col-span-5">
          <PaletVisualization
            numCamadas={numCamadas}
            caixasPorCamada={caixasPorCamada}
            alturaPaleteCm={alturaPaleteCm}
            pesoBrutoKg={pesoBrutoKg}
            pesoLiquidoKg={pesoLiquidoKg}
            excedeAltura={excedeAltura}
          />
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg text-sm text-purple-800">
        <div className="flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0 text-purple-600" />
          <div>
            <strong>Caderno de Encargos Sonae MC:</strong> Altura máxima {activeRule.altura_maxima_cm}cm | Peso máximo {activeRule.peso_maximo_kg}kg
          </div>
        </div>
      </div>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center rounded-lg z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Sincronizar Documentos do ARTSOFT</h2>
            <div className="space-y-3 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Data Início</label>
                <input
                  type="date"
                  value={syncDataInicio}
                  onChange={(e) => setSyncDataInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Data Fim</label>
                <input
                  type="date"
                  value={syncDataFim}
                  onChange={(e) => setSyncDataFim(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <p className="text-xs text-slate-500">Deixa vazio para sincronizar todas as guias</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSyncModal(false)}
                disabled={syncLoading}
                className="flex-1 px-3 py-2 bg-slate-200 text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-300 disabled:opacity-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSync}
                disabled={syncLoading}
                className="flex-1 px-3 py-2 bg-purple-600 text-white font-semibold text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
              >
                {syncLoading ? 'A sincronizar…' : 'Sincronizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
