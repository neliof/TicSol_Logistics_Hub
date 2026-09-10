import React, { useState } from 'react';
import { RuleConfig } from '../types/wms';
import { Sliders, ShieldCheck, Save, Building2, CheckCircle2 } from 'lucide-react';

interface RegrasEngineModuleProps {
  rules: RuleConfig[];
  onUpdateRule: (updatedRule: RuleConfig) => void;
}

export const RegrasEngineModule: React.FC<RegrasEngineModuleProps> = ({
  rules,
  onUpdateRule
}) => {
  const [selectedRuleId, setSelectedRuleId] = useState<string>(rules[0]?.cliente_id || 'SONAE_MC');
  const [toast, setToast] = useState<string | null>(null);

  const activeRule = rules.find(r => r.cliente_id === selectedRuleId) || rules[0];

  const [formData, setFormData] = useState<RuleConfig>(activeRule);

  React.useEffect(() => {
    if (activeRule) {
      setFormData(activeRule);
    }
  }, [selectedRuleId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateRule(formData);
    setToast(`Regra de Paletização para ${formData.cliente_nome} atualizada e ativa no PostgREST!`);
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 border border-emerald-400">
          <CheckCircle2 className="w-5 h-5" />
          <span>{toast}</span>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-600" />
            Motor de Regras de Paletização e Entrega (Caso Sonae MC)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Validação de limites físicos, regras de shelf-life e parâmetros GS1 por cliente B2B.
          </p>
        </div>
      </div>

      {/* Grid: Rules List + Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Customer Cards (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          {rules.map(rule => {
            const isSelected = rule.cliente_id === selectedRuleId;
            return (
              <div
                key={rule.cliente_id}
                onClick={() => setSelectedRuleId(rule.cliente_id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-50/70 border-blue-500 shadow-sm ring-1 ring-blue-500'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold text-blue-600">{rule.cliente_id}</span>
                  <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 border border-slate-200">
                    {rule.tipo_palete}
                  </span>
                </div>
                <h4 className="font-semibold text-sm text-slate-900">{rule.cliente_nome}</h4>
                <div className="mt-2 text-xs text-slate-500 font-mono space-y-0.5">
                  <p>Altura Máx: <strong className="text-slate-800">{rule.altura_maxima_cm} cm</strong></p>
                  <p>Peso Máx: <strong className="text-slate-800">{rule.peso_maximo_kg} kg</strong></p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Editable Rule Configuration Form (8 cols) */}
        <div className="lg:col-span-8">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <span className="font-mono text-xs text-blue-600 font-bold block">{formData.cliente_id}</span>
                <h3 className="font-bold text-lg text-slate-900">{formData.cliente_nome}</h3>
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4 text-amber-400" />
                Guardar Regra
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Altura Máxima da Palete (cm)</label>
                <input
                  type="number"
                  value={formData.altura_maxima_cm}
                  onChange={(e) => setFormData({ ...formData, altura_maxima_cm: parseInt(e.target.value, 10) || 180 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Peso Máximo Bruto (kg)</label>
                <input
                  type="number"
                  value={formData.peso_maximo_kg}
                  onChange={(e) => setFormData({ ...formData, peso_maximo_kg: parseInt(e.target.value, 10) || 800 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Vida Útil Mínima na Entrega (%)</label>
                <input
                  type="number"
                  value={formData.vida_util_minima_porcentagem}
                  onChange={(e) => setFormData({ ...formData, vida_util_minima_porcentagem: parseInt(e.target.value, 10) || 75 })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-blue-700 text-sm focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Tipo de Base de Palete</label>
                <select
                  value={formData.tipo_palete}
                  onChange={(e) => setFormData({ ...formData, tipo_palete: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 font-mono text-slate-900 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="EURO_120x80">EURO 120x80 cm</option>
                  <option value="ISO_120x100">ISO Industrial 120x100 cm</option>
                  <option value="CHEP_BLUE">CHEP Blue 120x80 cm</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-700 block mb-1 font-semibold text-xs">Regras Específicas de Empilhamento</label>
              <textarea
                rows={3}
                value={formData.regras_empilhamento}
                onChange={(e) => setFormData({ ...formData, regras_empilhamento: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 font-mono text-xs text-slate-800 focus:outline-none focus:border-blue-500"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
