"""Preflight coverage check for data quality gating."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.core.env import load_settings
from app.services.gmail import count_primary_messages
from app.services.calendar import count_events

settings = load_settings()
logger = logging.getLogger(__name__)

# Minimum thresholds for acceptable data coverage
MIN_PRIMARY_EMAILS = 10  # At least 10 emails in primary inbox
MIN_CALENDAR_EVENTS = 5  # At least 5 calendar events


@dataclass
class PreflightResult:
    """Result of preflight coverage check."""

    passed: bool
    email_count: int
    event_count: int
    failure_reason: str | None = None


async def check_coverage(access_token: str) -> PreflightResult:
    """Check if user has sufficient data for meaningful insights.

    This runs a lightweight count query before starting full ingestion
    to avoid wasting resources on sparse data.
    """
    # Calculate time window (last 90 days)
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=90)

    # Count emails and events in parallel
    email_count = 0
    event_count = 0

    try:
        email_count = await count_primary_messages(access_token)
    except Exception as e:
        logger.warning(f"Failed to count emails during preflight: {e}")

    try:
        event_count = await count_events(access_token, window_start, now)
    except Exception as e:
        logger.warning(f"Failed to count events during preflight: {e}")

    # Check thresholds
    if email_count < MIN_PRIMARY_EMAILS and event_count < MIN_CALENDAR_EVENTS:
        return PreflightResult(
            passed=False,
            email_count=email_count,
            event_count=event_count,
            failure_reason="insufficient_primary_coverage",
        )

    # Passed preflight check
    return PreflightResult(
        passed=True,
        email_count=email_count,
        event_count=event_count,
    )
