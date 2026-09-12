import { useCallback, useEffect, useState } from 'react';
import { AuditLog } from '../types/wms';
import { api } from '../api';

/** Mapeia um evento de logistics.auditoria_evento para AuditLog (tipo de UI). */
function eventoParaAuditLog(e: any): AuditLog {
  return {
    id: e.id,
    timestamp: e.criado_em,
    operador: e.operador,
    empresa_tenant: '',
    acao: e.acao,
    tabela_afetada: e.tabela_afetada || '',
    postgrest_rpc: '',
    detalhes_json: typeof e.detalhes === 'string' ? e.detalhes : JSON.stringify(e.detalhes ?? {}),
    ip_terminal: e.ip_terminal || '',
  };
}

/**
 * Auditoria persistida no backend (logistics.auditoria_evento). Substitui o
 * padrão anterior de gerar AuditLog só no cliente (App.tsx), que se perdia
 * a cada refresh e nunca refletia a ação real de outro operador/terminal.
 */
export function useAuditoria() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await api.listarAuditoria(100);
      setLogs(resp.eventos.map(eventoParaAuditLog));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar auditoria.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Regista o evento no backend e atualiza a lista local de forma otimista
  // (aparece de imediato na UI, sem esperar pelo round-trip completo).
  const registar = useCallback(
    async (acao: string, tabela_afetada: string, detalhes: Record<string, unknown>, operador: string) => {
      try {
        const resp = await api.registarAuditoria({ operador, acao, tabela_afetada, detalhes });
        setLogs((prev) => [eventoParaAuditLog(resp.evento), ...prev]);
      } catch (err) {
        // Falha ao registar auditoria não deve travar a ação de negócio que
        // a originou; fica só como erro de fundo.
        console.error('Erro ao registar auditoria:', err);
      }
    },
    []
  );

  return { logs, loading, error, registar, recarregar: carregar };
}
