import { useEffect, useState } from "react";
import { api } from "../api";

export default function SeriesConfig() {
  const [series, setSeries] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [receçãoSelecionadas, setReceçãoSelecionadas] = useState(new Set<string>());
  const [expediçãoSelecionadas, setExpediçãoSelecionadas] = useState(new Set<string>());

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const descobertas = await api.descobrirSeries();
      setSeries(descobertas.series || []);

      try {
        const confRec = await api.obterSeriesConfig("rececao");
        if (confRec?.receção) {
          setReceçãoSelecionadas(new Set(confRec.receção));
        }
      } catch {
        // Ignorar se não existe
      }

      try {
        const confExp = await api.obterSeriesConfig("expedicao");
        if (confExp?.expedição) {
          setExpediçãoSelecionadas(new Set(confExp.expedição));
        }
      } catch {
        // Ignorar se não existe
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function alternarReceção(codigo: string) {
    const nova = new Set(receçãoSelecionadas);
    if (nova.has(codigo)) {
      nova.delete(codigo);
    } else {
      nova.add(codigo);
    }
    setReceçãoSelecionadas(nova);
  }

  function alternarExpedição(codigo: string) {
    const nova = new Set(expediçãoSelecionadas);
    if (nova.has(codigo)) {
      nova.delete(codigo);
    } else {
      nova.add(codigo);
    }
    setExpediçãoSelecionadas(nova);
  }

  async function guardar() {
    setAGuardar(true);
    setMensagem(null);
    setErro(null);
    try {
      await api.salvarSeriesConfig(
        "rececao",
        Array.from(receçãoSelecionadas),
        Array.from(expediçãoSelecionadas)
      );
      await api.salvarSeriesConfig(
        "expedicao",
        Array.from(receçãoSelecionadas),
        Array.from(expediçãoSelecionadas)
      );
      setMensagem("Configuração guardada com sucesso.");
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAGuardar(false);
    }
  }

  if (carregando) {
    return <p className="estado-vazio">A carregar séries…</p>;
  }

  const seriesPorTipo: { [key: string]: any[] } = {};
  for (const s of series) {
    if (!seriesPorTipo[s.typeName]) {
      seriesPorTipo[s.typeName] = [];
    }
    seriesPorTipo[s.typeName].push(s);
  }

  // Filtrar séries por tipo para cada módulo
  const seriesReceção = series.filter(s =>
    s.type === 'Entrada' || s.type === 'Encomenda_Fornecedor'
  );
  const seriesExpedicao = series.filter(s =>
    s.type === 'Venda' || s.type === 'Saida' || s.type === 'Encomenda_Cliente'
  );

  return (
    <div className="series-config">
      <h2>Configuração de Séries de Documentos</h2>

      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {mensagem && <div className="alerta alerta-ok">{mensagem}</div>}

      <div className="series-grid">
        <div className="modulo-receção">
          <h3>Receção</h3>
          <p className="descricao-modulo">Séries de Entrada (Exxx) e Encomendas de Fornecedores (Fxxx)</p>
          <div className="lista-series">
            {seriesReceção.length > 0 ? (
              seriesReceção.map((s) => (
                <label key={`rec-${s.code}`} className="checkbox-serie">
                  <input
                    type="checkbox"
                    checked={receçãoSelecionadas.has(s.code)}
                    onChange={() => alternarReceção(s.code)}
                  />
                  <span className="codigo">{s.code}</span>
                  <span className="nome">{s.typeName}</span>
                </label>
              ))
            ) : (
              <p className="sem-series">Nenhuma série de Receção configurada</p>
            )}
          </div>
        </div>

        <div className="modulo-expedição">
          <h3>Expedição</h3>
          <p className="descricao-modulo">Séries de Vendas (Vxxx), Saídas (Sxxx) e Encomendas de Clientes (Cxxx)</p>
          <div className="lista-series">
            {seriesExpedicao.length > 0 ? (
              seriesExpedicao.map((s) => (
                <label key={`exp-${s.code}`} className="checkbox-serie">
                  <input
                    type="checkbox"
                    checked={expediçãoSelecionadas.has(s.code)}
                    onChange={() => alternarExpedição(s.code)}
                  />
                  <span className="codigo">{s.code}</span>
                  <span className="nome">{s.typeName}</span>
                </label>
              ))
            ) : (
              <p className="sem-series">Nenhuma série de Expedição configurada</p>
            )}
          </div>
        </div>
      </div>

      <div className="acoes">
        <button
          className="btn-primario"
          onClick={guardar}
          disabled={aGuardar}
        >
          {aGuardar ? "A guardar…" : "Guardar Configuração"}
        </button>
      </div>
    </div>
  );
}
