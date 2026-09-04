#!/usr/bin/env node
/**
 * Captura os ecrãs da aplicação para o guia de utilizador.
 *
 * Os dados reais (clientes, NIFs, moradas) são substituídos por dados de
 * demonstração fictícios ANTES de qualquer captura, interceptando as respostas
 * da API. Nenhuma captura contém informação real.
 *
 * Uso: node scripts/capturar-guia.mjs
 * Requer: servidor em :3000 e frontend em :5173 a correr.
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const DESTINO = join(process.cwd(), "docs", "imagens");
mkdirSync(DESTINO, { recursive: true });

const CREDENCIAIS = { email: "operador@ticsol.pt", password: "Demo2026!" };

// ---- Dados de demonstração (fictícios) -------------------------------------

const CLIENTES = [
  { nome: "Distribuição Atlântico, Lda.", nif: "500111222" },
  { nome: "Supermercados Ilha Verde, S.A.", nif: "500333444" },
  { nome: "Comércio Bela Vista, Lda.", nif: "500555666" },
  { nome: "Armazéns do Sul, S.A.", nif: "500777888" },
];

const MORADAS_DESCARGA = [
  "Rua das Amoreiras 14 / Vila Nova / 9000-100 Funchal",
  "Estrada Regional 104, km 3 / Ribeira Brava / 9350-200 Ribeira Brava",
  "Avenida do Mar 88 / Machico / 9200-050 Machico",
];

const MORADA_CARGA =
  "Caminho do Armazém 12, Nave B / Zona Industrial / 9000-000 Funchal";

const ARTIGOS = [
  "Frigideira antiaderente 28 cm",
  "Tacho com tampa de vidro 24 cm",
  "Caixa hermética 1,2 L",
  "Conjunto de facas de cozinha",
  "Tabuleiro de forno 40 cm",
  "Panela de pressão 6 L",
  "Jarro medidor 1 L",
  "Escorredor de massa 26 cm",
  "Wok em aço inoxidável 30 cm",
  "Conjunto de taças de servir",
  "Grelhador de mesa 32 cm",
  "Cafeteira de filtro 1,5 L",
];

const OBSERVACOES = [
  "",
  "Entrega em horário de manhã",
  "Confirmar receção com o encarregado",
  "",
];

function anonimizarDocumento(doc, indice) {
  const cliente = CLIENTES[indice % CLIENTES.length];
  let extra = {};
  try {
    extra = JSON.parse(doc.conteudo_xml || "{}");
  } catch {
    extra = {};
  }

  // Números de guia e de encomenda são sequências reais: substituídos por
  // séries de demonstração que mantêm o mesmo formato.
  const numeroDemo = `V990/2026${String(1000 + indice).padStart(4, "0")}`;

  return {
    ...doc,
    numero: numeroDemo,
    origem_doc_id: numeroDemo,
    conteudo_xml: JSON.stringify({
      ...extra,
      numero: numeroDemo.split("/")[1],
      terceiro_nome: cliente.nome,
      terceiro_nif: cliente.nif,
      morada_carga: MORADA_CARGA,
      morada_descarga: MORADAS_DESCARGA[indice % MORADAS_DESCARGA.length],
      hora_carga: extra.hora_carga || "09:30:00",
      matricula: indice % 3 === 0 ? "" : `AA-${10 + (indice % 80)}-BB`,
      volumes: String((indice % 6) + 1),
      peso: String(((indice % 9) + 1) * 12.5),
      pedido_origem: `EC${String(4200 + indice).padStart(5, "0")}`,
      observacoes: OBSERVACOES[indice % OBSERVACOES.length],
    }),
  };
}

function anonimizarLinha(linha, indice) {
  return {
    ...linha,
    descricao: ARTIGOS[indice % ARTIGOS.length],
    artigo_codigo: `ART${String(1000 + (indice % 350)).padStart(6, "0")}`,
  };
}

// ---- Captura ---------------------------------------------------------------

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  viewport: { width: 1800, height: 1100 },
  deviceScaleFactor: 2,
  locale: "pt-PT",
  colorScheme: "light",
});
const pagina = await contexto.newPage();

// Substituir dados reais por demonstração em todas as respostas da API.
await pagina.route("**/rest/v1/**", async (rota) => {
  const resposta = await rota.fetch();
  let corpo;
  try {
    corpo = await resposta.json();
  } catch {
    return rota.fulfill({ response: resposta });
  }

  if (!Array.isArray(corpo)) return rota.fulfill({ response: resposta });

  const url = rota.request().url();
  let novo = corpo;
  // Atenção à ordem: /documento/<id>/linhas também contém "/documento".
  if (url.includes("/linhas") || url.includes("/linha_documento")) {
    novo = corpo.map(anonimizarLinha);
  } else if (url.includes("/documento")) {
    novo = corpo.map(anonimizarDocumento);
  }

  await rota.fulfill({ response: resposta, json: novo });
});

const capturas = [];

/**
 * Captura o ecrã. Sem seletor, recorta à altura real do conteúdo para não
 * deixar meia imagem em branco.
 */
