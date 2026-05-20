"""add transaction client request id

Revision ID: 202605200002
Revises: 202605200001
Create Date: 2026-05-20
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "202605200002"
down_revision: str | None = "202605200001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("client_request_id", sa.Uuid(), nullable=True))
    op.create_index(
        "uq_transactions_client_request_id",
        "transactions",
        ["client_request_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("uq_transactions_client_request_id", table_name="transactions")
    op.drop_column("transactions", "client_request_id")
