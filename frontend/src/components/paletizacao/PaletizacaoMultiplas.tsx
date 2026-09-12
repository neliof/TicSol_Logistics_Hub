import React, { useState } from 'react';
import { Grid3x3, Play, X } from 'lucide-react';
import { ReceivingLine } from '../../types/wms';

interface ConfiguracaoPalete {
  linha_id: string;
  artigo_codigo: string;
  quantidade_total_recebida: number;
  quantidade_por_palete: number;
  numero_paletes_calculadas: number;
  quantidade_unidades_por_palete: number;
}

interface PaletizacaoMultiplasProps {
  ordem_id: string;
  linhas: ReceivingLine[];
  onCriarMultiplas: (configs: ConfiguracaoPalete[]) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export const PaletizacaoMultiplas: React.FC<PaletizacaoMultiplasProps> = ({
  ordem_id,
  linhas,
  onCriarMultiplas,
  onCancel,
  loading = false,
}) => {
  const [configs, setConfigs] = useState<ConfiguracaoPalete[]>(
    linhas.map(linha => ({
      linha_id: linha.id,
      artigo_codigo: linha.artigo_codigo,
      quantidade_total_recebida: linha.qtd_recebida_caixas,
      quantidade_por_palete: 10,
      numero_paletes_calculadas: Math.ceil(linha.qtd_recebida_caixas / 10),
      quantidade_unidades_por_palete: 0,
    }))
  );

  const handleAtualizar = (linha_id: string, qtdPorPalete: number) => {
    setConfigs(
      configs.map(c =>
        c.linha_id === linha_id
          ? {
              ...c,
              quantidade_por_palete: qtdPorPalete,
              numero_paletes_calculadas: Math.ceil(c.quantidade_total_recebida / qtdPorPalete),
            }
          : c
      )
    );
  };

  const handleCriar = async () => {
    // Validação
    for (const config of configs) {
      if (config.quantidade_por_palete <= 0) {
        alert(`Quantidade por palete deve ser > 0 para ${config.artigo_codigo}`);
        return;
      }
    }

    await onCriarMultiplas(configs);
  };

  const totalPaletes = configs.reduce((sum, c) => sum + c.numero_paletes_calculadas, 0);

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3x3 className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">Criar Múltiplas Paletes</h3>
        </div>
        <div className="text-xs font-semibold text-slate-600">Ordem: {ordem_id.slice(0, 8)}</div>
      </div>

      {/* Info */}
      <div className="p-3 bg-purple-50 border border-purple-200 rounded">
        <div className="text-sm font-semibold text-slate-900 mb-2">
          Resumo: {configs.length} linhas → {totalPaletes} paletes
        </div>
        <div className="text-xs text-slate-600">
          Configure a quantidade por palete para cada artigo
        </div>
      </div>

      {/* Configurações */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {configs.map((config) => (
          <div key={config.linha_id} className="p-3 bg-slate-50 border border-slate-200 rounded">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono font-bold text-sm text-slate-900">
                {config.artigo_codigo}
              </div>
              <div className="text-xs font-semibold text-slate-600">
                {config.numero_paletes_calculadas} paletes
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
              <div>
                <div className="text-slate-600 font-medium mb-0.5">Total recebido</div>
                <div className="font-mono font-bold text-slate-900">{config.quantidade_total_recebida} cx</div>
              </div>
              <div>
                <div className="text-slate-600 font-medium mb-0.5">Por palete</div>
                <input
                  type="number"
                  value={config.quantidade_por_palete}
                  onChange={(e) =>
                    handleAtualizar(
                      config.linha_id,
                      parseInt(e.target.value) || 1
                    )
                  }
                  min="1"
                  max={config.quantidade_total_recebida}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>
              <div>
                <div className="text-slate-600 font-medium mb-0.5">Unidades/palete</div>
                <input
                  type="number"
                  value={config.quantidade_unidades_por_palete}
                  onChange={(e) =>
                    setConfigs(
                      configs.map(c =>
                        c.linha_id === config.linha_id
                          ? {
                              ...c,
                              quantidade_unidades_por_palete: parseInt(e.target.value) || 0,
                            }
                          : c
                      )
                    )
                  }
                  min="0"
                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>
            </div>

            {/* Breakdown */}
            <div className="text-xs text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
              {config.numero_paletes_calculadas === 1
                ? `1 palete com ${config.quantidade_por_palete} cx`
                : `${config.numero_paletes_calculadas - 1} palete(s) com ${config.quantidade_por_palete} cx + 1 com ${config.quantidade_total_recebida % config.quantidade_por_palete || config.quantidade_por_palete} cx`}
            </div>
          </div>
        ))}
      </div>

      {/* Ações */}
      <div className="flex gap-3 pt-3 border-t border-slate-200">
        <button
          onClick={onCancel}
          className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          onClick={handleCriar}
          disabled={loading}
          className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          {loading ? 'A criar…' : `Criar ${totalPaletes} Paletes`}
        </button>
      </div>
    </div>
  );
};
