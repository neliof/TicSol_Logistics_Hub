import { useEffect, useState } from 'react';
import { ReceivingOrder, PalletSSCC, StockPosition } from '../types/wms';
import { api, LinhaReconciliacao } from '../api';
import { TIPO_DOCUMENTO_MAP, parseXmlContent, getTipoDocumento, formatNomeDocumento } from '../utils/documentTypes';

/**
 * Converte uma linha da vista de reconciliação (saldo ARTSOFT por produto) numa
 * StockPosition. O snapshot é o saldo contabilístico do ERP, não uma posição
 * física — por isso os campos de localização/lote/SSCC ficam neutros; a
 * quantidade vai em unidades.
 */
function snapshotParaStock(r: LinhaReconciliacao): StockPosition {
  const qtd = Number(r.quantidade_artsoft) || 0;
  return {
    id: r.produto_id,
    localizacao_codigo: 'ERP',
    zona: 'Cais de Receção',
    artigo_codigo: r.sku_interno,
    artigo_descricao: r.descricao,
    ean_barcode: r.ean13 || '',
    lote: '',
    data_validade: '',
    dias_para_validade: 0,
    fefo_status: 'OK',
    qtd_caixas: 0,
    qtd_unidades: qtd,
    peso_kg: 0,
    empresa_owner: '',
    reservado_pedido: false,
    data_entrada: r.ultima_sincronizacao || '',
  };
}

/** Mapeia documento ARTSOFT (de logistics.documento) para ReceivingOrder */
function docParaReceivingOrder(d: any, tiposMap: Record<string, string> = TIPO_DOCUMENTO_MAP): ReceivingOrder {
  const xml = parseXmlContent(d.conteudo_xml);
  const serie = d.origem_serie || '';
  const tipoDescricao = getTipoDocumento(serie, d.tipo, tiposMap);
  const nome = formatNomeDocumento(d.origem_doc_id || (serie + '-' + d.numero), d.numero, tipoDescricao);

  return {
    id: d.id,
    numero_guia: d.numero || d.origem_doc_id || '',
    serie: d.origem_serie,
    nome_documento: nome,
    numero_encomenda_artsoft: xml.pedido_origem || '',
    fornecedor_id: d.fornecedor_id || '',
    fornecedor_nome: xml.terceiro_nome || '',
    fornecedor_nif: xml.terceiro_nif || '',
    data_agendada: d.data_emissao || '',
    estado: 'PENDENTE' as const,
    doc_origem: d.origem_doc_id || '',
    observacoes: xml.observacoes || '',
    linhas: [], // Carregado posteriormente se necessário
  };
}

// Test data: mock receiving orders (temporary until API is available)
const MOCK_RECEIVING_ORDERS: ReceivingOrder[] = [
  {
    id: 'gr-001',
    numero_guia: 'GR-88421/2026',
    serie: 'GR',
    nome_documento: 'Guia Receção - Fornecedor A - Lisboa',
    numero_encomenda_artsoft: 'ENC-001',
    fornecedor_id: 'forn-001',
    fornecedor_nome: 'Fornecedor A - Lisboa',
    fornecedor_nif: '123456789',
    data_agendada: '2026-09-05T10:30:00Z',
    doc_origem: 'GR-88421',
    estado: 'PENDENTE',
    linhas: [
      {
        id: 'linha-001-1',
        nr_linha: 1,
        guia_id: 'gr-001',
        artigo_codigo: 'ART-001',
        artigo_descricao: 'Produto de Teste 1',
        ean_barcode: '5601234000001',
        qtd_esperada_caixas: 50,
        qtd_recebida_caixas: 50,
        qtd_ja_paletizada_caixas: 0,
        unidades_por_caixa: 12,
        estado_linha: 'CONCLUIDO',
        localizacao_sugerida: 'A-01-01-1',
        danificados_caixas: 0,
        peso_bruto_kg: 2.5,
        comprimento_cm: 30,
        largura_cm: 20,
        altura_cm: 15,
        lote: 'LOTE-001',
        data_validade: '2027-12-31'
      },
      {
        id: 'linha-001-2',
        nr_linha: 2,
        guia_id: 'gr-001',
        artigo_codigo: 'ART-002',
        artigo_descricao: 'Produto de Teste 2',
        ean_barcode: '5601234000002',
        qtd_esperada_caixas: 30,
        qtd_recebida_caixas: 30,
        qtd_ja_paletizada_caixas: 0,
        unidades_por_caixa: 24,
        estado_linha: 'CONCLUIDO',
        localizacao_sugerida: 'A-01-02-1',
        danificados_caixas: 0,
        peso_bruto_kg: 1.8,
        comprimento_cm: 25,
        largura_cm: 18,
        altura_cm: 12,
        lote: 'LOTE-002',
        data_validade: '2027-11-30'
      }
    ]
  }
];

export function useWMSData() {
  // Receiving orders: start with mock data (TODO: replace with API call)
  const [orders, setOrders] = useState<ReceivingOrder[]>(MOCK_RECEIVING_ORDERS);
  const [pallets, setPallets] = useState<PalletSSCC[]>([]);
  const [stock, setStock] = useState<StockPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tiposDocumento, setTiposDocumento] = useState<Record<string, string>>(TIPO_DOCUMENTO_MAP);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [recon, paletesRows, docsRows, tiposRes] = await Promise.all([
          api.reconciliacaoStock(500),
          api.paletes(500).catch(() => [] as any[]),
          api.listarDocumentos(100).catch(() => [] as any[]),
          fetch('/api/artsoft/tipos-documento').then(r => r.json()).catch(() => ({ tipos: TIPO_DOCUMENTO_MAP })),
        ]);

        setStock(
          recon
            .filter((r) => (Number(r.quantidade_artsoft) || 0) > 0)
            .map(snapshotParaStock)
        );
        setPallets(paletesRows as unknown as PalletSSCC[]);
        if (tiposRes && tiposRes.tipos) {
          setTiposDocumento(tiposRes.tipos);
        }
        setOrders(
          (docsRows || [])
            .map(d => docParaReceivingOrder(d, tiposRes?.tipos || TIPO_DOCUMENTO_MAP))
            .filter(o => o.numero_guia) // Ignora documentos sem número
        );
        setError(null);
      } catch (err) {
        console.warn('Erro ao carregar dados (usando mocks):', err);
        // Fallback para mock data em caso de erro (dev phase)
        setOrders(MOCK_RECEIVING_ORDERS.map(d => docParaReceivingOrder(d, TIPO_DOCUMENTO_MAP)));
        setTiposDocumento(TIPO_DOCUMENTO_MAP);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { orders, pallets, stock, loading, error, tiposDocumento, setOrders, setPallets, setStock };
}
