/**
 * Uma linha de conferência: produto encomendado vs. quantidade que o
 * operador está a confirmar como efetivamente recebida.
 *
 * A barra de conferência é o elemento visual central deste ecrã —
 * enche conforme a quantidade recebida se aproxima da encomendada, e
 * muda de cor consoante o resultado (âmbar em progresso, verde
 * conforme, vermelho em excesso — que a Secção 2.8.17 do caderno de
 * encargos trata como situação a não recepcionar).
 */
export default function LinhaConferencia({ linha, valores, onChange }) {
  const { produto } = linha;
  const encomendada = Number(linha.quantidade_encomendada);
  const recebida = Number(valores.quantidade_entregue ?? 0);
  const pct = encomendada > 0 ? Math.min((recebida / encomendada) * 100, 100) : 0;

  let estadoBarra = "parcial";
  if (recebida > encomendada) estadoBarra = "excesso";
  else if (recebida === encomendada && encomendada > 0) estadoBarra = "completo";

  return (
    <div className="recepcao__linha">
      <div>
        <div className="recepcao__produto-nome">{produto.descricao}</div>
        <div className="recepcao__produto-sku">
          {produto.sku_interno} · EAN {produto.ean13 || "—"}
        </div>
      </div>

      <div>
        <label className="recepcao__produto-sku">Lote</label>
        <input
          className="recepcao__input"
          type="text"
          placeholder={produto.controla_lote ? "obrigatório" : "n/a"}
          value={valores.numero_lote || ""}
          disabled={!produto.controla_lote}
          onChange={(e) => onChange({ numero_lote: e.target.value })}
        />
      </div>

      <div>
        <label className="recepcao__produto-sku">Validade</label>
        <input
          className="recepcao__input"
          type="date"
          disabled={!produto.controla_validade}
          value={valores.data_validade || ""}
          onChange={(e) => onChange({ data_validade: e.target.value })}
        />
      </div>

      <div>
        <label className="recepcao__produto-sku">Caixas recebidas</label>
        <input
          className="recepcao__input"
          type="number"
          min="0"
          value={valores.quantidade_entregue ?? ""}
          onChange={(e) => onChange({ quantidade_entregue: e.target.value })}
        />
      </div>

      <div className="recepcao__conferencia">
        <div className="recepcao__conferencia-numeros">
          <span>{recebida || 0}</span>
          <span>de {encomendada}</span>
        </div>
        <div className="recepcao__conferencia-barra">
          <div
            className={`recepcao__conferencia-fill recepcao__conferencia-fill--${estadoBarra}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
