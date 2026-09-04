import { useState } from "react";
import { api } from "./api";

export default function Entrar({ aoEntrar }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState(null);
  const [aEntrar, setAEntrar] = useState(false);

  async function submeter(e) {
    e.preventDefault();
    setErro(null);
    setAEntrar(true);
    try {
      const utilizador = await api.entrar(email, password);
      aoEntrar(utilizador);
    } catch (err) {
      setErro(err.message);
    } finally {
      setAEntrar(false);
    }
  }

  return (
    <div className="ecra-entrada">
      <form className="cartao-entrada" onSubmit={submeter}>
        <h1>TicSol Logistics Hub</h1>
        <p className="subtitulo">Entre com as suas credenciais.</p>

        <label htmlFor="email">Endereço de email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">Palavra-passe</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {erro && <div className="alerta alerta-erro">{erro}</div>}

        <button className="btn-primario" type="submit" disabled={aEntrar}>
          {aEntrar ? "A entrar…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
