#!/usr/bin/env node
/**
 * Gera docs/GUIA_UTILIZADOR.html a partir do conteúdo abaixo e das capturas
 * em docs/imagens/, embutidas em base64 para o ficheiro abrir sozinho.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.cwd();
const IMAGENS = join(RAIZ, "docs", "imagens");

function img(nome, legenda) {
  const dados = readFileSync(join(IMAGENS, `${nome}.png`)).toString("base64");
  return `<figure>
  <img src="data:image/png;base64,${dados}" alt="${legenda}">
  <figcaption>${legenda}</figcaption>
</figure>`;
}

function duplo(a, legendaA, b, legendaB) {
  return `<div class="par">${img(a, legendaA)}${img(b, legendaB)}</div>`;
}

const CSS = `
:root {
  --papel: #f4f5f2;
  --painel: #ffffff;
  --tinta: #16232f;
  --corpo: #2c3a44;
  --esbatido: #647079;
  --linha: #dde2de;
  --destaque: #0f6b5c;
  --destaque-escuro: #0b4f44;
  --destaque-fundo: #e6f1ee;
  --aviso: #8a5a00;
  --aviso-fundo: #fbf1de;
  --perigo: #9c2b22;
  --perigo-fundo: #f9e9e7;
  --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
  --sans: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
}

* { box-sizing: border-box; }

html { scroll-behavior: smooth; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }

body {
  margin: 0;
  background: var(--papel);
  color: var(--corpo);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.65;
}

.pagina { display: flex; align-items: flex-start; }

/* ---- Barra lateral ---- */

.lateral {
  width: 250px;
  flex: 0 0 250px;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
  padding: 32px 20px;
  border-right: 1px solid var(--linha);
  background: var(--painel);
}

.marca {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}

.marca-nome {
  font-family: var(--serif);
  font-size: 17px;
  color: var(--tinta);
  line-height: 1.25;
}

.indice { list-style: none; margin: 0; padding: 0; counter-reset: cap; }

.indice li { counter-increment: cap; }

.indice a {
  display: flex;
  gap: 10px;
  padding: 7px 0;
  color: var(--corpo);
  text-decoration: none;
  font-size: 14px;
}

.indice a::before {
  content: counter(cap);
  color: var(--esbatido);
  font-variant-numeric: tabular-nums;
  min-width: 14px;
}

.indice a:hover { color: var(--destaque-escuro); }

.indice a:focus-visible {
  outline: 2px solid var(--destaque);
  outline-offset: 2px;
  border-radius: 2px;
}

/* ---- Conteúdo ---- */

.conteudo {
  flex: 1;
  min-width: 0;
  padding: 48px 40px 96px;
  max-width: 800px;
}

h1 {
  font-family: var(--serif);
  font-size: 34px;
  line-height: 1.2;
  color: var(--tinta);
  margin: 0 0 10px;
  font-weight: 600;
}

.abertura {
  font-size: 17px;
  color: var(--esbatido);
  margin: 0 0 8px;
}

h2 {
  font-family: var(--serif);
  font-size: 25px;
  color: var(--tinta);
  font-weight: 600;
  margin: 56px 0 16px;
  padding-top: 28px;
  border-top: 1px solid var(--linha);
  scroll-margin-top: 24px;
}

h2:first-of-type { border-top: none; padding-top: 0; margin-top: 44px; }

h3 {
  font-family: var(--serif);
  font-size: 19px;
  color: var(--tinta);
  font-weight: 600;
  margin: 32px 0 10px;
}

p { margin: 0 0 14px; }

/* Referências a elementos da interface */
strong {
  font-weight: 600;
  color: var(--destaque-escuro);
  background: var(--painel);
  border: 1px solid var(--linha);
  border-radius: 3px;
  padding: 1px 6px;
  white-space: nowrap;
}

.caixa strong, figcaption strong { background: transparent; border: none; padding: 0; }

/* ---- Passos ---- */

ol.passos { list-style: none; counter-reset: passo; margin: 20px 0; padding: 0; }

