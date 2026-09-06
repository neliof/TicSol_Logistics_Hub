/**
 * Testes das conversões do mapper de produtos.
 *
 * node --test produtos/test/mapper.test.js
 */

import assert from "assert";
import { describe, it } from "node:test";
import { flagParaBool, numeroOuNull, inteiroOuNull, normalizarEan } from "../mapper.js";

describe("produtos/mapper.js", () => {
  describe("flagParaBool()", () => {
    it("reconhece verdadeiros ARTSOFT", () => {
      for (const v of ["1", "S", "s", "Sim", "TRUE", "Y"]) {
        assert.strictEqual(flagParaBool(v), true, `esperado true para '${v}'`);
      }
    });
    it("reconhece falsos ARTSOFT", () => {
      for (const v of ["0", "N", "n", "Nao", "FALSE"]) {
        assert.strictEqual(flagParaBool(v), false, `esperado false para '${v}'`);
      }
    });
    it("usa o fallback quando ausente ou indecifrável", () => {
      assert.strictEqual(flagParaBool("", true), true);
      assert.strictEqual(flagParaBool(null, true), true);
      assert.strictEqual(flagParaBool("xyz", false), false);
    });
  });

  describe("numeroOuNull()", () => {
    it("aceita ponto e vírgula decimal", () => {
      assert.strictEqual(numeroOuNull("1.5"), 1.5);
      assert.strictEqual(numeroOuNull("1,5"), 1.5);
    });
    it("preserva zero legítimo", () => {
      assert.strictEqual(numeroOuNull("0"), 0);
    });
    it("devolve null para vazio ou lixo", () => {
      assert.strictEqual(numeroOuNull(""), null);
      assert.strictEqual(numeroOuNull(null), null);
      assert.strictEqual(numeroOuNull("abc"), null);
    });
  });

  describe("inteiroOuNull()", () => {
    it("trunca decimais", () => {
      assert.strictEqual(inteiroOuNull("12.9"), 12);
    });
    it("trata 0 como null (sem significado útil)", () => {
      assert.strictEqual(inteiroOuNull("0"), null);
    });
  });

  describe("normalizarEan()", () => {
    it("aceita EAN de dígitos até 13 posições", () => {
      assert.strictEqual(normalizarEan("4042809105773"), "4042809105773");
      assert.strictEqual(normalizarEan("42078869"), "42078869");
    });
    it("rejeita códigos com mais de 13 dígitos", () => {
      assert.strictEqual(normalizarEan("C410101RH000975304"), null);
      assert.strictEqual(normalizarEan("50030247970135"), null); // 14 dígitos
    });
    it("rejeita códigos com letras e o vazio", () => {
      assert.strictEqual(normalizarEan("ABC123"), null);
      assert.strictEqual(normalizarEan(""), null);
      assert.strictEqual(normalizarEan(null), null);
    });
  });
});
