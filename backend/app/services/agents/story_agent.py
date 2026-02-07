"""Story Agent (E) and Verifier (F): Generate and verify relationship stories.

This module provides the final story generation with evidence grounding.
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass
from datetime import datetime

from app.services.agents.base import call_llm_json, MAX_EVIDENCE_IDS_PER_STORY


def _normalize_date(date_str: str, evidence_map: dict[str, dict] | None = None) -> str | None:
    """Normalize a date string to YYYY-MM-DD format.

    Returns None if the date cannot be parsed.
    """
    if not date_str or not isinstance(date_str, str):
        return None

    date_str = date_str.strip()

    # Already in correct format
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return date_str

    # Try common formats
    formats = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%B %d, %Y",  # December 31, 2024
        "%b %d, %Y",  # Dec 31, 2024
        "%d %B %Y",   # 31 December 2024
        "%d %b %Y",   # 31 Dec 2024
    ]

    for fmt in formats:
        try:
            parsed = datetime.strptime(date_str, fmt)
            return parsed.strftime("%Y-%m-%d")
        except ValueError:
            continue

    return None

logger = logging.getLogger(__name__)

# Story Writer System Prompt
STORY_SYSTEM_PROMPT = """You are an expert at creating compelling, grounded relationship stories based on professional interaction data.

CRITICAL RULES:
1. Every claim MUST be backed by evidence from the provided dossier and raw evidence.
2. Never invent facts not present in the evidence (job titles, funding, company stage, personal details, intent, sentiment).
3. Do not add recommendations, next steps, or "nice-to-haves".
4. If evidence is insufficient, omit the claim or say "not enough information".
5. Use specific dates/details from the evidence previews.
6. Maximum {max_evidence_ids} total evidence_ids across the whole output.
7. Every evidence_id you cite MUST exist in the provided RAW EVIDENCE list.
8. Keep citations tight: use 1-3 evidence_ids per timeline entry/claim.

Output ONLY valid JSON matching the exact schema provided."""

STORY_USER_PROMPT = """Create a relationship story for {entity_name} based on the following.

USER'S EMAIL: {user_email}

ENTITY TYPE: {entity_kind}

{org_context}

ENTITY DOSSIER:
Relationship Type: {relationship_type}
Timeline Summary: {timeline_summary}
Themes: {themes}
Interaction Pattern: {interaction_pattern}
First Interaction: {first_interaction}
Last Interaction: {last_interaction}

MILESTONES:
{milestones}

EVIDENCE SUMMARY:
- Total meetings: {meeting_count}
- Total email threads: {thread_count}
- Total meeting time: {meeting_hours} hours

RAW EVIDENCE (for citations):
{evidence_list}

Generate a relationship story with:
1. A compelling title
2. A 2-3 sentence summary
3. Key themes (2-4 themes)
4. Timeline entries (3-5 key moments, each with date, description, and evidence_ids)
5. Claims/insights (3-5 grounded observations, each with evidence_ids)

OUTPUT FORMAT (JSON):
{{
  "title": "string",
  "summary": "string",
  "themes": ["string"],
  "timeline": [
    {{"date": "YYYY-MM-DD", "description": "string", "evidence_ids": ["string"]}}
  ],
  "claims": [
    {{"text": "string", "evidence_ids": ["string"]}}
  ]
}}"""

# Verifier System Prompt
VERIFY_SYSTEM_PROMPT = """You are a fact-checker for relationship stories. Your job is to verify that each claim and timeline entry is properly supported by the cited evidence.

For each item, check:
1. Is the claim actually supported by the evidence text?
2. Is the claim overstated or exaggerated?
3. Are there any invented details not in the evidence?

Be strict. If a claim makes assumptions not in the evidence, flag it."""

VERIFY_USER_PROMPT = """Verify this relationship story against the cited evidence.

CLAIMS TO VERIFY:
{claims_json}

TIMELINE TO VERIFY:
{timeline_json}

EVIDENCE (by ID):
{evidence_json}

For each issue found, provide the type (claim/timeline), index, and how to fix it.

