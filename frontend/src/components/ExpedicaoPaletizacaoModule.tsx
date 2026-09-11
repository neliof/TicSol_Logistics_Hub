import React, { useState } from 'react';
import { GuiaTransporte, PaletaExpedicao } from '../types/expedicao';
import { PalletSSCC, RuleConfig } from '../types/wms';
import { api } from '../api';
import { generateSSCC, buildGS1128String, formatToGS1Date } from '../utils/gs1';
import { GS1LabelPrintModal } from './GS1LabelPrintModal';
import { BarcodeRenderer } from './BarcodeRenderer';
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
  ArrowRight,
  Truck
} from 'lucide-react';

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

  // Filtro e ordenação
  const [filterText, setFilterText] = useState('');
  const [sortBy, setSortBy] = useState<'numero' | 'cliente' | 'data'>('numero');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Aplicar filtro e ordenação
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

      {/* Seleção de Guia + Produtos — largura total da página, para caber
          mais linhas visíveis sem scroll apertado e o resumo ficar largo
          em vez de espremido na coluna de 7/12. */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">

        {/* Seleção Guia com Filtro e Ordenação */}
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

          {/* Lista de Guias */}
          <div className="border border-slate-300 rounded bg-white max-h-48 overflow-y-auto p-1">
            {guiasSorted.length === 0 ? (
              <div className="p-2 text-center text-xs text-slate-500">Nenhuma guia</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1">
                {guiasSorted.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGuiaId(g.id)}
                    className={`text-left p-1.5 rounded text-xs border transition-all ${
                      selectedGuiaId === g.id
                        ? 'bg-purple-50 border-purple-400'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-mono font-bold text-purple-700 text-[11px]">{g.serie ? `${g.serie}/` : ''}{g.numero_guia}</div>
                    <div className="text-[10px] text-slate-600 truncate">{g.serie ? g.cliente_nome : (g.nome_documento || g.cliente_nome)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

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

      {/* Grid: Inputs Calculator & Visual Stack Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left Form: Packing Parameters (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">

            {/* Pallet Stacking Parameters */}
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-3 pt-2">
              <Layers className="w-4 h-4 text-purple-600" />
              2. Definir Plano de Empilhamento
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
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-purple-700 font-bold focus:outline-none focus:border-purple-500 text-base shadow-xs"
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
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 font-mono text-purple-700 font-bold focus:outline-none focus:border-purple-500 text-base shadow-xs"
                />
              </div>
            </div>

            {/* Validação */}
            <div className="space-y-2 pt-2">
              {excedeAltura && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span><strong>Aviso:</strong> Altura ({alturaPaleteCm} cm) excede limite {activeRule.altura_maxima_cm} cm!</span>
                </div>
              )}

              {excedePeso && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span><strong>Aviso:</strong> Peso ({pesoBrutoKg} kg) excede limite {activeRule.peso_maximo_kg} kg!</span>
                </div>
              )}

              {excedeQuantidade && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span><strong>Erro:</strong> Palete requer {caixasNaPaleteProposta} caixas, mas guia tem só {caixasSolicitadas}!</span>
                </div>
              )}
            </div>

            {/* Metrics Summary */}
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

            {/* Botão Materializar */}
            <button
              onClick={handleMaterializePallet}
              disabled={excedeQuantidade || excedeAltura || excedePeso}
              className={`w-full py-3 px-4 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                excedeQuantidade || excedeAltura || excedePeso
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-md active:scale-95'
              }`}
            >
              <Plus className="w-5 h-5" />
              Materializar Palete + Imprimir Etiqueta
            </button>
          </div>
        </div>

        {/* Right: Visual Stack Preview (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-3">
              <Sparkles className="w-4 h-4 text-purple-600" />
              Visualização da Palete Proposta
            </h3>

            {/* Stack Visual */}
            <div className="flex flex-col gap-1 bg-gradient-to-b from-purple-50 to-purple-100 p-3 rounded-lg border border-purple-300 font-mono text-xs">
              <div className="h-5 bg-gradient-to-r from-purple-700 to-purple-900 border border-purple-600 rounded flex items-center justify-around px-2 text-[9px] font-mono text-purple-200 font-bold shadow-md">
                <span>|||</span>
                <span>EURO PALLET 120x80</span>
                <span>|||</span>
              </div>

              {Array.from({ length: numCamadas }).map((_, layerIdx) => (
                <div
                  key={layerIdx}
                  className="h-7 bg-gradient-to-r from-purple-400/30 to-purple-500/30 border border-purple-500/50 rounded flex items-center justify-center text-xs font-mono font-bold text-purple-700 transition-all hover:from-purple-400/50 hover:to-purple-500/50 shadow-sm"
                >
                  Camada {layerIdx + 1}: {caixasPorCamada} caixas
                </div>
              ))}
            </div>

            <span className="text-xs font-mono text-slate-400 mt-2">
              Total: {caixasNaPaleteProposta} Caixas • {numCamadas} Camadas
            </span>

            {/* Dimensões */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Ruler className="w-4 h-4 text-slate-600" />
                <span className="font-mono font-bold text-slate-900">120 × 80 × {alturaPaleteCm} cm</span>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200">
                <Scale className="w-4 h-4 text-slate-600" />
                <span className="font-mono font-bold text-lg text-slate-900">{pesoBrutoKg} kg</span>
                <span className="text-xs text-slate-500 font-mono">({pesoLiquidoKg} kg líquido)</span>
              </div>

              <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200">
                <Tag className="w-4 h-4 text-slate-600" />
                <span className="font-mono font-bold text-sm text-slate-900">Volume: {(caixasNaPaleteProposta * 0.01).toFixed(2)} m³</span>
              </div>
            </div>
          </div>
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
