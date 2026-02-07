from __future__ import annotations

import asyncio
import logging
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from itertools import islice
from typing import Awaitable, Optional, TypeVar
from uuid import UUID

# Configure logging for worker process
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stdout,
)

from sqlalchemy import func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.env import load_settings
from app.core.security import decrypt_token
from app.db.models import (
    Artifact,
    ArtifactType,
    Entity,
    EntityEvidence,
    EntityKind,
    EvidenceItem,
    Snapshot,
    SnapshotStage,
    SnapshotStatus,
    SourceType,
    User,
)
from app.services.gmail import (
    GmailMessage,
    fetch_message,
    is_automated_sender,
    list_messages,
    estimate_message_count,
)
from app.services.calendar import CalendarEvent, list_events
from app.services.google_oauth import revoke_token
from app.services.agents import (
    summarize_threads_batch,
    summarize_meetings_batch,
    create_dossier,
    extract_global_themes,
    generate_story as agent_generate_story,
    verify_story as agent_verify_story,
    fix_claims as agent_fix_claims,
)
from app.services.agents.base import MAX_EVIDENCE_IDS_PER_STORY
from app.services.gmail import fetch_messages
from app.queue import get_queue

settings = load_settings()
logger = logging.getLogger(__name__)

T = TypeVar("T")

_PERSONAL_EMAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "pm.me",
    "fastmail.com",
    "hey.com",
}


def _extract_base_domain(domain: str) -> str:
    parts = [p for p in domain.lower().split(".") if p]
    if len(parts) < 2:
        return domain.lower()

    # Heuristic for common 2-part public suffixes (co.uk, com.au, etc.)
    if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in {
        "co",
        "com",
        "org",
        "net",
        "gov",
        "ac",
        "edu",
    }:
        return parts[-3]

    return parts[-2]


def _domain_to_org_name(domain: str) -> str:
    base = _extract_base_domain(domain)
    cleaned = base.replace("-", " ").replace("_", " ").strip()
    if not cleaned:
        return domain
    words = [w for w in cleaned.split() if w]
    return " ".join(w[:1].upper() + w[1:] for w in words)


def _should_skip_org_domain(domain: str, user_domain: str | None) -> bool:
    d = domain.lower().strip()
    if not d:
        return True
    if user_domain and d == user_domain.lower().strip():
        return True
    if d in _PERSONAL_EMAIL_DOMAINS:
        return True
    if d.endswith(".gserviceaccount.com"):
        return True
    return False


@dataclass(frozen=True)
class IngestResult:
    snapshot_id: str
    status: str
    error: Optional[str] = None


def get_sync_session() -> async_sessionmaker:
    """Create a new async engine and session maker for the worker process."""
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def update_snapshot_status(
    session: AsyncSession,
    snapshot_id: UUID,
    status: Optional[SnapshotStatus] = None,
    stage: Optional[SnapshotStage] = None,
    progress_counts: Optional[dict] = None,
    failure_reason: Optional[str] = None,
) -> None:
    """Update snapshot status and progress."""
    result = await session.execute(select(Snapshot).where(Snapshot.id == snapshot_id))
    snapshot = result.scalar_one_or_none()
    if snapshot is None:
        logger.warning("Snapshot %s not found while updating status", snapshot_id)
        return

    if status:
        snapshot.status = status
    if stage:
        snapshot.stage = stage
    if progress_counts:
        snapshot.progress_counts = {**(snapshot.progress_counts or {}), **progress_counts}
    if failure_reason:
        snapshot.failure_reason = failure_reason

    await session.commit()


async def store_gmail_evidence(
    session: AsyncSession,
    snapshot_id: UUID,
    messages: list[GmailMessage],
) -> dict[str, UUID]:
    """Store Gmail messages as evidence items."""
    if not messages:
        return {}

    evidence_rows: list[dict] = []
    for msg in messages:
        participants: list[dict] = []
        if msg.from_email:
            participants.append(
                {
                    "email": msg.from_email,
                    "name": msg.from_name or "",
                    "role": "from",
                }
            )
        for to in msg.to_emails:
            participants.append({**to, "role": "to"})
        for cc in msg.cc_emails:
            participants.append({**cc, "role": "cc"})

        evidence_rows.append(
            {
                "snapshot_id": snapshot_id,
                "source_type": SourceType.gmail_message,
                "source_id": msg.id,
                "thread_id": msg.thread_id,
                "occurred_at": msg.internal_date,
                "title": msg.subject,
                "participants": participants,
                "snippet": msg.snippet,
                "body_preview": msg.body_preview,
                "is_bulk": (
                    msg.has_list_unsubscribe
                    or msg.has_list_id
                    or msg.recipient_count > 10
                ),
                "is_automated_sender": msg.is_automated_sender,
                "has_list_unsubscribe": msg.has_list_unsubscribe,
                "has_list_id": msg.has_list_id,
                "recipient_count": msg.recipient_count,
            }
        )

    chunk_size = 1000
    for offset in range(0, len(evidence_rows), chunk_size):
        chunk = evidence_rows[offset : offset + chunk_size]
        await session.execute(insert(EvidenceItem), chunk)

    await session.commit()
    return {}


async def store_calendar_evidence(
    session: AsyncSession,
    snapshot_id: UUID,
    events: list[CalendarEvent],
) -> dict[str, UUID]:
    """Store calendar events as evidence items."""
    if not events:
        return {}

    evidence_rows: list[dict] = []
    for event in events:
        participants: list[dict] = []
        if event.organizer_email:
            participants.append(
                {
                    "email": event.organizer_email,
                    "name": event.organizer_name or "",
                    "role": "organizer",
                }
            )
        for att in event.attendees:
            if not att.is_resource:
                participants.append(
                    {
                        "email": att.email,
                        "name": att.name or "",
                        "role": "attendee",
                        "response_status": att.response_status,
                    }
                )

        evidence_rows.append(
            {
                "snapshot_id": snapshot_id,
                "source_type": SourceType.calendar_event,
                "source_id": event.id,
                "occurred_at": event.start,
                "title": event.summary,
                "participants": participants,
                "snippet": event.location or "",
                "body_preview": event.description or "",
                "url": event.html_link,
                "duration_minutes": event.duration_minutes,
                "is_resource": any(att.is_resource for att in event.attendees),
            }
        )

    chunk_size = 1000
    for offset in range(0, len(evidence_rows), chunk_size):
        chunk = evidence_rows[offset : offset + chunk_size]
        await session.execute(insert(EvidenceItem), chunk)

    await session.commit()
    return {}


