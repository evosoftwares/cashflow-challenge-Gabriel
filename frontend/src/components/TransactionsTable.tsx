import type { TransactionListItem } from "../api/client";

type TransactionsTableProps = {
  transactions: TransactionListItem[];
  disabled: boolean;
  loading: boolean;
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
  return value === "CREDIT" ? "Crédito" : "Débito";
}

export function TransactionsTable({ transactions, disabled, loading, onRefresh }: TransactionsTableProps) {
  return (
    <section className="panel transactions-panel" aria-labelledby="transactions-title">
      <div className="panel-header panel-header--row">
        <div>
          <h2 id="transactions-title">Lançamentos</h2>
          <p>Movimentações registradas para o comerciante e data selecionados.</p>
        </div>
        <button className="button button--secondary" disabled={disabled || loading} onClick={onRefresh} type="button">
          {loading ? "Atualizando..." : "Atualizar lançamentos"}
        </button>
      </div>

      <div className="table-wrap">
        <table aria-label="Lançamentos financeiros">
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
                  Nenhum lançamento carregado.
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>
                    <span className={`type-badge type-badge--${transaction.type.toLowerCase()}`}>
                      {formatType(transaction.type)}
                    </span>
                  </td>
                  <td>{formatCurrency(transaction.amount)}</td>
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
