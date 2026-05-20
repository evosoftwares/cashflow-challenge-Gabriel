import { useEffect, useMemo, useState } from "react";

import {
  ApiError,
  createTransaction,
  getDailyBalance,
  getHealth,
  listTransactions,
  type DailyBalance,
  type TransactionListItem,
  type TransactionType,
} from "./api/client";
import { ApiSettings } from "./components/ApiSettings";
import { DailyBalancePanel } from "./components/DailyBalancePanel";
import { StatusMessage } from "./components/StatusMessage";
import { TransactionForm } from "./components/TransactionForm";
import { TransactionsTable } from "./components/TransactionsTable";

const apiKeyStorageKey = "cashflow.apiKey";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function currentLocalDateTime() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 16);
}

function normalizeAmount(value: string) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return value;
  return numericValue.toFixed(2);
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "API indisponível ou erro de rede.";
}

export default function App() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(apiKeyStorageKey) ?? "");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [merchantId, setMerchantId] = useState("");
  const [operationDate, setOperationDate] = useState(todayDate);
  const [transactionType, setTransactionType] = useState<TransactionType>("CREDIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(currentLocalDateTime);
  const [dailyBalance, setDailyBalance] = useState<DailyBalance | null>(null);
  const [balanceState, setBalanceState] = useState<"idle" | "loading" | "available" | "pending" | "error">("idle");
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    localStorage.setItem(apiKeyStorageKey, apiKey);
  }, [apiKey]);

  useEffect(() => {
    let active = true;
    getHealth()
      .then(() => {
        if (active) setApiStatus("online");
      })
      .catch(() => {
        if (active) setApiStatus("offline");
      });

    return () => {
      active = false;
    };
  }, []);

  const hasProtectedContext = useMemo(
    () => apiKey.trim().length > 0 && merchantId.trim().length > 0 && operationDate.trim().length > 0,
    [apiKey, merchantId, operationDate],
  );
  const canCreate = hasProtectedContext && amount.trim().length > 0 && occurredAt.trim().length > 0;

  async function refreshTransactions() {
    if (!hasProtectedContext) return;
    setTransactionsLoading(true);
    setMessage(null);
    try {
      const rows = await listTransactions(apiKey.trim(), merchantId.trim(), operationDate);
      setTransactions(rows);
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function refreshDailyBalance() {
    if (!hasProtectedContext) return;
    setBalanceState("loading");
    setMessage(null);
    try {
      const balance = await getDailyBalance(apiKey.trim(), merchantId.trim(), operationDate);
      setDailyBalance(balance);
      setBalanceState("available");
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setDailyBalance(null);
        setBalanceState("pending");
        return;
      }
      setBalanceState("error");
      setMessage({ tone: "error", text: errorMessage(error) });
    }
  }

  async function submitTransaction() {
    if (!canCreate) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await createTransaction(apiKey.trim(), {
        merchant_id: merchantId.trim(),
        type: transactionType,
        amount: normalizeAmount(amount),
        description: description.trim() || undefined,
        occurred_at: occurredAt,
      });
      setAmount("");
      setDescription("");
      await Promise.all([refreshTransactions(), refreshDailyBalance()]);
      setMessage({ tone: "success", text: "Movimentação salva com sucesso." });
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    } finally {
      setSubmitting(false);
    }
  }

  function generateMerchantId() {
    setMerchantId(crypto.randomUUID());
    setTransactions([]);
    setDailyBalance(null);
    setBalanceState("idle");
  }

  return (
    <main className="app-shell">
      <ApiSettings apiKey={apiKey} apiStatus={apiStatus} onApiKeyChange={setApiKey} />

      <section className="operation-context" aria-labelledby="operation-context-title">
        <div className="operation-context__intro">
          <div>
            <h2 id="operation-context-title">Dados para consulta</h2>
            <p>Escolha o comerciante e a data.</p>
          </div>
          <span className={hasProtectedContext ? "context-state context-state--ready" : "context-state"}>
            <span className="status-dot" aria-hidden="true" />
            {hasProtectedContext ? "Pronto para usar" : "Faltam dados"}
          </span>
        </div>
        <div className="context-grid">
          <label className="field">
            <span>Comerciante</span>
            <input
              aria-label="Comerciante"
              type="text"
              value={merchantId}
              onChange={(event) => setMerchantId(event.target.value)}
              placeholder="8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11"
            />
          </label>
          <label className="field">
            <span>Data</span>
            <input
              aria-label="Data"
              type="date"
              value={operationDate}
              onChange={(event) => setOperationDate(event.target.value)}
            />
          </label>
          <button
            aria-label="Criar comerciante de teste"
            className="button button--secondary context-grid__button"
            onClick={generateMerchantId}
            type="button"
          >
            Criar teste
          </button>
        </div>
      </section>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

      <div className="workspace-grid">
        <TransactionForm
          amount={amount}
          description={description}
          disabled={!canCreate}
          occurredAt={occurredAt}
          submitting={submitting}
          type={transactionType}
          onAmountChange={setAmount}
          onDescriptionChange={setDescription}
          onOccurredAtChange={setOccurredAt}
          onSubmit={submitTransaction}
          onTypeChange={setTransactionType}
        />

        <DailyBalancePanel
          balance={dailyBalance}
          disabled={!hasProtectedContext}
          date={operationDate}
          state={balanceState}
          onRefresh={refreshDailyBalance}
        />
      </div>

      <TransactionsTable
        disabled={!hasProtectedContext}
        loading={transactionsLoading}
        transactions={transactions}
        onRefresh={refreshTransactions}
      />
    </main>
  );
}
