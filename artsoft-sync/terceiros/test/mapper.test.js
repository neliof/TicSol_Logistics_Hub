/**
 * Testes das conversões do mapper de terceiros.
 * node --test terceiros/test/mapper.test.js
 */

import assert from "assert";
import { describe, it } from "node:test";
import { comporMorada } from "../mapper.js";

describe("terceiros/mapper.js", () => {
  describe("comporMorada()", () => {
    it("junta morada, localidade e código postal", () => {
      assert.strictEqual(
        comporMorada({ morada: "Rua X, 1", localidade: "Funchal", cod_postal: "9000-001" }),
        "Rua X, 1, Funchal, 9000-001"
      );
    });
    it("ignora partes vazias", () => {
      assert.strictEqual(comporMorada({ morada: "Rua X", localidade: "", cod_postal: null }), "Rua X");
    });
    it("devolve null quando tudo vazio", () => {
      assert.strictEqual(comporMorada({ morada: "", localidade: null }), null);
    });
  });
});
