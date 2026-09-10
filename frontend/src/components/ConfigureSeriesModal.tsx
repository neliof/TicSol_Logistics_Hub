import React, { useState } from 'react';
import { X, RefreshCw, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useSeriesConfig } from '../hooks/useSeriesConfig';

interface ConfigureSeriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type SeriesWithType = {
  code: string;
  type: 'Entrada' | 'Saida' | 'Venda' | 'Encomenda_Cliente' | 'Encomenda_Fornecedor' | 'Outro';
  typeName: string;
  docNome?: string;
};

const typeOrder = ['Entrada', 'Saida', 'Venda', 'Encomenda_Cliente', 'Encomenda_Fornecedor', 'Outro'];

export const ConfigureSeriesModal: React.FC<ConfigureSeriesModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [availableSeries, setAvailableSeries] = useState<SeriesWithType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Module tabs
  const [activeModule, setActiveModule] = useState<'receção' | 'expedição'>('receção');
  const receçãoConfig = useSeriesConfig('receção');
  const expedicãoConfig = useSeriesConfig('expedição');

  const activeConfig = activeModule === 'receção' ? receçãoConfig : expedicãoConfig;

  const discoverSeries = async () => {
    try {
      setDiscovering(true);
      setError(null);
      setInfoMessage(null);
      const response = await api.discover_artsoft_series();
      setAvailableSeries(response.series || []);
      if (response.series.length === 0) {
        setError('Nenhuma série descoberta. Introduz manualmente abaixo.');
      } else if (response.message) {
        setInfoMessage(response.message);
      }
    } catch (err) {
      setError(`Erro ao descobrir séries: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      setAvailableSeries([]);
    } finally {
      setDiscovering(false);
    }
  };

  const groupSeriesByType = (series: SeriesWithType[]) => {
    const grouped: Record<string, SeriesWithType[]> = {};
    for (const s of series) {
      if (!grouped[s.type]) grouped[s.type] = [];
      grouped[s.type].push(s);
    }
    return typeOrder.filter(t => grouped[t]).map(t => ({ type: t, series: grouped[t] }));
  };

  const handleToggleSerie = (code: string) => {
    const current = activeConfig.modulo === 'receção' ? activeConfig.receção : activeConfig.expedição;
    if (current.includes(code)) {
      if (activeModule === 'receção') {
        activeConfig.setReceção(current.filter(s => s !== code));
      } else {
        activeConfig.setExpedição(current.filter(s => s !== code));
      }
    } else {
      if (activeModule === 'receção') {
        activeConfig.setReceção([...current, code]);
      } else {
        activeConfig.setExpedição([...current, code]);
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await receçãoConfig.save();
      await expedicãoConfig.save();
      setSuccess('Configuração guardada com sucesso.');
      setTimeout(() => {
        setSuccess(null);
        onSaved?.();
      }, 2000);
    } catch (err) {
      setError(`Erro ao guardar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTestData = async () => {
    if (!confirm('Isto vai apagar TODOS os documentos de teste. Continua?')) {
      return;
    }
    try {
      setDeleting(true);
      setError(null);
      const result = await api.deleteTestData();
      setSuccess(`Dados de teste apagados: ${result.deleted.documentos} documentos.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(`Erro ao apagar dados: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  const grouped = groupSeriesByType(availableSeries);
  const current = activeModule === 'receção' ? activeConfig.receção : activeConfig.expedição;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Configurar Séries de Documentos</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Module Selector */}
          <div className="flex gap-2 border-b border-slate-200 pb-3">
            <button
              onClick={() => setActiveModule('receção')}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                activeModule === 'receção'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Receção
            </button>
            <button
              onClick={() => setActiveModule('expedição')}
              className={`px-3 py-2 rounded text-sm font-medium transition ${
                activeModule === 'expedição'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Expedição
            </button>
          </div>

          {/* Discovery Button */}
          <button
            onClick={discoverSeries}
            disabled={discovering}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 flex items-center justify-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${discovering ? 'animate-spin' : ''}`} />
            {discovering ? 'A descobrir…' : 'Descobrir séries'}
          </button>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Message */}
          {infoMessage && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-2 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Available Series by Type */}
          <div className="space-y-3">
            <div className="text-sm font-semibold text-slate-700">Séries disponíveis ({activeModule}):</div>
            {grouped.length > 0 ? (
              grouped.map(group => (
                <div key={group.type} className="space-y-1.5">
                  <div className="text-xs font-bold text-slate-600 px-2 py-1 bg-slate-100 rounded">
                    {group.series[0].typeName}
                  </div>
                  <div className="grid grid-cols-1 gap-2 ml-2">
                    {group.series.map(s => (
                      <label key={s.code} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={current.includes(s.code)}
                          onChange={() => handleToggleSerie(s.code)}
                          className="rounded border-slate-300"
                        />
                        <div className="text-sm text-slate-700">
                          <span className="font-mono font-semibold">{s.code}</span>
                          {s.docNome && <span className="text-slate-600 ml-2">— {s.docNome}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Nenhuma série disponível. Clica em "Descobrir séries" primeiro.</p>
            )}
          </div>

          {/* Selected Series */}
          {current.length > 0 && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs font-semibold text-blue-900 mb-2">Séries selecionadas para {activeModule}:</div>
              <div className="flex flex-wrap gap-2">
                {current.sort().map(code => (
                  <span key={code} className="bg-blue-200 text-blue-900 text-xs px-2 py-1 rounded font-mono">
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:bg-green-400"
            >
              {saving ? 'A guardar…' : 'Guardar Configuração'}
            </button>
            <button
              onClick={handleDeleteTestData}
              disabled={deleting}
              className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 disabled:bg-red-400 flex items-center gap-2"
              title="Apagar todos os documentos/artigos/clientes de teste"
            >
              <Trash2 className="w-4 h-4" />
              {deleting ? '…' : 'Apagar teste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
