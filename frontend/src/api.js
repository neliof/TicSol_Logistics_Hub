/**
 * Cliente da API do TicSol Logistics Hub.
 *
 * O token de sessão fica em sessionStorage: dura enquanto o separador estiver
 * aberto e não sobrevive ao fecho do browser.
 */

const CHAVE_TOKEN = "ticsol.token";
const CHAVE_UTILIZADOR = "ticsol.utilizador";

export function guardarSessao(token, utilizador) {
  sessionStorage.setItem(CHAVE_TOKEN, token);
  sessionStorage.setItem(CHAVE_UTILIZADOR, JSON.stringify(utilizador));
}

export function lerSessao() {
  const token = sessionStorage.getItem(CHAVE_TOKEN);
  if (!token) return null;
  try {
    return {
      token,
      utilizador: JSON.parse(sessionStorage.getItem(CHAVE_UTILIZADOR) || "{}"),
    };
  } catch {
    return { token, utilizador: {} };
  }
}

export function terminarSessao() {
  sessionStorage.removeItem(CHAVE_TOKEN);
  sessionStorage.removeItem(CHAVE_UTILIZADOR);
}

async function pedir(caminho, opcoes = {}) {
  const sessao = lerSessao();
  const res = await fetch(caminho, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
      ...(opcoes.headers || {}),
    },
  });

  if (res.status === 401) {
    terminarSessao();
    throw new Error("Sessão expirada. Volte a entrar.");
  }

  const texto = await res.text();
  let corpo = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }

  if (!res.ok) {
    const msg =
      (corpo && (corpo.error || corpo.message)) ||
      `Pedido falhou (${res.status})`;
    throw new Error(msg);
  }

  return corpo;
}

export const api = {
  async entrar(email, password) {
    const r = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(
        r.status === 429
          ? "Demasiadas tentativas. Aguarde alguns minutos."
          : corpo.error || "Credenciais inválidas."
      );
    }
    guardarSessao(corpo.token, corpo.usuario);
    return corpo.usuario;
  },

  listarDocumentos(limite = 100) {
    return pedir(`/rest/v1/documento?limit=${limite}`);
  },

  listarLinhasDoDocumento(documentoId) {
    return pedir(`/rest/v1/documento/${documentoId}/linhas`);
  },

  listarExecucoes(limite = 20) {
    return pedir(`/rest/v1/sincronizacao_execucao?limit=${limite}`);
  },

  sincronizarGuias() {
    return pedir("/api/artsoft/guias/sync", { method: "POST" });
  },

  descobrirSeries() {
    return pedir("/api/artsoft/series/discover");
  },

  obterSeriesConfig(modulo) {
    return pedir(`/api/artsoft/series/config/${modulo}`);
  },

  salvarSeriesConfig(modulo, receção, expedição) {
    return pedir("/api/artsoft/series/config", {
      method: "POST",
      body: JSON.stringify({ modulo, receção, expedição }),
    });
  },
};

/** Lê os campos guardados em conteudo_xml (JSON) de um documento. */
export function extras(documento) {
  if (!documento?.conteudo_xml) return {};
  try {
    return JSON.parse(documento.conteudo_xml);
  } catch {
    return {};
  }
}

/** Converte uma data ARTSOFT (AAAAMMDD) em texto legível. */
export function dataLegivel(valor) {
  const s = String(valor || "").trim();
  if (/^\d{8}$/.test(s)) {
    return `${s.substring(6, 8)}/${s.substring(4, 6)}/${s.substring(0, 4)}`;
  }
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}
