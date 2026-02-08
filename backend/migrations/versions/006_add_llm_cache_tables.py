"""Add email_category_cache and subscription_cache tables

Revision ID: 006_add_llm_cache_tables
Revises: 005_add_email_embeddings
Create Date: 2026-02-07

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "006_add_llm_cache_tables"
down_revision: Union[str, None] = "005_add_email_embeddings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "email_category_cache",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("gmail_message_id", sa.String(255), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("priority", sa.Integer, nullable=False, server_default="5"),
        sa.Column("category_reason", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_index("ix_email_category_cache_user_id", "email_category_cache", ["user_id"])
    op.create_unique_constraint(
        "uq_email_category_cache_user_message",
        "email_category_cache",
        ["user_id", "gmail_message_id"],
    )

    op.create_table(
        "subscription_cache",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("result_json", sa.Text, nullable=False),
        sa.Column(
            "cached_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("subscription_cache")
    op.drop_constraint("uq_email_category_cache_user_message", "email_category_cache")
    op.drop_index("ix_email_category_cache_user_id", table_name="email_category_cache")
    op.drop_table("email_category_cache")
