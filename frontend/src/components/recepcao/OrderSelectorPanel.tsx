import React, { useState } from 'react';
import { ReceivingOrder } from '../../types/wms';

interface OrderSelectorPanelProps {
  orders: ReceivingOrder[];
  selectedOrderId: string;
  selectedLineId: string;
  onSelectOrder: (orderId: string) => void;
  onSelectLine: (lineId: string) => void;
}

export const OrderSelectorPanel: React.FC<OrderSelectorPanelProps> = ({
  orders,
  selectedOrderId,
  selectedLineId,
  onSelectOrder,
  onSelectLine,
}) => {
  const [filterText, setFilterText] = useState('');
  const selectedOrder = orders.find(o => o.id === selectedOrderId) || orders[0];

  const ordersFiltered = orders.filter(o =>
    o.numero_guia.toLowerCase().includes(filterText.toLowerCase()) ||
    o.fornecedor_nome.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div>
        <label className="text-slate-700 block mb-2 font-medium text-sm">1. Selecionar Encomenda de Receção</label>
        <input
          type="text"
          placeholder="Procura…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded p-2 text-xs mb-2 focus:outline-none focus:border-purple-500"
        />
        <div className="border border-slate-300 rounded bg-white max-h-40 overflow-y-auto p-1">
          {ordersFiltered.length === 0 ? (
            <div className="p-2 text-center text-xs text-slate-500">Nenhuma encomenda</div>
          ) : (
            <div className="space-y-1">
              {ordersFiltered.map(o => (
                <button
                  key={o.id}
                  onClick={() => {
                    onSelectOrder(o.id);
                    if (o.linhas.length > 0) onSelectLine(o.linhas[0].id);
                  }}
                  className={`w-full text-left p-2 rounded text-xs border transition-all ${
                    selectedOrderId === o.id
                      ? 'bg-purple-50 border-purple-400'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold text-purple-700">{o.numero_guia}</div>
                  <div className="text-slate-600 text-[11px]">{o.fornecedor_nome}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedOrder && selectedOrder.linhas.length > 0 && (
        <div>
          <label className="text-slate-700 block mb-2 font-medium text-sm">Linha de Produto</label>
          <select
            value={selectedLineId}
            onChange={(e) => onSelectLine(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-purple-700 font-bold focus:outline-none focus:border-purple-500"
          >
            {selectedOrder.linhas.map(l => (
              <option key={l.id} value={l.id}>
                {l.artigo_codigo} - {(l.artigo_descricao || '').slice(0, 30)}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};
