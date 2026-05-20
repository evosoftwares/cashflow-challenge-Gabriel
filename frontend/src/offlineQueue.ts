import type { TransactionCreateRequest } from "./api/client";

export type QueuedTransactionStatus = "pending" | "syncing" | "failed";

export type QueuedTransaction = {
  local_id: string;
  client_request_id: string;
  payload: TransactionCreateRequest & { client_request_id: string };
  status: QueuedTransactionStatus;
  attempts: number;
  created_at: string;
  last_error: string | null;
};

const DB_NAME = "cashflow-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "queued_transactions";

function openQueueDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "local_id" });
        store.createIndex("created_at", "created_at", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const database = await openQueueDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = operation(store);
    let result: T | undefined;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function enqueueTransaction(payload: TransactionCreateRequest & { client_request_id: string }) {
  const queuedTransaction: QueuedTransaction = {
    local_id: crypto.randomUUID(),
    client_request_id: payload.client_request_id,
    payload,
    status: "pending",
    attempts: 0,
    created_at: new Date().toISOString(),
    last_error: null,
  };

  await withStore("readwrite", (store) => store.put(queuedTransaction));
  return queuedTransaction;
}

export async function listQueuedTransactions(): Promise<QueuedTransaction[]> {
  const rows = (await withStore<QueuedTransaction[]>("readonly", (store) => store.getAll())) ?? [];
  return rows.sort((first, second) => first.created_at.localeCompare(second.created_at));
}

export async function removeQueuedTransaction(localId: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(localId));
}

export async function saveQueuedTransaction(transaction: QueuedTransaction): Promise<void> {
  await withStore("readwrite", (store) => store.put(transaction));
}