ol.passos > li {
  counter-increment: passo;
  position: relative;
  padding: 16px 0 16px 46px;
  border-bottom: 1px solid var(--linha);
}

ol.passos > li:last-child { border-bottom: none; }

ol.passos > li::before {
  content: counter(passo);
  position: absolute;
  left: 0;
  top: 15px;
  width: 28px;
  height: 28px;
  border: 1px solid var(--destaque);
  border-radius: 50%;
  color: var(--destaque-escuro);
  font-size: 13px;
  font-weight: 600;
  display: grid;
  place-items: center;
  font-variant-numeric: tabular-nums;
}

ol.passos > li > p:last-child { margin-bottom: 0; }

.resultado {
  color: var(--esbatido);
  font-size: 15px;
}

ul.simples { margin: 12px 0; padding-left: 20px; }
ul.simples li { margin-bottom: 8px; }

/* ---- Caixas ---- */

.caixa {
  border-left: 3px solid var(--linha);
  border-radius: 4px;
  background: var(--painel);
  padding: 14px 16px;
  margin: 20px 0;
}

.caixa p:last-child { margin-bottom: 0; }

.caixa-nota { border-left-color: var(--destaque); background: var(--destaque-fundo); }
.caixa-aviso { border-left-color: var(--aviso); background: var(--aviso-fundo); color: var(--aviso); }
.caixa-perigo { border-left-color: var(--perigo); background: var(--perigo-fundo); color: var(--perigo); }

.caixa-titulo { font-weight: 600; }

/* ---- Imagens ---- */

figure { margin: 22px 0; }

figure img {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid var(--linha);
  border-radius: 4px;
  background: var(--painel);
}

figcaption {
  font-style: italic;
  color: var(--esbatido);
  font-size: 14px;
  margin-top: 8px;
}

.par { display: flex; gap: 16px; flex-wrap: wrap; }
.par figure { flex: 1 1 300px; margin: 22px 0 0; }

/* ---- Tabelas ---- */

/* A tabela rola dentro do seu contentor; a página nunca rola na horizontal. */
.tabela { overflow-x: auto; margin: 20px 0; }

table { width: 100%; border-collapse: collapse; font-size: 15px; }

th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--linha); }

th { color: var(--esbatido); font-weight: 600; font-size: 14px; }

/* ---- Ecrãs estreitos ---- */

@media (max-width: 860px) {
  .pagina { flex-direction: column; }

  .lateral {
    width: 100%;
    flex: none;
    position: static;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--linha);
    padding: 20px;
  }

  .indice { display: flex; flex-wrap: wrap; gap: 6px; }

  .indice a {
    border: 1px solid var(--linha);
    border-radius: 14px;
    padding: 5px 12px;
    font-size: 13px;
  }

  .conteudo { padding: 28px 20px 64px; }

  /* Nomes longos de botões podem partir de linha em vez de alargar a página. */
  strong { white-space: normal; }
}
`;

const CAPITULOS = [
  { id: "entrar", titulo: "Entrar na aplicação" },
  { id: "guias", titulo: "Ver as guias de transporte" },
  { id: "detalhe", titulo: "Ler o detalhe de uma guia" },
  { id: "procurar", titulo: "Procurar uma guia" },
  { id: "sincronizar", titulo: "Trazer guias novas do ARTSOFT" },
  { id: "historico", titulo: "Consultar o histórico" },
  { id: "problemas", titulo: "Quando algo corre mal" },
];

const HTML = `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Guia do utilizador — TicSol Logistics Hub</title>
<style>${CSS}</style>
</head>
<body>
<div class="pagina">

<aside class="lateral">
  <div class="marca">
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="13" fill="none" stroke="#0f6b5c" stroke-width="1.5"/>
      <path d="M9 15.5l4 4 8-8.5" fill="none" stroke="#0f6b5c" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="marca-nome">TicSol<br>Logistics Hub</span>
  </div>
  <nav>
    <ol class="indice">
      ${CAPITULOS.map((c) => `<li><a href="#${c.id}">${c.titulo}</a></li>`).join(
        "\n      "
      )}
    </ol>
  </nav>
</aside>