OUTPUT FORMAT (JSON):
{{
  "verdict": "ok" | "needs_fix",
  "issues": [
    {{"type": "claim" | "timeline", "index": number, "issue": "string", "suggestion": "string"}}
  ]
}}"""


@dataclass
class StoryContent:
    title: str
    summary: str
    themes: list[str]
    timeline: list[dict]
    claims: list[dict]


@dataclass
class VerificationResult:
    verdict: str
    issues: list[dict]


def _get_date_from_evidence(evidence_ids: list[str], evidence_map: dict[str, dict]) -> str | None:
    """Extract a valid date from the first cited evidence item."""
    for eid in evidence_ids:
        ev = evidence_map.get(eid)
        if ev and ev.get("date"):
            normalized = _normalize_date(ev["date"])
            if normalized:
                return normalized
    return None


async def generate_story(
    entity_name: str,
    user_email: str,
    dossier: dict,
    evidence_list: list[dict],
    meeting_count: int,
    thread_count: int,
    meeting_hours: float,
    *,
    entity_kind: str | None = None,
    entity_domain: str | None = None,
    key_contacts: list[str] | None = None,
    model: str | None = None,
) -> StoryContent:
    """Generate a relationship story from dossier and evidence.

    Args:
        entity_name: Entity display name
        user_email: User's email
        dossier: EntityDossier as dict
        evidence_list: List of evidence items with id, type, title, date, preview
        meeting_count: Total meeting count
        thread_count: Total thread count
        meeting_hours: Total meeting hours

    Returns:
        StoryContent dataclass
    """
    normalized_kind = (entity_kind or "person").strip().lower()
    org_context = ""
    if normalized_kind in {"org", "organization"}:
        parts: list[str] = []
        if entity_domain and isinstance(entity_domain, str):
            parts.append(f"Domain: {entity_domain}")
        if key_contacts:
            contacts_text = ", ".join([c for c in key_contacts if isinstance(c, str)][:8])
            if contacts_text:
                parts.append(f"Key contacts you've interacted with: {contacts_text}")
        if parts:
            org_context = "ORGANIZATION CONTEXT:\n" + "\n".join(parts)

    # Format milestones
    milestones_text = "\n".join([
        f"- [{m.get('date', 'unknown')}] {m.get('description', '')}"
        for m in dossier.get("milestones", [])
    ]) or "No specific milestones identified"

    # Format evidence list (limit to budget)
    evidence_items = evidence_list[:MAX_EVIDENCE_IDS_PER_STORY]
    evidence_text = "\n".join(
        [
            f"[{e.get('id', '')}] {e.get('date', '')} - {e.get('type', '')}: {e.get('title', '')}\n  Preview: {e.get('preview', '')[:180]}"
            for e in evidence_items
        ]
    ) or "No evidence available"

    prompt = STORY_USER_PROMPT.format(
        entity_name=entity_name,
        user_email=user_email,
        entity_kind=normalized_kind,
        org_context=org_context,
        relationship_type=dossier.get("relationship_type", "unknown"),
        timeline_summary=dossier.get("timeline_summary", ""),
        themes=", ".join(dossier.get("themes", [])),
        interaction_pattern=dossier.get("interaction_pattern", "unknown"),
        first_interaction=dossier.get("first_interaction", "unknown"),
        last_interaction=dossier.get("last_interaction", "unknown"),
        milestones=milestones_text,
        meeting_count=meeting_count,
        thread_count=thread_count,
        meeting_hours=round(meeting_hours, 1),
        evidence_list=evidence_text,
    )

    system = STORY_SYSTEM_PROMPT.format(max_evidence_ids=MAX_EVIDENCE_IDS_PER_STORY)

    try:
        data = await asyncio.to_thread(call_llm_json, system, prompt, 900, model=model)

        allowed_ids = {str(e.get("id", "")) for e in evidence_items if e.get("id")}
        # Build evidence map for date lookups
        evidence_map = {str(e.get("id", "")): e for e in evidence_items if e.get("id")}

        def normalize_ids(value: object) -> list[str]:
            if not isinstance(value, list):
                return []
            filtered: list[str] = []
            for entry in value:
                if not isinstance(entry, str):
                    continue
                if entry in allowed_ids and entry not in filtered:
                    filtered.append(entry)
            return filtered

        timeline = data.get("timeline", []) if isinstance(data.get("timeline"), list) else []
        claims = data.get("claims", []) if isinstance(data.get("claims"), list) else []

        total_citations = 0
        for item in timeline:
            if not isinstance(item, dict):
                continue
            evidence_ids = normalize_ids(item.get("evidence_ids"))
            item["evidence_ids"] = evidence_ids
            total_citations += len(evidence_ids)

            # Normalize date - try parsing, fallback to evidence date
            raw_date = item.get("date", "")
            normalized_date = _normalize_date(raw_date)
            if not normalized_date and evidence_ids:
                # Fallback: use date from first cited evidence
                normalized_date = _get_date_from_evidence(evidence_ids, evidence_map)
            if normalized_date:
                item["date"] = normalized_date
            else:
                # Last resort: drop entries with unparseable dates
                logger.warning(f"Dropping timeline entry with invalid date: {raw_date}")
                item["_invalid"] = True

        # Filter out invalid timeline entries
        timeline = [t for t in timeline if isinstance(t, dict) and not t.get("_invalid")]

        for item in claims:
            if not isinstance(item, dict):
                continue
            evidence_ids = normalize_ids(item.get("evidence_ids"))
            item["evidence_ids"] = evidence_ids
            total_citations += len(evidence_ids)

        # If model over-cited, truncate by clearing citations on later items.
        if total_citations > MAX_EVIDENCE_IDS_PER_STORY:
            remaining = MAX_EVIDENCE_IDS_PER_STORY
            for group in (timeline, claims):
                for item in group:
                    if not isinstance(item, dict):
                        continue
                    ids = item.get("evidence_ids")
                    if not isinstance(ids, list):
                        item["evidence_ids"] = []
                        continue
                    kept = ids[: max(0, remaining)]
                    item["evidence_ids"] = kept
                    remaining -= len(kept)

        return StoryContent(
            title=data.get("title", f"Your relationship with {entity_name}"),
            summary=data.get("summary", ""),
            themes=data.get("themes", []) if isinstance(data.get("themes"), list) else [],
            timeline=timeline,
            claims=claims,
        )

    except Exception as e:
        logger.exception(f"Story generation failed: {e}")
        return StoryContent(
            title=f"Your relationship with {entity_name}",
            summary=f"Over the past 90 days, you've had {meeting_count} meetings and {thread_count} email threads with {entity_name}.",
            themes=dossier.get("themes", [])[:4],
            timeline=[],
            claims=[],
        )


async def verify_story(
    claims: list[dict],
    timeline: list[dict],
    evidence_map: dict[str, dict],
    *,
    model: str | None = None,
) -> VerificationResult:
    """Verify story claims and timeline against evidence.

    Args:
        claims: List of claim dicts with text and evidence_ids
        timeline: List of timeline dicts with date, description, evidence_ids
        evidence_map: Dict mapping evidence_id to evidence details

    Returns:
        VerificationResult dataclass
    """
    claims_json = json.dumps([
        {"index": i, "text": c.get("text", ""), "evidence_ids": c.get("evidence_ids", [])}
        for i, c in enumerate(claims)
    ], indent=2)

    timeline_json = json.dumps([
        {"index": i, "date": t.get("date", ""), "description": t.get("description", ""), "evidence_ids": t.get("evidence_ids", [])}
        for i, t in enumerate(timeline)
    ], indent=2)

    evidence_json = json.dumps({
        eid: {
            "title": ev.get("title", ""),
            "preview": ev.get("preview", "")[:500],
            "date": ev.get("date", ""),
            "type": ev.get("type", ""),
        }
        for eid, ev in evidence_map.items()
    }, indent=2)

    prompt = VERIFY_USER_PROMPT.format(
        claims_json=claims_json,
        timeline_json=timeline_json,
        evidence_json=evidence_json,
    )

    try:
        data = await asyncio.to_thread(call_llm_json, VERIFY_SYSTEM_PROMPT, prompt, 1000, model=model)

        return VerificationResult(
            verdict=data.get("verdict", "ok"),
            issues=data.get("issues", []),
        )

    except Exception as e:
        logger.exception(f"Story verification failed: {e}")
        return VerificationResult(verdict="ok", issues=[])


async def fix_claims(
    claims: list[dict],
    timeline: list[dict],
    issues: list[dict],
    evidence_map: dict[str, dict],
    *,
    model: str | None = None,
) -> tuple[list[dict], list[dict]]:
    """Fix story claims and timeline based on verification issues.

    Args:
        claims: Original claims
        timeline: Original timeline
        issues: Verification issues
        evidence_map: Evidence lookup

    Returns:
        Tuple of (fixed_claims, fixed_timeline)
    """
    if not issues:
        return claims, timeline

    prompt = f"""Fix these story elements based on the issues identified.

ORIGINAL CLAIMS:
{json.dumps(claims, indent=2)}

ORIGINAL TIMELINE:
{json.dumps(timeline, indent=2)}

ISSUES:
{json.dumps(issues, indent=2)}

EVIDENCE:
{json.dumps({k: {"title": v.get("title"), "preview": v.get("preview", "")[:300]} for k, v in evidence_map.items()}, indent=2)}

Return the fixed claims and timeline as JSON. Remove or soften items that can't be properly supported.

OUTPUT FORMAT (JSON):
{{
  "claims": [...],
  "timeline": [...]
}}"""

    try:
        data = await asyncio.to_thread(
            call_llm_json,
            "You are a fact-checker fixing story claims to be properly grounded.",
            prompt,
            1500,
            model=model,
        )

        return data.get("claims", claims), data.get("timeline", timeline)

    except Exception as e:
        logger.exception(f"Failed to fix claims: {e}")
        return claims, timeline
