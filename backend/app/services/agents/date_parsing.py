"""Flexible date/time parser for LLM-generated and frontend inputs."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

from dateutil.parser import parse as dateutil_parse
from dateutil.parser import ParserError


_WEEKDAY_NAMES = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

_RELATIVE_DAY_PATTERN = re.compile(
    r"^(today|tomorrow|yesterday)(?:\s+at\s+(.+))?$", re.IGNORECASE
)

_NEXT_WEEKDAY_PATTERN = re.compile(
    r"^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)"
    r"(?:\s+at\s+(.+))?$",
    re.IGNORECASE,
)

_IN_DURATION_PATTERN = re.compile(
    r"^in\s+(\d+)\s+(minute|hour|day|week)s?$", re.IGNORECASE
)


def _apply_time_string(base_date: datetime, time_str: str) -> datetime:
    """Parse a time-of-day string and apply it to a date."""
    time_str = time_str.strip()
    try:
        parsed_time = dateutil_parse(time_str)
        return base_date.replace(
            hour=parsed_time.hour,
            minute=parsed_time.minute,
            second=0,
            microsecond=0,
        )
    except (ParserError, ValueError):
        return base_date


def parse_flexible_datetime(
    value: str,
    reference_time: datetime | None = None,
) -> datetime:
    """Parse a datetime string that may be ISO 8601 or natural language.

    Supports:
    - ISO 8601: "2026-02-10T14:00:00Z", "2026-02-10T14:00:00+00:00"
    - Relative days: "today", "tomorrow", "yesterday", "today at 3pm"
    - Next weekday: "next Monday", "next Friday at 10am"
    - Duration: "in 2 hours", "in 30 minutes"
    - Natural dates: "February 10 at 9am", "Feb 10, 2026 3:00 PM"

    Raises ValueError if the string cannot be parsed.
    """
    reference = reference_time or datetime.now(timezone.utc)
    cleaned = value.strip()

    relative_match = _RELATIVE_DAY_PATTERN.match(cleaned)
    if relative_match:
        day_word = relative_match.group(1).lower()
        time_part = relative_match.group(2)

        if day_word == "today":
            base = reference
        elif day_word == "tomorrow":
            base = reference + timedelta(days=1)
        else:
            base = reference - timedelta(days=1)

        base = base.replace(hour=9, minute=0, second=0, microsecond=0)
        if time_part:
            base = _apply_time_string(base, time_part)
        return base

    next_weekday_match = _NEXT_WEEKDAY_PATTERN.match(cleaned)
    if next_weekday_match:
        target_day = _WEEKDAY_NAMES[next_weekday_match.group(1).lower()]
        time_part = next_weekday_match.group(2)
        current_day = reference.weekday()
        days_ahead = (target_day - current_day) % 7
        if days_ahead == 0:
            days_ahead = 7
        base = reference + timedelta(days=days_ahead)
        base = base.replace(hour=9, minute=0, second=0, microsecond=0)
        if time_part:
            base = _apply_time_string(base, time_part)
        return base

    duration_match = _IN_DURATION_PATTERN.match(cleaned)
    if duration_match:
        amount = int(duration_match.group(1))
        unit = duration_match.group(2).lower()
        delta_map = {
            "minute": timedelta(minutes=amount),
            "hour": timedelta(hours=amount),
            "day": timedelta(days=amount),
            "week": timedelta(weeks=amount),
        }
        return reference + delta_map[unit]

    try:
        parsed = dateutil_parse(cleaned)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except (ParserError, ValueError) as parse_error:
        raise ValueError(f"Could not parse datetime: '{value}'") from parse_error
