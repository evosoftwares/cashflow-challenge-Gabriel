CREATE TABLE transactions (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    description VARCHAR(255),
    occurred_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE daily_balances (
    id UUID PRIMARY KEY,
    merchant_id UUID NOT NULL,
    balance_date DATE NOT NULL,
    total_credit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_debit NUMERIC(14, 2) NOT NULL DEFAULT 0,
    balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (merchant_id, balance_date)
);

CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