async def extract_entities(
    session: AsyncSession,
    snapshot_id: UUID,
    user_email: str,
) -> list[Entity]:
    """Extract and score entities from evidence items."""
    # Get all non-bulk evidence items
    result = await session.execute(
        select(
            EvidenceItem.id,
            EvidenceItem.participants,
            EvidenceItem.occurred_at,
            EvidenceItem.source_type,
            EvidenceItem.duration_minutes,
        )
        .where(EvidenceItem.snapshot_id == snapshot_id)
        .where(EvidenceItem.is_bulk == False)
    )
    evidence_rows = result.all()

    # Build entity stats
    entity_stats: dict[str, dict] = {}  # email -> stats

    for evidence_id, participants, occurred_at, source_type, duration_minutes in evidence_rows:
        participant_list = participants if isinstance(participants, list) else []
        evidence_date = occurred_at.date()

        for p in participant_list:
            if not isinstance(p, dict):
                continue
            email = p.get("email", "").lower()
            if not email or email == user_email.lower():
                continue

            # Skip automated senders
            if is_automated_sender(email):
                continue

            if email not in entity_stats:
                entity_stats[email] = {
                    "email": email,
                    "name": p.get("name", ""),
                    "interaction_dates": set(),
                    "meeting_count": 0,
                    "email_count": 0,
                    "total_meeting_minutes": 0,
                    "evidence_ids": set(),
                }

            stats = entity_stats[email]
            stats["interaction_dates"].add(evidence_date)
            stats["evidence_ids"].add(evidence_id)

            # Update name if we have a better one
            if p.get("name") and not stats["name"]:
                stats["name"] = p["name"]

            if source_type == SourceType.gmail_message:
                stats["email_count"] += 1
            elif source_type == SourceType.calendar_event:
                stats["meeting_count"] += 1
                stats["total_meeting_minutes"] += duration_minutes or 0

    # Filter by minimum interaction threshold
    eligible_entities = []
    for email, stats in entity_stats.items():
        interaction_days = len(stats["interaction_dates"])
        meeting_count = stats["meeting_count"]
        email_count = stats["email_count"]

        # Must have at least one of:
        # - interactions on 2+ separate days, OR
        # - 2+ meetings, OR
        # - 5+ emails
        if interaction_days >= 2 or meeting_count >= 2 or email_count >= 5:
            eligible_entities.append(stats)

    # Create entities with scoring
    entities = []
    for stats in eligible_entities:
        # Heuristic score (can be refined)
        score = (
            stats["total_meeting_minutes"] * 2  # Meeting time is valuable
            + stats["meeting_count"] * 30  # Each meeting counts
            + stats["email_count"] * 5  # Emails count less
            + len(stats["interaction_dates"]) * 10  # Spread of interaction
        )

        # Extract domain
        domain = None
        if "@" in stats["email"]:
            domain = stats["email"].split("@")[1]

        entity = Entity(
            snapshot_id=snapshot_id,
            kind=EntityKind.person,  # Default to person; org detection can be added
            name=stats["name"] or stats["email"].split("@")[0],
            primary_email=stats["email"],
            domain=domain,
            score=score,
            interaction_days=len(stats["interaction_dates"]),
            meeting_count=stats["meeting_count"],
            email_count=stats["email_count"],
            total_meeting_minutes=stats["total_meeting_minutes"],
        )
        session.add(entity)
        await session.flush()

        # Create entity-evidence links
        for evidence_id in stats["evidence_ids"]:
            link = EntityEvidence(
                snapshot_id=snapshot_id,
                entity_id=entity.id,
                evidence_id=evidence_id,
            )
            session.add(link)

        entities.append(entity)

    await session.commit()

    # Sort by score and return
    return sorted(entities, key=lambda e: e.score, reverse=True)


