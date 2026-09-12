import React, { useState } from 'react';
import { Database, AlertCircle, CheckCircle2, TrendingDown } from 'lucide-react';
import { EmptyState } from '../EmptyState';

interface ItemReconciliacao {
  artigo_codigo: string;
  artigo_descricao: string;
  quantidade_esperada: number;
  quantidade_sistema: number;
  quantidade_fisica: number;
  diferenca: number;
  divergencia_percentual: number;
  status: 'OK' | 'ALERTA' | 'ERRO';
  lotes?: string[];
}

interface StockReconciliacaoProps {
  recepcao_id: string;
  items: ItemReconciliacao[];
  onAtualizarFisico: (artigo_codigo: string, quantidade: number) => void;
  onValidar: () => Promise<boolean>;
  loading?: boolean;
}

export const StockReconciliacao: React.FC<StockReconciliacaoProps> = ({
  recepcao_id,
  items,
  onAtualizarFisico,
  onValidar,
  loading = false,
}) => {
  const [editandoArtigo, setEditandoArtigo] = useState<string | null>(null);
  const [qtdFisicaTemp, setQtdFisicaTemp] = useState(0);

  if (items.length === 0) {
    return (
      <div className="border border-slate-200 rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Reconciliação Stock</h3>
        </div>
        <EmptyState
          icon={Database}
          title="Sem items para reconciliar"
          description="Adicione items à receção"
          compact
        />
      </div>
    );
  }

  const totalEsperado = items.reduce((sum, i) => sum + i.quantidade_esperada, 0);
  const totalSistema = items.reduce((sum, i) => sum + i.quantidade_sistema, 0);
  const totalFisico = items.reduce((sum, i) => sum + i.quantidade_fisica, 0);
  const totalDiferenca = totalFisico - totalEsperado;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OK':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'ALERTA':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
      case 'ERRO':
        return <AlertCircle className="w-4 h-4 text-rose-600" />;
      default:
        return null;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'OK':
        return 'bg-emerald-50 border-emerald-200';
      case 'ALERTA':
        return 'bg-amber-50 border-amber-200';
      case 'ERRO':
        return 'bg-rose-50 border-rose-200';
      default:
        return 'bg-slate-50 border-slate-200';
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Reconciliação Stock</h3>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          Receção: {recepcao_id.slice(0, 8)}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-4 gap-2 p-3 bg-slate-100 rounded text-xs">
        <div>
          <div className="text-slate-600 font-medium">Esperado</div>
          <div className="font-bold text-slate-900">{totalEsperado}</div>
        </div>
        <div>
          <div className="text-slate-600 font-medium">Sistema</div>
          <div className="font-bold text-slate-900">{totalSistema}</div>
        </div>
        <div>
          <div className="text-slate-600 font-medium">Físico</div>
          <div className="font-bold text-slate-900">{totalFisico}</div>
        </div>
        <div>
          <div className={`text-slate-600 font-medium ${totalDiferenca !== 0 ? 'text-amber-700' : ''}`}>
            Diferença
          </div>
          <div className={`font-bold ${totalDiferenca === 0 ? 'text-emerald-600' : 'text-amber-700'}`}>
            {totalDiferenca > 0 ? '+' : ''}{totalDiferenca}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.artigo_codigo}
            className={`border rounded-lg p-3 ${getStatusBg(item.status)}`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(item.status)}
                  <span className="font-mono font-bold text-sm text-slate-900">
                    {item.artigo_codigo}
                  </span>
                </div>
                <div className="text-xs text-slate-600 truncate">{item.artigo_descricao}</div>
              </div>
              <div className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                {Math.abs(item.divergencia_percentual).toFixed(1)}% diff
              </div>
            </div>

            {/* Quantidades */}
            <div className="grid grid-cols-3 gap-2 mb-2 text-xs">
              <div className="bg-white bg-opacity-50 px-2 py-1 rounded">
                <div className="text-slate-600 font-medium">Esperado</div>
                <div className="font-mono font-bold text-slate-900">{item.quantidade_esperada}</div>
              </div>
              <div className="bg-white bg-opacity-50 px-2 py-1 rounded">
                <div className="text-slate-600 font-medium">Sistema</div>
                <div className="font-mono font-bold text-slate-900">{item.quantidade_sistema}</div>
              </div>
              <div className="bg-white bg-opacity-50 px-2 py-1 rounded">
                <div className="text-slate-600 font-medium">Físico</div>
                {editandoArtigo === item.artigo_codigo ? (
                  <input
                    type="number"
                    value={qtdFisicaTemp}
                    onChange={(e) => setQtdFisicaTemp(parseInt(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded px-1 py-0.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                ) : (
                  <div
                    className="font-mono font-bold text-slate-900 cursor-pointer hover:bg-blue-100 px-1 py-0.5 rounded"
                    onClick={() => {
                      setEditandoArtigo(item.artigo_codigo);
                      setQtdFisicaTemp(item.quantidade_fisica);
                    }}
                  >
                    {item.quantidade_fisica}
                  </div>
                )}
              </div>
            </div>

            {/* Ações edição */}
            {editandoArtigo === item.artigo_codigo && (
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    onAtualizarFisico(item.artigo_codigo, qtdFisicaTemp);
                    setEditandoArtigo(null);
                  }}
                  className="flex-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold"
                >
                  ✓ Guardar
                </button>
                <button
                  onClick={() => setEditandoArtigo(null)}
                  className="flex-1 px-2 py-1 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Lotes */}
            {item.lotes && item.lotes.length > 0 && (
              <div className="mt-2 pt-2 border-t border-white border-opacity-50 text-xs text-slate-600">
                Lotes: {item.lotes.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Ação validar */}
      <button
        onClick={onValidar}
        disabled={loading}
        className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded text-sm font-semibold transition-colors flex items-center justify-center gap-2"
      >
        <CheckCircle2 className="w-4 h-4" />
        {loading ? 'A validar…' : '✓ Validar Reconciliação'}
      </button>
    </div>
  );
};
