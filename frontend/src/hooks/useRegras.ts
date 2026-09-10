import { useEffect, useState } from 'react';
import { RuleConfig } from '../types/wms';
import { api } from '../api';

/**
 * Mapeia uma regra_logistica (modelo rico do ERP: fluxo + condicoes/efeitos
 * jsonb) para o RuleConfig da UI (modelo simplificado). Só os campos com
 * correspondência real são preenchidos a partir dos efeitos; os restantes
 * ficam com defaults sensatos. A chave é o id da regra — há várias regras por
 * cliente (uma por fluxo/categoria), logo cliente_id da UI não serve de chave.
 */
function regraParaRuleConfig(r: any): RuleConfig {
  const efeitos = r.efeitos || {};
  const pal = efeitos.paletizacao || {};
  const categoria = r.categoria_produto ? ` — ${r.categoria_produto}` : '';
  const fluxo = String(r.fluxo || 'regra').toUpperCase();

  return {
    cliente_id: r.id,
    cliente_nome: `${fluxo}${categoria}`,
    altura_maxima_cm: pal.altura_maxima_mm ? Math.round(pal.altura_maxima_mm / 10) : 180,
    peso_maximo_kg: pal.peso_maximo_kg ?? 1000,
    vida_util_minima_porcentagem: 75,
    permitir_palete_mista: pal.mono_produto_obrigatorio !== true,
    tipo_palete: 'EURO_120x80',
    obriga_sscc_gs1128: true,
    etiqueta_formato: 'A6_100x150mm',
    regras_empilhamento: JSON.stringify(efeitos, null, 2),
  };
}

const DEFAULT_RULES: RuleConfig[] = [
  {
    cliente_id: 'DEFAULT',
    cliente_nome: 'Regra Padrão',
    altura_maxima_cm: 200,
    peso_maximo_kg: 1500,
    vida_util_minima_porcentagem: 70,
    permitir_palete_mista: true,
    tipo_palete: 'EURO_120x80',
    obriga_sscc_gs1128: true,
    etiqueta_formato: 'A5_105x148mm',
    regras_empilhamento: 'Sem restrições'
  }
];

export function useRegras() {
  const [rules, setRules] = useState<RuleConfig[]>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      try {
        const rows = await api.regras(100);
        const mapped = rows.map(regraParaRuleConfig);
        setRules(mapped.length > 0 ? mapped : DEFAULT_RULES);
        setError(null);
      } catch (err) {
        // Fallback to defaults on error
        setRules(DEFAULT_RULES);
        setError(err instanceof Error ? err.message : 'Falha ao carregar regras.');
      } finally {
        setLoading(false);
      }
    };
    carregar();
  }, []);

  return { rules, setRules, loading, error };
}
