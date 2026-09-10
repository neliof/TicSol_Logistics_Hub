import { useEffect, useState } from 'react';
import { api } from '../api';

export function useSeriesConfig(modulo: string) {
  const [receção, setReceção] = useState<string[]>([]);
  const [expedição, setExpedição] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const config = await api.getSeriesConfig(modulo);
        setReceção(config.receção || []);
        setExpedição(config.expedição || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar config');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [modulo]);

  const save = async () => {
    try {
      await api.saveSeriesConfig(modulo, receção, expedição);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao guardar';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  return {
    modulo,
    receção,
    expedição,
    loading,
    error,
    setReceção,
    setExpedição,
    save
  };
}
