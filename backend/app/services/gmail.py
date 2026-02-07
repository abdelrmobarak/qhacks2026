from __future__ import annotations

import asyncio
import base64
import email
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

from app.core.env import load_settings

settings = load_settings()

# Patterns for noise detection
AUTOMATED_SENDER_PATTERNS = [
    r"^no[-_]?reply",
    r"^noreply",
    r"^do[-_]?not[-_]?reply",
    r"^donotreply",
    r"^notifications?",
    r"^updates?",
    r"^alerts?",
    r"^mailer[-_]?daemon",
    r"^postmaster",
    r"^bounce",
    r"^daemon",
    r"^auto[-_]?confirm",
    r"^auto[-_]?reply",
]

AUTOMATED_SENDER_REGEX = re.compile(
    "|".join(AUTOMATED_SENDER_PATTERNS), re.IGNORECASE
)


@dataclass
class GmailMessage:
    id: str
    thread_id: str
    internal_date: datetime
    subject: Optional[str]
    snippet: str
    from_email: Optional[str]
    from_name: Optional[str]
    to_emails: list[dict]
    cc_emails: list[dict]
    body_preview: str
    has_list_unsubscribe: bool
    has_list_id: bool
    is_automated_sender: bool
    recipient_count: int
    raw_headers: dict


def is_automated_sender(email_address: str) -> bool:
    """Check if an email address looks like an automated sender."""
    if not email_address:
        return False
    local_part = email_address.split("@")[0].lower()
    return bool(AUTOMATED_SENDER_REGEX.match(local_part))


def parse_email_address(addr: str) -> dict:
    """Parse an email address string into name and email parts."""
    if not addr:
        return {"email": "", "name": ""}

    # Try to match "Name <email@domain.com>" format
    match = re.match(r'^"?([^"<]*)"?\s*<([^>]+)>$', addr.strip())
    if match:
        return {"name": match.group(1).strip(), "email": match.group(2).strip().lower()}

    # Just an email address
    return {"email": addr.strip().lower(), "name": ""}


def parse_address_list(header_value: str) -> list[dict]:
    """Parse a comma-separated list of email addresses."""
    if not header_value:
        return []

    addresses = []
    # Split on comma but not inside quotes or angle brackets
    parts = re.split(r",\s*(?=(?:[^<]*<[^>]*>)*[^<]*$)", header_value)
    for part in parts:
        parsed = parse_email_address(part.strip())
        if parsed.get("email"):
            addresses.append(parsed)
    return addresses


def extract_body_text(payload: dict) -> str:
    """Extract plain text body from message payload."""
    body_parts = []

    def extract_from_parts(parts: list) -> None:
        for part in parts:
            mime_type = part.get("mimeType", "")
            if mime_type == "text/plain":
                body_data = part.get("body", {}).get("data", "")
                if body_data:
                    decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="ignore")
                    body_parts.append(decoded)
            elif "parts" in part:
                extract_from_parts(part["parts"])

    if "parts" in payload:
        extract_from_parts(payload["parts"])
    elif payload.get("mimeType") == "text/plain":
        body_data = payload.get("body", {}).get("data", "")
        if body_data:
            decoded = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="ignore")
            body_parts.append(decoded)

    return "\n".join(body_parts)


def clean_body_text(text: str, max_length: int = 30000) -> str:
    """Clean body text by removing quoted content and signatures."""
    lines = text.split("\n")
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()
        # Skip common quote indicators
        if stripped.startswith(">"):
            continue
        if re.match(r"^On .+ wrote:$", stripped):
            break
        if re.match(r"^-{3,}.*Original Message.*-{3,}$", stripped, re.IGNORECASE):
            break
        if re.match(r"^_{3,}$", stripped):
            break
        # Stop at signature indicators
        if stripped == "--":
            break
        cleaned_lines.append(line)

    result = "\n".join(cleaned_lines).strip()
    return result[:max_length]


def get_header_value(headers: list, name: str) -> Optional[str]:
    """Get a header value by name."""
    for header in headers:
        if header.get("name", "").lower() == name.lower():
            return header.get("value")
    return None


def has_header(headers: list, name: str) -> bool:
    """Check if a header exists."""
    return any(h.get("name", "").lower() == name.lower() for h in headers)


def build_gmail_service(access_token: str) -> Any:
    """Build a Gmail API service object."""
    credentials = Credentials(token=access_token)
    return build("gmail", "v1", credentials=credentials)

_GMAIL_METADATA_HEADERS = [
    "From",
    "To",
    "Cc",
    "Subject",
    "Date",
    "Message-ID",
    "Precedence",
    "List-Unsubscribe",
    "List-Id",
]

_GMAIL_MESSAGE_FIELDS = "id,threadId,internalDate,snippet,payload(headers)"


async def list_messages(
    access_token: str,
    query: str = "in:inbox newer_than:90d",
    max_results: int = 10000,
) -> list[dict]:
    """List message IDs matching a query."""
    service = build_gmail_service(access_token)

    def run_list() -> list[dict]:
        messages: list[dict] = []
        page_token: str | None = None

        while len(messages) < max_results:
            results = (
                service.users()
                .messages()
                .list(
                    userId="me",
                    q=query,
                    maxResults=min(500, max_results - len(messages)),
                    pageToken=page_token,
                )
                .execute()
            )

            batch_messages = results.get("messages", [])
            messages.extend(batch_messages)

            page_token = results.get("nextPageToken")
            if not page_token:
                break

        return messages[:max_results]

    return await asyncio.to_thread(run_list)


