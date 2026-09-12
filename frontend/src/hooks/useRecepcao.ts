import { useState, useCallback } from 'react';
import { ReceivingOrder, ReceivingLine } from '../types/wms';
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
import { api } from '../api';

/**
 * Hook para gerir estado da receção, persistido no backend
 * (POST/PATCH /rest/v1/recepcao/*). Responsável por: criação, conferência,
 * divergências, documentos, lotes, validação, finalização e integração ArtSoft.
 */
export function useRecepcao() {
  // Estado principal
  const [recepcao, setRecepcao] = useState<RecepcaoCompleta | null>(null);
  const [documento, setDocumento] = useState<RecepcaoDocument | null>(null);
  const [divergencias, setDivergencias] = useState<DivergenceRecord[]>([]);
  const [estado, setEstado] = useState<RecepcaoState | null>(null);
  const [lotes, setLotes] = useState<Map<string, LoteRegistado[]>>(new Map());
  const [integracao, setIntegracao] = useState<ArtsoftIntegration | null>(null);
  const [auditoria, setAuditoria] = useState<AuditRecord[]>([]);
  const [validacao, setValidacao] = useState<RecepcaoValidacao | null>(null);

  // Loading / Error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recarregarValidacao = useCallback(async (recepcaoId: string) => {
    try {
      const resp = await api.validarRecepcao(recepcaoId);
      setValidacao(resp.validacao);
    } catch (err) {
      // Falha ao validar não deve bloquear o resto do fluxo; regista o erro
      // mas mantém a última validação conhecida em vez de a apagar.
      console.error('Erro ao validar receção:', err);
    }
  }, []);

  const recarregarAuditoria = useCallback(async (recepcaoId: string) => {
    try {
      const resp = await api.auditoriaRecepcao(recepcaoId);
      setAuditoria(resp.auditoria as AuditRecord[]);
    } catch (err) {
      console.error('Erro ao carregar auditoria:', err);
    }
  }, []);

  // Criar nova receção — persiste no backend (POST /rest/v1/recepcao)
  const criarRecepcao = useCallback(
    async (ordem: ReceivingOrder, operador: string): Promise<ResultadoRecepcao> => {
      setLoading(true);
      setError(null);
      try {
        const resp = await api.criarRecepcao({
          numero_guia: ordem.numero_guia,
          numero_encomenda_artsoft: ordem.numero_encomenda_artsoft,
          fornecedor_nome: ordem.fornecedor_nome,
          operador_inicio: operador,
        });

        const row = resp.recepcao;
        const novaRecepcao: RecepcaoCompleta = {
          id: row.id,
          numero_guia: row.numero_guia,
          numero_encomenda_artsoft: row.numero_encomenda_artsoft,
          fornecedor_nome: row.fornecedor_nome,
          divergencias: [],
          estado: {
            recepcao_id: row.id,
            estado_atual: row.estado,
            transicao_em: row.criado_em,
            operador,
          },
          paletasAssociadas: [],
          auditoria: [],
          criado_em: row.criado_em,
          atualizado_em: row.atualizado_em,
        };

        setRecepcao(novaRecepcao);
        setEstado(novaRecepcao.estado);
        setDocumento(null);
        setDivergencias([]);
        setLotes(new Map());
        setValidacao(null);
        setAuditoria([]);
        await recarregarValidacao(row.id);

        return {
          recepcao_id: row.id,
          estado: row.estado,
          numero_guia: row.numero_guia,
          criado_em: row.criado_em,
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
    [recarregarValidacao]
  );

  // Registar documento — POST /rest/v1/recepcao/:id/documento
  const registarDocumento = useCallback(
    async (tipo: string, numero: string, data: string, operador: string, url_anexo?: string) => {
      if (!recepcao) {
        setError('Nenhuma receção ativa para registar documento');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const resp = await api.registarDocumentoRecepcao(recepcao.id, { tipo, numero, data, operador, url_anexo });
        setDocumento(resp.documento as RecepcaoDocument);
        await recarregarValidacao(recepcao.id);
        await recarregarAuditoria(recepcao.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao registar documento');
      } finally {
        setLoading(false);
      }
    },
    [recepcao, recarregarValidacao, recarregarAuditoria]
  );

  // Conferir linha (local — a persistência da linha em si é feita pelo
  // caller via onUpdateOrders; aqui só disparamos divergência se aplicável)
  const conferirLinha = useCallback(
    (linha: ReceivingLine, qtd_recebida: number, danificados: number, operador: string) => {
      if (!recepcao) return;

      const diferenca = qtd_recebida - linha.qtd_esperada_caixas;

      if (diferenca !== 0 || danificados > 0) {
        const tipo = diferenca < 0 ? 'FALTA' : diferenca > 0 ? 'EXCESSO' : 'DANIFICADO';
        registarDivergencia(
          linha.id,
          tipo,
          Math.abs(diferenca) || danificados,
          `Diferença de ${Math.abs(diferenca)} caixas${danificados > 0 ? ` + ${danificados} danificados` : ''}`,
          operador
        );
      }
    },
    [recepcao] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Registar divergência — POST /rest/v1/recepcao/:id/divergencia
  const registarDivergencia = useCallback(
    async (
      linha_id: string,
      tipo: 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'NAO_ENCOMENDADO' | 'QUALIDADE',
      quantidade: number,
      motivo: string,
      operador: string,
      impacto: 'ACEITAR' | 'REJEITAR' | 'REVISAR' = 'REVISAR'
    ) => {
      if (!recepcao) {
        setError('Nenhuma receção ativa para registar divergência');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const resp = await api.registarDivergenciaRecepcao(recepcao.id, {
          linha_id,
          tipo,
          quantidade,
          motivo,
          operador,
          impacto_entrada_artsoft: impacto,
        });
        setDivergencias((prev) => [...prev, resp.divergencia as DivergenceRecord]);
        await recarregarValidacao(recepcao.id);
        await recarregarAuditoria(recepcao.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao registar divergência');
      } finally {
        setLoading(false);
      }
    },
    [recepcao, recarregarValidacao, recarregarAuditoria]
  );

  // Registar lotes — POST /rest/v1/recepcao/:id/lote (um pedido por lote)
  const registarLotes = useCallback(
    async (linha_id: string, novosLotes: LoteRegistado[], operador: string) => {
      if (!recepcao) {
        setError('Nenhuma receção ativa para registar lotes');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        for (const lote of novosLotes) {
          await api.registarLoteRecepcao(recepcao.id, {
            linha_id,
            lote: lote.lote,
            quantidade: lote.quantidade,
            data_validade: lote.data_validade,
            vida_util_dias: lote.vida_util_dias,
          });
        }

        setLotes((prev) => {
          const novoMapa = new Map(prev);
          novoMapa.set(linha_id, novosLotes);
          return novoMapa;
        });

        await recarregarValidacao(recepcao.id);
        await recarregarAuditoria(recepcao.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao registar lotes');
      } finally {
        setLoading(false);
      }
    },
    [recepcao, recarregarValidacao, recarregarAuditoria]
  );

  // Devolve a última validação conhecida (carregada via recarregarValidacao,
  // que corre automaticamente após criar receção e após cada ação relevante).
  const validarRecepcao = useCallback((): RecepcaoValidacao => {
    if (validacao) return validacao;
    return {
      documento_registado: false,
      linhas_conferidas: false,
      linhas_completas: { total: 0, conferidas: 0 },
      divergencias_nao_resolvidas: 0,
      lotes_obrigatorios_registados: false,
      localizacoes_definidas: false,
      paletes_criadas: 0,
      alertas: [],
      erros: recepcao ? ['A validar...'] : ['Receção não inicializada'],
      valido: false,
    };
  }, [validacao, recepcao]);

  // Finalizar receção — POST /rest/v1/recepcao/:id/finalizar (backend
  // valida documento + localizações antes de aceitar; erros 409 chegam aqui)
  const finalizarRecepcao = useCallback(
    async (operador: string): Promise<boolean> => {
      if (!recepcao) {
        setError('Nenhuma receção ativa para finalizar');
        return false;
      }

      setLoading(true);
      setError(null);
      try {
        const resp = await api.finalizarRecepcao(recepcao.id, operador);
        const estadoAtualizado: RecepcaoState = {
          recepcao_id: recepcao.id,
          estado_atual: resp.recepcao.estado,
          transicao_em: resp.recepcao.atualizado_em,
          operador,
        };
        setEstado(estadoAtualizado);
        await recarregarAuditoria(recepcao.id);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao finalizar receção';
        setError(msg);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [recepcao, recarregarAuditoria]
  );

  // Criar entrada ArtSoft — POST /rest/v1/artsoft/entrada
  const criarEntradaArtsoft = useCallback(async () => {
    if (!recepcao) {
      setError('Nenhuma receção ativa para criar entrada ArtSoft');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await api.criarEntradaArtsoft(recepcao.id, {
        numero_guia: recepcao.numero_guia,
        numero_encomenda_artsoft: recepcao.numero_encomenda_artsoft,
        fornecedor_nome: recepcao.fornecedor_nome,
      });
      setIntegracao(resp.integracao as ArtsoftIntegration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar entrada ArtSoft');
    } finally {
      setLoading(false);
    }
  }, [recepcao]);

  // Tentar novamente entrada ArtSoft — POST /rest/v1/artsoft/entrada/:id/retry
  const retryEntradaArtsoft = useCallback(async () => {
    if (!integracao) {
      setError('Nenhuma integração ArtSoft para repetir');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const resp = await api.retryEntradaArtsoft(integracao.id);
      setIntegracao(resp.integracao as ArtsoftIntegration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao repetir entrada ArtSoft');
    } finally {
      setLoading(false);
    }
  }, [integracao]);

  return {
    // Estado
    recepcao,
    documento,
    divergencias,
    estado,
    lotes,
    integracao,
    auditoria,
    validacao,
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
    criarEntradaArtsoft,
    retryEntradaArtsoft,
  };
}
