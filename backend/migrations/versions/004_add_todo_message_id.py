"""Add message_id column to todos table for deduplication

Revision ID: 004_add_todo_message_id
Revises: 003_add_todos_table
Create Date: 2026-02-07

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004_add_todo_message_id"
down_revision: Union[str, None] = "003_add_todos_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("todos", sa.Column("message_id", sa.String(255), nullable=True))
    op.create_index("ix_todos_message_id", "todos", ["message_id"])


def downgrade() -> None:
    op.drop_index("ix_todos_message_id", table_name="todos")
    op.drop_column("todos", "message_id")
