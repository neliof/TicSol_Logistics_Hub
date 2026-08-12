import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "./api/paletizacaoClient";
import "../shared/tokens.css";
import "./styles/paletizacao.css";

function formatHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Paletizacao() {
  const [encomendas, setEncomendas] = useState([]);
  const [encomendaAtivaId, setEncomendaAtivaId] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [linhaAtivaId, setLinhaAtivaId] = useState(null);
  const [plano, setPlano] = useState(null);
  const [numeroLote, setNumeroLote] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [aCalcular, setACalcular] = useState(false);
  const [aMaterializar, setAMaterializar] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);

  const encomendaAtiva = useMemo(
    () => encomendas.find((e) => e.id === encomendaAtivaId) || null,
    [encomendas, encomendaAtivaId]
  );
  const linhaAtiva = useMemo(
    () => linhas.find((l) => l.id === linhaAtivaId) || null,
    [linhas, linhaAtivaId]
  );

  useEffect(() => {
    api
      .listarEncomendasParaPaletizar()
      .then((rows) => {
        setEncomendas(rows);
        if (rows.length > 0) setEncomendaAtivaId(rows[0].id);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  // Nota: reset síncrono de estado ao mudar de encomenda — mesmo padrão
  // documentado pelo React (https://react.dev/learn/you-might-not-need-an-effect)
  // usado em Reception.jsx. A regra react-hooks/set-state-in-effect (v7,
  // pensada para o React Compiler) marca isto como erro; desativa-se aqui
  // conscientemente pelo mesmo motivo.
  useEffect(() => {
    if (!encomendaAtivaId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErro(null);
    setPlano(null);
    setResultado(null);
    setLinhaAtivaId(null);
    api
      .listarLinhas(encomendaAtivaId)
      .then((rows) => {
        setLinhas(rows);
        if (rows.length > 0) setLinhaAtivaId(rows[0].id);
      })
      .catch((e) => setErro(e.message));
  }, [encomendaAtivaId]);

  const calcularPlano = useCallback(async () => {
    if (!linhaAtiva || !encomendaAtiva) return;
    setACalcular(true);
    setErro(null);
    setResultado(null);
    try {
      const padrao = encomendaAtiva.fluxo === "pbl" ? "multi_produto" : "mono_produto";
      const linhas_plano = await api.calcularPaletizacao(
        linhaAtiva.produto_id,
        Number(linhaAtiva.quantidade_encomendada),
        encomendaAtiva.fluxo,
        padrao
      );
      setPlano(linhas_plano);
    } catch (e) {
      setErro(e.message);
    } finally {
      setACalcular(false);
    }
  }, [linhaAtiva, encomendaAtiva]);

  async function materializar() {
    if (!plano || !linhaAtiva || !encomendaAtiva) return;
    if (linhaAtiva.produto.categoria && !numeroLote) {
      setErro("Indica o número de lote antes de materializar as paletes.");
      return;
    }
    setAMaterializar(true);
    setErro(null);
    try {
      const regra = await api.resolverRegra(
        encomendaAtiva.cliente.id,
        encomendaAtiva.fluxo,
        linhaAtiva.produto.categoria
      );

      const paletesCriadas = [];
      for (const linhaPlano of plano) {
        const sscc = await api.gerarSSCC(encomendaAtiva.empresa_id);

        const [palete] = await api.criarPalete({
          empresa_id: encomendaAtiva.empresa_id,
          sscc,
          tipo: "europalete",
          padrao: encomendaAtiva.fluxo === "pbl" ? "multi_produto" : "mono_produto",
          fluxo: encomendaAtiva.fluxo,
          ti: linhaAtiva.produto.ti,
          hi: linhaAtiva.produto.hi,
          altura_mm: linhaPlano.altura_estimada_mm,
          peso_kg: linhaPlano.peso_estimado_kg,
          estado: "em_preparacao",
          cliente_id: encomendaAtiva.cliente.id,
          encomenda_id: encomendaAtiva.id,
        });

        await api.criarCaixas(
          Array.from({ length: linhaPlano.caixas_nesta_palete }, () => ({
            empresa_id: encomendaAtiva.empresa_id,
            produto_id: linhaAtiva.produto_id,
            palete_id: palete.id,
            quantidade: 1,
            estado: "disponivel",
          }))
        );

        if (regra) {
          await api.criarEtiqueta({
            empresa_id: encomendaAtiva.empresa_id,
            tipo: "palete",
            palete_id: palete.id,
            template_id: regra.template_etiqueta_id,
            regra_aplicada_id: regra.id,
            identificadores_aplicacao: [
              { ia: "00", valor: sscc },
              { ia: "37", valor: String(linhaPlano.caixas_nesta_palete) },
            ],
          });
        }

        paletesCriadas.push({ ...linhaPlano, sscc });
      }

      await api.marcarEmPreparacao(encomendaAtiva.id);
      setResultado({ paletes: paletesCriadas, regraCategoria: regra?.categoria_produto || null });
      setPlano(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setAMaterializar(false);
    }
  }

  return (
    <div className="paletizacao">
      <aside className="paletizacao__fila">
        <div className="paletizacao__fila-titulo">Encomendas a paletizar</div>
        {carregando && <div className="paletizacao__cliente-item paletizacao__meta">A carregar...</div>}
        {encomendas.map((e) => (
          <div
            key={e.id}
            className={`paletizacao__cliente-item ${
              e.id === encomendaAtivaId ? "paletizacao__cliente-item--ativo" : ""
            }`}
            onClick={() => setEncomendaAtivaId(e.id)}
          >
            <span className="paletizacao__fluxo-pill">{e.fluxo.toUpperCase()}</span>
            <span className="paletizacao__cliente-nome">{e.cliente?.nome}</span>
            <span className="paletizacao__meta">
              {e.numero_ordem_compra} · {formatHora(e.data_agendamento)}
            </span>
          </div>
        ))}
        {!carregando && encomendas.length === 0 && (
          <div className="paletizacao__cliente-item paletizacao__meta">
            Sem encomendas prontas a paletizar.
          </div>
        )}
      </aside>

      <main className="paletizacao__detalhe">
        {erro && <div className="paletizacao__alerta paletizacao__alerta--erro">{erro}</div>}

        {!encomendaAtiva ? (
          <div className="paletizacao__vazio">
            <h2>Sem encomenda selecionada</h2>
            <p>Escolhe uma encomenda na coluna do lado.</p>
          </div>
        ) : (
          <>
            <div className="paletizacao__cabecalho">
              <div>
                <h1>{encomendaAtiva.cliente?.nome}</h1>
                <div className="oc">
                  OC {encomendaAtiva.numero_ordem_compra} · Fluxo {encomendaAtiva.fluxo.toUpperCase()}
                </div>
              </div>
            </div>

            <div className="paletizacao__linhas-select">
              {linhas.map((l) => (
                <button
                  key={l.id}
                  className={`paletizacao__linha-btn ${
                    l.id === linhaAtivaId ? "paletizacao__linha-btn--ativo" : ""
                  }`}
                  onClick={() => {
                    setLinhaAtivaId(l.id);
                    setPlano(null);
                    setResultado(null);
                  }}
                >
                  <span className="paletizacao__linha-btn-sku">{l.produto.sku_interno}</span>
                  <span>{l.produto.descricao}</span>
                  <span className="paletizacao__linha-btn-qtd">{l.quantidade_encomendada} cx</span>
                </button>
              ))}
            </div>

            {linhaAtiva && (
              <div className="paletizacao__acao-calculo">
                {linhaAtiva.produto.categoria === "congelados" || linhaAtiva.produto.controla_lote !== false ? (
                  <input
                    className="paletizacao__input"
                    placeholder="Número de lote"
                    value={numeroLote}
                    onChange={(e) => setNumeroLote(e.target.value)}
                  />
                ) : null}
                <button className="paletizacao__botao paletizacao__botao--secundario" onClick={calcularPlano} disabled={aCalcular}>
                  {aCalcular ? "A calcular…" : "Calcular plano de paletização"}
                </button>
              </div>
            )}

            {plano && (
              <div className="paletizacao__plano">
                <div className="paletizacao__plano-titulo">
                  Plano calculado — {plano.length} palete{plano.length !== 1 ? "s" : ""}
                </div>
                <div className="paletizacao__plano-grid">
                  {plano.map((p) => (
                    <div
                      key={p.numero_palete}
                      className={`paletizacao__palete-card ${
                        p.dentro_limites
                          ? "paletizacao__palete-card--ok"
                          : "paletizacao__palete-card--alerta"
                      }`}
                    >
                      <div className="paletizacao__palete-numero">Palete {p.numero_palete}</div>
                      <div className="paletizacao__palete-linha">
                        <span>Caixas</span>
                        <span>{p.caixas_nesta_palete}</span>
                      </div>
                      <div className="paletizacao__palete-linha">
                        <span>Camadas</span>
                        <span>{p.camadas}</span>
                      </div>
                      <div className="paletizacao__palete-linha">
                        <span>Altura</span>
                        <span>{(p.altura_estimada_mm / 1000).toFixed(2)} m</span>
                      </div>
                      <div className="paletizacao__palete-linha">
                        <span>Peso</span>
                        <span>{p.peso_estimado_kg} kg</span>
                      </div>
                      {p.alertas?.length > 0 && (
                        <ul className="paletizacao__palete-alertas">
                          {p.alertas.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>

                <div className="paletizacao__acoes">
                  <button
                    className="paletizacao__botao paletizacao__botao--primario"
                    onClick={materializar}
                    disabled={aMaterializar}
                  >
                    {aMaterializar ? "A criar paletes…" : "Materializar paletes + SSCC + etiquetas"}
                  </button>
                </div>
              </div>
            )}

            {resultado && (
              <div className="paletizacao__resultado">
                <div className="paletizacao__resultado-titulo">
                  {resultado.paletes.length} paletes criadas com sucesso
                  {resultado.regraCategoria && (
                    <span className="paletizacao__meta">
                      {" "}
                      · regra aplicada: exceção "{resultado.regraCategoria}"
                    </span>
                  )}
                </div>
                {resultado.paletes.map((p) => (
                  <div key={p.sscc} className="paletizacao__sscc-linha">
                    <span className="paletizacao__sscc-codigo">{p.sscc}</span>
                    <span>{p.caixas_nesta_palete} caixas</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
