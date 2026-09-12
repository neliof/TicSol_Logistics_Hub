import React, { useState } from 'react';
import { Edit3, Plus, Minus, Copy, Trash2, Save, X } from 'lucide-react';

interface PaletItem {
  linha_id: string;
  artigo_codigo: string;
  quantidade_caixas: number;
  quantidade_unidades: number;
  lote?: string;
  validade?: string;
}

interface PaletizacaoGestaoProps {
  sscc: string;
  items: PaletItem[];
  onAdicionar: (item: PaletItem) => void;
  onRemover: (linhaId: string) => void;
  onAtualizar: (items: PaletItem[]) => void;
  onDividir: (novoSSCC: string, itemsMudar: PaletItem[]) => void;
  loading?: boolean;
}

export const PaletizacaoGestao: React.FC<PaletizacaoGestaoProps> = ({
  sscc,
  items,
  onAdicionar,
  onRemover,
  onAtualizar,
  onDividir,
  loading = false,
}) => {
  const [modo, setModo] = useState<'visualizar' | 'editar' | 'adicionar' | 'dividir'>('visualizar');
  const [itemEdit, setItemEdit] = useState<PaletItem | null>(null);
  const [novoItem, setNovoItem] = useState<Partial<PaletItem>>({});
  const [selecionados, setSelecionados] = useState<string[]>([]);

  const handleSalvarEdicao = () => {
    if (itemEdit) {
      const updated = items.map(i => (i.linha_id === itemEdit.linha_id ? itemEdit : i));
      onAtualizar(updated);
      setItemEdit(null);
      setModo('visualizar');
    }
  };

  const handleAdicionarItem = () => {
    if (novoItem.artigo_codigo && novoItem.quantidade_caixas) {
      onAdicionar(novoItem as PaletItem);
      setNovoItem({});
      setModo('visualizar');
    }
  };

  const handleDividir = () => {
    if (selecionados.length === 0) {
      alert('Selecione items para dividir');
      return;
    }
    const itemsMudar = items.filter(i => selecionados.includes(i.linha_id));
    const novoSSCC = `${sscc.substring(0, 10)}-DIV`;
    onDividir(novoSSCC, itemsMudar);
    setSelecionados([]);
    setModo('visualizar');
  };

  const totalCaixas = items.reduce((sum, i) => sum + i.quantidade_caixas, 0);
  const totalUnidades = items.reduce((sum, i) => sum + i.quantidade_unidades, 0);

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono font-bold text-sm text-slate-900">{sscc}</div>
          <div className="text-xs text-slate-600 mt-1">
            {items.length} items • {totalCaixas} cx • {totalUnidades} un
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setModo('editar')}
            disabled={items.length === 0 || modo !== 'visualizar'}
            className="px-2 py-1 bg-blue-100 hover:bg-blue-200 disabled:bg-slate-100 text-blue-700 disabled:text-slate-400 rounded text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3" />
            Editar
          </button>
          <button
            onClick={() => setModo('adicionar')}
            disabled={modo !== 'visualizar'}
            className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 disabled:bg-slate-100 text-emerald-700 disabled:text-slate-400 rounded text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Item
          </button>
          <button
            onClick={() => setModo('dividir')}
            disabled={items.length < 2 || modo !== 'visualizar'}
            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 disabled:bg-slate-100 text-amber-700 disabled:text-slate-400 rounded text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <Copy className="w-3 h-3" />
            Dividir
          </button>
        </div>
      </div>

      {/* Modo visualizar — Lista items */}
      {modo === 'visualizar' && (
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded">
              Sem items nesta palete
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.linha_id}
                className="flex items-center justify-between gap-2 p-2 bg-slate-50 border border-slate-200 rounded"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-sm text-slate-900">
                    {item.artigo_codigo}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {item.quantidade_caixas} cx {item.quantidade_unidades > 0 && `+ ${item.quantidade_unidades} un`}
                  </div>
                  {item.lote && (
                    <div className="text-xs text-slate-500">
                      Lote: {item.lote} (val: {item.validade})
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onRemover(item.linha_id)}
                  className="text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modo editar */}
      {modo === 'editar' && (
        <div className="space-y-2 p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="text-sm font-semibold text-slate-900 mb-2">Editar Items</div>
          {items.map((item) => (
            <div key={item.linha_id} className="space-y-1 p-2 bg-white rounded border border-slate-200">
              <div className="font-mono text-xs font-bold text-slate-900">{item.artigo_codigo}</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">Caixas</label>
                  <input
                    type="number"
                    value={item.quantidade_caixas}
                    onChange={(e) => {
                      const updated = {
                        ...item,
                        quantidade_caixas: parseInt(e.target.value) || 0,
                      };
                      const newItems = items.map(i =>
                        i.linha_id === item.linha_id ? updated : i
                      );
                      onAtualizar(newItems);
                    }}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-0.5">Unidades</label>
                  <input
                    type="number"
                    value={item.quantidade_unidades}
                    onChange={(e) => {
                      const updated = {
                        ...item,
                        quantidade_unidades: parseInt(e.target.value) || 0,
                      };
                      const newItems = items.map(i =>
                        i.linha_id === item.linha_id ? updated : i
                      );
                      onAtualizar(newItems);
                    }}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            onClick={() => setModo('visualizar')}
            className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
          >
            ✓ Guardar Alterações
          </button>
        </div>
      )}

      {/* Modo adicionar */}
      {modo === 'adicionar' && (
        <div className="space-y-2 p-3 bg-emerald-50 border border-emerald-200 rounded">
          <div className="text-sm font-semibold text-slate-900 mb-2">Adicionar Item</div>
          <input
            type="text"
            placeholder="Código artigo"
            value={novoItem.artigo_codigo || ''}
            onChange={(e) =>
              setNovoItem({ ...novoItem, artigo_codigo: e.target.value })
            }
            className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Caixas"
              value={novoItem.quantidade_caixas || 0}
              onChange={(e) =>
                setNovoItem({
                  ...novoItem,
                  quantidade_caixas: parseInt(e.target.value) || 0,
                })
              }
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              min="0"
            />
            <input
              type="number"
              placeholder="Unidades"
              value={novoItem.quantidade_unidades || 0}
              onChange={(e) =>
                setNovoItem({
                  ...novoItem,
                  quantidade_unidades: parseInt(e.target.value) || 0,
                })
              }
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              min="0"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdicionarItem}
              disabled={!novoItem.artigo_codigo || !novoItem.quantidade_caixas}
              className="flex-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded text-xs font-semibold"
            >
              Adicionar
            </button>
            <button
              onClick={() => setModo('visualizar')}
              className="flex-1 px-2 py-1 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Modo dividir */}
      {modo === 'dividir' && (
        <div className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded">
          <div className="text-sm font-semibold text-slate-900 mb-2">Selecione items para mover</div>
          {items.map((item) => (
            <label
              key={item.linha_id}
              className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded cursor-pointer hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selecionados.includes(item.linha_id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelecionados([...selecionados, item.linha_id]);
                  } else {
                    setSelecionados(selecionados.filter(id => id !== item.linha_id));
                  }
                }}
                className="w-4 h-4 accent-amber-600"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-bold text-slate-900">{item.artigo_codigo}</div>
                <div className="text-xs text-slate-600">{item.quantidade_caixas} cx</div>
              </div>
            </label>
          ))}
          <div className="flex gap-2">
            <button
              onClick={handleDividir}
              disabled={selecionados.length === 0}
              className="flex-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white rounded text-xs font-semibold"
            >
              Dividir
            </button>
            <button
              onClick={() => {
                setModo('visualizar');
                setSelecionados([]);
              }}
              className="flex-1 px-2 py-1 bg-slate-300 hover:bg-slate-400 text-slate-700 rounded text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
