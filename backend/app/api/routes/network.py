"""Network graph endpoint: fetches emails from Gmail and computes a relationship graph."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Annotated, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.db import get_db
from app.db.models import User
from app.services.agents.base import call_llm_json
from app.services.gmail import fetch_messages, list_messages
from app.services.token_manager import get_valid_access_token

router = APIRouter()
logger = logging.getLogger(__name__)


class GraphNode(BaseModel):
    id: str
    name: str
    email: str
    type: str
    email_count: int
    thread_count: int
    domain: Optional[str] = None
    description: Optional[str] = None


class GraphEdge(BaseModel):
    source: str
    target: str
    weight: int


class GraphResponse(BaseModel):
    status: str
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    total_emails: int = 0


def _generate_descriptions(
    contacts: list[dict],
    contact_subjects: dict[str, list[str]],
) -> dict[str, str]:
    """Use LLM to generate a one-line description for each contact."""
    contact_summaries = []
    for contact in contacts:
        email = contact["email"]
        subjects = contact_subjects.get(email, [])
        unique_subjects = list(dict.fromkeys(subjects))[:10]
        subject_text = "; ".join(unique_subjects) if unique_subjects else "No subjects"
        contact_summaries.append(
            f"- {contact['name']} ({email}): {subject_text}"
        )

    prompt = (
        "For each contact below, write a short one-sentence description of "
        "what your relationship/interactions are about based on the email subjects.\n"
        "Keep each description under 15 words. Be specific, not generic.\n\n"
        + "\n".join(contact_summaries)
        + "\n\nReturn JSON: {\"descriptions\": {\"email@example.com\": \"description\", ...}}"
    )

    try:
        result = call_llm_json(
            system_prompt="You summarize email relationships concisely.",
            user_prompt=prompt,
            max_tokens=2000,
        )
        return result.get("descriptions", {})
    except Exception as description_error:
        logger.warning("Failed to generate contact descriptions: %s", description_error)
        return {}


def _build_graph(user: User, messages: list) -> GraphResponse:
    """Build graph nodes and edges from a list of GmailMessage objects."""
    if not messages:
        return GraphResponse(status="empty", total_emails=0)

    contact_emails: dict[str, dict] = {}
    contact_subjects: dict[str, list[str]] = defaultdict(list)
    thread_participants: dict[str, set[str]] = defaultdict(set)
    user_email_lower = user.email.lower()

    def _register_contact(email_address: str, name: str | None, message) -> None:
        if email_address not in contact_emails:
            contact_emails[email_address] = {
                "name": name or email_address.split("@")[0],
                "email": email_address,
                "email_count": 0,
                "threads": set(),
                "domain": email_address.split("@")[1] if "@" in email_address else None,
            }
        contact_emails[email_address]["email_count"] += 1
        if message.subject:
            contact_subjects[email_address].append(message.subject)
        if message.thread_id:
            contact_emails[email_address]["threads"].add(message.thread_id)

    for message in messages:
        people_in_message: set[str] = set()

        if message.from_email:
            from_normalized = message.from_email.strip().lower()
            if from_normalized != user_email_lower:
                _register_contact(from_normalized, message.from_name, message)
                people_in_message.add(from_normalized)

        for recipient in message.to_emails + message.cc_emails:
            recipient_email = (recipient.get("email") or "").strip().lower()
            if not recipient_email or recipient_email == user_email_lower:
                continue
            _register_contact(recipient_email, recipient.get("name"), message)
            people_in_message.add(recipient_email)

        if message.thread_id:
            for person_email in people_in_message:
                thread_participants[message.thread_id].add(person_email)

    sorted_contacts = sorted(
        contact_emails.values(),
        key=lambda contact: contact["email_count"],
        reverse=True,
    )[:30]

    descriptions = _generate_descriptions(sorted_contacts, contact_subjects)

    top_contact_emails = {contact["email"] for contact in sorted_contacts}

    nodes: list[GraphNode] = [
        GraphNode(
            id="you",
            name=user.name or "You",
            email=user.email,
            type="you",
            email_count=len(messages),
            thread_count=len(thread_participants),
        )
    ]

    for contact in sorted_contacts:
        nodes.append(
            GraphNode(
                id=contact["email"],
                name=contact["name"],
                email=contact["email"],
                type="person",
                email_count=contact["email_count"],
                thread_count=len(contact["threads"]),
                domain=contact["domain"],
                description=descriptions.get(contact["email"]),
            )
        )

    edges: list[GraphEdge] = []
    edge_weights: dict[tuple[str, str], int] = defaultdict(int)

    for _thread_id, participants in thread_participants.items():
        relevant_participants = participants & top_contact_emails
        participant_list = sorted(relevant_participants)
        for participant_index in range(len(participant_list)):
            for other_index in range(participant_index + 1, len(participant_list)):
                pair = (participant_list[participant_index], participant_list[other_index])
                edge_weights[pair] += 1

    for (source_email, target_email), weight in edge_weights.items():
        if weight >= 1:
            edges.append(GraphEdge(source=source_email, target=target_email, weight=weight))

    for contact in sorted_contacts:
        edges.append(
            GraphEdge(
                source="you",
                target=contact["email"],
                weight=contact["email_count"],
            )
        )

    return GraphResponse(
        status="ready",
        nodes=nodes,
        edges=edges,
        total_emails=len(messages),
    )


@router.get("/graph", response_model=GraphResponse)
async def network_graph(
    database: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> GraphResponse:
    """Fetch recent emails from Gmail and compute a relationship graph."""
    access_token = await get_valid_access_token(user, database)

    message_refs = await list_messages(
        access_token,
        query="in:anywhere",
        max_results=2000,
    )
    message_ids = [
        ref["id"] for ref in message_refs if isinstance(ref, dict) and "id" in ref
    ]

    if not message_ids:
        return GraphResponse(status="empty", total_emails=0)

    messages = await fetch_messages(access_token, message_ids, include_body=False)

    return await asyncio.to_thread(_build_graph, user, messages)
