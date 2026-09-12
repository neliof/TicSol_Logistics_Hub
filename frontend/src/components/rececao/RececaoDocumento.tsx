import React, { useState } from 'react';
import { FileText, X, Upload } from 'lucide-react';
import { RecepcaoDocument } from '../../types/rececao';

interface RececaoDocumentoProps {
  isOpen: boolean;
  documento: RecepcaoDocument | null;
  onSave: (tipo: string, numero: string, data: string, url_anexo?: string, observacoes?: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

type DocumentoTipo = 'GUIA_REMESSA' | 'GUIA_TRANSPORTE' | 'FATURA' | 'OUTRO';

export const RececaoDocumento: React.FC<RececaoDocumentoProps> = ({
  isOpen,
  documento,
  onSave,
  onCancel,
  loading = false,
}) => {
  const [tipo, setTipo] = useState<DocumentoTipo>(documento?.tipo || 'GUIA_REMESSA');
  const [numero, setNumero] = useState(documento?.numero || '');
  const [data, setData] = useState(documento?.data || new Date().toISOString().split('T')[0]);
  const [url_anexo, setUrl_anexo] = useState(documento?.url_anexo || '');
  const [observacoes, setObservacoes] = useState(documento?.observacoes || '');
  const [anexoPreview, setAnexoPreview] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setUrl_anexo(base64);
      setAnexoPreview(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    if (!numero.trim()) {
      alert('Número obrigatório');
      return;
    }

    onSave(tipo, numero, data, url_anexo || undefined, observacoes || undefined);
    setTipo('GUIA_REMESSA');
    setNumero('');
    setData(new Date().toISOString().split('T')[0]);
    setUrl_anexo('');
    setObservacoes('');
    setAnexoPreview(null);
  };

  const tipoLabels: Record<DocumentoTipo, string> = {
    GUIA_REMESSA: 'Guia de Remessa',
    GUIA_TRANSPORTE: 'Guia de Transporte',
    FATURA: 'Fatura',
    OUTRO: 'Outro Documento',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">
              {documento ? 'Editar Documento' : 'Registar Documento'}
            </h3>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tipo documento */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de documento</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(tipoLabels) as DocumentoTipo[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  tipo === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {tipoLabels[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Número */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Número do documento</label>
          <input
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: 123456, ST123/2024, FT-2024-001"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Data */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">Data do documento</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Anexo */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">Anexo (PDF/Foto)</label>
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="anexo-upload"
            />
            <label htmlFor="anexo-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-medium text-slate-700">
                {anexoPreview ? `✓ ${anexoPreview}` : 'Clique para upload'}
              </span>
              <span className="text-xs text-slate-500">ou arraste um ficheiro</span>
            </label>
          </div>
        </div>

        {/* Observações */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1">Observações</label>
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            rows={2}
            placeholder="Ex: Documento ilegível em parte, necessita confirmação..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading && <span className="animate-spin">⟳</span>}
            {documento ? 'Atualizar' : 'Registar'}
          </button>
        </div>
      </div>
    </div>
  );
};
