"""Add email_embeddings table with pgvector

Revision ID: 005_add_email_embeddings
Revises: 004_add_todo_message_id
Create Date: 2026-02-07

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = "005_add_email_embeddings"
down_revision: Union[str, None] = "004_add_todo_message_id"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "email_embeddings",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("gmail_message_id", sa.String(255), nullable=False),
        sa.Column("thread_id", sa.String(255), nullable=True),
        sa.Column("subject", sa.Text, nullable=True),
        sa.Column("from_email", sa.String(255), nullable=True),
        sa.Column("from_name", sa.String(255), nullable=True),
        sa.Column("snippet", sa.Text, nullable=True),
        sa.Column("body_preview", sa.Text, nullable=True),
        sa.Column("email_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("embedding_text", sa.Text, nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index("ix_email_embeddings_user_id", "email_embeddings", ["user_id"])
    op.create_unique_constraint(
        "uq_email_embeddings_user_message",
        "email_embeddings",
        ["user_id", "gmail_message_id"],
    )

    op.execute(
        "CREATE INDEX ix_email_embeddings_embedding ON email_embeddings "
        "USING hnsw (embedding vector_cosine_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_email_embeddings_embedding")
    op.drop_constraint("uq_email_embeddings_user_message", "email_embeddings")
    op.drop_index("ix_email_embeddings_user_id", table_name="email_embeddings")
    op.drop_table("email_embeddings")