<main class="conteudo">

<h1>Guia do utilizador</h1>
<p class="abertura">
  Como consultar as guias de transporte no TicSol Logistics Hub. Este guia
  acompanha-o desde a entrada na aplicação até à resolução dos avisos mais
  comuns.
</p>

<div class="caixa caixa-nota">
  <p>
    As imagens deste guia foram tiradas da aplicação real. Os nomes de clientes,
    números de contribuinte, moradas, números de guia e descrições de artigos
    foram substituídos por exemplos fictícios.
  </p>
</div>

<h2 id="entrar">Entrar na aplicação</h2>

<p>
  A aplicação abre no ecrã de entrada. Precisa do endereço de email e da
  palavra-passe que lhe foram atribuídos.
</p>

${img("01-entrada", "Ecrã de entrada, com os campos por preencher.")}

<ol class="passos">
  <li>
    <p>Clique no campo <strong>Endereço de email</strong> e escreva o seu email.</p>
  </li>
  <li>
    <p>Clique no campo <strong>Palavra-passe</strong> e escreva a sua palavra-passe. Os caracteres aparecem ocultos.</p>
  </li>
  <li>
    <p>Clique em <strong>Entrar</strong>.</p>
    <p class="resultado">
      O botão passa a indicar "A entrar…" enquanto a aplicação verifica os
      dados. Se estiverem corretos, abre a página das guias de transporte.
    </p>
  </li>
</ol>

<p>
  Se o email ou a palavra-passe não corresponderem, aparece uma mensagem
  vermelha por baixo dos campos e continua no mesmo ecrã. Os dados que escreveu
  mantêm-se, para corrigir só o que estiver errado.
</p>

${img("02-entrada-erro", "Mensagem apresentada quando as credenciais não correspondem.")}

<div class="caixa caixa-aviso">
  <p class="caixa-titulo">Demasiadas tentativas</p>
  <p>
    Após várias tentativas falhadas seguidas, a aplicação bloqueia novas
    tentativas durante alguns minutos e mostra "Demasiadas tentativas. Aguarde
    alguns minutos." Espere e volte a tentar; se não se lembrar da
    palavra-passe, peça ao responsável para a redefinir.
  </p>
</div>

<h2 id="guias">Ver as guias de transporte</h2>

<p>
  Depois de entrar, a aplicação abre em <strong>Guias de transporte</strong>. O
  ecrã está dividido em duas partes: à esquerda a lista de guias, à direita o
  detalhe da guia que estiver selecionada.
</p>

${img("03-guias-lista", "Lista de guias à esquerda e detalhe da guia selecionada à direita.")}

<p>Cada linha da lista mostra três informações:</p>

<ul class="simples">
  <li>o número da guia, na primeira linha, a negrito;</li>
  <li>o nome do cliente, por baixo;</li>
  <li>a data do documento, à direita.</li>
</ul>

<p>
  Por cima da lista, a contagem indica quantas guias estão a ser mostradas. Para
  ver outra guia, clique nela: a barra verde à esquerda passa para a guia
  escolhida e o painel da direita atualiza-se.
</p>

<div class="caixa caixa-nota">
  <p>
    A lista mostra as guias mais recentes. Se tiver muitas guias, use a caixa de
    procura descrita mais à frente em vez de percorrer a lista toda.
  </p>
</div>

<h2 id="detalhe">Ler o detalhe de uma guia</h2>

<p>
  O painel da direita mostra o número da guia em título e, por baixo, os dados
  do transporte.
</p>

${img("04-guia-detalhe", "Detalhe completo de uma guia, com os campos do transporte e a lista de artigos.")}

