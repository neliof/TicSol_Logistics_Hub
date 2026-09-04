const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class ArtsoftConnection {
  constructor(host, port, username, password) {
    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
  }

  calculateDigest(challenge) {
    const hash = 'sha1';
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
        timeout: 60000
      });

      let loginRespData = '';
      let loginComplete = false;
      let postSent = false;
      let postRespData = '';

      socket.on('error', (err) => {
        socket.destroy();
        reject(new Error(`Connection error: ${err.message}`));
      });

      socket.on('connect', () => {
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

        socket.write(loginRequest);
      });

      socket.on('data', (chunk) => {
        const data = chunk.toString();

        if (!loginComplete) {
          loginRespData += data;

          if (loginRespData.includes('\r\n\r\n')) {
            const headerEndIdx = loginRespData.indexOf('\r\n\r\n');
            const headers = loginRespData.substring(0, headerEndIdx);

            const digestMatch = headers.match(/digest:\s*([^\r\n]+)/i);
            if (!digestMatch) {
              socket.destroy();
              reject(new Error('No challenge'));
              return;
            }

            const challenge = digestMatch[1].trim();
            const digest = this.calculateDigest(challenge);

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

            socket.write(postRequest);
            postSent = true;
            loginComplete = true;
            loginRespData = '';
          }
        } else if (postSent) {
          postRespData += data;
        }
      });

      socket.on('end', () => {
        if (postSent && postRespData) {
          const headerEndIdx = postRespData.indexOf('\r\n\r\n');
          if (headerEndIdx === -1) {
            reject(new Error('Invalid response'));
            return;
          }
          const body = postRespData.substring(headerEndIdx + 4);
          resolve(body);
        } else {
          reject(new Error('Unexpected end'));
        }
      });
    });
  }
}

// ===== DESCOBERTA =====

async function testPaths() {
  const conn = new ArtsoftConnection('192.168.1.120', 4333, 'ADMIN', 'ARTSOFT');

  // Paths a testar
  const pathsToTest = [
    // Data
    { name: 'DataDocum (Doc.DataDocum)', path: '%DocFch.Doc.DataDocum' },
    { name: 'Data (Doc.Data)', path: '%DocFch.Doc.Data' },
    { name: 'DocData (Doc.DocData)', path: '%DocFch.Doc.DocData' },

    // NIF
    { name: 'TerNIF (Ter.NIF)', path: '%DocFch.Ter.NIF' },
    { name: 'NIF (Ter.Nif)', path: '%DocFch.Ter.Nif' },
    { name: 'Nif (Ter.nif)', path: '%DocFch.Ter.nif' },

    // Matricula
    { name: 'Matricula (Logis.Matricula)', path: '%DocFch.Logis.Matricula' },
    { name: 'Matricula (Logis.Matricula_Veiculo)', path: '%DocFch.Logis.Matricula_Veiculo' },
    { name: 'Matricula (Transp.Matricula)', path: '%DocFch.Transp.Matricula' },

    // Endereços
    { name: 'EndCarga (Logis.EndCarga)', path: '%DocFch.Logis.EndCarga' },
    { name: 'EndCarga (Logis.End_Carga)', path: '%DocFch.Logis.End_Carga' },
    { name: 'EndCarga (Logis.Morada_Carga)', path: '%DocFch.Logis.Morada_Carga' },

    { name: 'EndDescarga (Logis.EndDescarga)', path: '%DocFch.Logis.EndDescarga' },
    { name: 'EndDescarga (Logis.End_Descarga)', path: '%DocFch.Logis.End_Descarga' },
    { name: 'EndDescarga (Logis.Morada_Descarga)', path: '%DocFch.Logis.Morada_Descarga' },

    // Peso e Volume
    { name: 'Peso (Logis.Peso)', path: '%DocFch.Logis.Peso' },
    { name: 'Peso (Logis.Peso_Total)', path: '%DocFch.Logis.Peso_Total' },
    { name: 'Peso (Transp.Peso)', path: '%DocFch.Transp.Peso' },

    { name: 'Volumes (Logis.Volumes)', path: '%DocFch.Logis.Volumes' },
    { name: 'Volumes (Logis.Num_Volumes)', path: '%DocFch.Logis.Num_Volumes' },
    { name: 'Volumes (Transp.Volumes)', path: '%DocFch.Transp.Volumes' },

    // DataHora
    { name: 'DataHora (Logis.DataHora)', path: '%DocFch.Logis.DataHora' },
    { name: 'DataHora (Logis.Data_Hora)', path: '%DocFch.Logis.Data_Hora' },
    { name: 'DataHora (Transp.DataHora)', path: '%DocFch.Transp.DataHora' },
  ];

  console.log('=== Descoberta de Paths Corretos ===\n');

  const results = [];

  for (const { name, path: testPath } of pathsToTest) {
    const xml = `<?xml version='1.0' encoding='UTF-8'?>
<root type='list' name='test' query='DocFch|V980|NrDoc=1:1'>
  <defcol>
    <DocSerie form='%DocFch.Doc.Serie'/>
    <DocNrDoc form='%DocFch.Doc.NrDoc'/>
    <TestField form='${testPath}'/>
  </defcol>
</root>`;

    try {
      const response = await conn.doRequest('Queries/Query', xml);

      // Analisar se o campo tem erro ou valor
      if (response.includes('ErrVarNotFound')) {
        results.push({ name, path: testPath, status: '❌ ERRO (path invalido)' });
      } else if (response.includes('TestField')) {
        // Extrair valor
        const match = response.match(/<TestField>([^<]*)<\/TestField>/);
        if (match && match[1]) {
          results.push({ name, path: testPath, status: `✅ OK - Valor: ${match[1].substring(0, 30)}` });
        } else {
          results.push({ name, path: testPath, status: '⚠️  Campo vazio' });
        }
      } else {
        results.push({ name, path: testPath, status: '❓ Desconhecido' });
      }

      // Pequena pausa entre requisições
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      results.push({ name, path: testPath, status: `⚠️  Erro: ${err.message}` });
    }
  }

  // Exibir resultados
  console.log('=== Resultados ===\n');
  results.forEach(r => {
    console.log(`${r.name}`);
    console.log(`  Path: ${r.path}`);
    console.log(`  ${r.status}\n`);
  });

  // Salvar relatório
  const outputDir = path.join(__dirname, '..', 'e2e-artsoft');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const reportPath = path.join(outputDir, 'path-discovery-report.txt');
  const report = results
    .map(r => `${r.name}\n  Path: ${r.path}\n  ${r.status}`)
    .join('\n\n');

  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`\n[OK] Relatório salvo em: e2e-artsoft/path-discovery-report.txt`);

  // Filtrar apenas os que funcionam
  const working = results.filter(r => r.status.includes('✅') || r.status.includes('⚠️'));
  if (working.length > 0) {
    console.log('\n=== Paths que Funcionam ===');
    working.forEach(r => {
      console.log(`${r.name}: ${r.path}`);
    });
  }
}

testPaths().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
