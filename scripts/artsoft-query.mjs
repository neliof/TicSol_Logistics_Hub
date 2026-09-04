#!/usr/bin/env node
/**
 * Ferramenta de diagnóstico do ARTSOFT WebServer.
 *
 * Credenciais lidas do .env (nunca hardcoded):
 *   ARTSOFT_HOST, ARTSOFT_PORTA, ARTSOFT_UTILIZADOR, ARTSOFT_SENHA
 *
 * Uso:
 *   node scripts/artsoft-query.mjs ping
 *       Testa login + digest contra o WebServer.
 *
 *   node scripts/artsoft-query.mjs schema <Tabela>
 *       Lista os campos disponíveis numa tabela (DocFch, DocLan, TerFch…).
 *
 *   node scripts/artsoft-query.mjs series <AAAAMMDD> <AAAAMMDD>
 *       Mostra que séries existem no intervalo e o TpSAFT de cada uma.
 *
 *   node scripts/artsoft-query.mjs guias <AAAAMMDD> <AAAAMMDD> [serie]
 *       Amostra de guias com cabeçalho, campos logísticos e linhas.
 */

import dotenv from "dotenv";
import { executarPedidoArtsoft } from "../artsoft-sync/artsoft/connection.js";

dotenv.config();

const cfg = {
  host: process.env.ARTSOFT_HOST,
  porta: Number(process.env.ARTSOFT_PORTA),
  utilizador: process.env.ARTSOFT_UTILIZADOR,
  senha: process.env.ARTSOFT_SENHA,
};

for (const [chave, valor] of Object.entries(cfg)) {
  if (!valor) {
    console.error(
      `ERRO: falta ARTSOFT_${chave.toUpperCase()} no .env ` +
        `(ver .env.example em artsoft-sync/)`
    );
    process.exit(1);
  }
}

/** Extrai os <rec> de uma resposta em objetos simples. */
function extrairRegistos(xml) {
  return [...xml.matchAll(/<rec>(.*?)<\/rec>/gs)].map((m) => {
    const o = {};
    for (const f of m[1].matchAll(/<(\w+)>(.*?)<\/\1>/g)) o[f[1]] = f[2];
    return o;
  });
}

const [comando, ...args] = process.argv.slice(2);

switch (comando) {
  case "ping": {
    const xml =
      "<?xml version='1.0'?><root><Licence form='(Licence)'/></root>";
    const r = await executarPedidoArtsoft({ ...cfg, xml });
    console.log(`OK — ${cfg.host}:${cfg.porta} respondeu ${r.length} bytes`);
    console.log(r.substring(0, 300));
    break;
  }

  case "schema": {
    const tabela = args[0];
    if (!tabela) {
      console.error("ERRO: indicar a tabela. ex: schema DocFch");
      process.exit(1);
    }
    const r = await executarPedidoArtsoft({
      ...cfg,
      endpoint: "ArtDB/_TblDesc",
      xml: `<Table table='${tabela}' type='f' ord='0' />`,
    });
    console.log(r);
    break;
  }

  case "series": {
    const [ini, fim] = args;
    if (!/^\d{8}$/.test(ini || "") || !/^\d{8}$/.test(fim || "")) {
      console.error("ERRO: datas em AAAAMMDD. ex: series 20260801 20260831");
      process.exit(1);
    }
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<root type='list' end='1000' name='rec' query='DocFch|DocData|TpDoc=V1:V999|Data=${ini}:${fim}'>
  <defcol>
    <Serie form='%DocFch.Doc.Serie'/>
    <TpSAFT form='%DocFch.Inf.TpSAFT'/>
    <Nome form='%DocFch.Doc.Nome'/>
  </defcol>
</root>`;
    const recs = extrairRegistos(await executarPedidoArtsoft({ ...cfg, xml }));
    const contagem = {};
    for (const x of recs) {
      const k = `${x.Serie}|${x.TpSAFT}|${x.Nome || ""}`;
      contagem[k] = (contagem[k] || 0) + 1;
    }
    console.log(`${recs.length} documentos entre ${ini} e ${fim}\n`);
    console.log("Série  TpSAFT  Nome                          Docs");
    for (const [k, v] of Object.entries(contagem).sort()) {
      const [s, t, n] = k.split("|");
      console.log(`${s.padEnd(7)}${t.padEnd(8)}${n.padEnd(30)}${v}`);
    }
    const guias = [
      ...new Set(
        Object.keys(contagem)
          .filter((k) => ["GT", "GR", "GA", "GC", "GD"].includes(k.split("|")[1]))
          .map((k) => k.split("|")[0])
      ),
    ];
    console.log(`\nSéries de guia: ${guias.join(";") || "(nenhuma)"}`);
    break;
  }

  case "guias": {
    const [ini, fim, serie = "V990"] = args;
    if (!/^\d{8}$/.test(ini || "") || !/^\d{8}$/.test(fim || "")) {
      console.error(
        "ERRO: datas em AAAAMMDD. ex: guias 20260801 20260808 V990"
      );
      process.exit(1);
    }
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<root type='list' end='3' name='rec' query='DocFch|DocData|TpDoc=${serie}:${serie}|Data=${ini}:${fim} ^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}'>
  <defcol>
    <Serie form='%DocFch.Doc.Serie'/>
    <NrDoc form='%DocFch.Doc.NrDoc'/>
    <DocID form='%DocFch.Doc.ID'/>
    <Data form='%DocFch.Data.Docum'/>
    <TpSAFT form='%DocFch.Inf.TpSAFT'/>
    <TerNome form='%TerFch.Ter.Nome'/>
    <Matricula form='%DocFch.Inf.Matricula'/>
    <LocCarga form='%DocFch.Doc.LocCarga'/>
    <LocDesc form='%DocFch.Doc.LocDesc'/>
    <DataCarga form='%DocFch.Doc.DataCarga'/>
    <HoraCarga form='%DocFch.Doc.HoraCarga'/>
    <PesoBr form='%DocFch.Log.PesoBr'/>
    <NrVol form='%DocFch.Log.NrVol'/>
    <Lans type='list' name='lan' query='DocLan|Document|TpDoc={%DocFch.Doc.Serie}|NrDoc={%DocFch.Doc.NrDoc}'>
      <defcol>
        <NrLin form='%DocLan.Doc.NrLin'/>
        <Codigo form='%DocLan.Cod.Codigo'/>
        <Descric form='%DocLan.Div.Descric'/>
        <Qtd form='%DocLan.Qtd.Movim'/>
      </defcol>
    </Lans>
  </defcol>
</root>`;
    const r = await executarPedidoArtsoft({ ...cfg, xml });
    console.log(r.replace(/></g, ">\n<"));
    break;
  }

  default:
    console.error(
      "Comandos: ping | schema <Tabela> | series <ini> <fim> | guias <ini> <fim> [serie]"
    );
    process.exit(1);
}
