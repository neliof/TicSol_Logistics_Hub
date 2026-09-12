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

export function useWMSData() {
  const [orders, setOrders] = useState<ReceivingOrder[]>([]);
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
          api.paletes(500),
          api.listarDocumentos(100),
          // Tabela de tradução local; não é dado de negócio crítico, por
          // isso mantém fallback ao mapa local em vez de falhar tudo.
          fetch('/api/artsoft/tipos-documento').then(r => r.json()).catch(() => ({ tipos: TIPO_DOCUMENTO_MAP })),
        ]);

        setStock(
          recon
            .filter((r) => (Number(r.quantidade_artsoft) || 0) > 0)
            .map(snapshotParaStock)
        );
        setPallets(paletesRows as unknown as PalletSSCC[]);
        const tiposMap = (tiposRes && tiposRes.tipos) || TIPO_DOCUMENTO_MAP;
        setTiposDocumento(tiposMap);
        setOrders(
          (docsRows || [])
            .map(d => docParaReceivingOrder(d, tiposMap))
            .filter(o => o.numero_guia) // Ignora documentos sem número
        );
        setError(null);
      } catch (err) {
        // Não mascarar a falha com dados fictícios: o operador precisa de
        // saber que a informação apresentada pode estar desatualizada ou
        // em falta, não ver encomendas inventadas sem aviso.
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados do WMS';
        console.error('Erro ao carregar dados WMS:', err);
        setError(msg);
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
