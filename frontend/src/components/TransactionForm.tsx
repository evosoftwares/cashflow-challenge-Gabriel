import { ArrowDownRight, ArrowUpRight, PlusCircle } from "lucide-react";

import type { TransactionType } from "../api/client";

type TransactionFormProps = {
  type: TransactionType;
  amount: string;
  description: string;
  occurredAt: string;
  disabled: boolean;
  submitting: boolean;
  onTypeChange: (value: TransactionType) => void;
  onAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onOccurredAtChange: (value: string) => void;
  onSubmit: () => void;
};

export function TransactionForm({
  type,
  amount,
  description,
  occurredAt,
  disabled,
  submitting,
  onTypeChange,
  onAmountChange,
  onDescriptionChange,
  onOccurredAtChange,
  onSubmit,
}: TransactionFormProps) {
  return (
    <section className="panel transaction-form" aria-labelledby="transaction-form-title">
      <div className="panel-header">
        <div>
          <h2 id="transaction-form-title">Nova movimentação</h2>
          <p>Informe uma entrada ou saída do comerciante.</p>
        </div>
      </div>

      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <fieldset className="transaction-type-group">
          <legend>Tipo</legend>
          <div className="segmented-control" role="group" aria-label="Tipo">
            <button
              aria-pressed={type === "CREDIT"}
              className={type === "CREDIT" ? "segmented-control__option is-active" : "segmented-control__option"}
              onClick={() => onTypeChange("CREDIT")}
              type="button"
            >
              <ArrowUpRight size={16} strokeWidth={2.3} aria-hidden="true" />
              Entrada
            </button>
            <button
              aria-pressed={type === "DEBIT"}
              className={type === "DEBIT" ? "segmented-control__option is-active" : "segmented-control__option"}
              onClick={() => onTypeChange("DEBIT")}
              type="button"
            >
              <ArrowDownRight size={16} strokeWidth={2.3} aria-hidden="true" />
              Saída
            </button>
          </div>
        </fieldset>

        <label className="field">
          <span>Valor</span>
          <input
            inputMode="decimal"
            min="0.01"
            step="0.01"
            type="number"
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            placeholder="100.00"
          />
        </label>

        <label className="field">
          <span>Quando aconteceu</span>
          <input
            aria-label="Quando aconteceu"
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => onOccurredAtChange(event.target.value)}
          />
        </label>

        <label className="field field--wide">
          <span>Descrição simples</span>
          <input
            aria-label="Descrição simples"
            maxLength={255}
            type="text"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Venda no cartão"
          />
        </label>

        <div className="form-actions">
          <button className="button button--primary" disabled={disabled || submitting} type="submit">
            <PlusCircle size={17} strokeWidth={2.4} aria-hidden="true" />
            {submitting ? "Salvando..." : "Salvar movimentação"}
          </button>
        </div>
      </form>
    </section>
  );
}
