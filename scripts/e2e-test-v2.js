const { default: DigestFetch } = require('digest-fetch');

const ARTSOFT_HOST = '192.168.1.120';
const ARTSOFT_PORT = 4333;
const ARTSOFT_USER = 'ADMIN';
const ARTSOFT_PASS = 'ARTSOFT';
const ARTSOFT_URL = `http://${ARTSOFT_HOST}:${ARTSOFT_PORT}/Queries/Query`;

// Query simples para teste
const testQuery = `<?xml version="1.0"?>
<root type="list" name="test" query="DocFch">
  <defcol>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
    <DocSerie form="%DocFch.Doc.Serie"/>
  </defcol>
</root>`;

// Query com campos de descoberta
const discoverQuery = `<?xml version="1.0"?>
<root type="list" name="DocFch" query="DocFch">
  <defcol>
    <DocSerie form="%DocFch.Doc.Serie"/>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
    <DataDocum form="%DocFch.Doc.DataDocum"/>
    <TpSAFT form="%DocFch.Inf.TpSAFT"/>
    <TerTerceiro form="%DocFch.Ter.Terceiro"/>
    <TerNome form="%DocFch.Ter.Nome"/>
    <Matricula form="%DocFch.Logis.Matricula"/>
    <EndCarga form="%DocFch.Logis.EndCarga"/>
    <EndDescarga form="%DocFch.Logis.EndDescarga"/>
    <Peso form="%DocFch.Logis.Peso"/>
    <Volumes form="%DocFch.Logis.Volumes"/>
    <DataHora form="%DocFch.Logis.DataHora"/>
  </defcol>
</root>`;

console.log('=== Teste de Conexão ARTSOFT ===\n');
console.log(`Host: ${ARTSOFT_URL}`);
console.log(`User: ${ARTSOFT_USER}\n`);

async function runTests() {
  const client = new DigestFetch(ARTSOFT_USER, ARTSOFT_PASS);

  try {
    console.log('1. Teste simples...');
    const res1 = await client.fetch(ARTSOFT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml'
      },
      body: testQuery
    });

    const text1 = await res1.text();
    console.log(`[OK] Status: ${res1.status}`);
    console.log(`Resposta (primeiras 300 chars):\n${text1.substring(0, 300)}\n`);

    console.log('2. Descoberta de campos...');
    const res2 = await client.fetch(ARTSOFT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml'
      },
      body: discoverQuery
    });

    const text2 = await res2.text();

    if (text2 && text2.length > 50) {
      console.log(`[OK] Status: ${res2.status}`);
      console.log(`Tamanho: ${text2.length} bytes\n`);

      // Salvar em ficheiro
      const fs = require('fs');
      fs.writeFileSync('../e2e-artsoft/docfch-response.xml', text2, 'utf8');
      console.log('[OK] Resposta salva em: ../e2e-artsoft/docfch-response.xml\n');

      // Mostrar resposta
      console.log('=== Resposta Completa ===');
      console.log(text2);
      console.log('\n=== Análise ===');

      if (text2.includes('<Matricula>')) {
        console.log('[OK] Matricula: encontrada');
      } else {
        console.log('[!] Matricula: NÃO encontrada');
      }

      if (text2.includes('<EndCarga>')) {
        console.log('[OK] EndCarga: encontrada');
      } else {
        console.log('[!] EndCarga: NÃO encontrada');
      }

      if (text2.includes('<EndDescarga>')) {
        console.log('[OK] EndDescarga: encontrada');
      } else {
        console.log('[!] EndDescarga: NÃO encontrada');
      }

      if (text2.includes('<Peso>')) {
        console.log('[OK] Peso: encontrada');
      } else {
        console.log('[!] Peso: NÃO encontrada');
      }

      if (text2.includes('<Volumes>')) {
        console.log('[OK] Volumes: encontrada');
      } else {
        console.log('[!] Volumes: NÃO encontrada');
      }

      if (text2.includes('<DataHora>')) {
        console.log('[OK] DataHora: encontrada');
      } else {
        console.log('[!] DataHora: NÃO encontrada');
      }
    } else {
      console.log(`[ERRO] Resposta vazia. Status: ${res2.status}`);
      console.log(`Resposta: ${text2}`);
    }

  } catch (err) {
    console.error('[ERRO] Falha na requisição:', err.message);
    process.exit(1);
  }
}

runTests();
