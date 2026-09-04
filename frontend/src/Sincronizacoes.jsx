import { useEffect, useState } from "react";
import { api } from "./api";

const ROTULO_ESTADO = {
  ok: "Concluída",
  incompleto: "Incompleta",
  erro_comunicacao: "Erro de comunicação",
  erro_autenticacao: "Erro de autenticação",
  erro_xml: "Erro de leitura",
  erro_funcional: "Erro de processamento",
};

function classeEstado(estado) {
  if (estado === "ok") return "etiqueta etiqueta-ok";
  if (estado === "incompleto") return "etiqueta etiqueta-aviso";
  return "etiqueta etiqueta-erro";
}

function horaLegivel(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
}

export default function Sincronizacoes() {
  const [execucoes, setExecucoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    api
      .listarExecucoes(20)
      .then((r) =>
        setExecucoes(
          [...r].sort(
            (a, b) => new Date(b.executado_em) - new Date(a.executado_em)
          )
        )
      )
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <p className="estado-vazio">A carregar histórico…</p>;
  if (erro) return <div className="alerta alerta-erro">{erro}</div>;

  if (execucoes.length === 0) {
    return (
      <p className="estado-vazio">
        Ainda não há sincronizações registadas. Abra{" "}
        <strong>Guias de transporte</strong> e use{" "}
        <strong>Sincronizar com ARTSOFT</strong>.
      </p>
    );
  }

  return (
    <div>
      <p className="contagem">Últimas {execucoes.length} sincronizações</p>
      <table className="tabela-linhas">
        <thead>
          <tr>
            <th>Quando</th>
            <th>Estado</th>
            <th className="num">Páginas</th>
            <th className="num">Registos</th>
            <th>Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {execucoes.map((e) => (
            <tr key={e.id}>
              <td>{horaLegivel(e.executado_em)}</td>
              <td>
                <span className={classeEstado(e.estado)}>
                  {ROTULO_ESTADO[e.estado] || e.estado}
                </span>
              </td>
              <td className="num">{e.pagina ?? "—"}</td>
              <td className="num">{e.registos ?? "—"}</td>
              <td>{e.erro_resumo || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
