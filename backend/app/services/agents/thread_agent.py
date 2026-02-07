"""Thread Agent (A): Summarizes email threads.

Input: All messages in a thread
Output: Thread summary with milestones, themes, key participants
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass

from app.services.agents.base import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a thread summarizer. Given a series of email messages from a single thread, extract:
1. A brief summary (1-2 sentences)
2. Key milestones/decisions made in the thread
3. Main themes/topics discussed
4. Key participants and their roles

Be factual and concise. Only include information present in the messages.
Output valid JSON matching the schema provided."""

USER_PROMPT = """Summarize this email thread:

THREAD ID: {thread_id}
SUBJECT: {subject}

MESSAGES (chronological):
{messages}

OUTPUT FORMAT (JSON):
{{
  "summary": "string",
  "milestones": ["string"],
  "themes": ["string"],
  "participants": [
    {{"email": "string", "role": "string"}}
  ],
  "message_count": number,
  "date_range": {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}}
}}"""

BATCH_SYSTEM_PROMPT = """You are a thread summarizer. Given multiple email threads, extract for EACH thread:
1. A brief summary (1-2 sentences)
2. Key milestones/decisions made in the thread
3. Main themes/topics discussed
4. Key participants and their roles

Be factual and concise. Only include information present in the messages.
Output valid JSON matching the schema provided."""

BATCH_USER_PROMPT = """Summarize these email threads.

THREADS (JSON):
{threads_json}

Return exactly one summary per input thread. Use the provided thread_id for each output item.

OUTPUT FORMAT (JSON):
{{
  "threads": [
    {{
      "thread_id": "string",
      "summary": "string",
      "milestones": ["string"],
      "themes": ["string"],
      "participants": [{{"email": "string", "role": "string"}}],
      "message_count": number,
      "date_range": {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}}
    }}
  ]
}}"""


@dataclass
class ThreadSummary:
    thread_id: str
    summary: str
    milestones: list[str]
    themes: list[str]
    participants: list[dict]
    message_count: int
    date_range: dict


async def summarize_thread(
    thread_id: str,
    subject: str,
    messages: list[dict],
    *,
    model: str | None = None,
) -> ThreadSummary:
    """Summarize an email thread.

    Args:
        thread_id: Gmail thread ID
        subject: Thread subject line
        messages: List of message dicts with keys: date, from, preview

    Returns:
        ThreadSummary dataclass
    """
    if not messages:
        return ThreadSummary(
            thread_id=thread_id,
            summary="Empty thread",
            milestones=[],
            themes=[],
            participants=[],
            message_count=0,
            date_range={},
        )

    # Format messages for prompt
    messages_text = "\n\n".join([
        f"[{m.get('date', 'unknown')}] From: {m.get('from', 'unknown')}\n{m.get('preview', '')[:500]}"
        for m in messages[:20]  # Limit to 20 messages
    ])

    prompt = USER_PROMPT.format(
        thread_id=thread_id,
        subject=subject or "(no subject)",
        messages=messages_text,
    )

    try:
        data = await asyncio.to_thread(call_llm_json, SYSTEM_PROMPT, prompt, 800, model=model)

        return ThreadSummary(
            thread_id=thread_id,
            summary=data.get("summary", ""),
            milestones=data.get("milestones", []),
            themes=data.get("themes", []),
            participants=data.get("participants", []),
            message_count=data.get("message_count", len(messages)),
            date_range=data.get("date_range", {}),
        )

    except Exception as e:
        logger.exception(f"Thread summarization failed for {thread_id}: {e}")
        # Return basic summary on failure
        return ThreadSummary(
            thread_id=thread_id,
            summary=f"Email thread with {len(messages)} messages",
            milestones=[],
            themes=[],
            participants=[{"email": m.get("from", "")} for m in messages[:5]],
            message_count=len(messages),
            date_range={},
        )


async def summarize_threads_batch(
    threads: list[dict],
    *,
    model: str | None = None,
) -> list[ThreadSummary]:
    """Summarize multiple email threads in a single LLM call.

    Args:
        threads: List of dicts with keys: thread_id, subject, messages
        model: Optional LLM model override

    Returns:
        List of ThreadSummary in the same order as input.
    """
    if not threads:
        return []

    threads_json = json.dumps(threads, ensure_ascii=False)
    prompt = BATCH_USER_PROMPT.format(threads_json=threads_json)

    try:
        data = await asyncio.to_thread(call_llm_json, BATCH_SYSTEM_PROMPT, prompt, 2200, model=model)
        items = data.get("threads", [])
        if not isinstance(items, list):
            raise ValueError("Expected 'threads' to be a list")

        by_id: dict[str, dict] = {}
        for item in items:
            if not isinstance(item, dict):
                continue
            tid = item.get("thread_id")
            if isinstance(tid, str) and tid.strip():
                by_id[tid] = item

        results: list[ThreadSummary] = []
        for thread in threads:
            tid = str(thread.get("thread_id") or "")
            messages = thread.get("messages", [])
            message_count = len(messages) if isinstance(messages, list) else 0

            item = by_id.get(tid, {})
            raw_message_count = item.get("message_count")
            parsed_message_count = message_count
            if isinstance(raw_message_count, int):
                parsed_message_count = raw_message_count
            elif raw_message_count is not None:
                try:
                    parsed_message_count = int(raw_message_count)
                except Exception:
                    parsed_message_count = message_count

            results.append(
                ThreadSummary(
                    thread_id=tid,
                    summary=str(item.get("summary") or ""),
                    milestones=item.get("milestones", []) if isinstance(item.get("milestones"), list) else [],
                    themes=item.get("themes", []) if isinstance(item.get("themes"), list) else [],
                    participants=item.get("participants", []) if isinstance(item.get("participants"), list) else [],
                    message_count=parsed_message_count,
                    date_range=item.get("date_range", {}) if isinstance(item.get("date_range"), dict) else {},
                )
            )

        return results

    except Exception as e:
        logger.exception("Thread batch summarization failed: %s", e)
        # Fallback to per-thread calls to keep behavior working.
        results: list[ThreadSummary] = []
        for thread in threads:
            tid = str(thread.get("thread_id") or "")
            subject = str(thread.get("subject") or "")
            messages = thread.get("messages", [])
            results.append(
                await summarize_thread(
                    thread_id=tid,
                    subject=subject,
                    messages=messages if isinstance(messages, list) else [],
                    model=model,
                )
            )
        return results
