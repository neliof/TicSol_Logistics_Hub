const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ArtsoftConnection {
  constructor(host, port, username, password, options = {}) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.challenge = null;
    this.options = {
      hash: 'SHA1',
      timeout: 60,
      ...options
    };
  }

  calculateDigest(challenge) {
    const hash = this.options.hash === 'SHA1' ? 'sha1' : 'md5';
    const userHash = crypto.createHash(hash).update(this.username).digest();
    const passHash = crypto.createHash(hash).update(this.password).digest();
    const chalHash = crypto.createHash(hash).update(challenge).digest();

    return crypto
      .createHash(hash)
      .update(Buffer.concat([userHash, passHash, chalHash]))
      .digest('hex');
  }

  async doRequest(endpoint, payload) {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection({
        host: this.host,
        port: this.port,
        timeout: this.options.timeout * 1000
      });

      let loginRespData = '';
      let challenge = null;
      let loginComplete = false;
      let postSent = false;
      let postRespData = '';

      socket.on('error', (err) => {
        socket.destroy();
        reject(new Error(`Connection error: ${err.message}`));
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Socket timeout'));
      });

      socket.on('connect', () => {
        console.log('[INFO] Conexao TCP estabelecida');

        // PASSO 1: GET /login
        const loginHeaders = {
          'Connection': 'Keep-Alive',
          'Keep-Alive': '60',
          'Encoding': 'utf-8',
          'name': this.username,
          'XMLIdent': '3'
        };

        const loginRequest =
          `GET /login HTTP/1.1\r\n` +
          `Host: ${this.host}:${this.port}\r\n` +
          Object.entries(loginHeaders)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\r\n') +
          '\r\n\r\n';

        console.log('[INFO] Enviando GET /login');
        socket.write(loginRequest);
      });

      socket.on('data', (chunk) => {
        const data = chunk.toString();

        if (!loginComplete) {
          // Coletar resposta de login
          loginRespData += data;

          // Verificar se recebeu headers completos
          if (loginRespData.includes('\r\n\r\n')) {
            const headerEndIdx = loginRespData.indexOf('\r\n\r\n');
            const headers = loginRespData.substring(0, headerEndIdx);

            // Extrair digest challenge
            const digestMatch = headers.match(/digest:\s*([^\r\n]+)/i);
            if (digestMatch) {
              challenge = digestMatch[1].trim();
              console.log(`[OK] Challenge: ${challenge.substring(0, 50)}...`);
            } else {
              console.log('[ERRO] Nenhum challenge no header');
              console.log('Headers:', headers);
              socket.destroy();
              reject(new Error('No challenge in login response'));
              return;
            }

            loginComplete = true;

            // PASSO 2: Calcular digest
            const digest = this.calculateDigest(challenge);
            console.log(`[OK] Digest calculado: ${digest.substring(0, 30)}...`);

            // PASSO 3: POST na MESMA conexao TCP
            const postHeaders = {
              'Content-Type': 'text/xml; charset=utf-8',
              'Encoding': 'utf-8',
              'digest': digest,
              'Connection': 'Close',
              'Content-Length': Buffer.byteLength(payload)
            };

            const postRequest =
              `POST /${endpoint} HTTP/1.1\r\n` +
              `Host: ${this.host}:${this.port}\r\n` +
              Object.entries(postHeaders)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\r\n') +
              '\r\n\r\n' +
              payload;

            console.log(`[INFO] Enviando POST /${endpoint}`);
            socket.write(postRequest);
            postSent = true;

            // Limpar buffer para resposta POST
            loginRespData = '';
          }
        } else if (postSent) {
          // Coletar resposta POST
          postRespData += data;
        }
      });

      socket.on('end', () => {
        if (postSent && postRespData) {
          const headerEndIdx = postRespData.indexOf('\r\n\r\n');
          if (headerEndIdx === -1) {
            reject(new Error('Invalid HTTP response'));
            return;
          }

          const headers = postRespData.substring(0, headerEndIdx);
          const body = postRespData.substring(headerEndIdx + 4);

          if (headers.includes(' 401 ')) {
            reject(new Error('Authentication failed (401 Unauthorized)'));
          } else if (headers.includes(' 200 ') || headers.includes(' 204 ')) {
            console.log('[OK] POST succeeds (200/204)');
            resolve(body);
          } else {
            const statusLine = headers.split('\r\n')[0];
            console.log(`[!] Unexpected status: ${statusLine}`);
            resolve(body);
          }
        } else {
          reject(new Error('Connection closed unexpectedly'));
        }
      });
    });
  }
}

