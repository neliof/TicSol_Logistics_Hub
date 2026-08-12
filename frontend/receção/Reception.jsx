import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "./api/postgrestClient";
import LinhaConferencia from "./LinhaConferencia";
import "./styles/reception.css";

// Checklist de controlo de qualidade — Secção 2.8.9 do caderno de encargos
// de referência. Cada item tem de ser confirmado antes de aceitar a carga.
const ITENS_CHECKLIST = [
  { id: "viatura", label: "Estado geral da viatura/galera" },
  { id: "embalagem", label: "Estado geral da caixa/embalagem" },
  { id: "estiva", label: "Paletização conforme TI×HI acordado" },
  { id: "etiquetas", label: "Identificação de caixas e paletes (GS1-128)" },
  { id: "rotulagem", label: "Rotulagem em português" },
];

function formatHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Reception() {
  const [encomendas, setEncomendas] = useState([]);
  const [encomendaAtivaId, setEncomendaAtivaId] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [valoresPorLinha, setValoresPorLinha] = useState({});
  const [linhasRejeitadas, setLinhasRejeitadas] = useState({});
  const [checklist, setChecklist] = useState({});
  const [localizacaoRececao, setLocalizacaoRececao] = useState("");
  const [localizacoes, setLocalizacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aSubmeter, setASubmeter] = useState(false);

  const encomendaAtiva = useMemo(
    () => encomendas.find((e) => e.id === encomendaAtivaId) || null,
    [encomendas, encomendaAtivaId]
  );

  // ---- Carrega a fila de encomendas pendentes ao abrir o ecrã ----
  useEffect(() => {
    api
      .listarEncomendasPendentes()
      .then((rows) => {
        setEncomendas(rows);
        if (rows.length > 0) setEncomendaAtivaId(rows[0].id);
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));

    api.listarLocalizacoesRececao().then(setLocalizacoes).catch((e) => setErro(e.message));
  }, []);

  // ---- Carrega as linhas quando muda a encomenda selecionada ----
  // Nota: este reset síncrono de erro/checklist ao mudar de encomenda é o
  // padrão documentado pelo próprio React para "resetar estado quando uma
  // prop/id muda" (https://react.dev/learn/you-might-not-need-an-effect).
  // A regra react-hooks/set-state-in-effect (nova no eslint-plugin v7,
  // pensada para o React Compiler) marca isto como erro; desativa-se aqui
  // conscientemente em vez de contorcer o código.
  useEffect(() => {
    if (!encomendaAtivaId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErro(null);
    setChecklist({});
    setLinhasRejeitadas({});
    api
      .listarLinhas(encomendaAtivaId)
      .then((rows) => {
        setLinhas(rows);
        const iniciais = {};
        rows.forEach((l) => {
          iniciais[l.id] = {
            quantidade_entregue: l.quantidade_encomendada,
            numero_lote: "",
            data_validade: "",
          };
        });
        setValoresPorLinha(iniciais);
      })
      .catch((e) => setErro(e.message));
  }, [encomendaAtivaId]);

  const atualizarValoresLinha = useCallback((linhaId, patch) => {
    setValoresPorLinha((atual) => ({
      ...atual,
      [linhaId]: { ...atual[linhaId], ...patch },
    }));
  }, []);

  const checklistCompleto = ITENS_CHECKLIST.every((item) => checklist[item.id]);
  const linhasAceites = linhas.filter((l) => !linhasRejeitadas[l.id]);
  const podeConfirmar =
    checklistCompleto && linhasAceites.length > 0 && localizacaoRececao.trim() !== "" && !aSubmeter;

  async function rejeitarLinha(linha) {
    const motivo = window.prompt(
      `Motivo da rejeição — ${linha.produto.descricao}\n(logistica / qualidade / documental / fora_de_especificacao / excesso_entrega)`,
      "qualidade"
    );
    if (!motivo) return;
    try {
      await api.registarRejeicao({
        empresa_id: encomendaAtiva.empresa_id,
        encomenda_id: encomendaAtiva.id,
        fornecedor_id: encomendaAtiva.fornecedor_id,
        motivo,
        descricao: `Linha ${linha.produto.sku_interno} rejeitada na receção da OC ${encomendaAtiva.numero_ordem_compra}`,
      });
      setLinhasRejeitadas((atual) => ({ ...atual, [linha.id]: true }));
    } catch (e) {
      setErro(e.message);
    }
  }

  async function confirmarRececao() {
    if (!podeConfirmar || !encomendaAtiva) return;
    setASubmeter(true);
    setErro(null);
    try {
      for (const linha of linhasAceites) {
        const valores = valoresPorLinha[linha.id];
        let loteId = null;

        if (linha.produto.controla_lote) {
          if (!valores.numero_lote) {
            throw new Error(`Falta o número de lote para ${linha.produto.descricao}`);
          }
          const lote = await api.criarLote({
            produto_id: linha.produto_id,
            numero_lote: valores.numero_lote,
            data_validade: linha.produto.controla_validade ? valores.data_validade || null : null,
            fornecedor_id: encomendaAtiva.fornecedor_id,
          });
          loteId = Array.isArray(lote) ? lote[0]?.id : lote?.id;
        }

        await api.atualizarLinha(linha.id, {
          quantidade_entregue: Number(valores.quantidade_entregue),
        });

        await api.registarMovimento({
          empresa_id: encomendaAtiva.empresa_id,
          tipo: "recepcao",
          produto_id: linha.produto_id,
          lote_id: loteId,
          quantidade: Number(valores.quantidade_entregue),
          localizacao_destino_id: localizacaoRececao,
        });
      }

      await api.concluirRecepcao(encomendaAtiva.id);

      setEncomendas((atual) => atual.filter((e) => e.id !== encomendaAtiva.id));
      setEncomendaAtivaId(null);
      setLinhas([]);
    } catch (e) {
      setErro(e.message);
    } finally {
      setASubmeter(false);
    }
  }

  return (
    <div className="recepcao">
      <aside className="recepcao__fila">
        <div className="recepcao__fila-titulo">Cais — hoje</div>
        {carregando && (
          <div className="recepcao__cais-item recepcao__cais-meta">A carregar...</div>
        )}
        {encomendas.map((e) => (
          <div
            key={e.id}
            className={`recepcao__cais-item ${
              e.id === encomendaAtivaId ? "recepcao__cais-item--ativo" : ""
            }`}
            onClick={() => setEncomendaAtivaId(e.id)}
          >
            <span className="recepcao__cais-hora">{formatHora(e.data_agendamento)}</span>
            <span className="recepcao__cais-fornecedor">{e.fornecedor?.nome || "—"}</span>
            <span className="recepcao__cais-meta">
              {e.numero_ordem_compra} · {e.cais_atribuido || "cais n/d"}
            </span>
          </div>
        ))}
        {!carregando && encomendas.length === 0 && (
          <div className="recepcao__cais-item recepcao__cais-meta">
            Sem entregas agendadas.
          </div>
        )}
      </aside>

      <main className="recepcao__detalhe">
        {erro && (
          <div
            className="recepcao__check-item"
            style={{ background: "var(--red-bg)", color: "var(--red)", marginBottom: 20 }}
          >
            {erro}
          </div>
        )}

        {!encomendaAtiva ? (
          <div className="recepcao__vazio">
            <h2>Sem encomenda selecionada</h2>
            <p>Escolhe uma entrega na coluna do lado para começar a conferência.</p>
          </div>
        ) : (
          <>
            <div className="recepcao__cabecalho">
              <div>
                <h1>{encomendaAtiva.fornecedor?.nome}</h1>
                <div className="oc">
                  OC {encomendaAtiva.numero_ordem_compra} · Cais {encomendaAtiva.cais_atribuido} ·{" "}
                  {formatHora(encomendaAtiva.data_agendamento)}
                </div>
              </div>
              <span className="recepcao__estado-pill">{encomendaAtiva.estado}</span>
            </div>

            <div className="recepcao__checklist">
              {ITENS_CHECKLIST.map((item) => (
                <label key={item.id} className="recepcao__check-item">
                  <input
                    type="checkbox"
                    checked={!!checklist[item.id]}
                    onChange={(e) =>
                      setChecklist((atual) => ({ ...atual, [item.id]: e.target.checked }))
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="recepcao__produto-sku">Localização de receção</label>
              <select
                className="recepcao__input"
                style={{ maxWidth: 260 }}
                value={localizacaoRececao}
                onChange={(e) => setLocalizacaoRececao(e.target.value)}
              >
                <option value="">Escolhe uma localização…</option>
                {localizacoes.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.codigo}
                  </option>
                ))}
              </select>
            </div>

            <div className="recepcao__linhas">
              <div className="recepcao__linha recepcao__linha-header">
                <span>Produto</span>
                <span>Lote</span>
                <span>Validade</span>
                <span>Recebido</span>
                <span>Conferência</span>
              </div>
              {linhas.map((linha) => (
                <div key={linha.id} style={{ position: "relative" }}>
                  <LinhaConferencia
                    linha={linha}
                    valores={valoresPorLinha[linha.id] || {}}
                    onChange={(patch) => atualizarValoresLinha(linha.id, patch)}
                  />
                  {linhasRejeitadas[linha.id] ? (
                    <div
                      className="recepcao__produto-sku"
                      style={{ color: "var(--red)", padding: "0 20px 12px" }}
                    >
                      Linha rejeitada — excluída da confirmação.
                    </div>
                  ) : (
                    <div style={{ padding: "0 20px 12px", textAlign: "right" }}>
                      <button
                        className="recepcao__botao recepcao__botao--rejeitar"
                        style={{ padding: "6px 14px", fontSize: 12 }}
                        onClick={() => rejeitarLinha(linha)}
                      >
                        Rejeitar linha
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="recepcao__acoes">
              <button
                className="recepcao__botao recepcao__botao--confirmar"
                disabled={!podeConfirmar}
                onClick={confirmarRececao}
                title={
                  !checklistCompleto
                    ? "Confirma todos os itens do controlo de qualidade primeiro"
                    : undefined
                }
              >
                {aSubmeter ? "A confirmar…" : "Confirmar receção"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
