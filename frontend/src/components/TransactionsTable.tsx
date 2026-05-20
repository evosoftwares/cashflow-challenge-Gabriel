import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";

import type { TransactionListItem } from "../api/client";

type TransactionsTableProps = {
  transactions: TransactionListItem[];
  disabled: boolean;
  filterDate: string;
  onFilterDateChange: (value: string) => void;
};

type SortKey = "type" | "amount" | "description" | "occurred_at" | "created_at";
type SortDirection = "asc" | "desc";

const PAGE_SIZE = 10;
const sortableColumns: Array<{ key: SortKey; label: string; ariaLabel: string }> = [
  { key: "type", label: "Tipo", ariaLabel: "Ordenar por tipo" },
  { key: "amount", label: "Valor", ariaLabel: "Ordenar por valor" },
  { key: "description", label: "Descrição", ariaLabel: "Ordenar por descrição" },
  { key: "occurred_at", label: "Ocorrência", ariaLabel: "Ordenar por ocorrência" },
  { key: "created_at", label: "Criação", ariaLabel: "Ordenar por criação" },
];

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

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getSortValue(transaction: TransactionListItem, sortKey: SortKey): string | number {
  if (sortKey === "amount") return Number(transaction.amount);
  if (sortKey === "type") return formatType(transaction.type);
  if (sortKey === "description") return transaction.description ?? "";
  return new Date(transaction[sortKey]).getTime();
}

function compareTransactions(a: TransactionListItem, b: TransactionListItem, sortKey: SortKey, direction: SortDirection) {
  const firstValue = getSortValue(a, sortKey);
  const secondValue = getSortValue(b, sortKey);
  const directionMultiplier = direction === "asc" ? 1 : -1;

  if (typeof firstValue === "number" && typeof secondValue === "number") {
    return (firstValue - secondValue) * directionMultiplier;
  }

  return String(firstValue).localeCompare(String(secondValue), "pt-BR", { sensitivity: "base" }) * directionMultiplier;
}

function searchableText(transaction: TransactionListItem): string {
  return normalizeSearch(
    [
      formatType(transaction.type),
      transaction.type,
      transaction.amount,
      formatCurrency(transaction.amount),
      transaction.description ?? "",
      transaction.occurred_at,
      transaction.created_at,
      formatDateTime(transaction.occurred_at),
      formatDateTime(transaction.created_at),
    ].join(" "),
  );
}

export function TransactionsTable({
  transactions,
  disabled,
  filterDate,
  onFilterDateChange,
}: TransactionsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);

  const visibleTransactions = useMemo(() => {
    const normalizedSearch = normalizeSearch(searchTerm);
    const filteredTransactions = normalizedSearch
      ? transactions.filter((transaction) => searchableText(transaction).includes(normalizedSearch))
      : transactions;

    if (sortKey === null) return filteredTransactions;
    return [...filteredTransactions].sort((a, b) => compareTransactions(a, b, sortKey, sortDirection));
  }, [searchTerm, sortDirection, sortKey, transactions]);

  const totalPages = Math.max(1, Math.ceil(visibleTransactions.length / PAGE_SIZE));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = visibleTransactions.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);
  const hasPreviousPage = activePage > 1;
  const hasNextPage = activePage < totalPages;
  const counterLabel =
    visibleTransactions.length === 1 ? "1 movimentação" : `${visibleTransactions.length} movimentações`;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortDirection, sortKey, transactions]);

  function handleSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextSortKey);
    setSortDirection("asc");
  }

  return (
    <section className="panel transactions-panel" aria-labelledby="transactions-title">
      <div className="panel-header panel-header--row">
        <div>
          <h2 id="transactions-title">Movimentações do dia</h2>
          <p>{counterLabel} na data selecionada</p>
        </div>
        <div className="transactions-toolbar">
          <label className="field transactions-search">
            <span>Buscar</span>
            <div className="input-with-icon">
              <Search size={15} strokeWidth={2.2} aria-hidden="true" />
              <input
                aria-label="Buscar movimentações"
                disabled={disabled}
                placeholder="Tipo, valor, descrição ou data"
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </label>
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
        </div>
      </div>

      <div className="table-wrap">
        <table aria-label="Movimentações financeiras">
          <thead>
            <tr>
              {sortableColumns.map((column) => (
                <th key={column.key}>
                  <button
                    aria-label={column.ariaLabel}
                    className="sort-button"
                    onClick={() => handleSort(column.key)}
                    type="button"
                  >
                    <span>{column.label}</span>
                    <ArrowUpDown size={13} strokeWidth={2.3} aria-hidden="true" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedTransactions.length === 0 ? (
              <tr>
                <td className="empty-row" colSpan={5}>
                  Nenhuma movimentação nesta data.
                </td>
              </tr>
            ) : (
              paginatedTransactions.map((transaction) => (
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

      <div className="pagination-bar" aria-label="Paginação de movimentações">
        <span>
          Página {activePage} de {totalPages}
        </span>
        <div className="pagination-actions">
          <button
            aria-label="Página anterior"
            className="button button--secondary pagination-button"
            disabled={!hasPreviousPage}
            onClick={() => setCurrentPage(Math.max(1, activePage - 1))}
            type="button"
          >
            <ChevronLeft size={15} strokeWidth={2.2} aria-hidden="true" />
            Anterior
          </button>
          <button
            aria-label="Próxima página"
            className="button button--secondary pagination-button"
            disabled={!hasNextPage}
            onClick={() => setCurrentPage(Math.min(totalPages, activePage + 1))}
            type="button"
          >
            Próxima
            <ChevronRight size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