// ===== TESTES =====

const ARTSOFT_HOST = '192.168.1.120';
const ARTSOFT_PORT = 4333;
const ARTSOFT_USER = 'ADMIN';
const ARTSOFT_PASS = 'ARTSOFT';

async function runTests() {
  const conn = new ArtsoftConnection(ARTSOFT_HOST, ARTSOFT_PORT, ARTSOFT_USER, ARTSOFT_PASS);

  console.log('=== Teste de Conexão ARTSOFT ===\n');
  console.log(`Host: ${ARTSOFT_HOST}:${ARTSOFT_PORT}`);
  console.log(`User: ${ARTSOFT_USER}\n`);

  try {
    console.log('1. Teste simples (V980)...');
    const testXml = `<?xml version='1.0' encoding='UTF-8'?>
<root type='list' name='test' query='DocFch|V980|NrDoc=1:1'>
  <defcol>
    <DocNrDoc form='%DocFch.Doc.NrDoc'/>
    <DocSerie form='%DocFch.Doc.Serie'/>
  </defcol>
</root>`;

    const result1 = await conn.doRequest('Queries/Query', testXml);
    console.log(`Resposta (primeiros 300 chars):\n${result1.substring(0, 300)}\n`);

    console.log('2. Descoberta de campos (V980, V990, V998)...');
    const discoverXml = `<?xml version='1.0' encoding='UTF-8'?>
<root type='list' end='50' name='DocFch' query='DocFch|V980|NrDoc=1:99999'>
  <defcol>
    <DocSerie form='%DocFch.Doc.Serie'/>
    <DocNrDoc form='%DocFch.Doc.NrDoc'/>
    <DataDocum form='%DocFch.Doc.DataDocum'/>
    <TpSAFT form='%DocFch.Inf.TpSAFT'/>
    <TerTerceiro form='%DocFch.Ter.Terceiro'/>
    <TerNome form='%DocFch.Ter.Nome'/>
    <TerNIF form='%DocFch.Ter.NIF'/>
    <Matricula form='%DocFch.Logis.Matricula'/>
    <EndCarga form='%DocFch.Logis.EndCarga'/>
    <EndDescarga form='%DocFch.Logis.EndDescarga'/>
    <Peso form='%DocFch.Logis.Peso'/>
    <Volumes form='%DocFch.Logis.Volumes'/>
    <DataHora form='%DocFch.Logis.DataHora'/>
  </defcol>
</root>`;

    const result2 = await conn.doRequest('Queries/Query', discoverXml);

    if (result2 && result2.length > 50) {
      console.log(`[OK] Resposta: ${result2.length} bytes\n`);

      // Salvar
      const outputDir = path.join(__dirname, '..', 'e2e-artsoft');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(path.join(outputDir, 'docfch-response.xml'), result2, 'utf8');
      console.log(`[OK] Salvo em: e2e-artsoft/docfch-response.xml\n`);

      // Mostrar resposta
      console.log('=== Resposta Completa ===');
      console.log(result2);

      // Análise
      console.log('\n=== Análise ===');
      if (result2.includes('<Matricula>')) console.log('[OK] Matricula: presente');
      else console.log('[!] Matricula: ausente');

      if (result2.includes('<EndCarga>')) console.log('[OK] EndCarga: presente');
      else console.log('[!] EndCarga: ausente');

      if (result2.includes('<EndDescarga>')) console.log('[OK] EndDescarga: presente');
      else console.log('[!] EndDescarga: ausente');

      if (result2.includes('<Peso>')) console.log('[OK] Peso: presente');
      else console.log('[!] Peso: ausente');

      if (result2.includes('<Volumes>')) console.log('[OK] Volumes: presente');
      else console.log('[!] Volumes: ausente');

      if (result2.includes('<DataHora>')) console.log('[OK] DataHora: presente');
      else console.log('[!] DataHora: ausente');
    } else {
      console.log('[ERRO] Resposta vazia');
    }

  } catch (err) {
    console.error('[ERRO]', err.message);
    process.exit(1);
  }
}

runTests();
