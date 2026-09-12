import React from 'react';
import { Calendar } from 'lucide-react';

interface SyncDocumentsModalProps {
  isOpen: boolean;
  isLoading: boolean;
  seriesLabel: string;
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (value: string) => void;
  onDataFimChange: (value: string) => void;
  onSync: () => void;
  onClose: () => void;
}

export const SyncDocumentsModal: React.FC<SyncDocumentsModalProps> = ({
  isOpen,
  isLoading,
  seriesLabel,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  onSync,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Sincronizar Documentos
        </h3>
        <p className="text-sm text-slate-600 mb-6">
          {seriesLabel ? `Sincroniza: ${seriesLabel}` : 'Sincroniza documentos'} com intervalo de datas (opcional).
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data Início (opcional)
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => onDataInicioChange(e.target.value)}
              disabled={isLoading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Data Fim (opcional)
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => onDataFimChange(e.target.value)}
              disabled={isLoading}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onSync}
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sincronizando...
              </>
            ) : (
              'Sincronizar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
