import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => MockResponse) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input, init)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillOperationContext(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText("Comerciante"));
  await user.type(screen.getByLabelText("Comerciante"), "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11");
  await user.clear(screen.getByLabelText("Data"));
  await user.type(screen.getByLabelText("Data"), "2026-05-20");
}

describe("Cash Flow operational portal", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("renders the branded operational shell and keeps technical access hidden", async () => {
    mockFetch(() => healthResponse());

    render(<App />);

    expect(screen.getByRole("heading", { name: "Carrefour Fluxo de Caixa" })).toBeInTheDocument();
    expect(await screen.findByText("Sistema conectado")).toBeInTheDocument();
    expect(screen.queryByText("Chave de acesso")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar movimentação" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atualizar movimentações" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atualizar resumo do dia" })).toBeDisabled();
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
          merchant_id: "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
          type: "CREDIT",
          amount: "100.00",
          description: "Venda no cartao",
          occurred_at: "2026-05-20T10:00",
        });
        return jsonResponse(201, {
          id: "4dc7300e-8df7-4634-b6a0-8bda7afc4218",
          merchant_id: "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
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

  test("shows the pending consolidation state when the balance endpoint returns 404", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.includes("/daily-balances/")) return jsonResponse(404, { detail: "Daily balance not found" });
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);
    await user.click(screen.getByRole("button", { name: "Atualizar resumo do dia" }));

    expect(await screen.findByText("Aguardando atualização")).toBeInTheDocument();
  });

  test("renders a daily balance when consolidation is available", async () => {
    mockFetch((input) => {
      const url = String(input);
      if (url.endsWith("/health")) return healthResponse();
      if (url.includes("/daily-balances/")) {
        return jsonResponse(200, {
          merchant_id: "8dbfb836-7e2c-44b8-9a3b-f5c8c2c8dd11",
          date: "2026-05-20",
          total_credit: "300.00",
          total_debit: "80.00",
          balance: "220.00",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();

    render(<App />);
    await fillOperationContext(user);
    await user.click(screen.getByRole("button", { name: "Atualizar resumo do dia" }));

    expect(await screen.findByText("Saldo atualizado")).toBeInTheDocument();
    expect(screen.getByText("R$ 300,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 80,00")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 220,00").length).toBeGreaterThanOrEqual(1);
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
    await fillOperationContext(user);
    await user.click(screen.getByRole("button", { name: "Atualizar movimentações" }));

    const table = await screen.findByRole("table", { name: "Movimentações financeiras" });
    expect(within(table).getByText("Venda no cartao")).toBeInTheDocument();
    expect(within(table).getByText("Entrada")).toBeInTheDocument();
    expect(within(table).getByText("R$ 100,00")).toBeInTheDocument();
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
