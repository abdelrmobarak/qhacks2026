"""Theme Agent (D): Extracts global themes from snapshot.

Input: All thread and meeting summaries from snapshot
Output: Snapshot-wide themes and focus areas
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from app.services.agents.base import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a professional activity analyzer. Given summaries of email threads and meetings from the past 90 days, identify:

1. Major themes/projects the user is working on
2. Key focus areas and recurring topics
3. Time allocation patterns (what takes most attention)

Be factual. Only identify themes that appear across multiple interactions.
Output valid JSON matching the schema provided."""

USER_PROMPT = """Analyze the following email and meeting summaries from the past 90 days to identify major themes and focus areas.

TOTAL THREADS: {thread_count}
TOTAL MEETINGS: {meeting_count}

SAMPLE THREAD THEMES (aggregated):
{thread_themes}

SAMPLE MEETING TOPICS (aggregated):
{meeting_topics}

SAMPLE THREAD SUMMARIES:
{thread_samples}

SAMPLE MEETING PURPOSES:
{meeting_samples}

OUTPUT FORMAT (JSON):
{{
  "themes": [
    {{"name": "string", "frequency": "high" | "medium" | "low", "description": "string"}}
  ],
  "focus_areas": ["string"],
  "time_allocation": {{
    "external_meetings_pct": number,
    "internal_meetings_pct": number,
    "email_heavy_pct": number
  }},
  "snapshot_summary": "string"
}}"""


@dataclass
class GlobalThemes:
    themes: list[dict]
    focus_areas: list[str]
    time_allocation: dict
    snapshot_summary: str
    thread_count: int
    meeting_count: int


async def extract_global_themes(
    thread_summaries: list[dict],
    meeting_summaries: list[dict],
) -> GlobalThemes:
    """Extract global themes from all summaries.

    Args:
        thread_summaries: All thread summaries from snapshot
        meeting_summaries: All meeting summaries from snapshot

    Returns:
        GlobalThemes dataclass
    """
    if not thread_summaries and not meeting_summaries:
        return GlobalThemes(
            themes=[],
            focus_areas=[],
            time_allocation={},
            snapshot_summary="No data available",
            thread_count=0,
            meeting_count=0,
        )

    # Aggregate themes from threads
    all_thread_themes = []
    for t in thread_summaries:
        all_thread_themes.extend(t.get("themes", []))

    # Count theme frequencies
    theme_counts: dict[str, int] = {}
    for theme in all_thread_themes:
        theme_lower = theme.lower()
        theme_counts[theme_lower] = theme_counts.get(theme_lower, 0) + 1

    # Get top themes
    top_thread_themes = sorted(
        theme_counts.items(), key=lambda x: x[1], reverse=True
    )[:20]

    # Aggregate meeting topics
    all_meeting_topics = []
    for m in meeting_summaries:
        all_meeting_topics.extend(m.get("topics", []))

    topic_counts: dict[str, int] = {}
    for topic in all_meeting_topics:
        topic_lower = topic.lower()
        topic_counts[topic_lower] = topic_counts.get(topic_lower, 0) + 1

    top_meeting_topics = sorted(
        topic_counts.items(), key=lambda x: x[1], reverse=True
    )[:20]

    # Sample summaries for context
    thread_samples = "\n".join([
        f"- {t.get('summary', '')[:200]}"
        for t in thread_summaries[:15]
    ])

    meeting_samples = "\n".join([
        f"- {m.get('purpose', '')[:200]}"
        for m in meeting_summaries[:15]
    ])

    prompt = USER_PROMPT.format(
        thread_count=len(thread_summaries),
        meeting_count=len(meeting_summaries),
        thread_themes=", ".join([f"{t[0]} ({t[1]}x)" for t in top_thread_themes]),
        meeting_topics=", ".join([f"{t[0]} ({t[1]}x)" for t in top_meeting_topics]),
        thread_samples=thread_samples or "No threads",
        meeting_samples=meeting_samples or "No meetings",
    )

    try:
        data = call_llm_json(SYSTEM_PROMPT, prompt, max_tokens=1000)

        return GlobalThemes(
            themes=data.get("themes", []),
            focus_areas=data.get("focus_areas", []),
            time_allocation=data.get("time_allocation", {}),
            snapshot_summary=data.get("snapshot_summary", ""),
            thread_count=len(thread_summaries),
            meeting_count=len(meeting_summaries),
        )

    except Exception as e:
        logger.exception(f"Global theme extraction failed: {e}")
        return GlobalThemes(
            themes=[{"name": t[0], "frequency": "medium", "description": ""} for t in top_thread_themes[:5]],
            focus_areas=[t[0] for t in top_meeting_topics[:5]],
            time_allocation={},
            snapshot_summary="Activity summary unavailable",
            thread_count=len(thread_summaries),
            meeting_count=len(meeting_summaries),
        )
