import React, { useState } from 'react';
import { FileText, Download, Check, X } from 'lucide-react';

interface DocumentoExpedicao {
  id: string;
  tipo: 'GUIA_TRANSPORTE' | 'FATURA' | 'FACTURA_RECIBO' | 'ETIQUETA';
  numero: string;
  serie: string;
  data_emissao: string;
  data_pagamento?: string;
  estado: 'RASCUNHO' | 'EMITIDA' | 'PAGA' | 'CANCELADA';
  valor_total?: number;
  moeda?: string;
  url_download?: string;
  operador?: string;
}

interface ExpedicaoFaturacaoProps {
  numero_guia: string;
  documentos: DocumentoExpedicao[];
  onEmitir: (tipo: string) => Promise<void>;
  onDownload: (id: string) => void;
  loading?: boolean;
}

export const ExpedicaoFaturacao: React.FC<ExpedicaoFaturacaoProps> = ({
  numero_guia,
  documentos,
  onEmitir,
  onDownload,
  loading = false,
}) => {
  const getEstadoBg = (estado: string) => {
    switch (estado) {
      case 'RASCUNHO':
        return 'bg-slate-100 text-slate-700';
      case 'EMITIDA':
        return 'bg-blue-100 text-blue-700';
      case 'PAGA':
        return 'bg-emerald-100 text-emerald-700';
      case 'CANCELADA':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case 'GUIA_TRANSPORTE':
        return 'Guia Transporte';
      case 'FATURA':
        return 'Fatura';
      case 'FACTURA_RECIBO':
        return 'Factura-Recibo';
      case 'ETIQUETA':
        return 'Etiqueta';
      default:
        return tipo;
    }
  };

  const tiposDisponiveis = [
    'GUIA_TRANSPORTE',
    'FATURA',
    'FACTURA_RECIBO',
    'ETIQUETA',
  ];
  const tiposFaltantes = tiposDisponiveis.filter(
    tipo => !documentos.some(d => d.tipo === tipo)
  );

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-600" />
          <h3 className="font-semibold text-slate-900">Faturação</h3>
        </div>
        <div className="text-xs font-semibold text-slate-600">
          Guia: {numero_guia}
        </div>
      </div>

      {/* Documentos */}
      <div className="space-y-2">
        {documentos.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded">
            Nenhum documento emitido
          </div>
        ) : (
          documentos.map((doc) => (
            <div
              key={doc.id}
              className={`flex items-center justify-between gap-2 p-3 rounded border ${getEstadoBg(doc.estado)}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <FileText className="w-4 h-4" />
                  <span className="font-semibold text-sm">
                    {getTipoLabel(doc.tipo)}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-white bg-opacity-50 rounded font-mono">
                    {doc.numero}
                  </span>
                </div>
                <div className="text-xs text-current text-opacity-70">
                  {doc.serie} • {new Date(doc.data_emissao).toLocaleDateString('pt-PT')}
                  {doc.valor_total && ` • ${doc.valor_total.toFixed(2)} ${doc.moeda || 'EUR'}`}
                </div>
              </div>

              <div className="flex items-center gap-1">
                {doc.url_download && (
                  <button
                    onClick={() => onDownload(doc.id)}
                    className="p-2 hover:bg-white hover:bg-opacity-50 rounded transition-colors"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Emitir documentos */}
      {tiposFaltantes.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            Documentos a emitir:
          </div>
          <div className="space-y-1 mb-2">
            {tiposFaltantes.map((tipo) => (
              <div key={tipo} className="text-xs text-slate-600">
                • {getTipoLabel(tipo)}
              </div>
            ))}
          </div>
          <button
            onClick={() => onEmitir('GUIA_TRANSPORTE')}
            disabled={loading}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded text-sm font-semibold transition-colors"
          >
            {loading ? 'A emitir…' : '+ Emitir Documentos'}
          </button>
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-100 rounded text-xs">
        <div className="text-center">
          <div className="font-bold text-slate-900">{documentos.length}</div>
          <div className="text-slate-600">Emitidos</div>
        </div>
        <div className="text-center">
          <div className="font-bold text-slate-900">
            {documentos.filter(d => d.estado === 'PAGA').length}
          </div>
          <div className="text-slate-600">Pagos</div>
        </div>
      </div>
    </div>
  );
};
