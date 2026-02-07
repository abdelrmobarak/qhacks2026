"""Add persistent OAuth token columns to users table

Revision ID: 002_user_persistent_tokens
Revises: 001_initial_schema
Create Date: 2026-02-07

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "002_user_persistent_tokens"
down_revision: Union[str, None] = "001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("refresh_token_encrypted", sa.Text, nullable=True))
    op.add_column("users", sa.Column("access_token_encrypted", sa.Text, nullable=True))
    op.add_column("users", sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "token_expiry")
    op.drop_column("users", "access_token_encrypted")
    op.drop_column("users", "refresh_token_encrypted")
