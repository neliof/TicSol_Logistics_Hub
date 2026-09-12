import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ReceivingLine } from '../../types/wms';

interface RececaoDivergenciasProps {
  isOpen: boolean;
  linha: ReceivingLine | null;
  onSave: (tipo: string, quantidade: number, motivo: string, impacto: string) => void;
  onCancel: () => void;
}

type DivergenciaTipo = 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'NAO_ENCOMENDADO' | 'QUALIDADE';

export const RececaoDivergencias: React.FC<RececaoDivergenciasProps> = ({
  isOpen,
  linha,
  onSave,
  onCancel,
}) => {
  const [tipo, setTipo] = useState<DivergenciaTipo>('FALTA');
  const [quantidade, setQuantidade] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [impacto, setImpacto] = useState<'ACEITAR' | 'REJEITAR' | 'REVISAR'>('REVISAR');

  if (!isOpen || !linha) return null;

  const handleSave = () => {
    if (!motivo.trim()) {
      alert('Motivo obrigatório');
      return;
    }

    onSave(tipo, quantidade, motivo, impacto);
    setTipo('FALTA');
    setQuantidade(0);
    setMotivo('');
    setImpacto('REVISAR');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <h3 className="text-lg font-bold text-slate-900">Registar Divergência</h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Artigo info */}
        <div className="mb-4 p-3 bg-slate-50 rounded-lg text-sm">
          <div className="font-mono font-bold text-slate-900">{linha.artigo_codigo}</div>
          <div className="text-slate-600 text-xs mt-1">{linha.artigo_descricao}</div>
          <div className="text-slate-500 text-xs mt-1">
            Encomendado: {linha.qtd_esperada_caixas} | Recebido: {linha.qtd_recebida_caixas}
          </div>
        </div>

        {/* Tipo divergência */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de divergência</label>
          <div className="grid grid-cols-2 gap-2">
            {(['FALTA', 'EXCESSO', 'DANIFICADO', 'NAO_ENCOMENDADO', 'QUALIDADE'] as DivergenciaTipo[]).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                    tipo === t
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {t === 'NAO_ENCOMENDADO' ? 'Não encomendado' : t}
                </button>
              )
            )}
          </div>
        </div>

        {/* Quantidade */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade</label>
          <input
            type="number"
            value={quantidade}
            onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
            min="0"
          />
        </div>

        {/* Motivo */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Motivo</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Ex: Caixas danificadas no transporte, artigo fora de validade..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        {/* Impacto entrada Artsoft */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Impacto na entrada Artsoft
          </label>
          <div className="space-y-2">
            {(['ACEITAR', 'REVISAR', 'REJEITAR'] as const).map((i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="impacto"
                  value={i}
                  checked={impacto === i}
                  onChange={(e) => setImpacto(e.target.value as typeof impacto)}
                  className="w-4 h-4 accent-rose-600"
                />
                <span className="text-sm text-slate-700">
                  {i === 'ACEITAR'
                    ? 'Aceitar na entrada'
                    : i === 'REVISAR'
                      ? 'Aguardar revisão (padrão)'
                      : 'Rejeitar'}
                </span>
              </label>
            ))}
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
            className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Registar Divergência
          </button>
        </div>
      </div>
    </div>
  );
};