async def extract_top_organizations(
    session: AsyncSession,
    snapshot_id: UUID,
    user_email: str,
    *,
    limit: int = 5,
) -> list[tuple[Entity, int]]:
    """Extract and score organization entities by email domain.

    Returns:
        List of (org_entity, contact_count), sorted by score desc.
    """
    result = await session.execute(
        select(Entity)
        .where(Entity.snapshot_id == snapshot_id)
        .where(Entity.kind == EntityKind.org)
        .order_by(Entity.score.desc())
        .limit(limit)
    )
    existing = result.scalars().all()
    if existing:
        # Contact counts aren't stored; return 0 for pre-existing records.
        return [(entity, 0) for entity in existing]

    user_domain = user_email.split("@", 1)[1].lower() if "@" in user_email else None

    result = await session.execute(
        select(
            EvidenceItem.id,
            EvidenceItem.participants,
            EvidenceItem.occurred_at,
            EvidenceItem.source_type,
            EvidenceItem.duration_minutes,
        )
        .where(EvidenceItem.snapshot_id == snapshot_id)
        .where(EvidenceItem.is_bulk == False)
    )
    evidence_rows = result.all()

    org_stats: dict[str, dict] = {}

    for evidence_id, participants, occurred_at, source_type, duration_minutes in evidence_rows:
        participant_list = participants if isinstance(participants, list) else []
        evidence_date = occurred_at.date()

        emails_by_domain: dict[str, set[str]] = {}
        domains_in_evidence: set[str] = set()

        for p in participant_list:
            if not isinstance(p, dict):
                continue
            email = str(p.get("email", "") or "").lower()
            if not email or email == user_email.lower():
                continue
            if is_automated_sender(email):
                continue
            if "@" not in email:
                continue
            domain = email.split("@", 1)[1].lower()
            if _should_skip_org_domain(domain, user_domain):
                continue

            domains_in_evidence.add(domain)
            emails_by_domain.setdefault(domain, set()).add(email)

        for domain in domains_in_evidence:
            stats = org_stats.setdefault(
                domain,
                {
                    "domain": domain,
                    "interaction_dates": set(),
                    "meeting_count": 0,
                    "email_count": 0,
                    "total_meeting_minutes": 0,
                    "evidence_ids": set(),
                    "contact_emails": set(),
                },
            )

            stats["interaction_dates"].add(evidence_date)
            stats["evidence_ids"].add(evidence_id)
            stats["contact_emails"].update(emails_by_domain.get(domain, set()))

            if source_type == SourceType.gmail_message:
                stats["email_count"] += 1
            elif source_type == SourceType.calendar_event:
                stats["meeting_count"] += 1
                stats["total_meeting_minutes"] += duration_minutes or 0

    if not org_stats:
        return []

    eligible: list[dict] = []
    for stats in org_stats.values():
        interaction_days = len(stats["interaction_dates"])
        meeting_count = stats["meeting_count"]
        email_count = stats["email_count"]

        if interaction_days >= 2 or meeting_count >= 2 or email_count >= 5:
            eligible.append(stats)

    if not eligible:
        return []

    def score(stats: dict) -> float:
        return (
            stats["total_meeting_minutes"] * 2
            + stats["meeting_count"] * 30
            + stats["email_count"] * 5
            + len(stats["interaction_dates"]) * 10
            + len(stats["contact_emails"]) * 25
        )

    top_orgs = sorted(eligible, key=score, reverse=True)[: max(0, limit)]

    created: list[tuple[Entity, int]] = []
    for stats in top_orgs:
        domain = stats["domain"]
        contact_count = len(stats["contact_emails"])

        entity = Entity(
            snapshot_id=snapshot_id,
            kind=EntityKind.org,
            name=_domain_to_org_name(domain),
            primary_email=None,
            domain=domain,
            score=score(stats),
            interaction_days=len(stats["interaction_dates"]),
            meeting_count=stats["meeting_count"],
            email_count=stats["email_count"],
            total_meeting_minutes=stats["total_meeting_minutes"],
        )
        session.add(entity)
        await session.flush()

        for evidence_id in stats["evidence_ids"]:
            session.add(
                EntityEvidence(
                    snapshot_id=snapshot_id,
                    entity_id=entity.id,
                    evidence_id=evidence_id,
                )
            )

        created.append((entity, contact_count))

    await session.commit()
    return created


async def compute_wrapped_metrics(
    session: AsyncSession,
    snapshot_id: UUID,
) -> dict:
    """Compute Wrapped-style metrics from evidence."""
    # Get all calendar events
    result = await session.execute(
        select(EvidenceItem.occurred_at, EvidenceItem.duration_minutes)
        .where(EvidenceItem.snapshot_id == snapshot_id)
        .where(EvidenceItem.source_type == SourceType.calendar_event)
    )
    events = result.all()

    # Count emails
    result = await session.execute(
        select(func.count())
        .select_from(EvidenceItem)
        .where(EvidenceItem.snapshot_id == snapshot_id)
        .where(EvidenceItem.source_type == SourceType.gmail_message)
    )
    total_emails = int(result.scalar_one() or 0)

    # Calculate metrics
    total_meetings = len(events)
    total_meeting_minutes = sum(duration or 0 for _, duration in events)
    total_meeting_hours = total_meeting_minutes / 60

    # Group by week for averages (90 days = ~13 weeks)
    weeks = 13
    avg_meetings_per_week = total_meetings / weeks if weeks > 0 else 0
    avg_meeting_hours_per_week = total_meeting_hours / weeks if weeks > 0 else 0

    # Focus time estimate (assume 40 hour work week, subtract meetings)
    work_hours_per_week = 40
    focus_hours_per_week = max(0, work_hours_per_week - avg_meeting_hours_per_week)

    # Meeting cost estimate (configurable hourly rate)
    hourly_rate = 100  # Default $100/hour
    meeting_cost_estimate = total_meeting_hours * hourly_rate

    # Meeting heatmap data (days with meetings)
    meeting_dates: dict[str, int] = {}
    for occurred_at, _ in events:
        date_str = occurred_at.strftime("%Y-%m-%d")
        meeting_dates[date_str] = meeting_dates.get(date_str, 0) + 1

    # Email stats
    emails_per_week = total_emails / weeks if weeks > 0 else 0

    return {
        "total_meetings": total_meetings,
        "total_meeting_hours": round(total_meeting_hours, 1),
        "avg_meetings_per_week": round(avg_meetings_per_week, 1),
        "avg_meeting_hours_per_week": round(avg_meeting_hours_per_week, 1),
        "focus_hours_per_week": round(focus_hours_per_week, 1),
        "meeting_cost_estimate": round(meeting_cost_estimate, 0),
        "total_emails": total_emails,
        "emails_per_week": round(emails_per_week, 1),
        "meeting_heatmap": meeting_dates,
        "snapshot_window_days": 90,
    }


