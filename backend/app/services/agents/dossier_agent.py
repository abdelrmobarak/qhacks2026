"""Dossier Agent (C): Creates entity dossiers from evidence.

Input: Thread summaries + meeting summaries for an entity (person or organization)
Output: Compact dossier with timeline, milestones, themes
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from app.services.agents.base import call_llm_json, MAX_THREADS_FOR_DOSSIER, MAX_MEETINGS_FOR_DOSSIER

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a relationship dossier compiler. Given thread and meeting summaries involving a specific person or organization, create a compact dossier that captures:

1. Key milestones in the relationship
2. Main themes/topics of interaction
3. A condensed timeline of significant events
4. The apparent nature of the relationship (colleague, customer, vendor, etc.)

RULES:
- Every claim must be traceable to the provided summaries
- Do not invent details not present in the evidence
- Focus on professional context
- Be concise but comprehensive

Output valid JSON matching the schema provided."""

USER_PROMPT = """Create a relationship dossier for {entity_name} ({entity_email}).

USER EMAIL: {user_email}

THREAD SUMMARIES (email interactions):
{thread_summaries}

MEETING SUMMARIES (calendar interactions):
{meeting_summaries}

OUTPUT FORMAT (JSON):
{{
  "relationship_type": "colleague" | "customer" | "vendor" | "partner" | "investor" | "candidate" | "other",
  "milestones": [
    {{"date": "YYYY-MM-DD", "description": "string", "source_type": "thread" | "meeting", "source_id": "string"}}
  ],
  "themes": ["string"],
  "timeline_summary": "string",
  "interaction_pattern": "frequent" | "regular" | "occasional" | "sporadic",
  "first_interaction": "YYYY-MM-DD",
  "last_interaction": "YYYY-MM-DD"
}}"""


@dataclass
class EntityDossier:
    entity_id: str
    entity_name: str
    relationship_type: str
    milestones: list[dict]
    themes: list[str]
    timeline_summary: str
    interaction_pattern: str
    first_interaction: str | None
    last_interaction: str | None
    thread_count: int
    meeting_count: int


async def create_dossier(
    entity_id: str,
    entity_name: str,
    entity_email: str,
    user_email: str,
    thread_summaries: list[dict],
    meeting_summaries: list[dict],
    *,
    model: str | None = None,
) -> EntityDossier:
    """Create a dossier for an entity based on evidence summaries.

    Args:
        entity_id: Entity UUID
        entity_name: Entity display name
        entity_email: Entity email address
        user_email: The user's email address
        thread_summaries: List of ThreadSummary dicts
        meeting_summaries: List of MeetingSummary dicts

    Returns:
        EntityDossier dataclass
    """
    # Limit inputs to budget
    threads = thread_summaries[:MAX_THREADS_FOR_DOSSIER]
    meetings = meeting_summaries[:MAX_MEETINGS_FOR_DOSSIER]

    if not threads and not meetings:
        return EntityDossier(
            entity_id=entity_id,
            entity_name=entity_name,
            relationship_type="other",
            milestones=[],
            themes=[],
            timeline_summary="No interaction data available",
            interaction_pattern="sporadic",
            first_interaction=None,
            last_interaction=None,
            thread_count=0,
            meeting_count=0,
        )

    # Format thread summaries
    threads_text = "\n\n".join([
        f"[Thread {t.get('thread_id', 'unknown')}] {t.get('date_range', {}).get('start', 'unknown')} - {t.get('date_range', {}).get('end', 'unknown')}\n"
        f"Subject: {t.get('subject', '(no subject)')}\n"
        f"Summary: {t.get('summary', '')}\n"
        f"Themes: {', '.join(t.get('themes', []))}\n"
        f"Milestones: {', '.join(t.get('milestones', []))}"
        for t in threads
    ]) or "No email threads"

    # Format meeting summaries
    meetings_text = "\n\n".join([
        f"[Meeting {m.get('event_id', 'unknown')}] {m.get('date', 'unknown')}\n"
        f"Title: {m.get('title', '(no title)')}\n"
        f"Purpose: {m.get('purpose', '')}\n"
        f"Type: {m.get('meeting_type', 'other')}\n"
        f"Topics: {', '.join(m.get('topics', []))}"
        for m in meetings
    ]) or "No meetings"

    prompt = USER_PROMPT.format(
        entity_name=entity_name,
        entity_email=entity_email,
        user_email=user_email,
        thread_summaries=threads_text,
        meeting_summaries=meetings_text,
    )

    try:
        data = await asyncio.to_thread(call_llm_json, SYSTEM_PROMPT, prompt, 1200, model=model)

        return EntityDossier(
            entity_id=entity_id,
            entity_name=entity_name,
            relationship_type=data.get("relationship_type", "other"),
            milestones=data.get("milestones", []),
            themes=data.get("themes", []),
            timeline_summary=data.get("timeline_summary", ""),
            interaction_pattern=data.get("interaction_pattern", "sporadic"),
            first_interaction=data.get("first_interaction"),
            last_interaction=data.get("last_interaction"),
            thread_count=len(threads),
            meeting_count=len(meetings),
        )

    except Exception as e:
        logger.exception(f"Dossier creation failed for {entity_id}: {e}")
        return EntityDossier(
            entity_id=entity_id,
            entity_name=entity_name,
            relationship_type="other",
            milestones=[],
            themes=[],
            timeline_summary=f"Interaction history with {entity_name}",
            interaction_pattern="sporadic",
            first_interaction=None,
            last_interaction=None,
            thread_count=len(threads),
            meeting_count=len(meetings),
        )
