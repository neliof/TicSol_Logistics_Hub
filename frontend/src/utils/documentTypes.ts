/** Mapa de séries/tipos de documento ARTSOFT → descrição legível */
export const TIPO_DOCUMENTO_MAP: Record<string, string> = {
  // Guias de Transporte (vários intervalos V950-V999)
  'V950': 'Guia Transporte',
  'V960': 'Guia Transporte',
  'V970': 'Guia Transporte',
  'V980': 'Guia Transporte',
  'V990': 'Guia Transporte',
  'V991': 'Guia Transporte',
  'V992': 'Guia Transporte',
  'V993': 'Guia Transporte',
  'V994': 'Guia Transporte',
  'V995': 'Guia Transporte',

  // Faturas (V001-V099)
  'V001': 'Fatura',
  'V010': 'Fatura',
  'V020': 'Fatura',
  'V050': 'Fatura',
  'V099': 'Fatura',

  // Notas de Crédito/Débito (V100-V199)
  'V100': 'Nota Crédito',
  'V110': 'Nota Crédito',
  'V120': 'Nota Crédito',
  'V150': 'Nota Débito',
  'V160': 'Nota Débito',
  'V170': 'Nota Débito',
  'V199': 'Nota Débito',

  // Devoluções/Encomendas (A001-A999)
  'A001': 'Devolução',
  'A010': 'Devolução',
  'A100': 'Encomenda',
  'A110': 'Encomenda',
  'A200': 'Orçamento',
  'A210': 'Orçamento',

  // Recibos/Pagamentos (B001-B999)
  'B001': 'Recibo',
  'B010': 'Recibo',
  'B100': 'Extracto',
  'B110': 'Extracto',

  // Alias curtos (2 letras)
  'GR': 'Guia Receção',
  'GT': 'Guia Transporte',
  'GE': 'Guia Expedição',
  'NC': 'Nota Crédito',
  'ND': 'Nota Débito',
  'RF': 'Recibo',
};

/** Parse JSON from conteudo_xml field safely */
export function parseXmlContent(xmlContent: any): Record<string, any> {
  if (typeof xmlContent === 'string') {
    try {
      return JSON.parse(xmlContent);
    } catch {
      return {};
    }
  }
  return xmlContent || {};
}

/** Get document type description from serie/tipo */
export function getTipoDocumento(serie: string, tipo: string, tiposMap: Record<string, string> = TIPO_DOCUMENTO_MAP): string {
  return tiposMap[serie] || tipo || 'Documento';
}

/** Format document name as "Serie-Numero - Tipo Documento" */
export function formatNomeDocumento(
  serieOuId: string,
  numero: string,
  tipoDescricao: string
): string {
  return `${serieOuId || numero} - ${tipoDescricao}`;
}
