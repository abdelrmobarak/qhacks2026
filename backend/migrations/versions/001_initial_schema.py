"""Initial schema

Revision ID: 001_initial_schema
Revises:
Create Date: 2025-01-12

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enums
    snapshot_status = postgresql.ENUM(
        "queued", "running", "done", "failed", name="snapshotstatus", create_type=False
    )
    snapshot_status.create(op.get_bind(), checkfirst=True)

    snapshot_stage = postgresql.ENUM(
        "init",
        "gmail_list",
        "gmail_fetch",
        "calendar_fetch",
        "wrapped_compute",
        "entities_compute",
        "story_generate",
        "dossier_precompute",
        "finalize",
        name="snapshotstage",
        create_type=False,
    )
    snapshot_stage.create(op.get_bind(), checkfirst=True)

    source_type = postgresql.ENUM(
        "gmail_message", "calendar_event", name="sourcetype", create_type=False
    )
    source_type.create(op.get_bind(), checkfirst=True)

    entity_kind = postgresql.ENUM("person", "org", name="entitykind", create_type=False)
    entity_kind.create(op.get_bind(), checkfirst=True)

    artifact_type = postgresql.ENUM(
        "wrapped_cards",
        "top_entities",
        "graph",
        "thread_summary",
        "meeting_summary",
        "entity_dossier",
        "global_themes",
        "story_text",
        "story_verification",
        name="artifacttype",
        create_type=False,
    )
    artifact_type.create(op.get_bind(), checkfirst=True)

    # Create users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create sessions table
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Create snapshots table
    op.create_table(
        "snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("window_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status",
            snapshot_status,
            default="queued",
            nullable=False,
        ),
        sa.Column("stage", snapshot_stage, nullable=True),
        sa.Column("progress_counts", postgresql.JSONB, nullable=True),
        sa.Column("failure_reason", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("ingest_job_id", sa.String(255), nullable=True),
        sa.Column("access_token_encrypted", sa.Text, nullable=True),
        sa.Column("refresh_token_encrypted", sa.Text, nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
    )

    # Create evidence_items table
    op.create_table(
        "evidence_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "snapshot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("source_type", source_type, nullable=False),
        sa.Column("source_id", sa.String(255), nullable=False),
        sa.Column("thread_id", sa.String(255), nullable=True, index=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(1000), nullable=True),
        sa.Column("participants", postgresql.JSONB, nullable=True),
        sa.Column("snippet", sa.Text, nullable=True),
        sa.Column("body_preview", sa.Text, nullable=True),
        sa.Column("url", sa.String(2000), nullable=True),
        sa.Column("raw_json", postgresql.JSONB, nullable=True),
        sa.Column("is_bulk", sa.Boolean, default=False, nullable=False),
        sa.Column("is_automated_sender", sa.Boolean, default=False, nullable=False),
        sa.Column("has_list_unsubscribe", sa.Boolean, default=False, nullable=False),
        sa.Column("has_list_id", sa.Boolean, default=False, nullable=False),
        sa.Column("recipient_count", sa.Integer, default=1, nullable=False),
        sa.Column("duration_minutes", sa.Integer, nullable=True),
        sa.Column("is_resource", sa.Boolean, default=False, nullable=False),
        sa.UniqueConstraint(
            "snapshot_id", "source_type", "source_id", name="uq_evidence_source"
        ),
    )
    op.create_index(
        "ix_evidence_items_snapshot_source",
        "evidence_items",
        ["snapshot_id", "source_type"],
    )

    # Create entities table
    op.create_table(
        "entities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "snapshot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("kind", entity_kind, nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("primary_email", sa.String(255), nullable=True, index=True),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("score", sa.Float, default=0.0, nullable=False),
        sa.Column("interaction_days", sa.Integer, default=0, nullable=False),
        sa.Column("meeting_count", sa.Integer, default=0, nullable=False),
        sa.Column("email_count", sa.Integer, default=0, nullable=False),
        sa.Column("total_meeting_minutes", sa.Integer, default=0, nullable=False),
    )
    op.create_index("ix_entities_snapshot_score", "entities", ["snapshot_id", "score"])

    # Create entity_evidence table
    op.create_table(
        "entity_evidence",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "snapshot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "entity_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("entities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "evidence_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("evidence_items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(50), nullable=True),
        sa.UniqueConstraint("entity_id", "evidence_id", name="uq_entity_evidence"),
    )
    op.create_index("ix_entity_evidence_entity", "entity_evidence", ["entity_id"])
    op.create_index("ix_entity_evidence_evidence", "entity_evidence", ["evidence_id"])

    # Create artifacts table
    op.create_table(
        "artifacts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "snapshot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("type", artifact_type, nullable=False),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("data", postgresql.JSONB, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("model_name", sa.String(100), nullable=True),
        sa.Column("prompt_version", sa.String(50), nullable=True),
        sa.UniqueConstraint("snapshot_id", "type", "key", name="uq_artifact_key"),
    )
    op.create_index("ix_artifacts_snapshot_type", "artifacts", ["snapshot_id", "type"])

    # Create entitlements table
    op.create_table(
        "entitlements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "snapshot_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("snapshots.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("unlocked_story_count", sa.Integer, default=1, nullable=False),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("stripe_checkout_session_id", sa.String(255), nullable=True),
        sa.Column("stripe_event_id", sa.String(255), nullable=True, unique=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("entitlements")
    op.drop_table("artifacts")
    op.drop_table("entity_evidence")
    op.drop_table("entities")
    op.drop_table("evidence_items")
    op.drop_table("snapshots")
    op.drop_table("sessions")
    op.drop_table("users")

    # Drop enums
    op.execute("DROP TYPE IF EXISTS artifacttype")
    op.execute("DROP TYPE IF EXISTS entitykind")
    op.execute("DROP TYPE IF EXISTS sourcetype")
    op.execute("DROP TYPE IF EXISTS snapshotstage")
    op.execute("DROP TYPE IF EXISTS snapshotstatus")
