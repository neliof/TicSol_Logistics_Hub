import { useEffect, useState } from "react";
import { api } from "../api";
import { AlertTriangle, Trash2, RefreshCw } from "lucide-react";

const TABELAS: { chave: string; label: string; descricao: string }[] = [
  { chave: "documentos", label: "Documentos (Guias/Vendas)", descricao: "logistics.documento + linhas (cascata)" },
  { chave: "stock", label: "Stock ARTSOFT", descricao: "logistics.artsoft_stock_snapshot" },
  { chave: "paletes", label: "Paletes SSCC", descricao: "logistics.palete" },
  { chave: "produtos", label: "Artigos", descricao: "logistics.produto" },
  { chave: "clientes", label: "Clientes", descricao: "logistics.cliente" },
  { chave: "fornecedores", label: "Fornecedores", descricao: "logistics.fornecedor" },
];

export default function GestaoDadosModule() {
  const [contagens, setContagens] = useState<Record<string, number>>({});
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [aApagar, setAApagar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await api.contarDadosTeste();
      setContagens(res.contagens);
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function alternar(chave: string) {
    const nova = new Set(selecionadas);
    if (nova.has(chave)) nova.delete(chave);
    else nova.add(chave);
    setSelecionadas(nova);
  }

  async function apagar() {
    if (selecionadas.size === 0) return;

    const labels = TABELAS.filter((t) => selecionadas.has(t.chave)).map((t) => t.label);
    const totalRegistos = Array.from(selecionadas).reduce((acc, c) => acc + (contagens[c] || 0), 0);

    const confirmado = window.confirm(
      `ATENÇÃO — Ação irreversível.\n\n` +
        `Vais apagar ${totalRegistos} registos de:\n${labels.map((l) => `• ${l}`).join("\n")}\n\n` +
        `Podes voltar a sincronizar depois a partir do ARTSOFT.\n\nConfirmas?`
    );
    if (!confirmado) return;

    setAApagar(true);
    setErro(null);
    setMensagem(null);
    try {
      const res = await api.apagarDadosTeste(Array.from(selecionadas));
      const resumo = Object.entries(res.deleted)
        .map(([k, v]) => `${TABELAS.find((t) => t.chave === k)?.label || k}: ${v} apagados`)
        .join(" • ");
      setMensagem(resumo || "Concluído.");
      if (Object.keys(res.erros || {}).length > 0) {
        setErro(Object.entries(res.erros).map(([k, v]) => `${k}: ${v}`).join(" | "));
      }
      setSelecionadas(new Set());
      await carregar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setAApagar(false);
    }
  }

  if (carregando) {
    return <p className="estado-vazio">A carregar contagens…</p>;
  }

  return (
    <div className="series-config">
      <h2>Gestão de Dados de Teste / Sincronização</h2>

      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {mensagem && <div className="alerta alerta-ok">{mensagem}</div>}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, padding: 12, fontSize: 13, color: "#92400e" }}>
        <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          Apagar dados aqui é <strong>irreversível</strong>. Usa isto para limpar dados de teste antes de
          ressincronizar do ARTSOFT — não afeta a configuração de ligação nem de séries.
        </span>
      </div>

      <div className="modulo-receção" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TABELAS.map((t) => (
            <label key={t.chave} className="checkbox-serie">
              <input
                type="checkbox"
                checked={selecionadas.has(t.chave)}
                onChange={() => alternar(t.chave)}
              />
              <span className="codigo" style={{ minWidth: 90 }}>{contagens[t.chave] ?? 0} reg.</span>
              <span className="nome">
                <strong style={{ color: "var(--text-main)" }}>{t.label}</strong>
                {" — "}
                {t.descricao}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="acoes">
        <button
          className="btn-primario"
          onClick={apagar}
          disabled={aApagar || selecionadas.size === 0}
          style={{ background: selecionadas.size > 0 ? "#dc2626" : undefined, display: "flex", alignItems: "center", gap: 6 }}
        >
          <Trash2 size={16} />
          {aApagar ? "A apagar…" : `Apagar Selecionados (${selecionadas.size})`}
        </button>

        <button
          className="btn-primario"
          onClick={carregar}
          disabled={carregando}
          style={{ background: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}
        >
          <RefreshCw size={16} />
          Atualizar Contagens
        </button>
      </div>
    </div>
  );
}
