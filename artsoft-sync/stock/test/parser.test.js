/**
 * Testes do parser de stock (StkAgr).
 * node --test stock/test/parser.test.js
 */

import assert from "assert";
import { describe, it } from "node:test";
import { parseStockResponse, ErroParserStock } from "../parser.js";

describe("stock/parser.js", () => {
  it("rejeita raiz nula", () => {
    assert.throws(() => parseStockResponse(null), ErroParserStock);
  });

  it("devolve array vazio para <root/>", () => {
    assert.deepStrictEqual(parseStockResponse({}), []);
  });

  it("parse de uma linha de stock", () => {
    const raiz = {
      rec: {
        Codigo: "C41050316004",
        NrArm: "1",
        DtValid: "20270714",
        QtdEntr: "5",
        QtdSaid: "0",
        QtdCativa: "0",
      },
    };
    const l = parseStockResponse(raiz);
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].codigo, "C41050316004");
    assert.strictEqual(l[0].armazem, "1");
    assert.strictEqual(l[0].data_validade, "20270714");
    assert.strictEqual(l[0].qtd_entrada, "5");
    assert.strictEqual(l[0].qtd_saida, "0");
  });

  it("parse de várias linhas (mesmo produto, validades diferentes)", () => {
    const raiz = {
      rec: [
        { Codigo: "A1", DtValid: "20270714", QtdEntr: "5", QtdSaid: "1" },
        { Codigo: "A1", DtValid: "20270918", QtdEntr: "4", QtdSaid: "0" },
      ],
    };
    const l = parseStockResponse(raiz);
    assert.strictEqual(l.length, 2);
  });

  it("ignora linhas sem código", () => {
    const raiz = { rec: [{ QtdEntr: "5" }, { Codigo: "A2", QtdEntr: "3" }] };
    const l = parseStockResponse(raiz);
    assert.strictEqual(l.length, 1);
    assert.strictEqual(l[0].codigo, "A2");
  });
});
