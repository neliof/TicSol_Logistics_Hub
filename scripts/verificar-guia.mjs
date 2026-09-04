#!/usr/bin/env node
/**
 * Verifica o guia gerado: recursos externos, termos técnicos que não devem
 * lá estar, imagens partidas, âncoras e layout em largura estreita.
 */

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ficheiro = join(process.cwd(), "docs", "GUIA_UTILIZADOR.html");
const html = readFileSync(ficheiro, "utf8");
let problemas = 0;

function verificar(nome, ok, detalhe = "") {
  console.log(`${ok ? "OK  " : "FALHA"}  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) problemas++;
}

// 1. Recursos externos
const externos = [
  ...html.matchAll(/<(?:link|script)[^>]+(?:href|src)=["']([^"']+)["']/gi),
].map((m) => m[1]);
verificar(
  "sem recursos externos",
  externos.length === 0,
  externos.join(", ")
);

const imgsExternas = [...html.matchAll(/<img[^>]+src=["'](?!data:)([^"']+)/gi)];
verificar("todas as imagens embutidas", imgsExternas.length === 0);

// 2. Termos que não pertencem a um guia de utilizador final
const PROIBIDOS = [
  "npm ", "node ", "psql", "SQL", "SELECT ", "migration", "migração de base",
  ".env", "endpoint", "API", "localhost", "JWT", "token", "Docker",
  "deploy", "código-fonte", "repositório", "PostgreSQL", "backup",
];
const encontrados = PROIBIDOS.filter((t) =>
  new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
    // Ignorar o CSS e o base64 das imagens.
    html.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/base64,[^"]+/g, "")
  )
);
verificar("sem jargão técnico", encontrados.length === 0, encontrados.join(", "));

// 3. Render no browser
const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1400, height: 1000 },
  deviceScaleFactor: 1,
});
const pagina = await contexto.newPage();

const errosConsola = [];
pagina.on("console", (m) => m.type() === "error" && errosConsola.push(m.text()));
pagina.on("pageerror", (e) => errosConsola.push(e.message));

await pagina.goto("file:///" + resolve(ficheiro).replace(/\\/g, "/"), {
  waitUntil: "load",
});

verificar("sem erros de consola", errosConsola.length === 0, errosConsola[0] || "");

const imagens = await pagina.evaluate(() =>
  [...document.images].map((i) => ({ ok: i.complete && i.naturalWidth > 0 }))
);
verificar(
  `${imagens.length} imagens carregadas`,
  imagens.length > 0 && imagens.every((i) => i.ok)
);

// 4. Âncoras do índice
const ancoras = await pagina.evaluate(() =>
  [...document.querySelectorAll(".indice a")].map((a) => ({
    destino: a.getAttribute("href"),
    existe: !!document.querySelector(a.getAttribute("href")),
  }))
);
verificar(
  `${ancoras.length} âncoras do índice válidas`,
  ancoras.length > 0 && ancoras.every((a) => a.existe),
  ancoras.filter((a) => !a.existe).map((a) => a.destino).join(", ")
);

// 5. Sem scroll horizontal, em largura normal e estreita
for (const largura of [1400, 700, 380]) {
  await pagina.setViewportSize({ width: largura, height: 1000 });
  await pagina.waitForTimeout(200);
  const excesso = await pagina.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  verificar(`sem scroll horizontal a ${largura}px`, excesso <= 1, `excesso ${excesso}px`);
}

// 6. Capturas para revisão visual
await pagina.setViewportSize({ width: 1400, height: 1000 });
await pagina.waitForTimeout(300);
await pagina.screenshot({
  path: join(process.cwd(), "docs", "imagens", "_revisao-guia-topo.png"),
});

await pagina.setViewportSize({ width: 420, height: 900 });
await pagina.waitForTimeout(300);
await pagina.screenshot({
  path: join(process.cwd(), "docs", "imagens", "_revisao-guia-estreito.png"),
});

await navegador.close();

console.log(
  problemas === 0
    ? "\nGuia verificado sem problemas."
    : `\n${problemas} verificação(ões) falharam.`
);
process.exit(problemas === 0 ? 0 : 1);
