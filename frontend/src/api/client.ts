export type TransactionType = "CREDIT" | "DEBIT";

export type TransactionCreateRequest = {
  merchant_id: string;
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
    return new ApiError("API Key inválida ou ausente.", response.status);
  }
  if (response.status === 404) {
    return new ApiError("Recurso não encontrado.", response.status);
  }

  try {
    const body = (await response.json()) as { detail?: string };
    return new ApiError(body.detail ?? "Erro ao comunicar com a API.", response.status);
  } catch {
    return new ApiError("Erro ao comunicar com a API.", response.status);
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