async def estimate_message_count(
    access_token: str,
    query: str = "in:inbox newer_than:90d",
) -> int:
    """Fast estimate of how many messages match a query."""
    service = build_gmail_service(access_token)

    def run_estimate() -> int:
        try:
            results = (
                service.users()
                .messages()
                .list(userId="me", q=query, maxResults=1)
                .execute()
            )
            estimate = results.get("resultSizeEstimate")
            return int(estimate) if isinstance(estimate, int) else 0
        except Exception:
            return 0

    return await asyncio.to_thread(run_estimate)


def _parse_gmail_message(
    *,
    msg: dict,
    include_body: bool,
) -> Optional[GmailMessage]:
    headers = msg.get("payload", {}).get("headers", [])

    from_header = get_header_value(headers, "From") or ""
    from_parsed = parse_email_address(from_header)

    to_header = get_header_value(headers, "To") or ""
    to_emails = parse_address_list(to_header)

    cc_header = get_header_value(headers, "Cc") or ""
    cc_emails = parse_address_list(cc_header)

    subject = get_header_value(headers, "Subject")
    snippet = msg.get("snippet", "") or ""

    body_preview = snippet
    if include_body:
        body_text = extract_body_text(msg.get("payload", {}))
        body_preview = clean_body_text(body_text)

    has_list_unsub = has_header(headers, "List-Unsubscribe")
    has_list_id_header = has_header(headers, "List-Id")
    precedence = get_header_value(headers, "Precedence") or ""

    recipient_count = len(to_emails) + len(cc_emails)

    try:
        internal_date = datetime.fromtimestamp(
            int(msg["internalDate"]) / 1000, tz=timezone.utc
        )
    except Exception:
        internal_date = datetime.now(timezone.utc)

    message_id = msg.get("id")
    thread_id = msg.get("threadId")
    if not isinstance(message_id, str) or not isinstance(thread_id, str):
        return None

    return GmailMessage(
        id=message_id,
        thread_id=thread_id,
        internal_date=internal_date,
        subject=subject,
        snippet=snippet,
        from_email=from_parsed.get("email"),
        from_name=from_parsed.get("name"),
        to_emails=to_emails,
        cc_emails=cc_emails,
        body_preview=body_preview,
        has_list_unsubscribe=has_list_unsub,
        has_list_id=has_list_id_header,
        is_automated_sender=is_automated_sender(from_parsed.get("email", "")),
        recipient_count=recipient_count,
        raw_headers={
            "from": from_header,
            "to": to_header,
            "cc": cc_header,
            "subject": subject,
            "date": get_header_value(headers, "Date"),
            "message_id": get_header_value(headers, "Message-ID"),
            "precedence": precedence,
        },
    )


async def fetch_message(
    access_token: str,
    message_id: str,
    *,
    include_body: bool = False,
    service: Any | None = None,
) -> Optional[GmailMessage]:
    """Fetch message details.

    Defaults to metadata-only fetch for speed (snippet + headers). Set include_body=True
    if you need the cleaned plain-text body preview.
    """
    resolved_service = service or build_gmail_service(access_token)

    def run_get() -> Optional[dict]:
        request_kwargs: dict[str, Any] = {
            "userId": "me",
            "id": message_id,
        }
        if include_body:
            request_kwargs["format"] = "full"
        else:
            request_kwargs["format"] = "metadata"
            request_kwargs["metadataHeaders"] = list(_GMAIL_METADATA_HEADERS)
        request_kwargs["fields"] = _GMAIL_MESSAGE_FIELDS

        try:
            return resolved_service.users().messages().get(**request_kwargs).execute()
        except Exception:
            return None

    msg = await asyncio.to_thread(run_get)
    if not isinstance(msg, dict):
        return None
    return _parse_gmail_message(msg=msg, include_body=include_body)


async def fetch_messages(
    access_token: str,
    message_ids: list[str],
    *,
    include_body: bool = False,
    batch_size: int = 50,
) -> list[GmailMessage]:
    """Fetch many messages efficiently using Gmail batch requests."""
    if not message_ids:
        return []

    resolved_batch_size = max(1, min(100, batch_size))
    service = build_gmail_service(access_token)

    def run_batch_fetch() -> list[GmailMessage]:
        messages: list[GmailMessage] = []

        def callback(
            request_id: str,
            response: dict | None,
            exception: Exception | None,
        ) -> None:
            if exception is not None or not isinstance(response, dict):
                return
            parsed = _parse_gmail_message(msg=response, include_body=include_body)
            if parsed is not None:
                messages.append(parsed)

        for offset in range(0, len(message_ids), resolved_batch_size):
            chunk_ids = message_ids[offset : offset + resolved_batch_size]
            batch = service.new_batch_http_request()
            for chunk_message_id in chunk_ids:
                request_kwargs: dict[str, Any] = {"userId": "me", "id": chunk_message_id}
                if include_body:
                    request_kwargs["format"] = "full"
                else:
                    request_kwargs["format"] = "metadata"
                    request_kwargs["metadataHeaders"] = list(_GMAIL_METADATA_HEADERS)
                request_kwargs["fields"] = _GMAIL_MESSAGE_FIELDS

                batch.add(
                    service.users().messages().get(**request_kwargs),
                    callback=callback,
                )
            batch.execute()

        return messages

    return await asyncio.to_thread(run_batch_fetch)


async def count_primary_messages(access_token: str) -> int:
    """Count inbox messages in the last 90 days (for preflight check)."""
    service = build_gmail_service(access_token)

    try:
        results = (
            service.users()
            .messages()
            .list(
                userId="me",
                q="in:inbox newer_than:90d",
                maxResults=1,
            )
            .execute()
        )
        return results.get("resultSizeEstimate", 0)
    except Exception:
        return 0
