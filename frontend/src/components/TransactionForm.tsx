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
          <h2 id="transaction-form-title">Novo lançamento</h2>
          <p>Registre créditos e débitos do comerciante selecionado.</p>
        </div>
      </div>

      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="field">
          <span>Tipo</span>
          <select value={type} onChange={(event) => onTypeChange(event.target.value as TransactionType)}>
            <option value="CREDIT">Crédito</option>
            <option value="DEBIT">Débito</option>
          </select>
        </label>

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
          <span>Data/hora do lançamento</span>
          <input type="datetime-local" value={occurredAt} onChange={(event) => onOccurredAtChange(event.target.value)} />
        </label>

        <label className="field field--wide">
          <span>Descrição</span>
          <input
            maxLength={255}
            type="text"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Venda no cartão"
          />
        </label>

        <div className="form-actions">
          <button className="button button--primary" disabled={disabled || submitting} type="submit">
            {submitting ? "Registrando..." : "Registrar lançamento"}
          </button>
        </div>
      </form>
    </section>
  );
}