async function capturar(nome, descricao, seletor = null) {
  const caminho = join(DESTINO, `${nome}.png`);

  if (seletor) {
    await pagina.locator(seletor).screenshot({ path: caminho });
  } else {
    // O clip é relativo à viewport: sem voltar ao topo, o cabeçalho fica fora.
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await pagina.waitForTimeout(200);
    const altura = await pagina.evaluate(() => {
      const conteudo = document.querySelector(".conteudo");
      if (!conteudo) return document.body.scrollHeight;
      const fim = conteudo.getBoundingClientRect().bottom + window.scrollY;
      return Math.ceil(fim + 24);
    });
    const largura = pagina.viewportSize().width;
    await pagina.screenshot({
      path: caminho,
      clip: { x: 0, y: 0, width: largura, height: Math.min(altura, 2400) },
    });
  }

  capturas.push({ nome, descricao });
  console.log(`  ${nome}.png — ${descricao}`);
}

console.log("A capturar ecrãs…");

// 1. Entrada, vazia
await pagina.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await pagina.evaluate(() => sessionStorage.clear());
await pagina.reload({ waitUntil: "networkidle" });
await capturar("01-entrada", "Ecrã de entrada", ".cartao-entrada");

// 2. Entrada com erro de credenciais
await pagina.fill("#email", "operador@ticsol.pt");
await pagina.fill("#password", "palavra-errada");
await pagina.click('button[type="submit"]');
await pagina.waitForSelector(".alerta-erro", { timeout: 10000 });
await capturar("02-entrada-erro", "Erro de credenciais", ".cartao-entrada");

// 3. Entrada bem-sucedida → lista de guias
await pagina.fill("#password", CREDENCIAIS.password);
await pagina.click('button[type="submit"]');
await pagina.waitForSelector(".lista-guias", { timeout: 20000 });
await pagina.waitForTimeout(1200);
await capturar("03-guias-lista", "Lista de guias com detalhe");

// 4. Detalhe de uma guia (painel direito)
await capturar("04-guia-detalhe", "Detalhe de uma guia", ".detalhe");

// 5. Procura
await pagina.fill(".campo-procura", "Ilha Verde");
await pagina.waitForTimeout(600);
await capturar("05-guias-procura", "Procura por cliente");
await pagina.fill(".campo-procura", "");
await pagina.waitForTimeout(400);

// 6. Procura sem resultados
await pagina.fill(".campo-procura", "xyz-inexistente");
await pagina.waitForTimeout(600);
await capturar("06-procura-vazia", "Procura sem resultados");
await pagina.fill(".campo-procura", "");
await pagina.waitForTimeout(400);

// 7. Histórico de sincronizações
await pagina.click('button.aba:has-text("Sincronizações")');
await pagina.waitForSelector(".tabela-linhas", { timeout: 15000 });
await pagina.waitForTimeout(800);
await capturar("07-sincronizacoes", "Histórico de sincronizações");

await navegador.close();

console.log(`\n${capturas.length} capturas em docs/imagens/`);
