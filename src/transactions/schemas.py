from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

TransactionType = Literal["CREDIT", "DEBIT"]


class TransactionCreate(BaseModel):
    merchant_id: UUID
    type: TransactionType
    amount: Decimal = Field(gt=Decimal("0"))
    description: str | None = Field(default=None, max_length=255)
    occurred_at: datetime


class TransactionResponse(BaseModel):
    id: UUID
    merchant_id: UUID
    type: TransactionType
    amount: Decimal
    status: str


class TransactionListItem(BaseModel):
    id: UUID
    merchant_id: UUID
    type: TransactionType
    amount: Decimal
    description: str | None
    occurred_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
