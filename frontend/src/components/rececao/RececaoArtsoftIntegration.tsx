import React, { useState } from 'react';
import { Loader, CheckCircle2, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { ArtsoftIntegration } from '../../types/rececao';

interface RececaoArtsoftIntegrationProps {
  integracao: ArtsoftIntegration | null;
  onCriarEntrada: () => Promise<void>;
  onTentarNovamente: () => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const RececaoArtsoftIntegration: React.FC<RececaoArtsoftIntegrationProps> = ({
  integracao,
  onCriarEntrada,
  onTentarNovamente,
  loading = false,
  error,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!integracao) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <button
          onClick={onCriarEntrada}
          disabled={loading}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            <span className="font-semibold text-slate-900">Criar entrada no Artsoft</span>
          </div>
          {loading && <Loader className="w-5 h-5 text-amber-600 animate-spin" />}
        </button>
      </div>
    );
  }

  const isProcessing = integracao.estado === 'EM_PROCESSAMENTO' || loading;
  const isError = integracao.estado === 'ERRO' || integracao.estado === 'NECESSITA_INTERVENCAO';
  const isSuccess = integracao.estado === 'INTEGRADA';

  const statusInfo = {
    PENDENTE: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Pendente' },
    EM_PROCESSAMENTO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'A processar...' },
    INTEGRADA: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Integrada' },
    ERRO: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Erro' },
    NECESSITA_INTERVENCAO: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Aguarda revisão' },
  };

  const info = statusInfo[integracao.estado];

  return (
    <div className={`border rounded-lg p-4 ${info.bg} transition-all`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3 flex-1">
          {isProcessing && <Loader className="w-5 h-5 text-blue-600 animate-spin" />}
          {isError && <AlertCircle className="w-5 h-5 text-rose-600" />}
          {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
          <div>
            <div className={`font-semibold ${info.text}`}>Artsoft — {info.label}</div>
            <div className="text-xs text-slate-600 mt-1">
              {integracao.entrada_artsoft_id && `ID: ${integracao.entrada_artsoft_id}`}
              {integracao.tentativas > 0 && ` • Tentativas: ${integracao.tentativas}`}
            </div>
          </div>
        </div>

        {!isSuccess && isError && (
          <button
            onClick={onTentarNovamente}
            disabled={isProcessing}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-sm font-semibold transition-colors flex items-center gap-1"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar
          </button>
        )}
      </button>

      {/* Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-slate-300 space-y-3 text-sm">
          {/* Payload */}
          <div>
            <div className="font-mono font-bold text-slate-700 mb-1">Payload enviado:</div>
            <div className="bg-white bg-opacity-50 p-2 rounded text-xs font-mono text-slate-600 max-h-[150px] overflow-y-auto">
              {integracao.payload_enviado}
            </div>
          </div>

          {/* Resposta */}
          {integracao.resposta_artsoft && (
            <div>
              <div className="font-mono font-bold text-slate-700 mb-1">Resposta Artsoft:</div>
              <div className="bg-white bg-opacity-50 p-2 rounded text-xs font-mono text-slate-600 max-h-[150px] overflow-y-auto">
                {integracao.resposta_artsoft}
              </div>
            </div>
          )}

          {/* Erro técnico */}
          {integracao.erro_tecnico && (
            <div>
              <div className="font-mono font-bold text-rose-700 mb-1">Erro técnico:</div>
              <div className="bg-rose-50 p-2 rounded text-xs font-mono text-rose-600 max-h-[100px] overflow-y-auto">
                {integracao.erro_tecnico}
              </div>
            </div>
          )}

          {/* Próxima tentativa */}
          {integracao.proxima_tentativa_em && (
            <div className="text-xs text-amber-700">
              Próxima tentativa em: {new Date(integracao.proxima_tentativa_em).toLocaleString('pt-PT')}
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            <div>
              <div className="font-semibold">Criado:</div>
              <div>{new Date(integracao.criado_em).toLocaleString('pt-PT')}</div>
            </div>
            <div>
              <div className="font-semibold">Atualizado:</div>
              <div>{new Date(integracao.atualizado_em).toLocaleString('pt-PT')}</div>
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-3 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">{error}</div>
      )}
    </div>
  );
};
