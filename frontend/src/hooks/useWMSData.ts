import { useEffect, useState } from 'react';
import { ReceivingOrder, PalletSSCC, StockPosition } from '../types/wms';
import { api, LinhaReconciliacao } from '../api';

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
function docParaReceivingOrder(d: any): ReceivingOrder {
  const xml = typeof d.conteudo_xml === 'string'
    ? (() => { try { return JSON.parse(d.conteudo_xml); } catch { return {}; } })()
    : d.conteudo_xml || {};

  return {
    id: d.id,
    numero_guia: d.numero || d.origem_doc_id || '',
    serie: d.origem_serie,
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
    fornecedor_nome: 'Fornecedor A - Lisboa',
    data_recebimento: '2026-09-05T10:30:00Z',
    status: 'PENDENTE',
    linhas: [
      {
        id: 'linha-001-1',
        nr_linha: 1,
        artigo_codigo: 'ART-001',
        artigo_descricao: 'Produto de Teste 1',
        ean_barcode: '5601234000001',
        qtd_recebida_caixas: 50,
        qtd_ja_paletizada_caixas: 0,
        unidades_por_caixa: 12,
        peso_bruto_kg: 2.5,
        altura_cm: 15,
        lote: 'LOTE-001',
        data_validade: '2027-12-31'
      },
      {
        id: 'linha-001-2',
        nr_linha: 2,
        artigo_codigo: 'ART-002',
        artigo_descricao: 'Produto de Teste 2',
        ean_barcode: '5601234000002',
        qtd_recebida_caixas: 30,
        qtd_ja_paletizada_caixas: 0,
        unidades_por_caixa: 24,
        peso_bruto_kg: 1.8,
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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [recon, paletesRows, docsRows] = await Promise.all([
          api.reconciliacaoStock(500),
          api.paletes(500).catch(() => [] as any[]),
          api.listarDocumentos(100).catch(() => [] as any[]),
        ]);

        setStock(
          recon
            .filter((r) => (Number(r.quantidade_artsoft) || 0) > 0)
            .map(snapshotParaStock)
        );
        setPallets(paletesRows as unknown as PalletSSCC[]);
        setOrders(
          (docsRows || [])
            .map(docParaReceivingOrder)
            .filter(o => o.numero_guia) // Ignora documentos sem número
        );
        setError(null);
      } catch (err) {
        console.warn('Erro ao carregar dados (usando mocks):', err);
        // Fallback para mock data em caso de erro (dev phase)
        setOrders(MOCK_RECEIVING_ORDERS);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  return { orders, pallets, stock, loading, error, setOrders, setPallets, setStock };
}
