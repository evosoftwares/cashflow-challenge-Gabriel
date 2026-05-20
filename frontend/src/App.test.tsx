import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import App from "./App";

type MockResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

const jsonResponse = (status: number, body: unknown): MockResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const healthResponse = () => jsonResponse(200, { status: "ok" });
const demoMerchantId = "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11";

const transactionItem = (overrides: Record<string, string>) => ({
  id: overrides.id ?? crypto.randomUUID(),
  merchant_id: overrides.merchant_id ?? demoMerchantId,
  type: overrides.type ?? "CREDIT",
  amount: overrides.amount ?? "100.00",
  description: overrides.description ?? "Movimentação teste",
  occurred_at: overrides.occurred_at ?? "2026-05-20T10:00:00",
  created_at: overrides.created_at ?? "2026-05-20T10:01:00",
});

const streamResponse = (messages: string[]) =>
  new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        for (const message of messages) {
          controller.enqueue(encoder.encode(message));
        }
        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
      },
      status: 200,
    },
  );

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => MockResponse | Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    try {
      return Promise.resolve(handler(input, init));
    } catch (error) {
      if (url.endsWith("/health")) return Promise.resolve(healthResponse());
      if (url.includes("/daily-balances/") && url.includes("/stream")) {
        return Promise.resolve(streamResponse(['event: daily_balance\ndata: {"status":"pending"}\n\n']));
      }
      if (url.includes("/transactions?")) return Promise.resolve(jsonResponse(200, []));
      if (url.includes("/daily-balances/")) {
        return Promise.resolve(jsonResponse(404, { detail: "Daily balance not found" }));
      }
      throw error;
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillOperationContext(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText("Data"));
  await user.type(screen.getByLabelText("Data"), "2026-05-20");
}

function tableBodyRowTexts(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole("row")
    .slice(1)
    .map((row) => (row.textContent ?? "").replace(/\s+/g, " "));
}