async def gather_entity_evidence(
    session: AsyncSession,
    snapshot_id: UUID,
    entity_id: UUID,
) -> tuple[list[dict], list[dict], dict[str, dict]]:
    """Gather meeting and email evidence for an entity.

    Returns:
        Tuple of (meeting_evidence, email_evidence, evidence_map)
    """
    # Get all entity-evidence links for this entity
    result = await session.execute(
        select(EntityEvidence)
        .where(EntityEvidence.snapshot_id == snapshot_id)
        .where(EntityEvidence.entity_id == entity_id)
    )
    links = result.scalars().all()
    evidence_ids = [link.evidence_id for link in links]

    if not evidence_ids:
        return [], [], {}

    # Get all evidence items
    result = await session.execute(
        select(EvidenceItem)
        .where(EvidenceItem.id.in_(evidence_ids))
        .order_by(EvidenceItem.occurred_at.desc())
        .limit(settings.max_entity_evidence_items)
    )
    evidence_items = result.scalars().all()

    meeting_evidence: list[dict[str, object]] = []
    email_evidence: list[dict[str, object]] = []
    evidence_map: dict[str, dict[str, object]] = {}

    for ev in evidence_items:
        participants = ev.participants or []
        ev_dict: dict[str, object] = {
            "id": str(ev.id),
            "title": ev.title or "",
            "date": ev.occurred_at.strftime("%Y-%m-%d") if ev.occurred_at else "",
            "preview": ev.body_preview or ev.snippet or "",
        }
        evidence_map[str(ev.id)] = ev_dict

        if ev.source_type == SourceType.calendar_event:
            ev_dict["type"] = "meeting"
            ev_dict["duration_min"] = ev.duration_minutes or 0
            ev_dict["location"] = ev.snippet or ""
            organizer_email = next(
                (
                    p.get("email")
                    for p in (ev.participants or [])
                    if p.get("role") == "organizer"
                ),
                "",
            )
            ev_dict["organizer"] = organizer_email
            ev_dict["attendees_list"] = [
                {
                    "email": p.get("email", ""),
                    "name": p.get("name", ""),
                    "response_status": p.get("response_status", "unknown"),
                }
                for p in (ev.participants or [])
                if p.get("role") in ("attendee", "organizer")
            ]
            ev_dict["attendees"] = ", ".join(
                p.get("name") or p.get("email", "")
                for p in (ev.participants or [])
                if p.get("role") in ("attendee", "organizer")
            )
            ev_dict["description"] = ev.body_preview or ""
            meeting_evidence.append(ev_dict)
        elif ev.source_type == SourceType.gmail_message:
            ev_dict["type"] = "email"
            ev_dict["subject"] = ev.title or ""
            ev_dict["thread_id"] = ev.thread_id or ""
            from_participant = next(
                (p for p in participants if p.get("role") == "from"),
                {},
            )
            ev_dict["from"] = from_participant.get("email", "")
            ev_dict["from_name"] = from_participant.get("name", "")
            ev_dict["to_list"] = [
                {"email": p.get("email", ""), "name": p.get("name", "")}
                for p in participants
                if p.get("role") == "to"
            ]
            ev_dict["cc_list"] = [
                {"email": p.get("email", ""), "name": p.get("name", "")}
                for p in participants
                if p.get("role") == "cc"
            ]
            email_evidence.append(ev_dict)

    return meeting_evidence, email_evidence, evidence_map


async def create_entity_dossier(
    session: AsyncSession,
    snapshot_id: UUID,
    entity: Entity,
    user_email: str,
    meeting_evidence: list[dict],
    email_evidence: list[dict],
) -> dict:
    """Create and store a dossier for an entity using the Dossier Agent."""
    # Group emails by thread for thread summaries
    threads_by_id: dict[str, list[dict]] = {}
    for ev in email_evidence:
        thread_id = ev.get("thread_id", ev.get("id", "unknown"))
        if thread_id not in threads_by_id:
            threads_by_id[thread_id] = []
        threads_by_id[thread_id].append(ev)

    # Create thread summaries (limit to top threads by message count)
    sorted_threads = sorted(
        threads_by_id.items(), key=lambda inner_item: len(inner_item[1]), reverse=True
    )[: settings.max_thread_summaries]

    thread_inputs: list[dict] = []
    thread_subjects: dict[str, str] = {}
    full_message_counts: dict[str, int] = {}
    for thread_id, messages in sorted_threads:
        subject = str(messages[0].get("subject", "") if messages else "")
        thread_id_str = str(thread_id)
        thread_subjects[thread_id_str] = subject
        full_message_counts[thread_id_str] = len(messages)

        recent_messages = list(reversed(messages[:20]))
        thread_inputs.append(
            {
                "thread_id": thread_id_str,
                "subject": subject,
                "messages": [
                    {
                        "date": str(m.get("date", "")),
                        "from": str(m.get("from", "")),
                        "preview": str(m.get("preview", ""))[:500],
                    }
                    for m in recent_messages
                    if isinstance(m, dict)
                ],
            }
        )

    meeting_evidence_inputs = list(islice(meeting_evidence, settings.max_meeting_summaries))
    meeting_inputs: list[dict] = [
        {
            "event_id": str(ev.get("id", "")),
            "title": str(ev.get("title", "")),
            "date": str(ev.get("date", "")),
            "duration_minutes": int(ev.get("duration_min", 0) or 0),
            "location": ev.get("location") if isinstance(ev.get("location"), str) else None,
            "organizer": ev.get("organizer") if isinstance(ev.get("organizer"), str) else None,
            "attendees": ev.get("attendees_list", []) if isinstance(ev.get("attendees_list"), list) else [],
            "description": ev.get("description") if isinstance(ev.get("description"), str) else None,
            "is_recurring": bool(ev.get("is_recurring", False)),
        }
        for ev in meeting_evidence_inputs
        if isinstance(ev, dict)
    ]

    async def timed(coro: Awaitable[T]) -> tuple[T, float]:
        started_at = time.perf_counter()
        result = await coro
        return result, time.perf_counter() - started_at

    (thread_summaries_raw, thread_time), (meeting_summaries_raw, meeting_time) = await asyncio.gather(
        asyncio.create_task(timed(summarize_threads_batch(thread_inputs))),
        asyncio.create_task(timed(summarize_meetings_batch(meeting_inputs))),
    )
    logger.info(f"[TIMING]   - Thread summaries ({len(sorted_threads)} threads): {thread_time:.2f}s")
    logger.info(f"[TIMING]   - Meeting summaries ({len(meeting_inputs)} meetings): {meeting_time:.2f}s")

    thread_summaries_raw = thread_summaries_raw if isinstance(thread_summaries_raw, list) else []
    meeting_summaries_raw = meeting_summaries_raw if isinstance(meeting_summaries_raw, list) else []

    thread_summaries = [
        {
            "thread_id": summary.thread_id,
            "subject": thread_subjects.get(summary.thread_id, ""),
            "summary": summary.summary,
            "milestones": summary.milestones,
            "themes": summary.themes,
            "participants": summary.participants,
            "message_count": max(summary.message_count, full_message_counts.get(summary.thread_id, 0)),
            "date_range": summary.date_range,
        }
        for summary in thread_summaries_raw
        if hasattr(summary, "thread_id")
    ]

    meeting_summaries = [
        {
            "event_id": summary.event_id,
            "title": meeting_inputs[i].get("title", ""),
            "date": meeting_inputs[i].get("date", ""),
            "purpose": summary.purpose,
            "meeting_type": summary.meeting_type,
            "participants": summary.participants,
            "topics": summary.topics,
            "is_recurring": summary.is_recurring,
        }
        for i, summary in enumerate(meeting_summaries_raw)
        if i < len(meeting_inputs)
    ]

    # Create dossier
    dossier_start = time.perf_counter()
    dossier = await create_dossier(
        entity_id=str(entity.id),
        entity_name=entity.name,
        entity_email=entity.primary_email or entity.domain or "",
        user_email=user_email,
        thread_summaries=thread_summaries,
        meeting_summaries=meeting_summaries,
    )
    logger.info(f"[TIMING]   - Dossier creation: {time.perf_counter() - dossier_start:.2f}s")

    dossier_data = {
        "entity_id": str(entity.id),
        "entity_name": entity.name,
        "relationship_type": dossier.relationship_type,
        "milestones": dossier.milestones,
        "themes": dossier.themes,
        "timeline_summary": dossier.timeline_summary,
        "interaction_pattern": dossier.interaction_pattern,
        "first_interaction": dossier.first_interaction,
        "last_interaction": dossier.last_interaction,
        "thread_count": dossier.thread_count,
        "meeting_count": dossier.meeting_count,
    }

    # Store dossier artifact
    await store_artifact(
        session, snapshot_id,
        ArtifactType.entity_dossier,
        f"entity:{entity.id}:dossier",
        dossier_data,
        model_name=settings.llm_model,
        prompt_version="v1",
    )

    return dossier_data


