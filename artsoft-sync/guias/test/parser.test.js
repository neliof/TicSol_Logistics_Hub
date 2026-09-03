/**
 * Testes para parser de guias de transporte.
 *
 * npm test -- guias/test/parser.test.js
 */

import assert from "assert";
import { parseGuiasResponse, ErroParserGuia } from "../parser.js";

describe("parser.js", () => {
  describe("parseGuiasResponse()", () => {
    it("rejeita raiz nula", () => {
      assert.throws(
        () => parseGuiasResponse(null),
        /nula ou não é objeto/
      );
    });

    it("devolve array vazio para <root/>", () => {
      const raiz = {};
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 0);
    });

    it("parse documento mínimo (sem linhas)", () => {
      const raiz = {
        rec: {
          DocID: "V960-001-2024-11-15",
          DocSerie: "V960",
          DocNrDoc: "001",
        },
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 1);
      const doc = docs[0];
      assert.strictEqual(doc.serie, "V960");
      assert.strictEqual(doc.numero, "001");
      assert.strictEqual(doc.linhas.length, 0);
    });

    it("parse documento com linhas", () => {
      const raiz = {
        rec: {
          DocID: "V960-002-2024-11-15",
          DocSerie: "V960",
          DocNrDoc: "002",
          DataDocum: "15/11/2024",
          InfTpSAFT: "GR",
          TerTerceiro: "CLI001",
          TerNome: "Cliente XYZ",
          Lans: {
            rec: [
              {
                DocNrLan: "1",
                Artigo: "ART001",
                Nome: "Produto A",
                Qtd: "10",
                Unid: "UN",
              },
              {
                DocNrLan: "2",
                Artigo: "ART002",
                Nome: "Produto B",
                Qtd: "5",
                Unid: "UN",
              },
            ],
          },
        },
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 1);
      const doc = docs[0];
      assert.strictEqual(doc.serie, "V960");
      assert.strictEqual(doc.numero, "002");
      assert.strictEqual(doc.tipo_saft, "GR");
      assert.strictEqual(doc.linhas.length, 2);
      assert.strictEqual(doc.linhas[0].artigo_codigo, "ART001");
      assert.strictEqual(doc.linhas[0].quantidade, "10");
      assert.strictEqual(doc.linhas[1].artigo_codigo, "ART002");
    });

    it("parse múltiplos documentos", () => {
      const raiz = {
        rec: [
          {
            DocID: "V960-001",
            DocSerie: "V960",
            DocNrDoc: "001",
          },
          {
            DocID: "V960-002",
            DocSerie: "V960",
            DocNrDoc: "002",
          },
        ],
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 2);
      assert.strictEqual(docs[0].numero, "001");
      assert.strictEqual(docs[1].numero, "002");
    });

    it("lida com linhas vazias/null", () => {
      const raiz = {
        rec: {
          DocSerie: "V960",
          DocNrDoc: "003",
          Lans: {
            rec: null,
          },
        },
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 1);
      assert.strictEqual(docs[0].linhas.length, 0);
    });

    it("rejeita documento sem série", () => {
      const raiz = {
        rec: {
          DocID: "doc-001",
          DocNrDoc: "001",
          // falta DocSerie
        },
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 0); // skipped por erro
    });

    it("extrai campos CDU de cabeçalho", () => {
      const raiz = {
        rec: {
          DocSerie: "V960",
          DocNrDoc: "004",
          CDUNm_01: "CAMPO_1",
          CDU_01: "valor~um",
          CDUNm_02: "CAMPO_2",
          CDU_02: "valor_dois",
        },
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 1);
      const doc = docs[0];
      // CDU extrai normalizando ~ → último segmento
      assert.ok(doc.dados_extra);
    });

    it("preserva artigo_codigo mesmo sem match de produto", () => {
      const raiz = {
        rec: {
          DocSerie: "V960",
          DocNrDoc: "005",
          Lans: {
            rec: {
              Artigo: "INEXISTENTE",
              Nome: "Artigo desconhecido",
              Qtd: "1",
            },
          },
        },
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs[0].linhas[0].artigo_codigo, "INEXISTENTE");
    });

    it("fallthrough textoDe com aliases", () => {
      const raiz = {
        rec: {
          // DocSerie ausente, tenta Serie e Doc.Serie
          Serie: "V960",
          DocNrDoc: "006",
        },
      };
      const docs = parseGuiasResponse(raiz);
      assert.strictEqual(docs.length, 1);
      assert.strictEqual(docs[0].serie, "V960");
    });
  });
});
