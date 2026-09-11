import { useCallback, useEffect, useState } from 'react';
import { GuiaTransporte, LinhaGuia, PaletaExpedicao, ComprovanteEmbarque } from '../types/expedicao';
import { api } from '../api';
import { TIPO_DOCUMENTO_MAP, parseXmlContent, getTipoDocumento, formatNomeDocumento } from '../utils/documentTypes';

/** Mapeia uma linha_documento do ARTSOFT para LinhaGuia. */
function linhaDocParaLinhaGuia(l: any, guiaId: string): LinhaGuia {
  const extra = l.dados_extra || {};
  // quantidade: "1.000" (mil), "6.000" (6 com trailing zeros), "6.00" (6), "1,5" (1.5), "1.000,50" (mil+decimal)
  // Heurística: se dígitos ANTES do sep ≤ 2 → é decimal (X.YYY); senão é milhar (1.000)
  const qtdStr = String(l.quantidade || '0').trim();
  const lastSepIdx = Math.max(qtdStr.lastIndexOf('.'), qtdStr.lastIndexOf(','));
  let qtd = qtdStr;
  if (lastSepIdx > -1) {
    const digitsBefore = lastSepIdx;
    const digitsAfter = qtdStr.length - lastSepIdx - 1;

    if (digitsBefore <= 2) {
      // Poucos dígitos antes sep → decimal (X.YYY ou X,YY ou XX.YYY)
      const before = qtdStr.substring(0, lastSepIdx).replace(/\./g, '');
      qtd = before + '.' + qtdStr.substring(lastSepIdx + 1);
    } else {
      // 3+ dígitos antes → milhar (1.000 ou 1.000,50)
      qtd = qtdStr.replace(/\./g, '').replace(',', '.');
    }
  }
  const quantidade = Math.max(1, Number(qtd) || 1);
  // peso em BD pode ser 0 ou string — default 0.5kg se ausente ou inválido
  const peso = Number(extra.peso) > 0 ? Number(extra.peso) : 0.5;

  return {
    id: `${guiaId}-${l.nr_linha ?? l.id}`,
    nr_linha: l.nr_linha,
    guia_id: guiaId,
    artigo_codigo: l.artigo_codigo || '',
    artigo_descricao: l.descricao || '',
    ean_barcode: extra.ean13 || '',
    quantidade_solicitada: quantidade,
    lote: extra.lote || '',
    data_validade: extra.data_validade || '',
    temperatura_armazenamento: 'AMBIENTE',
    requer_palote_separada: false,
    peso_unitario_kg: peso,
    volume_unitario_m3: 0,
    status: 'PENDENTE',
    valor_unitario: Number(extra.valor_unitario) || undefined,
    iva_percentual: Number(extra.iva) || undefined,
    desconto_percentual: Number(extra.desconto) || undefined,
    total_liquido: Number(extra.total_liquido) || undefined,
  };
}

/**
 * Mapeia um documento ARTSOFT (guia de transporte) para GuiaTransporte, ao
 * nível do cabeçalho. As linhas ficam vazias de propósito: carregá-las seria
 * uma chamada por guia (N+1). O detalhe de linhas é obtido só quando uma guia
 * é aberta, não no carregamento da lista.
 */
function docParaGuia(d: any): GuiaTransporte {
  const x = parseXmlContent(d.conteudo_xml);
  const serie = d.origem_serie || '';
  const tipoDescricao = getTipoDocumento(serie, d.tipo, TIPO_DOCUMENTO_MAP);
  const clienteNome = x.terceiro_nome || '';
  const nome_documento = formatNomeDocumento(d.origem_doc_id || (serie + '-' + d.numero), d.numero, tipoDescricao);

  return {
    id: d.id,
    numero_guia: d.numero || d.origem_doc_id || '',
    serie: d.origem_serie || undefined,  // Série ARTSOFT para filtrar por módulo
    nome_documento,
    cliente_nome: clienteNome,
    cliente_nif: x.terceiro_nif || '',
    morada_entrega: x.morada_descarga || x.terceiro_morada || '',
    cidade_entrega: x.terceiro_localidade || '',
    codigo_postal_entrega: x.terceiro_cpostal || '',
    data_entrega_prevista: d.data_emissao || '',
    artsoft_order_id: x.pedido_origem || d.origem_doc_id || '',
    linhas: [],
    peso_total_estimado_kg: 0,
    volume_total_estimado_m3: 0,
    status: 'RECEBIDA',
    data_criacao: d.data_emissao || '',
    prioridade: 'NORMAL',
  };
}

export function useExpedicaoData() {
  const [guias, setGuias] = useState<GuiaTransporte[]>([]);
  // Sem tabelas próprias ainda: preenchidas pelo fluxo de expedição do WMS.
  const [paletas, setPaletas] = useState<PaletaExpedicao[]>([]);
  const [comprovantes, setComprovantes] = useState<ComprovanteEmbarque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const docs = await api.listarDocumentos(300);
        setGuias(docs.map(docParaGuia));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar guias de expedição.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Carrega as linhas de uma guia só quando é preciso (ao abri-la). Guias já
  // com linhas não voltam a ser pedidas.
  const carregarLinhas = useCallback(
    async (guiaId: string) => {
      const guia = guias.find((g) => g.id === guiaId);
      if (!guia || guia.linhas.length > 0) return;
      try {
        const linhas = await api.listarLinhasDoDocumento(guiaId);
        setGuias((prev) =>
          prev.map((g) =>
            g.id === guiaId ? { ...g, linhas: linhas.map((l) => linhaDocParaLinhaGuia(l, guiaId)) } : g
          )
        );
      } catch {
        // Sem detalhe de linhas: a guia fica com a lista vazia, sem quebrar o ecrã.
      }
    },
    [guias]
  );

  return {
    pedidos: guias,
    carregarLinhas,
    paletas,
    guias: comprovantes,
    loading,
    error,
    setPedidos: setGuias,
    setPaletas,
    setGuias: setComprovantes,
  };
}
