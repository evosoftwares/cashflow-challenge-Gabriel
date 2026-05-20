import type { DailyBalance } from "../api/client";

type DailyBalancePanelProps = {
  balance: DailyBalance | null;
  state: "idle" | "loading" | "available" | "pending" | "error";
  disabled: boolean;
  onRefresh: () => void;
};

const emptyValue = "R$ 0,00";

function formatCurrency(value: string | undefined): string {
  if (!value) return emptyValue;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function stateLabel(state: DailyBalancePanelProps["state"]) {
  if (state === "available") return "Consolidado disponível";
  if (state === "pending") return "Ainda não consolidado";
  if (state === "error") return "Erro";
  if (state === "loading") return "Consultando consolidado";
  return "Aguardando consulta";
}

export function DailyBalancePanel({ balance, state, disabled, onRefresh }: DailyBalancePanelProps) {
  return (
    <section className="panel balance-panel" aria-labelledby="balance-title">
      <div className="panel-header panel-header--row">
        <div>
          <h2 id="balance-title">Consolidado diário</h2>
          <p>Saldo calculado pelo worker assíncrono.</p>
        </div>
        <button className="button button--secondary" disabled={disabled || state === "loading"} onClick={onRefresh} type="button">
          Consultar consolidado
        </button>
      </div>

      <div className={`balance-state balance-state--${state}`}>{stateLabel(state)}</div>

      <dl className="metric-grid">
        <div>
          <dt>Total de créditos</dt>
          <dd>{formatCurrency(balance?.total_credit)}</dd>
        </div>
        <div>
          <dt>Total de débitos</dt>
          <dd>{formatCurrency(balance?.total_debit)}</dd>
        </div>
        <div className="metric-grid__balance">
          <dt>Saldo</dt>
          <dd>{formatCurrency(balance?.balance)}</dd>
        </div>
      </dl>
    </section>
  );
}
