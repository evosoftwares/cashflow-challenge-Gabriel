import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, TriangleAlert, Wifi, WifiOff, type LucideIcon } from "lucide-react";

import {
  ApiError,
  createTransaction,
  getDailyBalance,
  listTransactions,
  subscribeDailyBalance,
  type DailyBalance,
  type TransactionListItem,
  type TransactionType,
} from "./api/client";
import { ApiSettings } from "./components/ApiSettings";
import { DailyBalancePanel } from "./components/DailyBalancePanel";
import { StatusMessage } from "./components/StatusMessage";
import { TransactionForm } from "./components/TransactionForm";
import { TransactionsTable, type TransactionTableItem } from "./components/TransactionsTable";
import {
  enqueueTransaction,
  listQueuedTransactions,
  removeQueuedTransaction,
  saveQueuedTransaction,
  type QueuedTransaction,
} from "./offlineQueue";

const defaultApiKey = import.meta.env.VITE_DEFAULT_API_KEY ?? "local-dev-key";
const defaultMerchantId = "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11";
const queuedSyncRetryDelayMs = 5_000;
const dailyBalanceRetryAttempts = 5;
const dailyBalanceRetryDelayMs = 1_000;

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

function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return "API indisponível ou erro de rede.";
}

function shouldQueueForLater(error: unknown) {
  return !(error instanceof ApiError) || error.status === 0 || error.status >= 500;
}