describe("Cash Flow operational portal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders the branded operational shell ready for a nontechnical operator", async () => {
    const user = userEvent.setup();
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);

    expect(screen.getByRole("heading", { name: "Mercado do Bairro Fluxo de Caixa" })).toBeInTheDocument();
    expect(screen.queryByText("API conectada")).not.toBeInTheDocument();
    expect(screen.queryByText("API local localhost:8000")).not.toBeInTheDocument();
    expect(screen.queryByText("Chave de acesso")).not.toBeInTheDocument();
    expect(screen.getByText("Mercado do Bairro - Demonstração")).toBeInTheDocument();
    expect(screen.getByText("Pronto para usar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atualizar movimentações" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atualizar resumo do dia" })).not.toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: "Salvar movimentação" });
    expect(saveButton).toBeDisabled();
    await user.type(screen.getByLabelText("Valor"), "100.00");
    expect(saveButton).toBeEnabled();
  });

  test("creates a transaction with the API key header and shows success", async () => {
    const fetchMock = mockFetch((input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.endsWith("/transactions") && init?.method === "POST") {
        expect(init.headers).toMatchObject({
          "Content-Type": "application/json",
          "X-API-Key": "local-dev-key",
        });
        expect(JSON.parse(String(init.body))).toMatchObject({
          merchant_id: demoMerchantId,
          type: "CREDIT",
          amount: "100.00",
          description: "Venda no cartao",
          occurred_at: "2026-05-20T10:00",
        });
        return jsonResponse(201, {
          id: "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
          merchant_id: demoMerchantId,
          type: "CREDIT",
          amount: "100.00",
          status: "CREATED",
        });
      }
      if (url.includes("/transactions?")) return jsonResponse(200, []);
      if (url.includes("/daily-balances/")) return jsonResponse(404, { detail: "Daily balance not found" });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);
    await user.type(screen.getByLabelText("Valor"), "100.00");
    await user.type(screen.getByLabelText("Descrição simples"), "Venda no cartao");
    await user.clear(screen.getByLabelText("Quando aconteceu"));
    await user.type(screen.getByLabelText("Quando aconteceu"), "2026-05-20T10:00");
    await user.click(screen.getByRole("button", { name: "Salvar movimentação" }));

    expect(await screen.findByText("Movimentação salva com sucesso.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/transactions",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("shows the pending consolidation state from realtime updates", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.includes("/daily-balances/2026-05-20/stream")) {
        return streamResponse(['event: daily_balance\ndata: {"status":"pending"}\n\n']);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);

    expect(await screen.findByText("Aguardando atualização")).toBeInTheDocument();
  });

  test("renders a daily balance when realtime consolidation is available", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.includes("/daily-balances/2026-05-20/stream")) {
        return streamResponse([
          'event: daily_balance\ndata: {"status":"available","merchant_id":"8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11","date":"2026-05-20","total_credit":"300.00","total_debit":"80.00","balance":"220.00"}\n\n',
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);

    expect(await screen.findByText("Saldo atualizado")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 80,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 220,00").length).toBeGreaterThanOrEqual(1);
  });

  test("updates the daily summary from realtime stream without manual refresh", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.includes("/daily-balances/2026-05-20/stream")) {
        return streamResponse([
          'event: daily_balance\ndata: {"status":"available","merchant_id":"8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11","date":"2026-05-20","total_credit":"120.00","total_debit":"20.00","balance":"100.00"}\n\n',
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);

    expect(await screen.findByText("Saldo atualizado")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 20,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 100,00").length).toBeGreaterThanOrEqual(1);
  });

  test("loads day transactions automatically after realtime balance updates", async () => {
    let transactionListCalls = 0;
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.includes("/daily-balances/2026-05-20/stream")) {
        return streamResponse([
          'event: daily_balance\ndata: {"status":"available","merchant_id":"8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11","date":"2026-05-20","total_credit":"88.00","total_debit":"0.00","balance":"88.00"}\n\n',
        ]);
      }
      if (url.includes("/transactions?")) {
        transactionListCalls += 1;
        return jsonResponse(
          200,
          transactionListCalls === 1
            ? []
            : [
                {
                  id: "cef38293-8439-4417-8b65-22dd782b2daf",
                  merchant_id: "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
                  type: "CREDIT",
                  amount: "88.00",
                  description: "Validacao realtime",
                  occurred_at: "2026-05-20T10:00:00",
                  created_at: "2026-05-20T10:01:00",
                },
              ],
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);

    const table = await screen.findByRole("table", { name: "Movimentações financeiras" });
    expect(await within(table).findByText("Validacao realtime")).toBeInTheDocument();
    expect(within(table).getByText("R$ 88,00")).toBeInTheDocument();
    expect(transactionListCalls).toBeGreaterThanOrEqual(2);
  });

  test("lists transactions returned by the API", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.includes("/transactions?")) {
        return jsonResponse(200, [
          {
            id: "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
            merchant_id: "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
            type: "CREDIT",
            amount: "100.00",
            description: "Venda no cartao",
            occurred_at: "2026-05-20T10:00:00",
            created_at: "2026-05-20T10:01:00",
          },
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);

    const table = await screen.findByRole("table", { name: "Movimentações financeiras" });
    expect(within(table).getByText("Venda no cartao")).toBeInTheDocument();
    expect(within(table).getByText("Entrada")).toBeInTheDocument();
    expect(within(table).getByText("R$ 100,00")).toBeInTheDocument();
  });

  test("filters day transactions by the selected movement date", async () => {
    const fetchMock = mockFetch((input) => {
      const url = String(input);
      if (url.includes("/transactions?")) {
        if (url.includes("date=2026-05-21")) {
          return jsonResponse(200, [
            {
              id: "9a6aa074-1fc2-4c0f-932f-d2f44d555e57",
              merchant_id: demoMerchantId,
              type: "DEBIT",
              amount: "35.00",
              description: "Compra filtrada",
              occurred_at: "2026-05-21T09:30:00",
              created_at: "2026-05-21T09:31:00",
            },
          ]);
        }
        return jsonResponse(200, []);
      }
      throw new Error(`Unexpected request: ${url}`);
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText("Filtrar movimentações por data"), {
      target: { value: "2026-05-21" },
    });

    const table = await screen.findByRole("table", { name: "Movimentações financeiras" });
    expect(await within(table).findByText("Compra filtrada")).toBeInTheDocument();
    expect(within(table).getByText("Saída")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("date=2026-05-21"),
      expect.objectContaining({ headers: expect.objectContaining({ "X-API-Key": "local-dev-key" }) }),
    );
  });

  test("sorts day transactions by type, amount, description, occurrence and creation", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.includes("/transactions?")) {
        return jsonResponse(200, [
          transactionItem({
            id: "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
            type: "DEBIT",
            amount: "50.00",
            description: "Zulu fornecedor",
            occurred_at: "2026-05-20T12:00:00",
            created_at: "2026-05-20T12:01:00",
          }),
          transactionItem({
            id: "6b9f41ad-1f43-41c6-83da-484e92a80c30",
            type: "CREDIT",
            amount: "10.00",
            description: "Alpha venda",
            occurred_at: "2026-05-20T09:00:00",
            created_at: "2026-05-20T09:01:00",
          }),
          transactionItem({
            id: "41bf5b64-fcb3-494d-9049-5826d9e3afbd",
            type: "CREDIT",
            amount: "30.00",
            description: "Beta cartão",
            occurred_at: "2026-05-20T10:00:00",
            created_at: "2026-05-20T10:01:00",
          }),
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    const table = await screen.findByRole("table", { name: "Movimentações financeiras" });

    await user.click(within(table).getByRole("button", { name: "Ordenar por tipo" }));
    expect(tableBodyRowTexts(table).at(0)).toContain("Entrada");
    expect(tableBodyRowTexts(table).at(-1)).toContain("Saída");

    await user.click(within(table).getByRole("button", { name: "Ordenar por valor" }));
    expect(tableBodyRowTexts(table)[0]).toContain("R$ 10,00");

    await user.click(within(table).getByRole("button", { name: "Ordenar por descrição" }));
    expect(tableBodyRowTexts(table)[0]).toContain("Alpha venda");

    await user.click(within(table).getByRole("button", { name: "Ordenar por ocorrência" }));
    expect(tableBodyRowTexts(table)[0]).toContain("09:00");

    await user.click(within(table).getByRole("button", { name: "Ordenar por criação" }));
    expect(tableBodyRowTexts(table)[0]).toContain("09:01");
  });

  test("searches day transactions by visible transaction information", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.includes("/transactions?")) {
        return jsonResponse(200, [
          transactionItem({
            id: "7a4de3ff-8047-42c7-b9b2-679332e8f304",
            type: "DEBIT",
            amount: "50.00",
            description: "Fornecedor padaria",
            occurred_at: "2026-05-20T12:00:00",
            created_at: "2026-05-20T12:01:00",
          }),
          transactionItem({
            id: "b83630f9-c72a-46c4-a74f-5a852d020f6f",
            type: "CREDIT",
            amount: "10.00",
            description: "Venda balcão",
            occurred_at: "2026-05-20T09:00:00",
            created_at: "2026-05-20T09:01:00",
          }),
        ]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    const table = await screen.findByRole("table", { name: "Movimentações financeiras" });

    await user.type(screen.getByLabelText("Buscar movimentações"), "fornecedor");
    expect(within(table).getByText("Fornecedor padaria")).toBeInTheDocument();
    expect(within(table).queryByText("Venda balcão")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar movimentações"));
    await user.type(screen.getByLabelText("Buscar movimentações"), "saída");
    expect(within(table).getByText("Fornecedor padaria")).toBeInTheDocument();
    expect(within(table).queryByText("Venda balcão")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Buscar movimentações"));
    await user.type(screen.getByLabelText("Buscar movimentações"), "10,00");
    expect(within(table).getByText("Venda balcão")).toBeInTheDocument();
    expect(within(table).queryByText("Fornecedor padaria")).not.toBeInTheDocument();
  });

  test("paginates day transactions with ten rows per page", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.includes("/transactions?")) {
        return jsonResponse(
          200,
          Array.from({ length: 12 }, (_, index) =>
            transactionItem({
              id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              amount: `${index + 1}.00`,
              description: `Movimentação ${String(index + 1).padStart(2, "0")}`,
              occurred_at: `2026-05-20T${String(8 + index).padStart(2, "0")}:00:00`,
              created_at: `2026-05-20T${String(8 + index).padStart(2, "0")}:01:00`,
            }),
          ),
        );
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    const table = await screen.findByRole("table", { name: "Movimentações financeiras" });

    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(within(table).getByText("Movimentação 01")).toBeInTheDocument();
    expect(within(table).getByText("Movimentação 10")).toBeInTheDocument();
    expect(within(table).queryByText("Movimentação 11")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(within(table).getByText("Movimentação 11")).toBeInTheDocument();
    expect(within(table).getByText("Movimentação 12")).toBeInTheDocument();
    expect(within(table).queryByText("Movimentação 01")).not.toBeInTheDocument();
  });

  test("shows a clear API key error when the API returns 401", async () => {
    mockFetch((input, init) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.endsWith("/transactions") && init?.method === "POST") {
        return jsonResponse(401, { detail: "Invalid or missing API key" });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);
    await user.type(screen.getByLabelText("Valor"), "100.00");
    await user.clear(screen.getByLabelText("Quando aconteceu"));
    await user.type(screen.getByLabelText("Quando aconteceu"), "2026-05-20T10:00");
    await user.click(screen.getByRole("button", { name: "Salvar movimentação" }));

    await waitFor(() => {
      expect(screen.getByText("Não foi possível acessar o sistema. Acione o suporte.")).toBeInTheDocument();
    });
  });
});
