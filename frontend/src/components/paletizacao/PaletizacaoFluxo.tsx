import React, { useState } from 'react';
import { Layers, Plus, Check, AlertCircle, Loader } from 'lucide-react';
import { ReceivingLine } from '../../types/wms';

interface PaletizacaoFluxoProps {
  ordem_id: string;
  linhas: ReceivingLine[];
  onCriarPalete: (linhaId: string, quantidadeCaixas: number, quantidadeUnidades: number) => Promise<string>;
  onCancelar: () => void;
  loading?: boolean;
  erro?: string | null;
}

interface PaleteEmCriacao {
  linha_id: string;
  quantidade_caixas: number;
  quantidade_unidades: number;
  sscc?: string;
  estado: 'entrada' | 'processamento' | 'concluida' | 'erro';
}

export const PaletizacaoFluxo: React.FC<PaletizacaoFluxoProps> = ({
  ordem_id,
  linhas,
  onCriarPalete,
  onCancelar,
  loading = false,
  erro,
}) => {
  const [paletes, setPaletes] = useState<PaleteEmCriacao[]>([]);
  const [linhaAtual, setLinhaAtual] = useState<ReceivingLine | null>(linhas[0] || null);
  const [qtdCaixas, setQtdCaixas] = useState(0);
  const [qtdUnidades, setQtdUnidades] = useState(0);

  const linhasComRecebimento = linhas.filter(l => l.qtd_recebida_caixas > 0);

  const handleAdicionarPalete = async () => {
    if (!linhaAtual || qtdCaixas <= 0) {
      alert('Selecione linha e quantidade válida');
      return;
    }

    if (qtdCaixas > linhaAtual.qtd_recebida_caixas - linhaAtual.qtd_ja_paletizada_caixas) {
      alert(`Máximo ${linhaAtual.qtd_recebida_caixas - linhaAtual.qtd_ja_paletizada_caixas} caixas disponíveis`);
      return;
    }

    const paleteTemp: PaleteEmCriacao = {
      linha_id: linhaAtual.id,
      quantidade_caixas: qtdCaixas,
      quantidade_unidades: qtdUnidades,
      estado: 'processamento',
    };

    setPaletes([...paletes, paleteTemp]);

    try {
      const sscc = await onCriarPalete(linhaAtual.id, qtdCaixas, qtdUnidades);
      setPaletes(
        paletes.map(p =>
          p === paleteTemp
            ? { ...p, sscc, estado: 'concluida' }
            : p
        )
      );
      setQtdCaixas(0);
      setQtdUnidades(0);
    } catch (err) {
      setPaletes(
        paletes.map(p =>
          p === paleteTemp
            ? { ...p, estado: 'erro' }
            : p
        )
      );
    }
  };

  const handleRemoverPalete = (idx: number) => {
    setPaletes(paletes.filter((_, i) => i !== idx));
  };

  const palesInProgress = paletes.filter(p => p.estado !== 'erro').length;
  const paletesConcluidas = paletes.filter(p => p.estado === 'concluida').length;

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-600" />
          <h3 className="font-semibold text-slate-900">Fluxo Paletização</h3>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          Ordem: {ordem_id.slice(0, 8)}
        </div>
      </div>

      {/* Formulário nova palete */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
        <div className="text-sm font-semibold text-slate-900">Criar Nova Palete</div>

        {/* Linha selector */}
        <select
          value={linhaAtual?.id || ''}
          onChange={(e) => {
            const linha = linhasComRecebimento.find(l => l.id === e.target.value);
            setLinhaAtual(linha || null);
          }}
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          {linhasComRecebimento.map((linha) => {
            const disponivel = linha.qtd_recebida_caixas - linha.qtd_ja_paletizada_caixas;
            return (
              <option key={linha.id} value={linha.id}>
                {linha.artigo_codigo} — {disponivel} cx disponíveis
              </option>
            );
          })}
        </select>

        {/* Quantidades */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Caixas</label>
            <input
              type="number"
              value={qtdCaixas}
              onChange={(e) => setQtdCaixas(parseInt(e.target.value) || 0)}
              min="1"
              max={linhaAtual ? linhaAtual.qtd_recebida_caixas - linhaAtual.qtd_ja_paletizada_caixas : 0}
              className="w-full border border-slate-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Unidades</label>
            <input
              type="number"
              value={qtdUnidades}
              onChange={(e) => setQtdUnidades(parseInt(e.target.value) || 0)}
              min="0"
              className="w-full border border-slate-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {/* Ação */}
        <button
          onClick={handleAdicionarPalete}
          disabled={loading || !linhaAtual || qtdCaixas <= 0}
          className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {loading ? 'A criar…' : 'Adicionar Palete'}
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
          {erro}
        </div>
      )}

      {/* Paletes criadas */}
      <div>
        <div className="text-sm font-semibold text-slate-900 mb-2">
          Paletes ({paletesConcluidas}/{paletes.length})
        </div>
        {paletes.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded">
            Nenhuma palete criada
          </div>
        ) : (
          <div className="space-y-2">
            {paletes.map((palete, idx) => {
              const linha = linhas.find(l => l.id === palete.linha_id);
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-2 p-2 rounded border ${
                    palete.estado === 'concluida'
                      ? 'bg-emerald-50 border-emerald-200'
                      : palete.estado === 'erro'
                      ? 'bg-rose-50 border-rose-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  {palete.estado === 'processamento' && (
                    <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                  )}
                  {palete.estado === 'concluida' && (
                    <Check className="w-4 h-4 text-emerald-600" />
                  )}
                  {palete.estado === 'erro' && (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold text-slate-900">
                      {palete.sscc || `Criando…`}
                    </div>
                    <div className="text-xs text-slate-600">
                      {linha?.artigo_codigo} • {palete.quantidade_caixas} cx
                    </div>
                  </div>

                  {palete.estado !== 'processamento' && (
                    <button
                      onClick={() => handleRemoverPalete(idx)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumo */}
      <div className="flex gap-2 pt-2 border-t border-slate-200">
        <button
          onClick={onCancelar}
          className="flex-1 px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-sm font-semibold transition-colors"
        >
          Cancelar
        </button>
        <button
          disabled={paletesConcluidas === 0}
          className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded text-sm font-semibold transition-colors"
        >
          ✓ Concluir ({paletesConcluidas})
        </button>
      </div>
    </div>
  );
};