async def generate_entity_story(
    session: AsyncSession,
    snapshot_id: UUID,
    entity: Entity,
    user_email: str,
) -> tuple[dict, dict]:
    """Generate a verified story for an entity using the agent network.

    Returns:
        Tuple of (story_data, verification_data)
    """
    # Gather evidence
    evidence_start = time.perf_counter()
    meeting_evidence, email_evidence, evidence_map = await gather_entity_evidence(
        session, snapshot_id, entity.id
    )
    logger.info(f"[TIMING]   - Gather evidence: {time.perf_counter() - evidence_start:.2f}s ({len(meeting_evidence)} meetings, {len(email_evidence)} emails)")

    # If no evidence, return a minimal story
    if not meeting_evidence and not email_evidence:
        return {
            "entity_id": str(entity.id),
            "entity_name": entity.name,
            "title": f"Your relationship with {entity.name}",
            "summary": f"Limited data available for {entity.name}.",
            "claims": [],
            "timeline": [],
            "themes": [],
        }, {"verdict": "ok", "issues": []}

    user_email_normalized = user_email.lower().strip()
    entity_domain = (
        entity.domain.lower().strip()
        if isinstance(entity.domain, str) and entity.domain.strip()
        else None
    )
    entity_email = (
        entity.primary_email.lower().strip()
        if isinstance(entity.primary_email, str) and entity.primary_email.strip()
        else None
    )

    def format_contact(email: str, name: str | None = None) -> str:
        cleaned_email = email.strip()
        cleaned_name = (name or "").strip()
        if cleaned_name:
            return f"{cleaned_name} <{cleaned_email}>"
        return cleaned_email

    def compact_preview(text: object, *, max_chars: int = 220) -> str:
        if not isinstance(text, str):
            return ""
        cleaned = " ".join(text.split())
        if len(cleaned) <= max_chars:
            return cleaned
        return cleaned[: max(0, max_chars - 1)].rstrip() + "…"

    key_contacts: list[str] = []
    if entity.kind == EntityKind.org and entity_domain:
        contact_counts: dict[str, int] = {}
        contact_names: dict[str, str] = {}

        def add_contact(email: object, name: object = "") -> None:
            if not isinstance(email, str):
                return
            normalized = email.lower().strip()
            if not normalized or normalized == user_email_normalized:
                return
            if "@" not in normalized:
                return
            if not normalized.endswith(f"@{entity_domain}"):
                return
            if is_automated_sender(normalized):
                return

            contact_counts[normalized] = contact_counts.get(normalized, 0) + 1
            if isinstance(name, str) and name.strip() and normalized not in contact_names:
                contact_names[normalized] = name.strip()

        for ev in meeting_evidence:
            attendees = ev.get("attendees_list", [])
            if not isinstance(attendees, list):
                continue
            for p in attendees:
                if not isinstance(p, dict):
                    continue
                add_contact(p.get("email"), p.get("name"))

        for ev in email_evidence:
            add_contact(ev.get("from"), ev.get("from_name"))
            for group_key in ("to_list", "cc_list"):
                group = ev.get(group_key, [])
                if not isinstance(group, list):
                    continue
                for p in group:
                    if not isinstance(p, dict):
                        continue
                    add_contact(p.get("email"), p.get("name"))

        key_contacts = [
            format_contact(email, contact_names.get(email))
            for email, _ in sorted(
                contact_counts.items(),
                key=lambda item: (item[1], item[0]),
                reverse=True,
            )[:5]
        ]

    # Create dossier (sub-agent pipeline)
    dossier_data = await create_entity_dossier(
        session, snapshot_id, entity, user_email, meeting_evidence, email_evidence
    )

    # Calculate stats
    total_meeting_hours = sum(
        ev.get("duration_min", 0) for ev in meeting_evidence
    ) / 60

    thread_count = len(set(ev.get("thread_id", ev.get("id")) for ev in email_evidence))

    def is_entity_contact(email: object) -> bool:
        if not isinstance(email, str):
            return False
        normalized = email.lower().strip()
        if not normalized or normalized == user_email_normalized:
            return False
        if entity.kind == EntityKind.person:
            return bool(entity_email and normalized == entity_email)
        if entity_domain and normalized.endswith(f"@{entity_domain}"):
            return True
        return bool(entity_email and normalized == entity_email)

    combined: list[tuple[str, str, dict]] = []
    for ev in meeting_evidence:
        combined.append((str(ev.get("date") or ""), "meeting", ev))
    for ev in email_evidence:
        combined.append((str(ev.get("date") or ""), "email", ev))

    combined = [
        (date, kind, ev)
        for date, kind, ev in combined
        if isinstance(ev, dict) and str(ev.get("id") or "").strip()
    ]
    combined.sort(key=lambda item: item[0] or "9999-99-99")

    if len(combined) <= MAX_EVIDENCE_IDS_PER_STORY:
        selected = combined
    else:
        denom = max(1, MAX_EVIDENCE_IDS_PER_STORY - 1)
        indices = {
            round(i * (len(combined) - 1) / denom)
            for i in range(MAX_EVIDENCE_IDS_PER_STORY)
        }
        selected = [combined[i] for i in sorted(indices)]

    # Prepare evidence list for story agent (grounded, includes org contact metadata).
    evidence_list: list[dict] = []
    story_evidence_map: dict[str, dict[str, object]] = {}
    for date, kind, ev in selected:
        evidence_id = str(ev.get("id") or "")
        if not evidence_id:
            continue

        contacts: list[str] = []
        if kind == "meeting":
            attendees = ev.get("attendees_list", [])
            if isinstance(attendees, list):
                for p in attendees:
                    if not isinstance(p, dict):
                        continue
                    if is_entity_contact(p.get("email")):
                        contacts.append(
                            format_contact(
                                str(p.get("email") or ""),
                                str(p.get("name") or ""),
                            )
                        )
            title = str(ev.get("title") or "")
            base_preview = str(ev.get("description") or ev.get("preview") or "")
        else:
            if is_entity_contact(ev.get("from")):
                contacts.append(
                    format_contact(
                        str(ev.get("from") or ""),
                        str(ev.get("from_name") or ""),
                    )
                )
            for group_key in ("to_list", "cc_list"):
                group = ev.get(group_key, [])
                if not isinstance(group, list):
                    continue
                for p in group:
                    if not isinstance(p, dict):
                        continue
                    if is_entity_contact(p.get("email")):
                        contacts.append(
                            format_contact(
                                str(p.get("email") or ""),
                                str(p.get("name") or ""),
                            )
                        )
            title = str(ev.get("subject") or ev.get("title") or "")
            base_preview = str(ev.get("preview") or "")

        deduped_contacts: list[str] = []
        for c in contacts:
            if c and c not in deduped_contacts:
                deduped_contacts.append(c)
        deduped_contacts = deduped_contacts[:5]

        contact_prefix = ""
        if entity.kind == EntityKind.org and deduped_contacts:
            contact_prefix = f"Contacts: {', '.join(deduped_contacts)}\n"

        preview = (contact_prefix + compact_preview(base_preview)).strip()
        evidence_item = {
            "id": evidence_id,
            "type": kind,
            "title": title,
            "date": str(date or ""),
            "preview": preview,
        }
        evidence_list.append(evidence_item)
        story_evidence_map[evidence_id] = {
            "title": title,
            "preview": preview,
            "date": str(date or ""),
            "type": kind,
        }

    try:
        # Generate story using agent
        story_start = time.perf_counter()
        story_content = await agent_generate_story(
            entity_name=entity.name,
            user_email=user_email,
            dossier=dossier_data,
            evidence_list=evidence_list,
            meeting_count=entity.meeting_count,
            thread_count=thread_count,
            meeting_hours=total_meeting_hours,
            entity_kind=entity.kind.value,
            entity_domain=entity_domain,
            key_contacts=key_contacts,
        )
        logger.info(f"[TIMING]   - Story agent: {time.perf_counter() - story_start:.2f}s")

        final_claims = story_content.claims
        final_timeline = story_content.timeline
        verification_data = {"verdict": "skipped", "issues": []}

        if settings.story_verification_enabled:
            # Verify the story
            verify_start = time.perf_counter()
            verification = await agent_verify_story(
                claims=story_content.claims,
                timeline=story_content.timeline,
                evidence_map=story_evidence_map,
            )
            logger.info(
                f"[TIMING]   - Verification agent: {time.perf_counter() - verify_start:.2f}s"
            )

            verification_data = {
                "verdict": verification.verdict,
                "issues": verification.issues,
            }

            # Fix claims and timeline if needed
            if verification.verdict == "needs_fix" and verification.issues:
                fix_start = time.perf_counter()
                final_claims, final_timeline = await agent_fix_claims(
                    claims=story_content.claims,
                    timeline=story_content.timeline,
                    issues=verification.issues,
                    evidence_map=story_evidence_map,
                )
                logger.info(
                    f"[TIMING]   - Fix claims agent: {time.perf_counter() - fix_start:.2f}s"
                )

        story_data = {
            "entity_id": str(entity.id),
            "entity_name": entity.name,
            "title": story_content.title,
            "summary": story_content.summary,
            "themes": story_content.themes,
            "timeline": final_timeline,
            "claims": final_claims,
            "verification_status": verification_data.get("verdict", "skipped"),
        }

        return story_data, verification_data

    except Exception as e:
        logger.exception(f"LLM story generation failed for entity {entity.id}: {e}")
        # Return a basic story on failure
        return {
            "entity_id": str(entity.id),
            "entity_name": entity.name,
            "title": f"Your relationship with {entity.name}",
            "summary": f"Over the past 90 days, you've had {entity.meeting_count} meetings and exchanged {entity.email_count} emails with {entity.name}.",
            "claims": [],
            "timeline": [],
            "themes": [],
            "generation_error": str(e),
        }, {"verdict": "error", "issues": [{"error": str(e)}]}


