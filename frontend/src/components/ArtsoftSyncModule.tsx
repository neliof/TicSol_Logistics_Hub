import React, { useState } from 'react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Database,
  Play,
  Server,
  Clock,
  Scale,
  PackageSearch,
  Settings,
} from 'lucide-react';
import { useArtsoftSync } from '../hooks/useArtsoftSync';
import { ExecucaoSync, LinhaReconciliacao } from '../api';
import { ConfigureSeriesModal } from './ConfigureSeriesModal';

function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : Number.parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

const ROTULO_ESTADO: Record<string, string> = {
  ok: 'Concluída',
  incompleto: 'Incompleta',
  erro_comunicacao: 'Erro de comunicação',
  erro_autenticacao: 'Erro de autenticação',
  erro_xml: 'Erro de XML',
  erro_funcional: 'Erro funcional',
};

function estiloEstado(estado: string): string {
  if (estado === 'ok') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (estado === 'incompleto') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function dataLegivel(valor: string | null): string {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const Cartao: React.FC<{ rotulo: string; children: React.ReactNode }> = ({ rotulo, children }) => (
  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{rotulo}</div>
    <div className="mt-2">{children}</div>
  </div>
);

export const ArtsoftSyncModule: React.FC = () => {
  const {
    execucoes,
    health,
    reconciliacao,
    loading,
    error,
    aSincronizar,
    aSincronizarStock,
    ultimoResultadoCompleto,
    etapaSincronizacao,
    sincronizar,
    sincronizarStock,
  } = useArtsoftSync();
  const [aba, setAba] = useState<'execucoes' | 'reconciliacao'>('execucoes');
  const [showSeriesModal, setShowSeriesModal] = useState(false);

  const comDivergencia = reconciliacao.filter((r) => num(r.diferenca) !== 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-blue-600" />
            Sincronização ARTSOFT
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sincroniza artigos, clientes/fornecedores e guias de transporte para{' '}
            <code className="text-blue-600 font-mono font-bold">logistics.produto</code>,{' '}
            <code className="text-blue-600 font-mono font-bold">logistics.cliente</code>/
            <code className="text-blue-600 font-mono font-bold">fornecedor</code> e{' '}
            <code className="text-blue-600 font-mono font-bold">logistics.documento</code>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSeriesModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold text-xs rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            Configurar séries
          </button>
          <button
            onClick={sincronizar}
            disabled={aSincronizar}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            {aSincronizar ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {aSincronizar ? (etapaSincronizacao ?? 'A sincronizar…') : 'Sincronizar agora'}
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {ultimoResultadoCompleto && !aSincronizar && (
        <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-lg text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            {ultimoResultadoCompleto.produtos && (
              <div>
                Artigos: <strong>{ultimoResultadoCompleto.produtos.criados}</strong> criados,{' '}
                <strong>{ultimoResultadoCompleto.produtos.atualizados}</strong> atualizados
              </div>
            )}
            {ultimoResultadoCompleto.terceiros && (
              <div>
                Clientes: <strong>{ultimoResultadoCompleto.terceiros.clientes.criados}</strong> criados
                {' | '}Fornecedores:{' '}
                <strong>{ultimoResultadoCompleto.terceiros.fornecedores.criados}</strong> criados
              </div>
            )}
            {ultimoResultadoCompleto.guias && (
              <div>
                Guias: <strong>{ultimoResultadoCompleto.guias.docs_criados}</strong> documentos,{' '}
                <strong>{ultimoResultadoCompleto.guias.linhas_total}</strong> linhas
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Cartao rotulo="Estado do conector">
          {health ? (
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded-full border ${
                health.healthy
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}
            >
              {health.healthy ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertTriangle className="w-4 h-4" />
              )}
              {health.healthy ? 'Operacional' : 'Requer atenção'}
            </span>
          ) : (
            <span className="text-sm text-slate-400">{loading ? 'A carregar…' : '—'}</span>
          )}
        </Cartao>

        <Cartao rotulo="Última sincronização">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <Clock className="w-4 h-4 text-slate-400" />
            {dataLegivel(health?.lastSync ?? null)}
          </div>
          {health?.diasDesdeUltimaSincronizacao != null && (
            <div className="text-xs text-slate-500 mt-1">
              {health.diasDesdeUltimaSincronizacao === 0
                ? 'Hoje'
                : `Há ${health.diasDesdeUltimaSincronizacao} dia(s)`}
            </div>
          )}
        </Cartao>

        <Cartao rotulo="Produtos com divergência">
          <div className="flex items-center gap-1.5 text-2xl font-bold text-slate-900">
            <Scale className="w-5 h-5 text-slate-400" />
            {loading ? '—' : comDivergencia.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            de {reconciliacao.length} produtos comparados
          </div>
        </Cartao>
      </div>

      {/* Seletor de abas */}
      <div className="flex items-center gap-1.5 border-b border-slate-200">
        {[
          { id: 'execucoes' as const, rotulo: 'Histórico de execuções', icon: <Server className="w-4 h-4" /> },
          { id: 'reconciliacao' as const, rotulo: 'Reconciliação de stock', icon: <Scale className="w-4 h-4" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              aba === t.id
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.rotulo}
          </button>
        ))}
      </div>

      {aba === 'reconciliacao' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <PackageSearch className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-900">
                Stock ARTSOFT vs WMS
              </h3>
            </div>
            <button
              onClick={sincronizarStock}
              disabled={aSincronizarStock}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {aSincronizarStock ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {aSincronizarStock ? 'A atualizar…' : 'Atualizar stock'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="text-left font-semibold px-5 py-2">SKU</th>
                  <th className="text-left font-semibold px-5 py-2">Descrição</th>
                  <th className="text-right font-semibold px-5 py-2">WMS</th>
                  <th className="text-right font-semibold px-5 py-2">ARTSOFT</th>
                  <th className="text-right font-semibold px-5 py-2">Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      A carregar…
                    </td>
                  </tr>
                )}

                {!loading && reconciliacao.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Sem dados de stock. Carregue em “Atualizar stock”.
                    </td>
                  </tr>
                )}

                {reconciliacao
                  .filter((r) => num(r.quantidade_artsoft) !== 0 || num(r.quantidade_wms) !== 0)
                  .sort((a, b) => Math.abs(num(b.diferenca)) - Math.abs(num(a.diferenca)))
                  .slice(0, 200)
                  .map((r: LinhaReconciliacao) => {
                    const dif = num(r.diferenca);
                    return (
                      <tr key={r.produto_id} className="hover:bg-slate-50">
                        <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{r.sku_interno}</td>
                        <td className="px-5 py-2.5 text-slate-700">{r.descricao}</td>
                        <td className="px-5 py-2.5 text-right text-slate-700">{num(r.quantidade_wms)}</td>
                        <td className="px-5 py-2.5 text-right text-slate-700">
                          {r.quantidade_artsoft == null ? '—' : num(r.quantidade_artsoft)}
                        </td>
                        <td className="px-5 py-2.5 text-right">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                              dif === 0
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-red-700 bg-red-50 border-red-200'
                            }`}
                          >
                            {dif > 0 ? `+${dif}` : dif}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'execucoes' && (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2">
          <Server className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900">Histórico de execuções</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="text-left font-semibold px-5 py-2">Data</th>
                <th className="text-left font-semibold px-5 py-2">Tipo</th>
                <th className="text-left font-semibold px-5 py-2">Estado</th>
                <th className="text-right font-semibold px-5 py-2">Páginas</th>
                <th className="text-left font-semibold px-5 py-2">Correlação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    A carregar…
                  </td>
                </tr>
              )}

              {!loading && execucoes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Ainda não há sincronizações registadas.
                  </td>
                </tr>
              )}

              {execucoes.map((e: ExecucaoSync) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-5 py-2.5 text-slate-700 whitespace-nowrap">
                    {dataLegivel(e.executado_em)}
                  </td>
                  <td className="px-5 py-2.5 text-slate-700">{e.tipo}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${estiloEstado(e.estado)}`}
                    >
                      {ROTULO_ESTADO[e.estado] ?? e.estado}
                    </span>
                    {e.erro_resumo && (
                      <div className="text-xs text-red-600 mt-1">{e.erro_resumo}</div>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{e.pagina ?? '—'}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-400">
                    {e.correlation_id ? e.correlation_id.slice(0, 8) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <ConfigureSeriesModal
        isOpen={showSeriesModal}
        onClose={() => setShowSeriesModal(false)}
        onSaved={() => {
          // Recarregar dados após salvar as séries
          window.location.reload();
        }}
      />
    </div>
  );
};
