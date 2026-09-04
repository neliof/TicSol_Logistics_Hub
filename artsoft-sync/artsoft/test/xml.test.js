/**
 * Testes para XML parsing seguro.
 *
 * npm test -- artsoft/test/xml.test.js
 */

import assert from "assert";
import { describe, it } from "node:test";
import { parseXml, texto, textoDe, comoLista, escaparXml, ErroXmlArtsoft } from "../xml.js";

describe("xml.js", () => {
  describe("parseXml()", () => {
    it("rejeita DOCTYPE", () => {
      const xml = `<?xml version='1.0'?><!DOCTYPE foo [ ]><root/>`;
      assert.throws(() => parseXml(xml), /DOCTYPE.*rejeitado/i);
    });

    it("rejeita ENTITY", () => {
      const xml = `<?xml version='1.0'?><!ENTITY foo "bar"><root/>`;
      assert.throws(() => parseXml(xml), /ENTITY.*rejeitado/i);
    });

    it("aceita XML válido simples", () => {
      const xml = `<?xml version='1.0'?><root><valor>teste</valor></root>`;
      const obj = parseXml(xml);
      assert.strictEqual(obj.root.valor, "teste");
    });

    it("valida tamanho", () => {
      const grande = "x".repeat(100 * 1024 * 1024);
      const xml = `<?xml version='1.0'?><root>${grande}</root>`;
      assert.throws(() => parseXml(xml), /tamanho máximo/i);
    });
  });

  describe("texto()", () => {
    it("string simples", () => {
      assert.strictEqual(texto("  ola  "), "ola");
    });

    it("vazio -> null", () => {
      assert.strictEqual(texto(""), null);
      assert.strictEqual(texto("  "), null);
    });

    it("objeto com #text", () => {
      assert.strictEqual(texto({ "#text": "conteudo" }), "conteudo");
    });

    it("null/undefined -> null", () => {
      assert.strictEqual(texto(null), null);
      assert.strictEqual(texto(undefined), null);
    });
  });

  describe("textoDe()", () => {
    it("primeiro tag não vazio", () => {
      const no = { Tag1: "", Tag2: "  valor  ", Tag3: "outro" };
      assert.strictEqual(textoDe(no, "Tag1", "Tag2", "Tag3"), "valor");
    });

    it("nenhum encontrado -> null", () => {
      const no = { Tag1: "", Tag2: "" };
      assert.strictEqual(textoDe(no, "Tag1", "Tag2"), null);
    });
  });

  describe("comoLista()", () => {
    it("array fica array", () => {
      const arr = [{ a: 1 }, { b: 2 }];
      assert.deepStrictEqual(comoLista(arr), arr);
    });

    it("objeto vira array com 1 elemento", () => {
      const obj = { a: 1 };
      assert.deepStrictEqual(comoLista(obj), [obj]);
    });

    it("null/undefined -> []", () => {
      assert.deepStrictEqual(comoLista(null), []);
      assert.deepStrictEqual(comoLista(undefined), []);
    });
  });

  describe("escaparXml()", () => {
    it("escapa caracteres perigosos", () => {
      assert.strictEqual(escaparXml('a&b<c>d"e\'f'), "a&amp;b&lt;c&gt;d&quot;e&apos;f");
    });

    it("preserva texto seguro", () => {
      assert.strictEqual(escaparXml("teste123"), "teste123");
    });

    it("numero", () => {
      assert.strictEqual(escaparXml(42), "42");
    });

    it("null -> string vazio", () => {
      assert.strictEqual(escaparXml(null), "");
    });
  });
});
