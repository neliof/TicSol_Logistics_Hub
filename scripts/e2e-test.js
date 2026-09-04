const http = require('http');
const crypto = require('crypto');

const ARTSOFT_HOST = '192.168.1.120';
const ARTSOFT_PORT = 4333;
const ARTSOFT_USER = 'Admin';
const ARTSOFT_PASS = 'ARTSOFT';

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

function computeDigest(method, path, body, user, pass, realm, nonce, qop, nc, cnonce) {
  const ha1 = crypto.createHash('md5').update(`${user}:${realm}:${pass}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${path}`).digest('hex');

  let response;
  if (qop === 'auth') {
    response = crypto.createHash('md5')
      .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      .digest('hex');
  } else {
    response = crypto.createHash('md5')
      .update(`${ha1}:${nonce}:${ha2}`)
      .digest('hex');
  }

  return response;
}

function makeRequest(query, callback, isDiscover = false) {
  const options = {
    hostname: ARTSOFT_HOST,
    port: ARTSOFT_PORT,
    path: '/Queries/Query',
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'User-Agent': 'Node.js-E2E-Test'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 401 && res.headers['www-authenticate']) {
        // Digest auth challenge
        const authHeader = res.headers['www-authenticate'];
        const realmMatch = authHeader.match(/realm="([^"]+)"/);
        const nonceMatch = authHeader.match(/nonce="([^"]+)"/);
        const qopMatch = authHeader.match(/qop="([^"]+)"/);

        if (realmMatch && nonceMatch) {
          const realm = realmMatch[1];
          const nonce = nonceMatch[1];
          const qop = qopMatch ? qopMatch[1].split(',')[0].trim() : null;
          const nc = '00000001';
          const cnonce = crypto.randomBytes(8).toString('hex');

          const digest = computeDigest('POST', '/Queries/Query', query, ARTSOFT_USER, ARTSOFT_PASS, realm, nonce, qop, nc, cnonce);

          let authValue = `Digest username="${ARTSOFT_USER}", realm="${realm}", nonce="${nonce}", uri="/Queries/Query", response="${digest}"`;
          if (qop) {
            authValue += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
          }

          const options2 = { ...options };
          options2.headers['Authorization'] = authValue;

          const req2 = http.request(options2, (res2) => {
            let data2 = '';
            res2.on('data', (chunk) => {
              data2 += chunk;
            });
            res2.on('end', () => {
              callback(res2.statusCode, data2);
            });
          });

          req2.on('error', (e) => {
            console.error('Erro na requisição autenticada:', e.message);
            callback(null, null);
          });

          req2.write(query);
          req2.end();
        }
      } else {
        callback(res.statusCode, data);
      }
    });
  });

  req.on('error', (e) => {
    console.error('Erro na requisição:', e.message);
    callback(null, null);
  });

  req.write(query);
  req.end();
}

console.log('=== Teste de Conexão ARTSOFT ===\n');

console.log('1. Teste simples...');
makeRequest(testQuery, (status, response) => {
  if (status) {
    console.log(`[OK] Status: ${status}`);
    console.log(`Resposta (primeiras 500 chars):\n${response.substring(0, 500)}\n`);
  } else {
    console.log('[ERRO] Nenhuma resposta\n');
  }

  console.log('2. Descoberta de campos...');
  makeRequest(discoverQuery, (status, response) => {
    if (status && response.length > 4) {
      console.log(`[OK] Status: ${status}`);
      console.log(`Tamanho: ${response.length} bytes`);
      console.log(`\nResposta completa:\n${response}\n`);

      // Análise
      console.log('=== Análise ===');
      if (response.includes('<Matricula>')) {
        console.log('[OK] Matricula: encontrada');
      } else {
        console.log('[!] Matricula: NÃO encontrada');
      }

      if (response.includes('<EndCarga>')) {
        console.log('[OK] EndCarga: encontrada');
      } else {
        console.log('[!] EndCarga: NÃO encontrada');
      }

      if (response.includes('<Peso>')) {
        console.log('[OK] Peso: encontrada');
      } else {
        console.log('[!] Peso: NÃO encontrada');
      }
    } else {
      console.log(`[ERRO] Resposta vazia ou inválida. Status: ${status}`);
      if (response) console.log(`Resposta: ${response}`);
    }
  }, true);
}, false);
