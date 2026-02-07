"""Email intelligence agent for categorization, reply generation, TLDR digests, and subscription detection."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from app.services.agents.base import call_llm_json, call_llm

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Email categorization
# ---------------------------------------------------------------------------

CATEGORIZE_SYSTEM_PROMPT = """You are an email triage assistant. Given a list of emails, categorize each one.

Categories:
- needs_reply: Emails that require a human response (questions, requests, invitations)
- meeting_related: Meeting invitations, scheduling, calendar updates
- urgent: Time-sensitive or high-priority items
- newsletter: Newsletters, digests, content updates
- subscription: Subscription confirmations, billing, invoices, receipts, renewals
- informational: FYI emails, notifications, automated updates that need no action

For each email, output:
- message_id: the original message ID
- category: one of the categories above
- priority: 1 (highest) to 5 (lowest)
- reason: brief explanation of why this category

Output JSON: {"emails": [{"message_id": "...", "category": "...", "priority": 1, "reason": "..."}]}"""


def categorize_emails(emails: list[dict]) -> list[dict]:
    """Categorize a list of emails using LLM. Returns augmented email dicts."""
    if not emails:
        return []

    email_summaries = []
    for e in emails[:30]:  # Limit to 30 for token budget
        email_summaries.append({
            "message_id": e.get("message_id", ""),
            "subject": e.get("subject", ""),
            "from": e.get("from_email", ""),
            "from_name": e.get("from_name", ""),
            "snippet": e.get("snippet", "")[:200],
            "date": e.get("date", ""),
        })

    user_prompt = f"Categorize these emails:\n{json.dumps(email_summaries, indent=2)}"

    try:
        result = call_llm_json(CATEGORIZE_SYSTEM_PROMPT, user_prompt, max_tokens=2000)
        categories = {
            item["message_id"]: item
            for item in result.get("emails", [])
            if isinstance(item, dict) and "message_id" in item
        }
    except Exception:
        logger.exception("Email categorization failed")
        categories = {}

    # Merge categories back into original email dicts
    output = []
    for e in emails:
        mid = e.get("message_id", "")
        cat = categories.get(mid, {})
        output.append({
            **e,
            "category": cat.get("category", "informational"),
            "priority": cat.get("priority", 5),
            "category_reason": cat.get("reason", ""),
        })

    return output


# ---------------------------------------------------------------------------
# Reply generation
# ---------------------------------------------------------------------------

REPLY_SYSTEM_PROMPT = """You are a professional email reply assistant. Given an email, draft a concise, polite reply.

Rules:
- Match the tone of the original email (formal/casual)
- Be helpful and direct
- If it's a meeting request, confirm or suggest alternatives
- Keep it under 150 words

Output JSON: {"subject": "Re: ...", "body": "...", "tone": "formal|casual|friendly"}"""


def generate_reply(email_data: dict, user_name: str = "") -> dict:
    """Generate a reply suggestion for an email."""
    user_prompt = (
        f"Original email:\n"
        f"From: {email_data.get('from_name', '')} <{email_data.get('from_email', '')}>\n"
        f"Subject: {email_data.get('subject', '')}\n"
        f"Date: {email_data.get('date', '')}\n"
        f"Body:\n{email_data.get('body_preview', email_data.get('snippet', ''))}\n\n"
        f"Reply as: {user_name or 'the user'}"
    )

    try:
        return call_llm_json(REPLY_SYSTEM_PROMPT, user_prompt, max_tokens=500)
    except Exception:
        logger.exception("Reply generation failed")
        return {"subject": f"Re: {email_data.get('subject', '')}", "body": "", "tone": "formal"}


# ---------------------------------------------------------------------------
# TLDR digest
# ---------------------------------------------------------------------------

TLDR_SYSTEM_PROMPT = """You are a newsletter digest assistant. Given a list of important emails from the past few days, create a TLDR digest.

Output JSON:
{
  "summary": "1-2 sentence overview of the inbox",
  "highlights": [
    {
      "subject": "email subject",
      "from": "sender name or email",
      "gist": "1 sentence summary of the email",
      "action_needed": true/false
    }
  ]
}

