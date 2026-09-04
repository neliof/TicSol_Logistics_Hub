const http = require('http');
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

  /**
   * Calcula digest Artsoft: HASH(HASH(user) + HASH(pass) + HASH(challenge))
   */
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

  /**
   * Faz login + POST numa UNICA conexao TCP
   * Isto é crítico - Artsoft associa challenge a conexao TCP
   */
  async doRequest(endpoint, payload) {
    return new Promise((resolve, reject) => {
      const conn = http.createConnection({
        host: this.host,
        port: this.port,
        timeout: this.options.timeout * 1000
      });

      conn.on('error', (err) => {
        conn.destroy();
        reject(new Error(`Connection failed: ${err.message}`));
      });

      conn.on('timeout', () => {
        conn.destroy();
        reject(new Error('Connection timeout'));
      });

      // PASSO 1: GET /login na mesma conexao
      const loginHeaders = {
        'Connection': 'Keep-Alive',
        'Keep-Alive': '60',
        'Encoding': 'utf-8',
        'name': this.username,
        'XMLIdent': '3'
      };

      console.log('[INFO] GET /login com headers:', loginHeaders);
      conn.write(
        `GET /login HTTP/1.1\r\n` +
        `Host: ${this.host}:${this.port}\r\n` +
        Object.entries(loginHeaders)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\r\n') +
        '\r\n\r\n'
      );

      let loginRespData = '';
      let challenge = null;
      let loginComplete = false;
      let postSent = false;

      conn.on('data', (chunk) => {
        const data = chunk.toString();

        if (!loginComplete) {
          // Parse login response
          loginRespData += data;

          if (loginRespData.includes('\r\n\r\n')) {
            const [headers, body] = loginRespData.split('\r\n\r\n', 2);

            // Extrair digest header
            const digestMatch = headers.match(/digest:\s*([^\r\n]+)/i);
            if (digestMatch) {
              challenge = digestMatch[1].trim();
              console.log('[OK] Challenge obtido:', challenge.substring(0, 50) + '...');
            } else {
              console.log('[ERRO] Nenhum challenge no header digest');
              console.log('Headers login:', headers);
              conn.destroy();
              reject(new Error('No challenge received from login'));
              return;
            }

            loginComplete = true;

            // PASSO 2: Calcular digest
            const digest = this.calculateDigest(challenge);
            console.log('[OK] Digest calculado:', digest.substring(0, 20) + '...');

            // PASSO 3: POST na MESMA conexao
            const postHeaders = {
              'Content-Type': 'text/xml; charset=utf-8',
              'Encoding': 'utf-8',
              'digest': digest,
              'Connection': 'Close',
              'Content-Length': Buffer.byteLength(payload)
            };

            console.log('[INFO] POST ' + endpoint + ' com digest');
            conn.write(
              `POST /${endpoint} HTTP/1.1\r\n` +
              `Host: ${this.host}:${this.port}\r\n` +
              Object.entries(postHeaders)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\r\n') +
              '\r\n\r\n' +
              payload
            );

            postSent = true;
            loginRespData = ''; // Clear buffer para resposta POST
          }
        } else if (postSent) {
          // Collect POST response
          loginRespData += data;
        }
      });

      conn.on('end', () => {
        if (postSent && loginRespData) {
          const [headers, body] = loginRespData.split('\r\n\r\n', 2);

          if (headers.includes('401')) {
            reject(new Error('Authentication failed (401)'));
          } else if (headers.includes('200') || headers.includes('204')) {
            console.log('[OK] POST bem-sucedido');
            resolve(body || '');
          } else {
            console.log('[ERRO] Resposta POST inesperada:', headers.split('\r\n')[0]);
            resolve(body || '');
          }
        } else {
          reject(new Error('Connection closed unexpectedly'));
        }
      });
    });
  }

  async doLogin() {
    const testXml = "<?xml version='1.0'?><root><Licence form='(Licence)'/></root>";
    await this.doRequest('Queries/Query', testXml);
    console.log('[OK] Login validation successful');
  }

  async queryXml(xml) {
    return await this.doRequest('Queries/Query', xml);
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
      console.log(`[OK] Resposta obtida: ${result2.length} bytes\n`);

      // Salvar
      const outputDir = path.join(__dirname, '..', 'e2e-artsoft');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(path.join(outputDir, 'docfch-response.xml'), result2, 'utf8');
      console.log(`[OK] Resposta salva em: ${outputDir}/docfch-response.xml\n`);

      // Mostrar resposta
      console.log('=== Resposta Completa ===');
      console.log(result2);

      // Análise
      console.log('\n=== Análise ===');
      if (result2.includes('<Matricula>')) console.log('[OK] Matricula: encontrada');
      else console.log('[!] Matricula: NÃO encontrada');

      if (result2.includes('<EndCarga>')) console.log('[OK] EndCarga: encontrada');
      else console.log('[!] EndCarga: NÃO encontrada');

      if (result2.includes('<EndDescarga>')) console.log('[OK] EndDescarga: encontrada');
      else console.log('[!] EndDescarga: NÃO encontrada');

      if (result2.includes('<Peso>')) console.log('[OK] Peso: encontrada');
      else console.log('[!] Peso: NÃO encontrada');

      if (result2.includes('<Volumes>')) console.log('[OK] Volumes: encontrada');
      else console.log('[!] Volumes: NÃO encontrada');

      if (result2.includes('<DataHora>')) console.log('[OK] DataHora: encontrada');
      else console.log('[!] DataHora: NÃO encontrada');
    } else {
      console.log('[ERRO] Resposta vazia ou muito pequena');
      console.log('Resposta:', result2);
    }

  } catch (err) {
    console.error('[ERRO]', err.message);
    process.exit(1);
  }
}

runTests();
