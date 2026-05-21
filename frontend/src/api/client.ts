export type TransactionType = "CREDIT" | "DEBIT";

export type TransactionCreateRequest = {
  merchant_id: string;
  client_request_id?: string;
  type: TransactionType;
  amount: string;
  description?: string;
  occurred_at: string;
};

export type TransactionResponse = {
  id: string;
  merchant_id: string;
  type: TransactionType;
  amount: string;
  status: string;
};

export type TransactionListItem = {
  id: string;
  merchant_id: string;
  type: TransactionType;
  amount: string;
  description: string | null;
  occurred_at: string;
  created_at: string;
};

export type DailyBalance = {
  merchant_id: string;
  date: string;
  total_credit: string;
  total_debit: string;
  balance: string;
};

export type DailyBalanceStreamMessage =
  | { status: "pending" }
  | ({
      status: "available";
    } & DailyBalance);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function parseError(response: Response): Promise<ApiError> {
  if (response.status === 401) {
    return new ApiError("Não conseguimos confirmar o acesso deste ambiente. Chame o suporte.", response.status);
  }
  if (response.status === 404) {
    return new ApiError("Ainda não encontramos essa informação.", response.status);
  }

  try {
    const body = (await response.json()) as { detail?: string };
    return new ApiError(body.detail ?? "Não conseguimos concluir esta ação agora. Tente novamente em instantes.", response.status);
  } catch {
    return new ApiError("Não conseguimos concluir esta ação agora. Tente novamente em instantes.", response.status);
  }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

export async function getHealth(): Promise<{ status: string }> {
  return requestJson<{ status: string }>("/health");
}

export async function createTransaction(
  apiKey: string,
  payload: TransactionCreateRequest,
): Promise<TransactionResponse> {
  return requestJson<TransactionResponse>("/transactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function listTransactions(
  apiKey: string,
  merchantId: string,
  date: string,
): Promise<TransactionListItem[]> {
  const params = new URLSearchParams({ merchant_id: merchantId, date });
  return requestJson<TransactionListItem[]>(`/transactions?${params.toString()}`, {
    headers: {
      "X-API-Key": apiKey,
    },
  });
}

export async function getDailyBalance(
  apiKey: string,
  merchantId: string,
  date: string,
): Promise<DailyBalance> {
  const params = new URLSearchParams({ merchant_id: merchantId });
  return requestJson<DailyBalance>(`/daily-balances/${date}?${params.toString()}`, {
    headers: {
      "X-API-Key": apiKey,
    },
  });
}

function parseSseMessages(buffer: string): {
  messages: DailyBalanceStreamMessage[];
  remainingBuffer: string;
} {
  const blocks = buffer.split("\n\n");
  const remainingBuffer = blocks.pop() ?? "";
  const messages = blocks.flatMap((block) => {
    const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
    if (!dataLine) return [];
    return [JSON.parse(dataLine.slice("data: ".length)) as DailyBalanceStreamMessage];
  });

  return { messages, remainingBuffer };
}

export function subscribeDailyBalance(
  apiKey: string,
  merchantId: string,
  date: string,
  handlers: {
    onMessage: (message: DailyBalanceStreamMessage) => void;
    onError: (error: unknown) => void;
  },
): () => void {
  const controller = new AbortController();

  void (async () => {
    try {
      const params = new URLSearchParams({ merchant_id: merchantId });
      const response = await fetch(`${API_BASE_URL}/daily-balances/${date}/stream?${params.toString()}`, {
        headers: {
          "X-API-Key": apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw await parseError(response);
      }
      if (!response.body) {
        throw new ApiError("Não foi possível acompanhar as atualizações em tempo real agora.", 0);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parsed = parseSseMessages(buffer);
        buffer = parsed.remainingBuffer;
        for (const message of parsed.messages) {
          handlers.onMessage(message);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        handlers.onError(error);
      }
    }
  })();

  return () => controller.abort();
}
