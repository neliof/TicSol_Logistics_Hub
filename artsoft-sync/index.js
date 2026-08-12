import "dotenv/config";
import { criarClientePostgrest } from "./lib/postgrestClient.js";
import { sincronizar } from "./lib/sync.js";

async function criarConector() {
  const tipo = process.env.CONNECTOR_TYPE; // rest | odbc | file

  switch (tipo) {
    case "rest": {
      const { criarConectorRest } = await import("./connectors/rest.js");
      return {
        nomeConector: "rest",
        ...criarConectorRest({
          baseUrl: process.env.ARTSOFT_REST_URL, // ex.: http://192.168.1.120:4219
          apiKey: process.env.ARTSOFT_REST_API_KEY,
        }),
      };
    }
    case "odbc": {
      // Import dinâmico de propósito: o pacote odbc precisa da biblioteca
      // de sistema libodbc.so.2 (unixODBC no Linux, já incluído no
      // Windows). Só é carregado se realmente escolheres este conector —
      // quem usa "rest" ou "file" nunca precisa de instalar unixODBC.
      const { criarConectorOdbc } = await import("./connectors/odbc.js");
      return {
        nomeConector: "odbc",
        ...criarConectorOdbc({
          dsn: process.env.ARTSOFT_ODBC_DSN,
          utilizador: process.env.ARTSOFT_ODBC_USER,
          password: process.env.ARTSOFT_ODBC_PASSWORD,
        }),
      };
    }
    case "file": {
      const { criarConectorFile } = await import("./connectors/file.js");
      return {
        nomeConector: "file",
        ...criarConectorFile({
          pasta: process.env.ARTSOFT_FILES_PATH,
          separador: process.env.ARTSOFT_FILES_DELIMITER || ";",
        }),
      };
    }
    default:
      throw new Error(
        `CONNECTOR_TYPE inválido ou em falta no .env: "${tipo}". Usa "rest", "odbc" ou "file".`
      );
  }
}

async function main() {
  console.log(`--- TicSol Logistics Hub · Sync ARTSOFT (${process.env.CONNECTOR_TYPE}) ---`);
  console.log(new Date().toISOString());

  const conector = await criarConector();
  const postgrest = criarClientePostgrest({
    baseUrl: process.env.LOGISTICS_HUB_API_URL,
    token: process.env.LOGISTICS_HUB_SYNC_TOKEN,
  });

  const resultado = await sincronizar({
    conector,
    postgrest,
    empresaId: process.env.EMPRESA_ID,
  });

  console.log("---");
  console.log(
    `Concluído: ${resultado.produtos} produtos, ${resultado.clientes} clientes, ${resultado.fornecedores} fornecedores, ${resultado.stock} linhas de stock.`
  );
  if (resultado.erros.length > 0) {
    console.log(`Erros: ${resultado.erros.length}`);
    resultado.erros.forEach((e) => console.log(`  - ${e}`));
    process.exitCode = 1;
  }

  if (conector.fechar) await conector.fechar();
}

main().catch((e) => {
  console.error("Falha fatal na sincronização:", e.message);
  process.exitCode = 1;
});
