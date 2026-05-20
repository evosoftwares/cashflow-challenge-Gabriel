from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, JSON, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from src.database.connection import Base


class OutboxEvent(Base):
    __tablename__ = "outbox_events"
    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'PUBLISHED', 'FAILED')",
            name="ck_outbox_events_status",
        ),
        Index("ix_outbox_events_status_created_at", "status", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict[str, str]] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING",
        server_default=text("'PENDING'"),
    )
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default=text("0"))
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, server_default=func.now())
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

