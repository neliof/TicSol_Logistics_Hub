import { useEffect, useState } from "react";
import { api } from "../api";

export default function ArtsoftConfig() {
  const [host, setHost] = useState("");
  const [porta, setPorta] = useState("");
  const [utilizador, setUtilizador] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const config = await api.obterArtsoftConfig();
      setHost(config.host || "");
      setPorta(config.porta || "");
      setUtilizador(config.utilizador || "");
      setSenha(config.senha || "");
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  async function guardar() {
    setAGuardar(true);
    setMensagem(null);
    setErro(null);
    try {
      await api.salvarArtsoftConfig({ host, porta, utilizador, senha });
      setMensagem("Configuração guardada com sucesso.");
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAGuardar(false);
    }
  }

  if (carregando) {
    return <p className="estado-vazio">A carregar configuração…</p>;
  }

  return (
    <div className="series-config">
      <h2>Configuração de Ligação ARTSOFT</h2>

      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {mensagem && <div className="alerta alerta-ok">{mensagem}</div>}

      <div className="modulo-receção" style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Host</div>
            <input
              type="text"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.120"
              className="campo-config"
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Porta</div>
            <input
              type="text"
              value={porta}
              onChange={(e) => setPorta(e.target.value)}
              placeholder="4333"
              className="campo-config"
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Utilizador</div>
            <input
              type="text"
              value={utilizador}
              onChange={(e) => setUtilizador(e.target.value)}
              placeholder="ADMIN"
              className="campo-config"
            />
          </label>

          <label>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Senha</div>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="campo-config"
            />
          </label>
        </div>
      </div>

      <div className="acoes">
        <button className="btn-primario" onClick={guardar} disabled={aGuardar}>
          {aGuardar ? "A guardar…" : "Guardar Configuração"}
        </button>
      </div>
    </div>
  );
}