function queueLabel(count: number) {
  return count === 1 ? "1 movimentação pendente" : `${count} movimentações pendentes`;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function areQueuedTransactionsEqual(first: QueuedTransaction[], second: QueuedTransaction[]) {
  if (first.length !== second.length) return false;
  return first.every((transaction, index) => {
    const otherTransaction = second[index];
    return (
      transaction.local_id === otherTransaction.local_id &&
      transaction.status === otherTransaction.status &&
      transaction.attempts === otherTransaction.attempts &&
      transaction.last_error === otherTransaction.last_error
    );
  });
}

type SyncState = "online" | "offline" | "syncing" | "failed";

function getSyncStatusPresentation(syncState: SyncState, isOnline: boolean): {
  icon: LucideIcon;
  iconLabel: string;
  label: string;
} {
  if (syncState === "syncing") {
    return { icon: LoaderCircle, iconLabel: "Status sincronizando", label: "Sincronizando" };
  }
  if (syncState === "failed") {
    return { icon: TriangleAlert, iconLabel: "Status com falha", label: "Falha ao sincronizar" };
  }
  if (syncState === "offline" || !isOnline) {
    return { icon: WifiOff, iconLabel: "Status offline", label: "Offline" };
  }
  return { icon: Wifi, iconLabel: "Status online", label: "Online" };
}

export default function App() {
  const [merchantId, setMerchantId] = useState(defaultMerchantId);
  const [operationDate, setOperationDate] = useState(todayDate);
  const [transactionType, setTransactionType] = useState<TransactionType>("CREDIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [occurredAt, setOccurredAt] = useState(currentLocalDateTime);
  const [dailyBalance, setDailyBalance] = useState<DailyBalance | null>(null);
  const [balanceState, setBalanceState] = useState<"idle" | "loading" | "available" | "pending" | "error">("idle");
  const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
  const [queuedTransactions, setQueuedTransactions] = useState<QueuedTransaction[]>([]);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [syncState, setSyncState] = useState<SyncState>(
    typeof navigator === "undefined" || navigator.onLine ? "online" : "offline",
  );
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "warning" | "error" | "info"; text: string } | null>(null);
  const syncInProgressRef = useRef(false);
  const syncRetryTimerRef = useRef<number | null>(null);

  const hasProtectedContext = useMemo(
    () => isValidUuid(merchantId) && operationDate.trim().length > 0,
    [merchantId, operationDate],
  );
  const canCreate = hasProtectedContext && amount.trim().length > 0 && occurredAt.trim().length > 0;
  const selectedStoreName =
    merchantId === defaultMerchantId ? "Mercado do Bairro - Demonstração" : "Loja de teste local";
  const pendingCount = queuedTransactions.length;
  const failedCount = queuedTransactions.filter((transaction) => transaction.status === "failed").length;
  const syncStatusPresentation = getSyncStatusPresentation(syncState, isOnline);
  const SyncStatusIcon = syncStatusPresentation.icon;
  const displayedTransactions = useMemo<TransactionTableItem[]>(() => {
    const localRows = queuedTransactions
      .filter(
        (transaction) =>
          transaction.payload.merchant_id === merchantId.trim() &&
          transaction.payload.occurred_at.slice(0, 10) === operationDate,
      )
      .map<TransactionTableItem>((transaction) => ({
        id: transaction.local_id,
        merchant_id: transaction.payload.merchant_id,
        type: transaction.payload.type,
        amount: transaction.payload.amount,
        description: transaction.payload.description ?? null,
        occurred_at: transaction.payload.occurred_at,
        created_at: transaction.created_at,
        sync_status: transaction.status,
      }));

    return [...localRows, ...transactions];
  }, [merchantId, operationDate, queuedTransactions, transactions]);

  useEffect(() => {
    if (!hasProtectedContext) {
      setDailyBalance(null);
      setBalanceState("idle");
      return undefined;
    }

    setBalanceState("loading");
    return subscribeDailyBalance(defaultApiKey, merchantId.trim(), operationDate, {
      onMessage: (streamMessage) => {
        if (streamMessage.status === "pending") {
          setDailyBalance(null);
          setBalanceState("pending");
          return;
        }

        setDailyBalance({
          merchant_id: streamMessage.merchant_id,
          date: streamMessage.date,
          total_credit: streamMessage.total_credit,
          total_debit: streamMessage.total_debit,
          balance: streamMessage.balance,
        });
        setBalanceState("available");
        void refreshTransactions({ clearMessage: false });
      },
      onError: (error) => {
        setBalanceState("error");
        setMessage({ tone: "error", text: errorMessage(error) });
      },
    });
  }, [hasProtectedContext, merchantId, operationDate]);

  useEffect(() => {
    if (!hasProtectedContext) {
      setTransactions([]);
      return;
    }

    void refreshTransactions({ clearMessage: false });
  }, [hasProtectedContext, merchantId, operationDate]);

  useEffect(() => {
    let active = true;

    listQueuedTransactions()
      .then((rows) => {
        if (!active) return;
        setQueuedTransactions((currentRows) => (areQueuedTransactionsEqual(currentRows, rows) ? currentRows : rows));
        if (rows.length > 0 && navigator.onLine) {
          void syncQueuedTransactions();
        }
      })
      .catch((error) => {
        if (active) setMessage({ tone: "error", text: errorMessage(error) });
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      clearSyncRetryTimer();
      void syncQueuedTransactions();
    }

    function handleOffline() {
      setIsOnline(false);
      setSyncState("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  });

  useEffect(() => {
    return () => clearSyncRetryTimer();
  }, []);

  function clearSyncRetryTimer() {
    if (syncRetryTimerRef.current === null) return;
    window.clearTimeout(syncRetryTimerRef.current);
    syncRetryTimerRef.current = null;
  }

  function scheduleQueuedTransactionRetry() {
    if (!navigator.onLine || syncRetryTimerRef.current !== null) return;

    syncRetryTimerRef.current = window.setTimeout(() => {
      syncRetryTimerRef.current = null;
      if (navigator.onLine) {
        void syncQueuedTransactions();
      }
    }, queuedSyncRetryDelayMs);
  }

  async function refreshTransactions(options: { clearMessage?: boolean } = {}) {
    if (!hasProtectedContext) return;
    if (options.clearMessage ?? true) {
      setMessage(null);
    }
    try {
      const rows = await listTransactions(defaultApiKey, merchantId.trim(), operationDate);
      setTransactions(rows);
    } catch (error) {
      setMessage({ tone: "error", text: errorMessage(error) });
    }
  }

  async function reloadQueuedTransactions() {
    const rows = await listQueuedTransactions();
    setQueuedTransactions((currentRows) => (areQueuedTransactionsEqual(currentRows, rows) ? currentRows : rows));
    return rows;
  }

  async function queueTransactionForLater(payload: Parameters<typeof enqueueTransaction>[0]) {
    await enqueueTransaction(payload);
    await reloadQueuedTransactions();
    setAmount("");
    setDescription("");
    setMessage({
      tone: "warning",
      text: "Movimentação salva offline. Ela será enviada quando a conexão voltar.",
    });
    setSyncState(navigator.onLine ? "failed" : "offline");
    scheduleQueuedTransactionRetry();
  }

  async function syncQueuedTransactions() {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;
    setSyncState("syncing");

    try {
      const rows = await reloadQueuedTransactions();
      if (rows.length === 0) {
        setSyncState(navigator.onLine ? "online" : "offline");
        return;
      }

      for (const queuedTransaction of rows) {
        const syncingTransaction = {
          ...queuedTransaction,
          status: "syncing" as const,
          attempts: queuedTransaction.attempts + 1,
          last_error: null,
        };
        await saveQueuedTransaction(syncingTransaction);
        await reloadQueuedTransactions();

        try {
          await createTransaction(defaultApiKey, syncingTransaction.payload);
          await removeQueuedTransaction(syncingTransaction.local_id);
          await reloadQueuedTransactions();
        } catch (error) {
          const failedTransaction = {
            ...syncingTransaction,
            status: "failed" as const,
            last_error: errorMessage(error),
          };
          await saveQueuedTransaction(failedTransaction);
          await reloadQueuedTransactions();
          setSyncState("failed");
          setMessage({ tone: "error", text: "Falha ao sincronizar movimentações pendentes." });
          if (shouldQueueForLater(error)) {
            scheduleQueuedTransactionRetry();
          }
          return;
        }
      }

      if (hasProtectedContext) {
        await refreshTransactions({ clearMessage: false });
        void refreshDailyBalance({ retryPending: true, settleAfterSuccess: true });
      }
      setSyncState(navigator.onLine ? "online" : "offline");
      setMessage({ tone: "success", text: "Sincronização concluída." });
    } finally {
      syncInProgressRef.current = false;
    }
  }

  async function refreshDailyBalance(options: { retryPending?: boolean; settleAfterSuccess?: boolean } = {}) {
    if (!hasProtectedContext) return;
    setBalanceState("loading");
    setMessage(null);

    for (let attempt = 1; attempt <= dailyBalanceRetryAttempts; attempt += 1) {
      try {
        const balance = await getDailyBalance(defaultApiKey, merchantId.trim(), operationDate);
        setDailyBalance(balance);
        setBalanceState("available");
        if (options.settleAfterSuccess && attempt < dailyBalanceRetryAttempts) {
          await wait(dailyBalanceRetryDelayMs);
          continue;
        }
        return;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          if (options.retryPending && attempt < dailyBalanceRetryAttempts) {
            await wait(dailyBalanceRetryDelayMs);
            continue;
          }
          setDailyBalance(null);
          setBalanceState("pending");
          return;
        }
        setBalanceState("error");
        setMessage({ tone: "error", text: errorMessage(error) });
        return;
      }
    }
  }

  async function submitTransaction() {
    if (!canCreate) return;
    setSubmitting(true);
    setMessage(null);
    const payload = {
      merchant_id: merchantId.trim(),
      client_request_id: crypto.randomUUID(),
      type: transactionType,
      amount: normalizeAmount(amount),
      description: description.trim() || undefined,
      occurred_at: occurredAt,
    };

    try {
      if (!isOnline) {
        await queueTransactionForLater(payload);
        setSyncState("offline");
        return;
      }

      await createTransaction(defaultApiKey, payload);
      setAmount("");
      setDescription("");
      await refreshTransactions();
      void refreshDailyBalance({ retryPending: true, settleAfterSuccess: true });
      setMessage({ tone: "success", text: "Movimentação salva com sucesso." });
    } catch (error) {
      if (shouldQueueForLater(error)) {
        await queueTransactionForLater(payload);
        return;
      }
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
      <ApiSettings />

      <section className="operation-context" aria-labelledby="operation-context-title">
        <div className="operation-context__intro">
          <div>
            <h2 id="operation-context-title">Dados para consulta</h2>
            <p>A loja já está pronta para uso. Escolha apenas a data.</p>
          </div>
          <span className={hasProtectedContext ? "context-state context-state--ready" : "context-state"}>
            <span className="status-dot" aria-hidden="true" />
            {hasProtectedContext ? "Pronto para usar" : "Faltam dados"}
          </span>
        </div>
        <div className="context-grid">
          <div className="store-summary" role="group" aria-label="Loja selecionada">
            <span className="store-summary__label">Loja</span>
            <strong>{selectedStoreName}</strong>
            <small>{merchantId === defaultMerchantId ? "Ambiente de demonstração" : "Nova loja para teste local"}</small>
          </div>
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
            aria-label="Criar loja de teste"
            className="button button--secondary context-grid__button"
            onClick={generateMerchantId}
            type="button"
          >
            Nova loja teste
          </button>
        </div>
      </section>

      {message ? <StatusMessage tone={message.tone}>{message.text}</StatusMessage> : null}

      <section className={`sync-status sync-status--${syncState}`} aria-label="Estado de sincronização">
        <SyncStatusIcon
          aria-label={syncStatusPresentation.iconLabel}
          className="sync-status__icon"
          role="img"
          size={17}
          strokeWidth={2.4}
        />
        <strong>{syncStatusPresentation.label}</strong>
        <span>{pendingCount > 0 ? queueLabel(pendingCount) : "Sem pendências offline"}</span>
        {failedCount > 0 ? (
          <button className="button button--secondary sync-status__action" onClick={syncQueuedTransactions} type="button">
            Tentar enviar agora
          </button>
        ) : null}
      </section>

      <div className="primary-grid">
        <DailyBalancePanel
          balance={dailyBalance}
          date={operationDate}
          state={balanceState}
        />

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
      </div>

      <TransactionsTable
        disabled={!hasProtectedContext}
        filterDate={operationDate}
        transactions={displayedTransactions}
        onFilterDateChange={setOperationDate}
      />
    </main>
  );
}