<div class="tabela">
<table>
  <thead>
    <tr><th>Campo</th><th>O que indica</th></tr>
  </thead>
  <tbody>
    <tr><td>Cliente</td><td>Nome da entidade a quem a mercadoria se destina.</td></tr>
    <tr><td>NIF</td><td>Número de contribuinte dessa entidade.</td></tr>
    <tr><td>Data do documento</td><td>Data em que a guia foi emitida.</td></tr>
    <tr><td>Tipo</td><td>Natureza do documento. "GT" corresponde a guia de transporte.</td></tr>
    <tr><td>Local de carga</td><td>Morada onde a mercadoria é carregada.</td></tr>
    <tr><td>Local de descarga</td><td>Morada de entrega.</td></tr>
    <tr><td>Data e hora de carga</td><td>Momento previsto para o carregamento.</td></tr>
    <tr><td>Matrícula</td><td>Matrícula do veículo, quando registada.</td></tr>
    <tr><td>Volumes</td><td>Número de volumes a transportar.</td></tr>
    <tr><td>Peso bruto</td><td>Peso total da carga.</td></tr>
    <tr><td>Encomenda de origem</td><td>Referência da encomenda que deu origem à guia.</td></tr>
  </tbody>
</table>
</div>

<p>
  Um campo com um travessão não tem valor preenchido na guia de origem. É
  frequente na <strong>Matrícula</strong>, que muitas vezes só é registada no
  momento da carga.
</p>

<p>
  Se a guia tiver observações, elas aparecem numa faixa cor de âmbar por baixo
  dos campos.
</p>

<h3>Artigos</h3>

<p>
  Mais abaixo está a lista de artigos, com o número entre parênteses no título.
  Para cada artigo vê o número de linha, o código, a descrição e a quantidade.
  Enquanto os artigos carregam, aparece "A carregar artigos…".
</p>

<h2 id="procurar">Procurar uma guia</h2>

<p>
  A caixa <strong>Procurar por número de guia ou cliente</strong>, no topo do
  ecrã, filtra a lista à medida que escreve. Procura tanto no número da guia
  como no nome do cliente.
</p>

<ol class="passos">
  <li>
    <p>Clique na caixa <strong>Procurar por número de guia ou cliente</strong>.</p>
  </li>
  <li>
    <p>Escreva parte do número da guia ou parte do nome do cliente. Não precisa de escrever o valor completo.</p>
    <p class="resultado">
      A lista reduz-se enquanto escreve e a contagem passa a indicar quantas
      guias correspondem, do total.
    </p>
  </li>
  <li>
    <p>Clique numa das guias encontradas para ver o detalhe.</p>
  </li>
  <li>
    <p>Para voltar a ver todas, apague o texto da caixa de procura.</p>
  </li>
</ol>

${duplo(
  "05-guias-procura",
  "Procura por nome de cliente: a lista fica só com as guias correspondentes.",
  "06-procura-vazia",
  "Quando nada corresponde ao texto escrito, a aplicação explica-o em vez de mostrar uma lista vazia."
)}

<h2 id="sincronizar">Trazer guias novas do ARTSOFT</h2>

<p>
  As guias são criadas no ARTSOFT. O botão <strong>Sincronizar com ARTSOFT</strong>
  vai buscar as guias emitidas recentemente e acrescenta-as à lista.
</p>

<ol class="passos">
  <li>
    <p>Clique em <strong>Sincronizar com ARTSOFT</strong>.</p>
    <p class="resultado">
      O botão fica indisponível e passa a indicar "A sincronizar…". A operação
      pode demorar algum tempo, conforme o número de guias.
    </p>
  </li>
  <li>
    <p>Aguarde sem sair da página.</p>
    <p class="resultado">
      No fim aparece uma faixa verde com o número de guias e de linhas
      importadas, e a lista atualiza-se.
    </p>
  </li>
</ol>

<div class="caixa caixa-nota">
  <p>
    Sincronizar duas vezes não duplica guias: uma guia já existente é
    atualizada, não repetida.
  </p>
</div>

<div class="caixa caixa-aviso">
  <p class="caixa-titulo">Se aparecer uma faixa vermelha</p>
  <p>
    Uma faixa vermelha em vez da verde significa que a importação não terminou.
    A mensagem indica a causa: normalmente o ARTSOFT não respondeu a tempo.
    Aguarde um pouco e tente novamente; se se repetir, avise o responsável do
    sistema.
  </p>
</div>

<h2 id="historico">Consultar o histórico</h2>

