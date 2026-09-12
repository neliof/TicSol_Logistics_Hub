import { useState, useCallback } from 'react';
import { ReceivingOrder, ReceivingLine, PalletSSCC } from '../types/wms';
import {
  RecepcaoDocument,
  DivergenceRecord,
  RecepcaoState,
  ArtsoftIntegration,
  AuditRecord,
  RecepcaoCompleta,
  RecepcaoValidacao,
  LoteRegistado,
  ResultadoRecepcao,
} from '../types/rececao';

/**
 * Hook para gerir estado completo da receção
 * Responsável por: conferência, divergências, documentos, lotes, paletização, integração
 */
export function useRecepcao(recepcao_id?: string) {
  // Estado principal
  const [recepcao, setRecepcao] = useState<RecepcaoCompleta | null>(null);
  const [documento, setDocumento] = useState<RecepcaoDocument | null>(null);
  const [divergencias, setDivergencias] = useState<DivergenceRecord[]>([]);
  const [estado, setEstado] = useState<RecepcaoState | null>(null);
  const [lotes, setLotes] = useState<Map<string, LoteRegistado[]>>(new Map());
  const [integracao, setIntegracao] = useState<ArtsoftIntegration | null>(null);
  const [auditoria, setAuditoria] = useState<AuditRecord[]>([]);

  // Loading / Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Criar nova receção
  const criarRecepcao = useCallback(
    async (ordem: ReceivingOrder, operador: string): Promise<ResultadoRecepcao> => {
      setLoading(true);
      setError(null);
      try {
        // TODO: POST /rest/v1/recepcao com ordem_id
        const novaRecepcao: RecepcaoCompleta = {
          id: `REC-${Date.now()}`,
          numero_guia: ordem.numero_guia,
          numero_encomenda_artsoft: ordem.numero_encomenda_artsoft,
          fornecedor_nome: ordem.fornecedor_nome,
          divergencias: [],
          estado: {
            recepcao_id: `REC-${Date.now()}`,
            estado_atual: 'RASCUNHO',
            transicao_em: new Date().toISOString(),
            operador,
          },
          paletasAssociadas: [],
          auditoria: [],
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
        };

        setRecepcao(novaRecepcao);
        setEstado(novaRecepcao.estado);
        registarAuditoria(novaRecepcao.id, 'CRIAR_RECEPCAO', 'recepcao', novaRecepcao.id, null, novaRecepcao, operador);

        return {
          recepcao_id: novaRecepcao.id,
          estado: 'RASCUNHO',
          numero_guia: ordem.numero_guia,
          criado_em: novaRecepcao.criado_em,
          sucesso: true,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao criar receção';
        setError(msg);
        return { recepcao_id: '', estado: '', numero_guia: '', criado_em: '', sucesso: false, erro: msg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Registar documento
  const registarDocumento = useCallback(
    (tipo: string, numero: string, data: string, operador: string, url_anexo?: string) => {
      if (!recepcao) return;

      const doc: RecepcaoDocument = {
        id: `DOC-${Date.now()}`,
        recepcao_id: recepcao.id,
        tipo: tipo as any,
        numero,
        data,
        url_anexo,
        criado_em: new Date().toISOString(),
        operador,
      };

      setDocumento(doc);
      registarAuditoria(recepcao.id, 'REGISTAR_DOCUMENTO', 'recepcao_documento', doc.id, null, doc, operador);
    },
    [recepcao]
  );

  // Conferir linha
  const conferirLinha = useCallback(
    (linha: ReceivingLine, qtd_recebida: number, danificados: number, operador: string) => {
      if (!recepcao) return;

      const diferenca = qtd_recebida - linha.qtd_esperada_caixas;
      const linhaAtualizada = { ...linha, qtd_recebida_caixas: qtd_recebida, danificados_caixas: danificados };

      // Se houver diferença, registar automaticamente divergência
      if (diferenca !== 0 || danificados > 0) {
        const tipo = diferenca < 0 ? 'FALTA' : diferenca > 0 ? 'EXCESSO' : 'DANIFICADO';
        registarDivergencia(
          linha.id,
          tipo,
          Math.abs(diferenca) || danificados,
          `Diferença de ${Math.abs(diferenca)} boxes${danificados > 0 ? ` + ${danificados} danificados` : ''}`,
          operador
        );
      }

      registarAuditoria(
        recepcao.id,
        'CONFERIR_LINHA',
        'receiving_line',
        linha.id,
        { qtd_recebida_caixas: linha.qtd_recebida_caixas },
        { qtd_recebida_caixas: qtd_recebida, danificados_caixas: danificados },
        operador
      );
    },
    [recepcao]
  );

  // Registar divergência
  const registarDivergencia = useCallback(
    (
      linha_id: string,
      tipo: 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'NAO_ENCOMENDADO' | 'QUALIDADE',
      quantidade: number,
      motivo: string,
      operador: string,
      impacto: 'ACEITAR' | 'REJEITAR' | 'REVISAR' = 'REVISAR'
    ) => {
      if (!recepcao) return;

      const divergencia: DivergenceRecord = {
        id: `DIV-${Date.now()}`,
        linha_id,
        recepcao_id: recepcao.id,
        tipo,
        quantidade,
        motivo,
        impacto_entrada_artsoft: impacto,
        criado_em: new Date().toISOString(),
        operador,
      };

      setDivergencias((prev) => [...prev, divergencia]);
      registarAuditoria(recepcao.id, 'REGISTAR_DIVERGENCIA', 'divergencia_record', divergencia.id, null, divergencia, operador);
    },
    [recepcao]
  );

  // Registar lotes
  const registarLotes = useCallback(
    (linha_id: string, novosLotes: LoteRegistado[], operador: string) => {
      if (!recepcao) return;

      const lotesAtuais = lotes.get(linha_id) || [];
      const lotesNovosMapa = new Map(lotes);
      lotesNovosMapa.set(linha_id, novosLotes);
      setLotes(lotesNovosMapa);

      registarAuditoria(
        recepcao.id,
        'REGISTAR_LOTES',
        'lote_registado',
        linha_id,
        { lotes: lotesAtuais },
        { lotes: novosLotes },
        operador
      );
    },
    [recepcao, lotes]
  );

  // Registar auditoria
  const registarAuditoria = useCallback(
    (
      recepcao_id: string,
      acao: string,
      tabela_afetada: string,
      registro_id: string,
      valor_anterior: any,
      valor_novo: any,
      operador: string
    ) => {
      const auditEntry: AuditRecord = {
        id: `AUD-${Date.now()}`,
        recepcao_id,
        operador,
        acao,
        tabela_afetada,
        registro_id,
        valor_anterior,
        valor_novo,
        criado_em: new Date().toISOString(),
      };

      setAuditoria((prev) => [...prev, auditEntry]);
    },
    []
  );

  // Validar receção
  const validarRecepcao = useCallback((): RecepcaoValidacao => {
    if (!recepcao) {
      return {
        documento_registado: false,
        linhas_conferidas: false,
        linhas_completas: { total: 0, conferidas: 0 },
        divergencias_nao_resolvidas: 0,
        lotes_obrigatorios_registados: false,
        localizacoes_definidas: false,
        paletes_criadas: 0,
        alertas: ['Receção não inicializada'],
        erros: ['Receção não inicializada'],
        valido: false,
      };
    }

    const erros: string[] = [];
    const alertas: string[] = [];

    // Validação 1: Documento
    if (!documento) {
      erros.push('Documento do fornecedor não registado');
    }

    // Validação 2: Linhas conferidas
    // TODO: Verificar em recepcao.linhas

    // Validação 3: Divergências resolvidas
    const divergenciasNaoResolvidas = divergencias.filter((d) => d.impacto_entrada_artsoft === 'REVISAR').length;
    if (divergenciasNaoResolvidas > 0) {
      alertas.push(`${divergenciasNaoResolvidas} divergências aguardam resolução`);
    }

    // Validação 4: Lotes obrigatórios
    // TODO: Verificar regras de lote por artigo

    // Validação 5: Localizações
    // TODO: Verificar se paletes têm localização

    // Validação 6: Paletes
    // TODO: Contar paletes criadas

    return {
      documento_registado: !!documento,
      linhas_conferidas: true, // TODO
      linhas_completas: { total: 0, conferidas: 0 }, // TODO
      divergencias_nao_resolvidas: divergenciasNaoResolvidas,
      lotes_obrigatorios_registados: true, // TODO
      localizacoes_definidas: true, // TODO
      paletes_criadas: 0, // TODO
      alertas,
      erros,
      valido: erros.length === 0,
    };
  }, [recepcao, documento, divergencias]);

  // Finalizar receção
  const finalizarRecepcao = useCallback(
    async (operador: string): Promise<boolean> => {
      if (!recepcao) return false;

      const validacao = validarRecepcao();
      if (!validacao.valido) {
        setError(`Receção inválida: ${validacao.erros.join(', ')}`);
        return false;
      }

      setLoading(true);
      try {
        // TODO: PATCH /rest/v1/recepcao/{id} com estado=CONCLUIDA
        const estadoAtualizado: RecepcaoState = {
          ...estado!,
          estado_atual: 'CONCLUIDA',
          transicao_em: new Date().toISOString(),
          operador,
        };

        setEstado(estadoAtualizado);
        registarAuditoria(recepcao.id, 'FINALIZAR_RECEPCAO', 'recepcao', recepcao.id, { estado_atual: estado?.estado_atual }, { estado_atual: 'CONCLUIDA' }, operador);

        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao finalizar receção';
        setError(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [recepcao, estado, validarRecepcao, registarAuditoria]
  );

  return {
    // Estado
    recepcao,
    documento,
    divergencias,
    estado,
    lotes,
    integracao,
    auditoria,
    loading,
    error,

    // Ações
    criarRecepcao,
    registarDocumento,
    conferirLinha,
    registarDivergencia,
    registarLotes,
    validarRecepcao,
    finalizarRecepcao,
  };
}
