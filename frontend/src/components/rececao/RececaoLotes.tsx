import React, { useState } from 'react';
import { Package, Plus, X, Trash2 } from 'lucide-react';
import { LoteRegistado } from '../../types/rececao';
import { ReceivingLine } from '../../types/wms';

interface RececaoLotesProps {
  isOpen: boolean;
  linha: ReceivingLine | null;
  lotes: LoteRegistado[];
  onSave: (novosLotes: LoteRegistado[]) => void;
  onCancel: () => void;
}

export const RececaoLotes: React.FC<RececaoLotesProps> = ({
  isOpen,
  linha,
  lotes,
  onSave,
  onCancel,
}) => {
  const [lotesTemp, setLotesTemp] = useState<LoteRegistado[]>(lotes);
  const [novoLote, setNovoLote] = useState('');
  const [novaQtd, setNovaQtd] = useState(0);
  const [novaValidade, setNovaValidade] = useState('');
  const [novaVidaUtil, setNovaVidaUtil] = useState(0);

  if (!isOpen || !linha) return null;

  const handleAddLote = () => {
    if (!novoLote.trim() || novaQtd <= 0 || !novaValidade) {
      alert('Lote, quantidade e validade obrigatórios');
      return;
    }

    const loteObj: LoteRegistado = {
      linha_id: linha.id,
      lote: novoLote,
      quantidade: novaQtd,
      data_validade: novaValidade,
      vida_util_dias: novaVidaUtil || undefined,
    };

    setLotesTemp([...lotesTemp, loteObj]);
    setNovoLote('');
    setNovaQtd(0);
    setNovaValidade('');
    setNovaVidaUtil(0);
  };

  const handleRemoveLote = (index: number) => {
    setLotesTemp(lotesTemp.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (lotesTemp.length === 0) {
      alert('Adicione pelo menos um lote');
      return;
    }

    const totalQtd = lotesTemp.reduce((sum, l) => sum + l.quantidade, 0);
    if (totalQtd !== linha.qtd_recebida_caixas) {
      alert(
        `Total de lotes (${totalQtd}) não corresponde ao recebido (${linha.qtd_recebida_caixas})`
      );
      return;
    }

    onSave(lotesTemp);
    setLotesTemp([]);
  };

  const totalQtd = lotesTemp.reduce((sum, l) => sum + l.quantidade, 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            <h3 className="text-lg font-bold text-slate-900">Registar Lotes</h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Artigo info */}
        <div className="mb-4 p-3 bg-purple-50 rounded-lg text-sm">
          <div className="font-mono font-bold text-slate-900">{linha.artigo_codigo}</div>
          <div className="text-slate-600 text-xs mt-1">{linha.artigo_descricao}</div>
          <div className="text-slate-600 text-xs mt-1">
            Recebido: {linha.qtd_recebida_caixas} caixas
          </div>
        </div>

        {/* Formulário novo lote */}
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Lote</label>
              <input
                type="text"
                value={novoLote}
                onChange={(e) => setNovoLote(e.target.value)}
                placeholder="Ex: LOT-2024-001"
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quantidade</label>
              <input
                type="number"
                value={novaQtd}
                onChange={(e) => setNovaQtd(parseInt(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Validade</label>
              <input
                type="date"
                value={novaValidade}
                onChange={(e) => setNovaValidade(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Vida útil (dias)</label>
              <input
                type="number"
                value={novaVidaUtil}
                onChange={(e) => setNovaVidaUtil(parseInt(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                min="0"
              />
            </div>
          </div>
          <button
            onClick={handleAddLote}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar Lote
          </button>
        </div>

        {/* Lotes adicionados */}
        <div className="mb-6">
          <div className="text-sm font-semibold text-slate-900 mb-3">
            Lotes registados ({lotesTemp.length})
          </div>
          {lotesTemp.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-6 bg-slate-50 rounded">
              Nenhum lote registado
            </div>
          ) : (
            <div className="space-y-2">
              {lotesTemp.map((lote, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono font-bold text-sm text-slate-900">{lote.lote}</div>
                    <div className="text-xs text-slate-600 mt-1">
                      Qtd: {lote.quantidade} | Validade: {lote.data_validade}
                      {lote.vida_util_dias && ` (${lote.vida_util_dias} dias)`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveLote(idx)}
                    className="text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900">Total de lotes:</span>
            <span className={`font-bold ${totalQtd === linha.qtd_recebida_caixas ? 'text-emerald-600' : 'text-rose-600'}`}>
              {totalQtd} / {linha.qtd_recebida_caixas}
            </span>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={lotesTemp.length === 0}
            className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Guardar Lotes
          </button>
        </div>
      </div>
    </div>
  );
};
