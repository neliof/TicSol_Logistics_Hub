import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";

/**
 * Conector de ficheiros — para o caso de 192.168.1.120:4219 ser uma
 * partilha/FTP onde o ARTSOFT larga exportações CSV/TXT periódicas
 * (o padrão que já usaste antes noutras integrações: TSV/CSV em
 * Latin-1/Windows-1252, não UTF-8 — os ERPs portugueses fazem sempre
 * isto por causa dos acentos).
 *
 * Espera 4 ficheiros na pasta configurada: produtos.csv, clientes.csv,
 * fornecedores.csv, stock.csv — separador `;` (o mais comum em exports
 * portugueses para não colidir com vírgulas decimais). Ajusta
 * `separador`/nomes de ficheiro no .env se o teu export for diferente.
 */
export function criarConectorFile({ pasta, separador = ";", encoding = "latin1" }) {
  async function lerCsv(nomeFicheiro) {
    const caminho = path.join(pasta, nomeFicheiro);
    const buffer = await readFile(caminho);
    const texto = encoding === "latin1" ? iconv.decode(buffer, "win1252") : buffer.toString("utf-8");
    return parse(texto, {
      columns: true,
      delimiter: separador,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
  }

  function numOuNull(v) {
    if (v == null || v === "") return null;
    // exports portugueses costumam vir com vírgula decimal
    const n = Number(String(v).replace(",", "."));
    return Number.isNaN(n) ? null : n;
  }

  return {
    async buscarProdutos() {
      const linhas = await lerCsv("produtos.csv");
      return linhas.map((r) => ({
        codigo_interno: String(r.codigo ?? r.CODIGO),
        ean13: r.ean13 || r.EAN13 || null,
        gtin_caixa: r.gtin_caixa || null,
        descricao: r.descricao ?? r.DESCRICAO,
        categoria: r.familia ?? r.FAMILIA ?? null,
        peso_liquido_kg: numOuNull(r.peso ?? r.PESO),
        unidades_por_caixa: numOuNull(r.unid_caixa ?? r.UNID_CAIXA),
        ti: numOuNull(r.ti ?? r.TI),
        hi: numOuNull(r.hi ?? r.HI),
        fornecedor_codigo: r.cod_fornecedor ?? r.COD_FORNECEDOR ?? null,
      }));
    },

    async buscarClientes() {
      const linhas = await lerCsv("clientes.csv");
      return linhas.map((r) => ({
        codigo_interno: String(r.codigo ?? r.CODIGO),
        nome: r.nome ?? r.NOME,
        nif: r.nif ?? r.NIF ?? null,
        morada: r.morada ?? r.MORADA ?? null,
      }));
    },

    async buscarFornecedores() {
      const linhas = await lerCsv("fornecedores.csv");
      return linhas.map((r) => ({
        codigo_interno: String(r.codigo ?? r.CODIGO),
        nome: r.nome ?? r.NOME,
        nif: r.nif ?? r.NIF ?? null,
        morada: r.morada ?? r.MORADA ?? null,
      }));
    },

    async buscarStock() {
      const linhas = await lerCsv("stock.csv");
      return linhas.map((r) => ({
        produto_codigo: String(r.cod_artigo ?? r.codigo ?? r.CODIGO),
        quantidade: numOuNull(r.quantidade ?? r.QUANTIDADE) ?? 0,
      }));
    },
  };
}
