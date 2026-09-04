/**
 * Conexão ao ARTSOFT WebServer.
 *
 * PROTOCOLO ARTSOFT - REGRA CRÍTICA:
 *   O challenge devolvido pelo GET /login está associado à CONEXÃO TCP.
 *   O GET /login e o POST seguinte DEVEM usar a mesma conexão TCP (Keep-Alive).
 *   Usar conexões separadas causa 401 inevitavelmente.
 *
 * Digest ARTSOFT (não é RFC 2617):
 *   ALGO( ALGO(user).digest + ALGO(pass).digest + ALGO(challenge).digest )
 *
 * Portado de `artsoft_connection.py` (TICSOL_HUB_Central), validado contra
 * ARTSOFT V26 em 2026-09-04.
 */

import net from "node:net";
import { createHash } from "node:crypto";

export class ErroConexaoArtsoft extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroConexaoArtsoft";
  }
}

export class ErroAutenticacaoArtsoft extends ErroConexaoArtsoft {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroAutenticacaoArtsoft";
  }
}

/**
 * Calcula o digest ARTSOFT para um challenge.
 *
 * @param {string} utilizador
 * @param {string} senha
 * @param {string} challenge
 * @param {string} [hash]  'SHA1' | 'MD5'
 * @returns {string}       hex digest
 */
export function calcularDigest(utilizador, senha, challenge, hash = "SHA1") {
  const algo = hash === "MD5" ? "md5" : "sha1";

  const hUser = createHash(algo).update(utilizador).digest();
  const hPass = createHash(algo).update(senha).digest();
  const hChal = createHash(algo).update(challenge).digest();

  return createHash(algo)
    .update(Buffer.concat([hUser, hPass, hChal]))
    .digest("hex");
}

/**
 * Executa login + pedido numa única conexão TCP.
 *
 * @param {object} config
 * @param {string} config.host
 * @param {number} config.porta
 * @param {string} config.utilizador
 * @param {string} config.senha
 * @param {string} config.xml           corpo do pedido
 * @param {string} [config.endpoint]    default 'Queries/Query'
 * @param {string} [config.hash]        'SHA1' | 'MD5'
 * @param {number} [config.timeout]     ms, default 60000
 * @returns {Promise<string>}           XML de resposta
 */
export function executarPedidoArtsoft({
  host,
  porta,
  utilizador,
  senha,
  xml,
  endpoint = "Queries/Query",
  hash = "SHA1",
  timeout = 60000,
}) {
  return new Promise((resolve, reject) => {
    // Validar antes de abrir o socket: net.createConnection lança RangeError
    // para portas fora de gama, que não é o erro que os chamadores esperam.
    const portaNum = Number(porta);
    if (!Number.isInteger(portaNum) || portaNum < 1 || portaNum > 65535) {
      reject(
        new ErroConexaoArtsoft(`Erro de conexão: porta inválida (${porta})`)
      );
      return;
    }
    if (!String(host ?? "").trim()) {
      reject(new ErroConexaoArtsoft("Erro de conexão: host vazio"));
      return;
    }

    const socket = net.createConnection({ host, port: portaNum, timeout });

    let bufLogin = "";
    let bufPost = "";
    let loginFeito = false;
    let postEnviado = false;
    let terminado = false;

    const falhar = (erro) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      reject(erro);
    };

    socket.on("error", (err) =>
      falhar(new ErroConexaoArtsoft(`Conexão falhou: ${err.message}`))
    );

    socket.on("timeout", () =>
      falhar(new ErroConexaoArtsoft(`Timeout após ${timeout}ms`))
    );

    socket.on("connect", () => {
      // PASSO 1: GET /login para obter o challenge (mesma conexão TCP)
      const headers = [
        `Host: ${host}:${porta}`,
        "Connection: Keep-Alive",
        "Keep-Alive: 60",
        "Encoding: utf-8",
        `name: ${utilizador}`,
        "XMLIdent: 3",
      ].join("\r\n");

      socket.write(`GET /login HTTP/1.1\r\n${headers}\r\n\r\n`);
    });

    socket.on("data", (chunk) => {
      const dados = chunk.toString("utf8");

      if (!loginFeito) {
        bufLogin += dados;
        const fimHeaders = bufLogin.indexOf("\r\n\r\n");
        if (fimHeaders === -1) return;

        const headersLogin = bufLogin.substring(0, fimHeaders);
        const m = headersLogin.match(/^digest:\s*(.+)$/im);

        if (!m) {
          falhar(
            new ErroAutenticacaoArtsoft(
              `Sem challenge no GET /login. Headers: ${headersLogin.split("\r\n")[0]}`
            )
          );
          return;
        }

        const challenge = m[1].trim();
        const digest = calcularDigest(utilizador, senha, challenge, hash);
        const corpo = Buffer.from(xml, "utf8");

        // PASSO 2: POST na MESMA conexão TCP
        const headersPost = [
          `Host: ${host}:${porta}`,
          "Content-Type: text/xml; charset=utf-8",
          "Encoding: utf-8",
          `digest: ${digest}`,
          "Connection: Close",
          `Content-Length: ${corpo.length}`,
        ].join("\r\n");

        socket.write(`POST /${endpoint} HTTP/1.1\r\n${headersPost}\r\n\r\n`);
        socket.write(corpo);

        loginFeito = true;
        postEnviado = true;
        return;
      }

      if (postEnviado) bufPost += dados;
    });

    socket.on("end", () => {
      if (terminado) return;

      if (!postEnviado || !bufPost) {
        falhar(new ErroConexaoArtsoft("Conexão fechada sem resposta"));
        return;
      }

      const fimHeaders = bufPost.indexOf("\r\n\r\n");
      if (fimHeaders === -1) {
        falhar(new ErroConexaoArtsoft("Resposta HTTP inválida"));
        return;
      }

      const headers = bufPost.substring(0, fimHeaders);
      const corpo = bufPost.substring(fimHeaders + 4);
      const linhaStatus = headers.split("\r\n")[0];
      const status = parseInt(linhaStatus.split(" ")[1], 10);

      if (status === 401) {
        falhar(
          new ErroAutenticacaoArtsoft(
            `Autenticação falhou (digest inválido): ${corpo.substring(0, 200)}`
          )
        );
        return;
      }

      if (status !== 200 && status !== 204) {
        falhar(
          new ErroConexaoArtsoft(
            `HTTP ${status}: ${corpo.substring(0, 500)}`
          )
        );
        return;
      }

      terminado = true;
      resolve(corpo);
    });
  });
}