<p>
  O separador <strong>Sincronizações</strong>, no topo, mostra as últimas
  importações e como correram.
</p>

${img("07-sincronizacoes", "Histórico das últimas sincronizações, com o estado de cada uma.")}

<div class="tabela">
<table>
  <thead>
    <tr><th>Coluna</th><th>O que indica</th></tr>
  </thead>
  <tbody>
    <tr><td>Quando</td><td>Data e hora em que a importação começou.</td></tr>
    <tr><td>Estado</td><td>Como terminou. Verde significa concluída; vermelho, que houve um problema.</td></tr>
    <tr><td>Páginas</td><td>Quantos blocos de guias foram lidos do ARTSOFT.</td></tr>
    <tr><td>Registos</td><td>Quantas guias foram tratadas.</td></tr>
    <tr><td>Detalhe</td><td>Explicação, quando existe um problema a assinalar.</td></tr>
  </tbody>
</table>
</div>

<p>Os estados possíveis são:</p>

<ul class="simples">
  <li><strong>Concluída</strong> — correu tudo bem.</li>
  <li><strong>Incompleta</strong> — parte das guias foi importada, mas a operação não chegou ao fim.</li>
  <li><strong>Erro de comunicação</strong> — não foi possível contactar o ARTSOFT.</li>
  <li><strong>Erro de autenticação</strong> — o ARTSOFT recusou o acesso.</li>
  <li><strong>Erro de leitura</strong> — a resposta do ARTSOFT não pôde ser interpretada.</li>
  <li><strong>Erro de processamento</strong> — os dados chegaram, mas não foi possível guardá-los.</li>
</ul>

<div class="caixa caixa-nota">
  <p>
    Só os estados a verde confirmam que as guias ficaram todas registadas.
    Perante um estado a vermelho repetido, avise o responsável do sistema e
    indique a data e a hora da linha em causa.
  </p>
</div>

<h2 id="problemas">Quando algo corre mal</h2>

<div class="tabela">
<table>
  <thead>
    <tr><th>O que vê</th><th>O que significa</th><th>O que fazer</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>"Credenciais inválidas"</td>
      <td>O email ou a palavra-passe não correspondem.</td>
      <td>Confirme o email e volte a escrever a palavra-passe.</td>
    </tr>
    <tr>
      <td>"Demasiadas tentativas"</td>
      <td>Houve várias tentativas falhadas seguidas.</td>
      <td>Aguarde alguns minutos antes de tentar de novo.</td>
    </tr>
    <tr>
      <td>"Sessão expirada. Volte a entrar."</td>
      <td>Esteve muito tempo sem atividade.</td>
      <td>Entre novamente com as suas credenciais.</td>
    </tr>
    <tr>
      <td>"Nenhuma guia encontrada"</td>
      <td>Nada corresponde ao texto procurado, ou ainda não há guias importadas.</td>
      <td>Apague a procura. Se a lista continuar vazia, use Sincronizar com ARTSOFT.</td>
    </tr>
    <tr>
      <td>"Esta guia não tem artigos"</td>
      <td>A guia foi importada sem linhas de artigo.</td>
      <td>Confirme a guia no ARTSOFT; se lá tiver artigos, avise o responsável.</td>
    </tr>
    <tr>
      <td>Travessão num campo</td>
      <td>O campo não vem preenchido na guia de origem.</td>
      <td>Nada a fazer na aplicação: o valor tem de ser preenchido no ARTSOFT.</td>
    </tr>
  </tbody>
</table>
</div>

<h3>Sair da aplicação</h3>

<p>
  O botão <strong>Sair</strong>, no canto superior direito, termina a sessão e
  devolve-o ao ecrã de entrada. Use-o sempre que deixar o posto de trabalho num
  computador partilhado.
</p>

</main>
</div>
</body>
</html>
`;

const destino = join(RAIZ, "docs", "GUIA_UTILIZADOR.html");
writeFileSync(destino, HTML, "utf8");
console.log(
  `docs/GUIA_UTILIZADOR.html — ${(HTML.length / 1024 / 1024).toFixed(2)} MB`
);
