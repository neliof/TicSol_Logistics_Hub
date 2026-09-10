import React, { useState } from 'react';
import { X, Scan, Keyboard, Sparkles, Check, AlertCircle } from 'lucide-react';

interface BarcodeScannerModalProps {
  onScan: (barcodeValue: string) => void;
  onClose: () => void;
  title?: string;
  suggestedBarcodes?: { label: string; code: string; type: string }[];
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  onScan,
  onClose,
  title = 'Simulador de Leitor de Código de Barras / SSCC',
  suggestedBarcodes = [
    { label: 'Azeite Oliveira da Serra (EAN-13)', code: '5601234567890', type: 'EAN' },
    { label: 'Leite Mimosa UHT (EAN-13)', code: '5602345678901', type: 'EAN' },
    { label: 'Palete SSCC Azeite Sonae', code: '356012340000008411', type: 'SSCC' },
    { label: 'Localização Prateleira A-01-02-3', code: 'A-01-02-3', type: 'LOC' }
  ]
}) => {
  const [inputVal, setInputVal] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) {
      setErrorMsg('Por favor insira ou escolha um código de barras.');
      return;
    }
    onScan(inputVal.trim());
    onClose();
  };

  const handleQuickClick = (code: string) => {
    onScan(code);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="relative bg-white border border-slate-200 rounded-xl shadow-2xl max-w-lg w-full p-6 text-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
              <Scan className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="text-xs text-slate-500">PDA Terminal • Suporta EAN-13, GS1-128 e SSCC-18</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Laser Scanner Animation Viewfinder */}
        <div className="relative h-32 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden flex flex-col items-center justify-center mb-5">
          <div className="absolute inset-x-0 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-laser" />
          <Scan className="w-10 h-10 text-slate-600 animate-pulse" />
          <span className="text-xs font-mono text-slate-400 mt-2">Apontar o laser para o código EAN / GS1</span>
        </div>

        {/* Manual Code Input Form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Inserção Manual / Leitura Laser HID
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                autoFocus
                value={inputVal}
                onChange={(e) => {
                  setInputVal(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="Ex: 5601234567890 ou SSCC..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <Keyboard className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm transition-colors flex items-center gap-1 cursor-pointer shadow-sm"
            >
              <Check className="w-4 h-4 text-amber-400" />
              Validar
            </button>
          </div>
          {errorMsg && (
            <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {errorMsg}
            </p>
          )}
        </form>

        {/* Suggested Quick Barcodes */}
        <div>
          <span className="text-xs font-semibold text-slate-500 block mb-2 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            Atalhos para Teste em Tempo Real
          </span>
          <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
            {suggestedBarcodes.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQuickClick(item.code)}
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-lg text-left transition-all group cursor-pointer"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-800 block group-hover:text-blue-700">
                    {item.label}
                  </span>
                  <span className="text-[11px] font-mono text-slate-500">{item.code}</span>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-200 group-hover:bg-blue-100 text-slate-700 group-hover:text-blue-800 rounded">
                  {item.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
