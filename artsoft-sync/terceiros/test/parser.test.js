/**
 * Testes do parser de terceiros (TerFch).
 * node --test terceiros/test/parser.test.js
 */

import assert from "assert";
import { describe, it } from "node:test";
import { parseTerceirosResponse, ErroParserTerceiro } from "../parser.js";

describe("terceiros/parser.js", () => {
  it("rejeita raiz nula", () => {
    assert.throws(() => parseTerceirosResponse(null), ErroParserTerceiro);
  });

  it("devolve array vazio para <root/>", () => {
    assert.deepStrictEqual(parseTerceirosResponse({}), []);
  });

  it("parse de um cliente", () => {
    const raiz = {
      rec: {
        CliNum: "2",
        Nome: "FARMÁCIA DO VALE VERDE",
        Nif: "511240686",
        Morada: "SÍTIO DAS CASAS",
        Localid: "CURRAL",
        CPPais: "9030-319",
      },
    };
    const t = parseTerceirosResponse(raiz);
    assert.strictEqual(t.length, 1);
    assert.strictEqual(t[0].numero, "2");
    assert.strictEqual(t[0].nome, "FARMÁCIA DO VALE VERDE");
    assert.strictEqual(t[0].nif, "511240686");
  });

  it("lê o número por CliNum, ForNum ou Numero", () => {
    assert.strictEqual(parseTerceirosResponse({ rec: { ForNum: "7", Nome: "F" } })[0].numero, "7");
    assert.strictEqual(parseTerceirosResponse({ rec: { Numero: "9", Nome: "N" } })[0].numero, "9");
  });

  it("ignora registos sem número ou com número 0", () => {
    const raiz = {
      rec: [
        { Nome: "Sem número" },
        { CliNum: "0", Nome: "Zero" },
        { CliNum: "5", Nome: "Válido" },
      ],
    };
    const t = parseTerceirosResponse(raiz);
    assert.strictEqual(t.length, 1);
    assert.strictEqual(t[0].numero, "5");
  });
});