Focus on the most important and actionable emails. Skip automated notifications and spam.
Limit to the top 10 most important highlights."""


def create_tldr_digest(emails: list[dict]) -> dict:
    """Create a TLDR digest from a list of emails."""
    if not emails:
        return {"summary": "No emails to summarize.", "highlights": []}

    email_summaries = []
    for e in emails[:40]:
        email_summaries.append({
            "subject": e.get("subject", ""),
            "from": e.get("from_name") or e.get("from_email", ""),
            "snippet": e.get("snippet", "")[:300],
            "date": e.get("date", ""),
            "body_preview": (e.get("body_preview", "") or "")[:500],
        })

    user_prompt = f"Create a TLDR digest for these recent emails:\n{json.dumps(email_summaries, indent=2)}"

    try:
        return call_llm_json(TLDR_SYSTEM_PROMPT, user_prompt, max_tokens=2000)
    except Exception:
        logger.exception("TLDR digest creation failed")
        return {"summary": "Failed to generate digest.", "highlights": []}


# ---------------------------------------------------------------------------
# Subscription / bill detection
# ---------------------------------------------------------------------------

SUBSCRIPTION_SYSTEM_PROMPT = """You are a subscription and billing tracker. Given emails related to subscriptions, invoices, and billing, extract structured data about each subscription or bill.

Output JSON:
{
  "subscriptions": [
    {
      "service_name": "Netflix",
      "amount": "15.99",
      "currency": "USD",
      "renewal_date": "2026-03-01",
      "frequency": "monthly",
      "status": "active",
      "source_subject": "Your Netflix receipt"
    }
  ]
}

Rules:
- Extract exact amounts when visible in the email
- Estimate renewal dates based on billing frequency
- If unsure about a field, use null
- Deduplicate services (only list each service once with the latest info)"""


# ---------------------------------------------------------------------------
# Todo extraction from emails
# ---------------------------------------------------------------------------

TODOS_SYSTEM_PROMPT = """You are a task extraction assistant. Given a list of recent emails, extract actionable to-do items.

Look for:
- Direct requests or asks from people
- Deadlines and due dates mentioned
- Meeting follow-ups or action items
- Bills to pay or forms to fill
- RSVPs or confirmations needed
- Tasks implied by the email context

Output JSON:
{
  "todos": [
    {
      "text": "Clear, actionable task description",
      "source": "From: sender - Subject: email subject",
      "message_id": "the message_id of the source email",
      "priority": 1-5,
      "deadline": "YYYY-MM-DD or null"
    }
  ]
}

Rules:
- Only include genuinely actionable items (not FYI or newsletters)
- Write tasks as clear imperatives (e.g. "Reply to John about budget approval")
- Sort by priority (1 = most urgent)
- Limit to 15 most important tasks
- If no actionable items exist, return an empty todos array"""


def extract_todos(emails: list[dict]) -> dict:
    """Extract actionable to-do items from emails."""
    if not emails:
        return {"todos": []}

    email_summaries = []
    for email_item in emails[:40]:
        email_summaries.append({
            "message_id": email_item.get("message_id", ""),
            "subject": email_item.get("subject", ""),
            "from": email_item.get("from_name") or email_item.get("from_email", ""),
            "snippet": email_item.get("snippet", "")[:300],
            "date": email_item.get("date", ""),
            "body_preview": (email_item.get("body_preview", "") or "")[:500],
        })

    user_prompt = f"Extract actionable to-do items from these recent emails:\n{json.dumps(email_summaries, indent=2)}"

    try:
        result = call_llm_json(TODOS_SYSTEM_PROMPT, user_prompt, max_tokens=2000)
        todos = result.get("todos", [])
        for todo_item in todos:
            message_id = todo_item.get("message_id")
            if message_id:
                todo_item["link"] = f"https://mail.google.com/mail/u/0/#inbox/{message_id}"
        return {"todos": todos}
    except Exception:
        logger.exception("Todo extraction failed")
        return {"todos": []}


def detect_subscriptions(emails: list[dict]) -> list[dict]:
    """Detect subscriptions and billing from emails."""
    if not emails:
        return []

    email_summaries = []
    for e in emails[:50]:
        email_summaries.append({
            "subject": e.get("subject", ""),
            "from": e.get("from_name") or e.get("from_email", ""),
            "snippet": e.get("snippet", "")[:300],
            "date": e.get("date", ""),
            "body_preview": (e.get("body_preview", "") or "")[:800],
        })

    user_prompt = f"Extract subscriptions and bills from these emails:\n{json.dumps(email_summaries, indent=2)}"

    try:
        result = call_llm_json(SUBSCRIPTION_SYSTEM_PROMPT, user_prompt, max_tokens=2000)
        return result.get("subscriptions", [])
    except Exception:
        logger.exception("Subscription detection failed")
        return []