async def store_artifact(
    session: AsyncSession,
    snapshot_id: UUID,
    artifact_type: ArtifactType,
    key: str,
    data: dict,
    model_name: Optional[str] = None,
    prompt_version: Optional[str] = None,
) -> Artifact:
    """Store an artifact (immutable once written)."""
    # Check if artifact already exists
    result = await session.execute(
        select(Artifact)
        .where(Artifact.snapshot_id == snapshot_id)
        .where(Artifact.type == artifact_type)
        .where(Artifact.key == key)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return existing  # Don't overwrite

    artifact = Artifact(
        snapshot_id=snapshot_id,
        type=artifact_type,
        key=key,
        data=data,
        model_name=model_name,
        prompt_version=prompt_version,
    )
    session.add(artifact)
    try:
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    return artifact


async def run_ingestion(snapshot_id: str) -> IngestResult:
    """Run the full ingestion pipeline."""
    session_maker = get_sync_session()

    # Timing tracking
    timings: dict[str, float] = {}
    total_start = time.perf_counter()

    async with session_maker() as session:
        snapshot_uuid: Optional[UUID] = None
        try:
            snapshot_uuid = UUID(snapshot_id)
            logger.info(f"[TIMING] Starting ingestion for snapshot {snapshot_id}")

            # Get snapshot
            result = await session.execute(
                select(Snapshot).where(Snapshot.id == snapshot_uuid)
            )
            snapshot = result.scalar_one_or_none()

            if not snapshot:
                return IngestResult(snapshot_id=snapshot_id, status="failed", error="Snapshot not found")

            # Get user
            result = await session.execute(select(User).where(User.id == snapshot.user_id))
            user = result.scalar_one()

            # Decrypt tokens
            access_token = decrypt_token(snapshot.access_token_encrypted) if snapshot.access_token_encrypted else None
            if not access_token:
                await update_snapshot_status(
                    session, snapshot_uuid,
                    status=SnapshotStatus.failed,
                    failure_reason="No access token available",
                )
                return IngestResult(snapshot_id=snapshot_id, status="failed", error="No access token")

            # Stage A: Init
            await update_snapshot_status(
                session, snapshot_uuid,
                status=SnapshotStatus.running,
                stage=SnapshotStage.init,
            )

            # Stage B: Gmail list
            await update_snapshot_status(session, snapshot_uuid, stage=SnapshotStage.gmail_list)
            stage_start = time.perf_counter()
            estimated_message_count = await estimate_message_count(
                access_token,
                query="in:inbox newer_than:90d",
            )
            message_list = await list_messages(
                access_token,
                query="in:inbox newer_than:90d",
                max_results=settings.max_gmail_messages_listed,
            )
            timings["gmail_list"] = time.perf_counter() - stage_start
            logger.info(f"[TIMING] Gmail list: {timings['gmail_list']:.2f}s ({len(message_list)} messages)")
            await update_snapshot_status(
                session, snapshot_uuid,
                progress_counts={
                    "messages_estimated": estimated_message_count,
                    "messages_listed": len(message_list),
                },
            )

            # Stage C: Gmail fetch
            await update_snapshot_status(session, snapshot_uuid, stage=SnapshotStage.gmail_fetch)
            stage_start = time.perf_counter()
            message_ids: list[str] = [
                msg_ref["id"]
                for msg_ref in message_list[: settings.max_gmail_messages_fetched]
                if isinstance(msg_ref, dict) and isinstance(msg_ref.get("id"), str)
            ]
            messages = await fetch_messages(
                access_token,
                message_ids,
                include_body=False,
                batch_size=100,
            )
            timings["gmail_fetch"] = time.perf_counter() - stage_start
            logger.info(f"[TIMING] Gmail fetch: {timings['gmail_fetch']:.2f}s ({len(messages)} messages)")

            stage_start = time.perf_counter()
            await store_gmail_evidence(session, snapshot_uuid, messages)
            timings["gmail_store"] = time.perf_counter() - stage_start
            logger.info(f"[TIMING] Gmail store: {timings['gmail_store']:.2f}s")
            await update_snapshot_status(
                session, snapshot_uuid,
                progress_counts={"messages_fetched": len(messages), "messages_stored": len(messages)},
            )

            # Stage D: Calendar fetch
            await update_snapshot_status(session, snapshot_uuid, stage=SnapshotStage.calendar_fetch)
            stage_start = time.perf_counter()
            events = await list_events(
                access_token,
                time_min=snapshot.window_start,
                time_max=snapshot.window_end,
                max_results=settings.max_calendar_events,
            )
            timings["calendar_fetch"] = time.perf_counter() - stage_start
            logger.info(f"[TIMING] Calendar fetch: {timings['calendar_fetch']:.2f}s ({len(events)} events)")

            stage_start = time.perf_counter()
            await store_calendar_evidence(session, snapshot_uuid, events)
            timings["calendar_store"] = time.perf_counter() - stage_start
            logger.info(f"[TIMING] Calendar store: {timings['calendar_store']:.2f}s")
            await update_snapshot_status(
                session, snapshot_uuid,
                progress_counts={"events_fetched": len(events), "events_stored": len(events)},
            )

            # Stage E: Wrapped compute
            await update_snapshot_status(session, snapshot_uuid, stage=SnapshotStage.wrapped_compute)
            stage_start = time.perf_counter()
            wrapped_data = await compute_wrapped_metrics(session, snapshot_uuid)
            await store_artifact(
                session, snapshot_uuid,
                ArtifactType.wrapped_cards,
                "wrapped",
                wrapped_data,
            )
            timings["wrapped_compute"] = time.perf_counter() - stage_start
            logger.info(f"[TIMING] Wrapped compute: {timings['wrapped_compute']:.2f}s")

            # Stage F: Entity extraction
            await update_snapshot_status(session, snapshot_uuid, stage=SnapshotStage.entities_compute)
            stage_start = time.perf_counter()
            entities = await extract_entities(session, snapshot_uuid, user.email)
            timings["entity_extraction"] = time.perf_counter() - stage_start
            logger.info(f"[TIMING] Entity extraction: {timings['entity_extraction']:.2f}s ({len(entities)} entities)")

            # Store top 5 entities artifact
            top_5 = entities[:5]
            top_5_data = [
                {
                    "id": str(e.id),
                    "name": e.name,
                    "email": e.primary_email,
                    "domain": e.domain,
                    "score": e.score,
                    "meeting_count": e.meeting_count,
                    "email_count": e.email_count,
                    "total_meeting_minutes": e.total_meeting_minutes,
                }
                for e in top_5
            ]
            await store_artifact(
                session, snapshot_uuid,
                ArtifactType.top_entities,
                "top5",
                {"entities": top_5_data},
            )

            # Store graph artifact (nodes and edges)
            graph_data = {
                "nodes": [
                    {"id": str(e.id), "name": e.name, "type": "person"}
                    for e in top_5
                ],
                "edges": [],  # Edges can be computed from shared evidence
            }
            await store_artifact(
                session, snapshot_uuid,
                ArtifactType.graph,
                "graph",
                graph_data,
            )

            # Store top organizations artifact (domain aggregation)
            top_orgs = await extract_top_organizations(
                session, snapshot_uuid, user.email, limit=5
            )
            top_orgs_data = [
                {
                    "id": str(entity.id),
                    "name": entity.name,
                    "email": None,
                    "domain": entity.domain,
                    "score": entity.score,
                    "meeting_count": entity.meeting_count,
                    "email_count": entity.email_count,
                    "total_meeting_minutes": entity.total_meeting_minutes,
                    "contact_count": contact_count,
                }
                for entity, contact_count in top_orgs
            ]
            await store_artifact(
                session,
                snapshot_uuid,
                ArtifactType.top_entities,
                "top_orgs",
                {"entities": top_orgs_data},
            )

            await update_snapshot_status(
                session, snapshot_uuid,
                progress_counts={
                    "entities_extracted": len(entities),
                    "top_5_count": len(top_5),
                    "top_orgs_count": len(top_orgs_data),
                },
            )

            # Kick off story generation asynchronously after ingest completes.
            preload_story_entity_ids: list[str] = []
            if top_5:
                preload_story_entity_ids.append(str(top_5[0].id))
            if top_orgs:
                preload_story_entity_ids.extend(str(entity.id) for entity, _ in top_orgs)

            # Dedupe while preserving order.
            seen_preloads: set[str] = set()
            deduped_preloads: list[str] = []
            for entity_id in preload_story_entity_ids:
                if entity_id in seen_preloads:
                    continue
                seen_preloads.add(entity_id)
                deduped_preloads.append(entity_id)
            preload_story_entity_ids = deduped_preloads

            # Stage H: Finalize
            await update_snapshot_status(session, snapshot_uuid, stage=SnapshotStage.finalize)

            # Delete tokens from snapshot (persistent tokens remain on User)
            snapshot.access_token_encrypted = None
            snapshot.refresh_token_encrypted = None
            snapshot.token_expiry = None

            # Set completion
            snapshot.status = SnapshotStatus.done
            snapshot.completed_at = datetime.now(timezone.utc)
            snapshot.expires_at = snapshot.completed_at + timedelta(days=settings.snapshot_retention_days)

            await session.commit()

            if preload_story_entity_ids:
                try:
                    queue = get_queue()
                    for entity_id in preload_story_entity_ids:
                        queue.enqueue(
                            "app.jobs.generate_story.generate_story",
                            str(snapshot_uuid),
                            entity_id,
                            job_id=f"story:{snapshot_uuid}:{entity_id}",
                            job_timeout=300,
                        )
                except Exception as e:
                    # If Redis is unavailable, just skip preloading stories.
                    logger.warning("Failed to enqueue preload story jobs: %s", e)

            # Log final timing summary
            timings["total"] = time.perf_counter() - total_start
            logger.info(f"[TIMING] ========== INGESTION COMPLETE ==========")
            logger.info(f"[TIMING] Snapshot: {snapshot_id}")
            logger.info(f"[TIMING] Total time: {timings['total']:.2f}s")
            logger.info(f"[TIMING] Breakdown:")
            logger.info(f"[TIMING]   Gmail list:        {timings.get('gmail_list', 0):.2f}s")
            logger.info(f"[TIMING]   Gmail fetch:       {timings.get('gmail_fetch', 0):.2f}s")
            logger.info(f"[TIMING]   Gmail store:       {timings.get('gmail_store', 0):.2f}s")
            logger.info(f"[TIMING]   Calendar fetch:    {timings.get('calendar_fetch', 0):.2f}s")
            logger.info(f"[TIMING]   Calendar store:    {timings.get('calendar_store', 0):.2f}s")
            logger.info(f"[TIMING]   Wrapped compute:   {timings.get('wrapped_compute', 0):.2f}s")
            logger.info(f"[TIMING]   Entity extraction: {timings.get('entity_extraction', 0):.2f}s")
            logger.info(f"[TIMING]   Story generation:  {timings.get('story_generation', 0):.2f}s")
            google_time = timings.get('gmail_list', 0) + timings.get('gmail_fetch', 0) + timings.get('calendar_fetch', 0)
            llm_time = timings.get('story_generation', 0)
            logger.info(f"[TIMING] Google API total: {google_time:.2f}s ({100*google_time/timings['total']:.1f}%)")
            logger.info(f"[TIMING] LLM total: {llm_time:.2f}s ({100*llm_time/timings['total']:.1f}%)")
            logger.info(f"[TIMING] ==========================================")

            return IngestResult(snapshot_id=snapshot_id, status="done")

        except Exception as e:
            logger.exception(f"Ingestion failed for snapshot {snapshot_id}")
            try:
                await session.rollback()
            except Exception:
                logger.exception("Failed to rollback session for snapshot %s", snapshot_id)
            try:
                if snapshot_uuid is not None:
                    await update_snapshot_status(
                        session,
                        snapshot_uuid,
                        status=SnapshotStatus.failed,
                        failure_reason=str(e),
                    )
            except Exception:
                logger.exception("Failed to mark snapshot %s as failed", snapshot_id)
            return IngestResult(snapshot_id=snapshot_id, status="failed", error=str(e))


def ingest_snapshot(snapshot_id: str) -> IngestResult:
    """Entry point for RQ job - runs async ingestion."""
    return asyncio.run(run_ingestion(snapshot_id))
