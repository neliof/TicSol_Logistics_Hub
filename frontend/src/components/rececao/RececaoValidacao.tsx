import React from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { RecepcaoValidacao } from '../../types/rececao';

interface RececaoValidacaoProps {
  validacao: RecepcaoValidacao;
  onFinalizar: () => void;
  loading?: boolean;
}

export const RececaoValidacao: React.FC<RececaoValidacaoProps> = ({
  validacao,
  onFinalizar,
  loading = false,
}) => {
  const items = [
    {
      label: 'Documento fornecedor',
      status: validacao.documento_registado,
      type: 'error' as const,
    },
    {
      label: 'Linhas conferidas',
      status: validacao.linhas_conferidas,
      type: 'error' as const,
    },
    {
      label: `Linhas completas (${validacao.linhas_completas.conferidas}/${validacao.linhas_completas.total})`,
      status: validacao.linhas_completas.conferidas === validacao.linhas_completas.total,
      type: 'error' as const,
    },
    {
      label: 'Lotes obrigatórios registados',
      status: validacao.lotes_obrigatorios_registados,
      type: 'error' as const,
    },
    {
      label: 'Localizações definidas',
      status: validacao.localizacoes_definidas,
      type: 'error' as const,
    },
    {
      label: `Paletes criadas (${validacao.paletes_criadas})`,
      status: validacao.paletes_criadas > 0,
      type: 'warning' as const,
    },
    {
      label: `Divergências resolvidas (${validacao.divergencias_nao_resolvidas} pendentes)`,
      status: validacao.divergencias_nao_resolvidas === 0,
      type: 'warning' as const,
    },
  ];

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-slate-900 mb-1">Checklist de Validação</h3>
        <p className="text-xs text-slate-600">
          Verifique todos os itens antes de finalizar a receção
        </p>
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-start gap-3 p-2 bg-slate-50 rounded">
            <div className="flex-shrink-0 mt-0.5">
              {item.status ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : item.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              )}
            </div>
            <span className={`text-sm ${item.status ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {validacao.alertas.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded">
          <div className="text-xs font-semibold text-amber-900 mb-1">⚠ Alertas</div>
          {validacao.alertas.map((alerta, idx) => (
            <div key={idx} className="text-xs text-amber-800">
              • {alerta}
            </div>
          ))}
        </div>
      )}

      {/* Erros */}
      {validacao.erros.length > 0 && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded">
          <div className="text-xs font-semibold text-rose-900 mb-1">✕ Erros</div>
          {validacao.erros.map((erro, idx) => (
            <div key={idx} className="text-xs text-rose-800">
              • {erro}
            </div>
          ))}
        </div>
      )}

      {/* Botão finalizar */}
      <button
        onClick={onFinalizar}
        disabled={!validacao.valido || loading}
        className={`w-full px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          validacao.valido
            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
            : 'bg-slate-200 text-slate-500 cursor-not-allowed'
        }`}
      >
        {loading ? '⟳ A processar...' : '✓ Finalizar Receção'}
      </button>
    </div>
  );
};
