import { RefreshCw } from "lucide-react";

import type { TransactionListItem } from "../api/client";

type TransactionsTableProps = {
  transactions: TransactionListItem[];
  disabled: boolean;
  filterDate: string;
  loading: boolean;
  onFilterDateChange: (value: string) => void;
  onRefresh: () => void;
};

function formatCurrency(value: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatType(value: TransactionListItem["type"]) {
  return value === "CREDIT" ? "Entrada" : "Saída";
}

export function TransactionsTable({
  transactions,
  disabled,
  filterDate,
  loading,
  onFilterDateChange,
  onRefresh,
}: TransactionsTableProps) {
  const counterLabel = transactions.length === 1 ? "1 movimentação" : `${transactions.length} movimentações`;

  return (
    <section className="panel transactions-panel" aria-labelledby="transactions-title">
      <div className="panel-header panel-header--row">
        <div>
          <h2 id="transactions-title">Movimentações do dia</h2>
          <p>{counterLabel} na data selecionada</p>
        </div>
        <div className="transactions-toolbar">
          <label className="field transactions-filter">
            <span>Filtrar por data</span>
            <input
              aria-label="Filtrar movimentações por data"
              disabled={disabled}
              type="date"
              value={filterDate}
              onChange={(event) => onFilterDateChange(event.target.value)}
            />
          </label>
          <button
            aria-label="Atualizar movimentações"
            className="button button--secondary"
            disabled={disabled || loading}
            onClick={onRefresh}
            type="button"
          >
            <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table aria-label="Movimentações financeiras">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Descrição</th>
              <th>Ocorrência</th>
              <th>Criação</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={5}>
                  Nenhuma movimentação nesta data.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr
                  className={`transaction-row transaction-row--${transaction.type.toLowerCase()}`}
                  key={transaction.id}
                >
                  <td>
                    <span className={`type-badge type-badge--${transaction.type.toLowerCase()}`}>
                      {formatType(transaction.type)}
                    </span>
                  </td>
                  <td className={`amount-cell amount-cell--${transaction.type.toLowerCase()}`}>
                    {formatCurrency(transaction.amount)}
                  </td>
                  <td>{transaction.description ?? "-"}</td>
                  <td>{formatDateTime(transaction.occurred_at)}</td>
                  <td>{formatDateTime(transaction.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
