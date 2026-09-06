/**
 * Testes das conversões e agregação do mapper de stock.
 * node --test stock/test/mapper.test.js
 */

import assert from "assert";
import { describe, it } from "node:test";
import { numero, agregarSaldos } from "../mapper.js";

describe("stock/mapper.js", () => {
  describe("numero()", () => {
    it("aceita ponto e vírgula", () => {
      assert.strictEqual(numero("1.5"), 1.5);
      assert.strictEqual(numero("1,5"), 1.5);
    });
    it("vazio ou lixo vira 0 (neutro para soma)", () => {
      assert.strictEqual(numero(""), 0);
      assert.strictEqual(numero(null), 0);
      assert.strictEqual(numero("abc"), 0);
    });
  });

  describe("agregarSaldos()", () => {
    it("soma entrada menos saída por código", () => {
      const linhas = [
        { codigo: "A1", qtd_entrada: "5", qtd_saida: "1" },
        { codigo: "A1", qtd_entrada: "4", qtd_saida: "0" },
        { codigo: "A2", qtd_entrada: "10", qtd_saida: "3" },
      ];
      const s = agregarSaldos(linhas);
      assert.strictEqual(s.get("A1"), 8); // (5-1)+(4-0)
      assert.strictEqual(s.get("A2"), 7); // 10-3
    });

    it("ignora linhas sem código", () => {
      const s = agregarSaldos([{ qtd_entrada: "5" }, { codigo: "A1", qtd_entrada: "2" }]);
      assert.strictEqual(s.size, 1);
      assert.strictEqual(s.get("A1"), 2);
    });

    it("saldo pode ser negativo (saídas > entradas)", () => {
      const s = agregarSaldos([{ codigo: "A1", qtd_entrada: "1", qtd_saida: "3" }]);
      assert.strictEqual(s.get("A1"), -2);
    });

    it("lista vazia devolve mapa vazio", () => {
      assert.strictEqual(agregarSaldos([]).size, 0);
    });
  });
});
