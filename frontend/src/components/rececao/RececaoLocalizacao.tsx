import React, { useState } from 'react';
import { MapPin, X, Grid3x3 } from 'lucide-react';

interface RececaoLocalizacaoProps {
  isOpen: boolean;
  paletaSSCC: string | null;
  onSave: (localizacao: string, observacoes?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

type ZonaArmazem = 'A' | 'B' | 'C' | 'D';
type TipoLocal = 'RACK' | 'PISO' | 'CELA';

export const RececaoLocalizacao: React.FC<RececaoLocalizacaoProps> = ({
  isOpen,
  paletaSSCC,
  onSave,
  onCancel,
  loading = false,
}) => {
  const [zona, setZona] = useState<ZonaArmazem>('A');
  const [tipo, setTipo] = useState<TipoLocal>('RACK');
  const [corredor, setCorredor] = useState(1);
  const [prateleira, setPrateleira] = useState(1);
  const [posicao, setPosicao] = useState(1);
  const [observacoes, setObservacoes] = useState('');

  if (!isOpen || !paletaSSCC) return null;

  const handleSave = () => {
    const localizacao = `${zona}-${tipo}-${corredor}-${prateleira}-${posicao}`;
    onSave(localizacao, observacoes || undefined);
    setZona('A');
    setTipo('RACK');
    setCorredor(1);
    setPrateleira(1);
    setPosicao(1);
    setObservacoes('');
  };

  const previewLocalizacao = `${zona}-${tipo}-${corredor}-${prateleira}-${posicao}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-bold text-slate-900">Definir Localização</h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Palete info */}
        <div className="mb-4 p-3 bg-teal-50 rounded-lg text-sm">
          <div className="font-mono font-bold text-slate-900">SSCC: {paletaSSCC}</div>
          <div className="text-slate-600 text-xs mt-1">Localização: {previewLocalizacao}</div>
        </div>

        {/* Zona armazem */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Zona do armazém</label>
          <div className="grid grid-cols-4 gap-2">
            {(['A', 'B', 'C', 'D'] as ZonaArmazem[]).map((z) => (
              <button
                key={z}
                onClick={() => setZona(z)}
                className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                  zona === z
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>

        {/* Tipo localização */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de localização</label>
          <div className="grid grid-cols-3 gap-2">
            {(['RACK', 'PISO', 'CELA'] as TipoLocal[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  tipo === t
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Coordenadas */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Corredor</label>
            <input
              type="number"
              value={corredor}
              onChange={(e) => setCorredor(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              min="1"
              max="20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Prateleira</label>
            <input
              type="number"
              value={prateleira}
              onChange={(e) => setPrateleira(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              min="1"
              max="10"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Posição</label>
            <input
              type="number"
              value={posicao}
              onChange={(e) => setPosicao(parseInt(e.target.value) || 1)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              min="1"
              max="5"
            />
          </div>
        </div>

        {/* Preview localização */}
        <div className="mb-4 p-3 bg-slate-100 rounded-lg flex items-center gap-2">
          <Grid3x3 className="w-4 h-4 text-slate-600" />
          <span className="font-mono font-bold text-slate-900">{previewLocalizacao}</span>
        </div>

        {/* Observações */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex: Perto de saída, junto a Zona B, etc..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
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
            disabled={loading}
            className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Guardar Localização
          </button>
        </div>
      </div>
    </div>
  );
};
