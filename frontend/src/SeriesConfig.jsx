import { useEffect, useState } from "react";
import { api } from "./api";

export default function SeriesConfig() {
  const [series, setSeries] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [mensagem, setMensagem] = useState(null);

  const [receçãoSelecionadas, setReceçãoSelecionadas] = useState(new Set());
  const [expediçãoSelecionadas, setExpediçãoSelecionadas] = useState(new Set());

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const descobertas = await api.descobrirSeries();
      setSeries(descobertas.series || []);

      // Carregar configuração guardada para cada módulo
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
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function alternarReceção(codigo) {
    const nova = new Set(receçãoSelecionadas);
    if (nova.has(codigo)) {
      nova.delete(codigo);
    } else {
      nova.add(codigo);
    }
    setReceçãoSelecionadas(nova);
  }

  function alternarExpedição(codigo) {
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
    } catch (e) {
      setErro(e.message);
    } finally {
      setAGuardar(false);
    }
  }

  if (carregando) {
    return <p className="estado-vazio">A carregar séries…</p>;
  }

  const seriesPorTipo = {};
  for (const s of series) {
    if (!seriesPorTipo[s.typeName]) {
      seriesPorTipo[s.typeName] = [];
    }
    seriesPorTipo[s.typeName].push(s);
  }

  return (
    <div className="series-config">
      <h2>Configuração de Séries de Documentos</h2>

      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {mensagem && <div className="alerta alerta-ok">{mensagem}</div>}

      <div className="series-grid">
        <div className="modulo-receção">
          <h3>Receção</h3>
          <div className="lista-series">
            {series.map((s) => (
              <label key={`rec-${s.code}`} className="checkbox-serie">
                <input
                  type="checkbox"
                  checked={receçãoSelecionadas.has(s.code)}
                  onChange={() => alternarReceção(s.code)}
                />
                <span className="codigo">{s.code}</span>
                <span className="nome">{s.docNome || s.typeName}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="modulo-expedição">
          <h3>Expedição</h3>
          <div className="lista-series">
            {series.map((s) => (
              <label key={`exp-${s.code}`} className="checkbox-serie">
                <input
                  type="checkbox"
                  checked={expediçãoSelecionadas.has(s.code)}
                  onChange={() => alternarExpedição(s.code)}
                />
                <span className="codigo">{s.code}</span>
                <span className="nome">{s.docNome || s.typeName}</span>
              </label>
            ))}
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
