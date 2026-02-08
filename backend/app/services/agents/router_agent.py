"""Agent router: LLM-powered command dispatcher for SaturdAI."""

from __future__ import annotations

import logging

from app.services.agents.base import call_llm_json

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are SaturdAI's command router. Given a user's natural language command, determine which action to take.

Available actions:
- summarize_emails: Get a TLDR summary/digest of recent emails
- suggest_replies: Find emails that need replies and suggest responses
- track_subscriptions: Scan for subscriptions and billing information
- summarize_thread: Summarize email conversations/threads
- add_to_calendar: Create a calendar event (extract title, date, time, duration from the command)
- generate_todos: Extract actionable to-do items and tasks from recent emails
- fetch_recent: Fetch and categorize recent emails
- search_emails: Semantic search across emails to find messages about a topic, sentiment, person, or concept

Output JSON:
{
  "action": "<action_name>",
  "parameters": {},
  "confidence": 0.0-1.0,
  "message": "Brief description of what you're about to do"
}

For add_to_calendar, extract these parameters:
{
  "summary": "Event title",
  "date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "description": "optional description"
}

For search_emails, extract these parameters:
{
  "query": "the search query describing what emails to find"
}

If the command is unclear, set confidence < 0.5 and action to "unknown"."""


def route_command(command: str) -> dict:
    """Route a natural language command to an action."""
    try:
        return call_llm_json(SYSTEM_PROMPT, f"User command: {command}", max_tokens=300)
    except Exception:
        logger.exception("Command routing failed")
        return {
            "action": "unknown",
            "parameters": {},
            "confidence": 0.0,
            "message": "I couldn't understand that command.",
        }
