import { ArrowDownRight, ArrowUpRight, WalletCards } from "lucide-react";

import type { DailyBalance } from "../api/client";

type DailyBalancePanelProps = {
  balance: DailyBalance | null;
  state: "idle" | "loading" | "available" | "pending" | "error";
  date: string;
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
  if (state === "available") return "Saldo atualizado";
  if (state === "pending") return "Aguardando atualização";
  if (state === "error") return "Erro";
  if (state === "loading") return "Buscando saldo";
  return "Aguardando busca";
}

function formatDate(value: string): string {
  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return value || "Data não definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(parsedDate);
}

export function DailyBalancePanel({ balance, state, date }: DailyBalancePanelProps) {
  const balanceValue = formatCurrency(balance?.balance);

  return (
    <section className="panel balance-panel" aria-labelledby="balance-title">
      <div className="panel-header panel-header--row">
        <div>
          <h2 id="balance-title">Resumo do dia</h2>
          <p>{formatDate(date)}</p>
        </div>
      </div>

      <div className="balance-hero">
        <div>
          <span className={`balance-state balance-state--${state}`}>
            <span className="status-dot" aria-hidden="true" />
            {stateLabel(state)}
          </span>
          <p>Saldo do dia</p>
        </div>
        <strong>{balanceValue}</strong>
      </div>

      <dl className="metric-grid">
        <div className="metric-card metric-card--credit">
          <dt>
            <ArrowUpRight size={15} strokeWidth={2.4} aria-hidden="true" />
            Entradas
          </dt>
          <dd>{formatCurrency(balance?.total_credit)}</dd>
        </div>
        <div className="metric-card metric-card--debit">
          <dt>
            <ArrowDownRight size={15} strokeWidth={2.4} aria-hidden="true" />
            Saídas
          </dt>
          <dd>{formatCurrency(balance?.total_debit)}</dd>
        </div>
        <div className="metric-card metric-grid__balance">
          <dt>
            <WalletCards size={15} strokeWidth={2.4} aria-hidden="true" />
            Saldo
          </dt>
          <dd>{formatCurrency(balance?.balance)}</dd>
        </div>
      </dl>
    </section>
  );
}
