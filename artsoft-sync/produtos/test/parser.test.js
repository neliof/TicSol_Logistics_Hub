/**
 * Testes para o parser de fichas de artigo (StkFch).
 *
 * node --test produtos/test/parser.test.js
 */

import assert from "assert";
import { describe, it } from "node:test";
import { parseProdutosResponse, ErroParserProduto } from "../parser.js";

describe("produtos/parser.js", () => {
  describe("parseProdutosResponse()", () => {
    it("rejeita raiz nula", () => {
      assert.throws(() => parseProdutosResponse(null), ErroParserProduto);
    });

    it("devolve array vazio para <root/>", () => {
      assert.deepStrictEqual(parseProdutosResponse({}), []);
    });

    it("parse de um artigo (rec único, não-array)", () => {
      const raiz = {
        rec: {
          Codigo: "C4001001521",
          Descricao: "LEUKOPLAST 1.25X5",
          Unidade: "UND",
          CodOpc: "42078869",
          PesoLiq: "0.15",
          CtrlLote: "1",
          CtrlValid: "0",
        },
      };
      const p = parseProdutosResponse(raiz);
      assert.strictEqual(p.length, 1);
      assert.strictEqual(p[0].codigo, "C4001001521");
      assert.strictEqual(p[0].descricao, "LEUKOPLAST 1.25X5");
      assert.strictEqual(p[0].ean, "42078869");
      assert.strictEqual(p[0].peso_liquido, "0.15");
      assert.strictEqual(p[0].controla_lote, "1");
      assert.strictEqual(p[0].unidade, "UND");
    });

    it("parse de vários artigos (rec array)", () => {
      const raiz = {
        rec: [
          { Codigo: "A1", Descricao: "Um" },
          { Codigo: "A2", Descricao: "Dois" },
        ],
      };
      const p = parseProdutosResponse(raiz);
      assert.strictEqual(p.length, 2);
      assert.deepStrictEqual(p.map((x) => x.codigo), ["A1", "A2"]);
    });

    it("ignora registos sem código", () => {
      const raiz = {
        rec: [
          { Descricao: "Sem código" },
          { Codigo: "A2", Descricao: "Válido" },
        ],
      };
      const p = parseProdutosResponse(raiz);
      assert.strictEqual(p.length, 1);
      assert.strictEqual(p[0].codigo, "A2");
    });

    it("não converte tipos: pesos e flags ficam string", () => {
      const raiz = { rec: { Codigo: "A1", PesoLiq: "1.5", CtrlLote: "1" } };
      const p = parseProdutosResponse(raiz);
      assert.strictEqual(typeof p[0].peso_liquido, "string");
      assert.strictEqual(typeof p[0].controla_lote, "string");
    });

    it("preserva códigos com zeros à esquerda", () => {
      const raiz = { rec: { Codigo: "0012", Descricao: "X" } };
      const p = parseProdutosResponse(raiz);
      assert.strictEqual(p[0].codigo, "0012");
    });
  });
});
