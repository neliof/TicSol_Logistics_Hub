/**
 * Orquestrador da sincronização. Não sabe (nem quer saber) qual conector
 * está a usar — só chama os 4 métodos do contrato comum (interface.js) e
 * mapeia para o schema do Logistics Hub.
 */
export async function sincronizar({ conector, postgrest, empresaId, log = console.log }) {
  const resultado = { produtos: 0, clientes: 0, fornecedores: 0, stock: 0, erros: [] };

  // Fornecedores primeiro — produtos referenciam fornecedor_id
  try {
    const fornecedores = await conector.buscarFornecedores();
    if (fornecedores.length > 0) {
      const linhas = fornecedores.map((f) => ({
        empresa_id: empresaId,
        codigo_interno: f.codigo_interno,
        nome: f.nome,
        nif: f.nif,
        morada: f.morada,
      }));
      await postgrest.upsert("fornecedor", linhas, "codigo_interno");
      resultado.fornecedores = linhas.length;
      log(`✓ ${linhas.length} fornecedores sincronizados`);
    }
  } catch (e) {
    resultado.erros.push(`fornecedores: ${e.message}`);
    log(`✗ Erro a sincronizar fornecedores: ${e.message}`);
  }

  try {
    const clientes = await conector.buscarClientes();
    if (clientes.length > 0) {
      const linhas = clientes.map((c) => ({
        empresa_id: empresaId,
        codigo_interno: c.codigo_interno,
        nome: c.nome,
        nif: c.nif,
        morada: c.morada,
      }));
      await postgrest.upsert("cliente", linhas, "codigo_interno");
      resultado.clientes = linhas.length;
      log(`✓ ${linhas.length} clientes sincronizados`);
    }
  } catch (e) {
    resultado.erros.push(`clientes: ${e.message}`);
    log(`✗ Erro a sincronizar clientes: ${e.message}`);
  }

  // Fornecedor_id em PRODUTO é FK (uuid), não o código do ARTSOFT —
  // resolve-se aqui, depois de os fornecedores já estarem upserted acima.
  let idFornecedorPorCodigo = new Map();
  try {
    const fornecedoresAtuais = await postgrest.listarFornecedoresPorCodigo(empresaId);
    idFornecedorPorCodigo = new Map(fornecedoresAtuais.map((f) => [f.codigo_interno, f.id]));
  } catch (e) {
    log(`✗ Não foi possível resolver fornecedor_id dos produtos: ${e.message} (produtos ficam sem fornecedor associado)`);
  }

  try {
    const produtos = await conector.buscarProdutos();
    if (produtos.length > 0) {
      const linhas = produtos.map((p) => ({
        empresa_id: empresaId,
        sku_interno: p.codigo_interno,
        ean13: p.ean13,
        gtin_caixa: p.gtin_caixa,
        descricao: p.descricao,
        categoria: p.categoria,
        peso_liquido_kg: p.peso_liquido_kg,
        unidades_por_caixa: p.unidades_por_caixa,
        ti: p.ti,
        hi: p.hi,
        fornecedor_id: p.fornecedor_codigo ? idFornecedorPorCodigo.get(p.fornecedor_codigo) ?? null : null,
      }));
      const semFornecedorResolvido = linhas.filter((l) => !l.fornecedor_id).length;
      await postgrest.upsert("produto", linhas, "sku_interno");
      resultado.produtos = linhas.length;
      log(`✓ ${linhas.length} produtos sincronizados`);
      if (semFornecedorResolvido > 0) {
        log(`  (${semFornecedorResolvido} produtos sem fornecedor_id resolvido — código de fornecedor não encontrado)`);
      }
    }
  } catch (e) {
    resultado.erros.push(`produtos: ${e.message}`);
    log(`✗ Erro a sincronizar produtos: ${e.message}`);
  }

  try {
    const stock = await conector.buscarStock();
    if (stock.length > 0) {
      const produtosExistentes = await postgrest.listarProdutosPorSku(empresaId);
      const idPorSku = new Map(produtosExistentes.map((p) => [p.sku_interno, p.id]));

      const linhas = stock
        .map((s) => ({
          empresa_id: empresaId,
          produto_id: idPorSku.get(s.produto_codigo),
          quantidade_artsoft: s.quantidade,
          origem: conector.nomeConector || "desconhecido",
        }))
        .filter((l) => l.produto_id); // ignora stock de produtos que ainda não existem no Logistics Hub

      if (linhas.length > 0) {
        await postgrest.inserirStockSnapshot(linhas);
      }
      resultado.stock = linhas.length;
      log(`✓ ${linhas.length} linhas de stock registadas (snapshot de reconciliação, não substitui o stock físico do WMS)`);

      const ignorados = stock.length - linhas.length;
      if (ignorados > 0) {
        log(`  (${ignorados} linhas de stock ignoradas — produto ainda não existe no Logistics Hub)`);
      }
    }
  } catch (e) {
    resultado.erros.push(`stock: ${e.message}`);
    log(`✗ Erro a sincronizar stock: ${e.message}`);
  }

  return resultado;
}
