import { useEffect, useMemo, useState } from "react";
import { api, extras, dataLegivel } from "./api";

export default function GuiasTransporte() {
  const [documentos, setDocumentos] = useState([]);
  const [linhasDoDoc, setLinhasDoDoc] = useState([]);
  const [aCarregarLinhas, setACarregarLinhas] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [procura, setProcura] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aSincronizar, setASincronizar] = useState(false);
  const [aviso, setAviso] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const docs = await api.listarDocumentos(200);
      setDocumentos(docs);
      if (docs.length > 0) setSelecionado(docs[0].id);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  // As linhas são carregadas por documento, à medida que é selecionado.
  useEffect(() => {
    if (!selecionado) {
      setLinhasDoDoc([]);
      return;
    }
    let cancelado = false;
    setACarregarLinhas(true);
    api
      .listarLinhasDoDocumento(selecionado)
      .then((r) => {
        if (!cancelado) setLinhasDoDoc(r);
      })
      .catch((e) => {
        if (!cancelado) setErro(e.message);
      })
      .finally(() => {
        if (!cancelado) setACarregarLinhas(false);
      });
    return () => {
      cancelado = true;
    };
  }, [selecionado]);

  const filtrados = useMemo(() => {
    const termo = procura.trim().toLowerCase();
    if (!termo) return documentos;
    return documentos.filter((d) => {
      const x = extras(d);
      return (
        String(d.numero).toLowerCase().includes(termo) ||
        String(x.terceiro_nome || "").toLowerCase().includes(termo)
      );
    });
  }, [documentos, procura]);

  const doc = documentos.find((d) => d.id === selecionado) || null;
  const x = doc ? extras(doc) : {};

  async function sincronizar() {
    setASincronizar(true);
    setAviso(null);
    setErro(null);
    try {
      const r = await api.sincronizarGuias();
      setAviso(
        `Sincronização concluída: ${r?.docs_criados ?? 0} guias e ` +
          `${r?.linhas_total ?? 0} linhas.`
      );
      await carregar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setASincronizar(false);
    }
  }

  if (carregando) {
    return <p className="estado-vazio">A carregar guias…</p>;
  }

  return (
    <div className="guias">
      <div className="barra-acoes">
        <input
          className="campo-procura"
          type="search"
          placeholder="Procurar por número de guia ou cliente"
          value={procura}
          onChange={(e) => setProcura(e.target.value)}
        />
        <button
          className="btn-primario"
          onClick={sincronizar}
          disabled={aSincronizar}
        >
          {aSincronizar ? "A sincronizar…" : "Sincronizar com ARTSOFT"}
        </button>
      </div>

      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {aviso && <div className="alerta alerta-ok">{aviso}</div>}

      <p className="contagem">
        {filtrados.length} guia{filtrados.length === 1 ? "" : "s"}
        {procura ? ` de ${documentos.length}` : ""}
      </p>

      {filtrados.length === 0 ? (
        <p className="estado-vazio">
          Nenhuma guia encontrada. Use <strong>Sincronizar com ARTSOFT</strong>{" "}
          para importar guias.
        </p>
      ) : (
        <div className="painel-duplo">
          <ul className="lista-guias">
            {filtrados.map((d) => {
              const e = extras(d);
              return (
                <li key={d.id}>
                  <button
                    className={`item-guia ${d.id === selecionado ? "ativo" : ""}`}
                    onClick={() => setSelecionado(d.id)}
                  >
                    <span className="item-numero">{d.numero}</span>
                    <span className="item-cliente">
                      {e.terceiro_nome || "—"}
                    </span>
                    <span className="item-data">
                      {dataLegivel(d.data_emissao)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {doc && (
            <section className="detalhe">
              <h3>{doc.numero}</h3>

              <dl className="campos">
                <div>
                  <dt>Cliente</dt>
                  <dd>{x.terceiro_nome || "—"}</dd>
                </div>
                <div>
                  <dt>NIF</dt>
                  <dd>{x.terceiro_nif || "—"}</dd>
                </div>
                <div>
                  <dt>Data do documento</dt>
                  <dd>{dataLegivel(doc.data_emissao)}</dd>
                </div>
                <div>
                  <dt>Tipo</dt>
                  <dd>{doc.origem_tpsaft || "—"}</dd>
                </div>
                <div className="largo">
                  <dt>Local de carga</dt>
                  <dd>{x.morada_carga || "—"}</dd>
                </div>
                <div className="largo">
                  <dt>Local de descarga</dt>
                  <dd>{x.morada_descarga || "—"}</dd>
                </div>
                <div>
                  <dt>Data de carga</dt>
                  <dd>{dataLegivel(x.data_hora_carga)}</dd>
                </div>
                <div>
                  <dt>Hora de carga</dt>
                  <dd>{x.hora_carga || "—"}</dd>
                </div>
                <div>
                  <dt>Matrícula</dt>
                  <dd>{x.matricula || "—"}</dd>
                </div>
                <div>
                  <dt>Volumes</dt>
                  <dd>{x.volumes ?? "—"}</dd>
                </div>
                <div>
                  <dt>Peso bruto</dt>
                  <dd>{x.peso ?? "—"}</dd>
                </div>
                <div>
                  <dt>Encomenda de origem</dt>
                  <dd>{x.pedido_origem || "—"}</dd>
                </div>
              </dl>

              {x.observacoes && (
                <p className="observacoes">
                  <strong>Observações:</strong> {x.observacoes}
                </p>
              )}

              <h4>Artigos ({aCarregarLinhas ? "…" : linhasDoDoc.length})</h4>
              {aCarregarLinhas ? (
                <p className="estado-vazio">A carregar artigos…</p>
              ) : linhasDoDoc.length === 0 ? (
                <p className="estado-vazio">Esta guia não tem artigos.</p>
              ) : (
                <table className="tabela-linhas">
                  <thead>
                    <tr>
                      <th>Linha</th>
                      <th>Código</th>
                      <th>Descrição</th>
                      <th className="num">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasDoDoc.map((l) => (
                      <tr key={l.id}>
                        <td>{l.nr_linha}</td>
                        <td className="codigo">{l.artigo_codigo}</td>
                        <td>{l.descricao || "—"}</td>
                        <td className="num">
                          {l.quantidade == null
                            ? "—"
                            : Number(l.quantidade).toLocaleString("pt-PT")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
