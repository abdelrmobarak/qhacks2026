from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional
from uuid import UUID as UUIDType, uuid4

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# --------------------------------------------------------------------------
# Enums
# --------------------------------------------------------------------------


class SnapshotStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"


class SnapshotStage(str, enum.Enum):
    init = "init"
    gmail_list = "gmail_list"
    gmail_fetch = "gmail_fetch"
    calendar_fetch = "calendar_fetch"
    wrapped_compute = "wrapped_compute"
    entities_compute = "entities_compute"
    story_generate = "story_generate"
    dossier_precompute = "dossier_precompute"
    finalize = "finalize"


class SourceType(str, enum.Enum):
    gmail_message = "gmail_message"
    calendar_event = "calendar_event"


class EntityKind(str, enum.Enum):
    person = "person"
    org = "org"


class ArtifactType(str, enum.Enum):
    wrapped_cards = "wrapped_cards"
    top_entities = "top_entities"
    graph = "graph"
    thread_summary = "thread_summary"
    meeting_summary = "meeting_summary"
    entity_dossier = "entity_dossier"
    global_themes = "global_themes"
    story_text = "story_text"
    story_verification = "story_verification"


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Persistent OAuth tokens (encrypted) for ongoing API access
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    sessions: Mapped[list["Session"]] = relationship(
        "Session", back_populates="user", cascade="all, delete-orphan"
    )
    snapshots: Mapped[list["Snapshot"]] = relationship(
        "Snapshot", back_populates="user", cascade="all, delete-orphan"
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sessions")


class Snapshot(Base):
    __tablename__ = "snapshots"

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    window_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[SnapshotStatus] = mapped_column(
        Enum(SnapshotStatus), default=SnapshotStatus.queued, nullable=False
    )
    stage: Mapped[Optional[SnapshotStage]] = mapped_column(Enum(SnapshotStage), nullable=True)
    progress_counts: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True, default=dict)
    failure_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    ingest_job_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # OAuth tokens (encrypted, deleted after ingest)
    access_token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="snapshots")
    evidence_items: Mapped[list["EvidenceItem"]] = relationship(
        "EvidenceItem", back_populates="snapshot", cascade="all, delete-orphan"
    )
    entities: Mapped[list["Entity"]] = relationship(
        "Entity", back_populates="snapshot", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list["Artifact"]] = relationship(
        "Artifact", back_populates="snapshot", cascade="all, delete-orphan"
    )
    entitlement: Mapped[Optional["Entitlement"]] = relationship(
        "Entitlement", back_populates="snapshot", uselist=False, cascade="all, delete-orphan"
    )


class EvidenceItem(Base):
    __tablename__ = "evidence_items"
    __table_args__ = (
        Index("ix_evidence_items_snapshot_source", "snapshot_id", "source_type"),
        UniqueConstraint("snapshot_id", "source_type", "source_id", name="uq_evidence_source"),
    )

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    snapshot_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType), nullable=False)
    source_id: Mapped[str] = mapped_column(String(255), nullable=False)
    thread_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    participants: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    snippet: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body_preview: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    raw_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)

    # Filtering flags for noise detection
    is_bulk: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_automated_sender: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_list_unsubscribe: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_list_id: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recipient_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # For calendar events
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_resource: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    snapshot: Mapped["Snapshot"] = relationship("Snapshot", back_populates="evidence_items")
    entity_links: Mapped[list["EntityEvidence"]] = relationship(
        "EntityEvidence", back_populates="evidence", cascade="all, delete-orphan"
    )


class Entity(Base):
    __tablename__ = "entities"
    __table_args__ = (Index("ix_entities_snapshot_score", "snapshot_id", "score"),)

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    snapshot_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind: Mapped[EntityKind] = mapped_column(Enum(EntityKind), nullable=False)
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    primary_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Stats for filtering
    interaction_days: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    meeting_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    email_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_meeting_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    snapshot: Mapped["Snapshot"] = relationship("Snapshot", back_populates="entities")
    evidence_links: Mapped[list["EntityEvidence"]] = relationship(
        "EntityEvidence", back_populates="entity", cascade="all, delete-orphan"
    )


class EntityEvidence(Base):
    __tablename__ = "entity_evidence"
    __table_args__ = (
        UniqueConstraint("entity_id", "evidence_id", name="uq_entity_evidence"),
        Index("ix_entity_evidence_entity", "entity_id"),
        Index("ix_entity_evidence_evidence", "evidence_id"),
    )

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    snapshot_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False
    )
    evidence_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("evidence_items.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # e.g., "from", "to", "cc", "organizer", "attendee"

    # Relationships
    entity: Mapped["Entity"] = relationship("Entity", back_populates="evidence_links")
    evidence: Mapped["EvidenceItem"] = relationship("EvidenceItem", back_populates="entity_links")


class Artifact(Base):
    __tablename__ = "artifacts"
    __table_args__ = (
        UniqueConstraint("snapshot_id", "type", "key", name="uq_artifact_key"),
        Index("ix_artifacts_snapshot_type", "snapshot_id", "type"),
    )

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    snapshot_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[ArtifactType] = mapped_column(Enum(ArtifactType), nullable=False)
    key: Mapped[str] = mapped_column(String(255), nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    model_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    snapshot: Mapped["Snapshot"] = relationship("Snapshot", back_populates="artifacts")


class Entitlement(Base):
    __tablename__ = "entitlements"

    id: Mapped[UUIDType] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    snapshot_id: Mapped[UUIDType] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("snapshots.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    unlocked_story_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stripe_checkout_session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stripe_event_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, unique=True
    )  # For idempotency
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    snapshot: Mapped["Snapshot"] = relationship("Snapshot", back_populates="entitlement")
