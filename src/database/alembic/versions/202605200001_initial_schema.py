"""initial schema

Revision ID: 202605200001
Revises:
Create Date: 2026-05-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "202605200001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'transactions',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('merchant_id', sa.Uuid(), nullable=False),
        sa.Column('type', sa.String(length=10), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('occurred_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("type IN ('CREDIT', 'DEBIT')", name='ck_transactions_type'),
        sa.CheckConstraint('amount > 0', name='ck_transactions_amount_positive'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_transactions_merchant_id', 'transactions', ['merchant_id'])
    op.create_index('ix_transactions_merchant_occurred_at', 'transactions', ['merchant_id', 'occurred_at'])

    op.create_table(
        'daily_balances',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('merchant_id', sa.Uuid(), nullable=False),
        sa.Column('balance_date', sa.Date(), nullable=False),
        sa.Column('total_credit', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('total_debit', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('balance', sa.Numeric(14, 2), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('merchant_id', 'balance_date', name='uq_daily_balances_merchant_date'),
    )
    op.create_index('ix_daily_balances_merchant_date', 'daily_balances', ['merchant_id', 'balance_date'])

    op.create_table(
        'processed_events',
        sa.Column('event_id', sa.Uuid(), nullable=False),
        sa.Column('transaction_id', sa.Uuid(), nullable=False),
        sa.Column('processed_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('event_id'),
    )


def downgrade() -> None:
    op.drop_table('processed_events')
    op.drop_index('ix_daily_balances_merchant_date', table_name='daily_balances')
    op.drop_table('daily_balances')
    op.drop_index('ix_transactions_merchant_occurred_at', table_name='transactions')
    op.drop_index('ix_transactions_merchant_id', table_name='transactions')
    op.drop_table('transactions')
