import { useState } from "react";
import { lerSessao, terminarSessao } from "./api";
import Entrar from "./Entrar";
import GuiasTransporte from "./GuiasTransporte";
import Sincronizacoes from "./Sincronizacoes";

const PAGINAS = [
  { id: "guias", rotulo: "Guias de transporte" },
  { id: "sincronizacoes", rotulo: "Sincronizações" },
];

export default function App() {
  const sessao = lerSessao();
  const [utilizador, setUtilizador] = useState(sessao?.utilizador || null);
  const [pagina, setPagina] = useState("guias");

  if (!utilizador) {
    return <Entrar aoEntrar={setUtilizador} />;
  }

  function sair() {
    terminarSessao();
    setUtilizador(null);
  }

  return (
    <div className="app">
      <header className="cabecalho">
        <div className="marca">TicSol Logistics Hub</div>
        <nav className="navegacao">
          {PAGINAS.map((p) => (
            <button
              key={p.id}
              className={`aba ${pagina === p.id ? "ativa" : ""}`}
              onClick={() => setPagina(p.id)}
            >
              {p.rotulo}
            </button>
          ))}
        </nav>
        <div className="utilizador">
          <span>{utilizador.nome || utilizador.email}</span>
          <button className="btn-secundario" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <main className="conteudo">
        {pagina === "guias" && <GuiasTransporte />}
        {pagina === "sincronizacoes" && <Sincronizacoes />}
      </main>
    </div>
  );
}
