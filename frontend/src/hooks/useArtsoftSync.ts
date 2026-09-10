import { useCallback, useEffect, useState } from 'react';
import {
  api,
  empresaIdDaSessao,
  ExecucaoSync,
  LinhaReconciliacao,
  ResultadoSync,
  ResultadoSyncCompleto,
  SyncHealth,
} from '../api';

export function useArtsoftSync() {
  const [execucoes, setExecucoes] = useState<ExecucaoSync[]>([]);
  const [health, setHealth] = useState<SyncHealth | null>(null);
  const [reconciliacao, setReconciliacao] = useState<LinhaReconciliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aSincronizar, setASincronizar] = useState(false);
  const [aSincronizarStock, setASincronizarStock] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoSync | null>(null);
  const [etapaSincronizacao, setEtapaSincronizacao] = useState<string | null>(null);
  const [ultimoResultadoCompleto, setUltimoResultadoCompleto] = useState<ResultadoSyncCompleto | null>(null);

  const carregar = useCallback(async () => {
    const empresaId = empresaIdDaSessao();
    try {
      const [execs, saude, recon] = await Promise.all([
        api.listarExecucoes(20),
        empresaId ? api.healthSync(empresaId) : Promise.resolve(null),
        api.reconciliacaoStock(500).catch(() => [] as LinhaReconciliacao[]),
      ]);
      setExecucoes(execs);
      setHealth(saude);
      setReconciliacao(recon);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler o estado da sincronização.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => clearInterval(intervalo);
  }, [carregar]);

  // Sincroniza produtos e terceiros antes das guias: as linhas de guia só
  // resolvem produto_id se o artigo já existir em logistics.produto, e o
  // cabeçalho só resolve cliente_id se o terceiro já existir.
  const sincronizar = useCallback(async () => {
    setASincronizar(true);
    setError(null);
    const resultadoCompleto: ResultadoSyncCompleto = {
      produtos: null,
      terceiros: null,
      guias: null,
      erros: [],
    };
    try {
      setEtapaSincronizacao('A sincronizar artigos…');
      try {
        resultadoCompleto.produtos = await api.sincronizarProdutos();
      } catch (err) {
        resultadoCompleto.erros.push(
          `Artigos: ${err instanceof Error ? err.message : 'falha desconhecida'}`
        );
      }

      setEtapaSincronizacao('A sincronizar clientes e fornecedores…');
      try {
        resultadoCompleto.terceiros = await api.sincronizarTerceiros();
      } catch (err) {
        resultadoCompleto.erros.push(
          `Terceiros: ${err instanceof Error ? err.message : 'falha desconhecida'}`
        );
      }

      setEtapaSincronizacao('A sincronizar guias de transporte…');
      try {
        resultadoCompleto.guias = await api.sincronizarGuias();
        setUltimoResultado(resultadoCompleto.guias);
      } catch (err) {
        resultadoCompleto.erros.push(
          `Guias: ${err instanceof Error ? err.message : 'falha desconhecida'}`
        );
      }

      setUltimoResultadoCompleto(resultadoCompleto);
      if (resultadoCompleto.erros.length > 0) {
        setError(resultadoCompleto.erros.join(' | '));
      }
      await carregar();
      return resultadoCompleto;
    } finally {
      setEtapaSincronizacao(null);
      setASincronizar(false);
    }
  }, [carregar]);

  const sincronizarStock = useCallback(async () => {
    setASincronizarStock(true);
    setError(null);
    try {
      await api.sincronizarStock();
      await carregar();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'A sincronização de stock falhou.');
    } finally {
      setASincronizarStock(false);
    }
  }, [carregar]);

  return {
    execucoes,
    health,
    reconciliacao,
    loading,
    error,
    aSincronizar,
    aSincronizarStock,
    ultimoResultado,
    ultimoResultadoCompleto,
    etapaSincronizacao,
    sincronizar,
    sincronizarStock,
    recarregar: carregar,
  };
}
