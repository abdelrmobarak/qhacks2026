"""Email embedding and semantic search via pgvector + OpenAI embeddings."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID as UUIDType

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.env import load_settings
from app.db.models import EmailEmbedding
from app.services.agents.base import call_llm
from app.services.gmail import fetch_messages, list_messages

settings = load_settings()
logger = logging.getLogger(__name__)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 1536
BATCH_SIZE = 100
MAX_EMAILS_TO_INDEX = 500
SEARCH_TOP_K = 10


def generate_embedding(text_input: str) -> list[float]:
    """Generate a single embedding vector via OpenAI."""
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not configured")

    with httpx.Client(timeout=30) as client:
        response = client.post(
            "https://api.openai.com/v1/embeddings",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": EMBEDDING_MODEL,
                "input": text_input,
            },
        )
        response.raise_for_status()
        return response.json()["data"][0]["embedding"]


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """Generate embeddings for a batch of texts in a single API call."""
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY not configured")

    if not texts:
        return []

    all_embeddings: list[list[float]] = []

    with httpx.Client(timeout=60) as client:
        for offset in range(0, len(texts), BATCH_SIZE):
            batch = texts[offset : offset + BATCH_SIZE]
            response = client.post(
                "https://api.openai.com/v1/embeddings",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": EMBEDDING_MODEL,
                    "input": batch,
                },
            )
            response.raise_for_status()
            data = response.json()["data"]
            sorted_data = sorted(data, key=lambda item: item["index"])
            all_embeddings.extend([item["embedding"] for item in sorted_data])

    return all_embeddings


def _build_embedding_text(
    subject: str | None,
    from_name: str | None,
    from_email: str | None,
    body_preview: str,
) -> str:
    """Build the text string that gets embedded."""
    sender = from_name or from_email or "Unknown"
    parts = []
    if subject:
        parts.append(f"Subject: {subject}")
    parts.append(f"From: {sender}")
    if body_preview:
        parts.append(f"Body: {body_preview[:2000]}")
    return " | ".join(parts)


async def index_emails(
    user_id: UUIDType,
    access_token: str,
    database: AsyncSession,
) -> int:
    """Fetch recent Gmail messages, skip already-indexed, embed and store new ones.

    Returns the number of newly indexed emails.
    """
    message_refs = await list_messages(
        access_token,
        query="in:inbox newer_than:30d",
        max_results=MAX_EMAILS_TO_INDEX,
    )
    gmail_ids = [ref["id"] for ref in message_refs if isinstance(ref, dict) and "id" in ref]
    if not gmail_ids:
        return 0

    existing_result = await database.execute(
        select(EmailEmbedding.gmail_message_id).where(
            EmailEmbedding.user_id == user_id,
            EmailEmbedding.gmail_message_id.in_(gmail_ids),
        )
    )
    already_indexed = set(existing_result.scalars().all())

    new_gmail_ids = [gmail_id for gmail_id in gmail_ids if gmail_id not in already_indexed]
    if not new_gmail_ids:
        return 0

    messages = await fetch_messages(access_token, new_gmail_ids, include_body=True)

    texts_to_embed: list[str] = []
    message_data: list[dict[str, Any]] = []

    for message in messages:
        embedding_text = _build_embedding_text(
            subject=message.subject,
            from_name=message.from_name,
            from_email=message.from_email,
            body_preview=message.body_preview,
        )
        texts_to_embed.append(embedding_text)
        message_data.append({
            "gmail_message_id": message.id,
            "thread_id": message.thread_id,
            "subject": message.subject,
            "from_email": message.from_email,
            "from_name": message.from_name,
            "snippet": message.snippet,
            "body_preview": (message.body_preview or "")[:5000],
            "email_date": message.internal_date,
            "embedding_text": embedding_text,
        })

    if not texts_to_embed:
        return 0

    embeddings = generate_embeddings_batch(texts_to_embed)

    for index, embedding_vector in enumerate(embeddings):
        record = EmailEmbedding(
            user_id=user_id,
            embedding=embedding_vector,
            **message_data[index],
        )
        database.add(record)

    await database.commit()
    logger.info("Indexed %d new emails for user %s", len(embeddings), user_id)
    return len(embeddings)


async def search_emails(
    user_id: UUIDType,
    query: str,
    access_token: str,
    database: AsyncSession,
) -> dict[str, Any]:
    """Index new emails, then perform semantic vector search and synthesize results."""
    newly_indexed = await index_emails(user_id, access_token, database)

    query_embedding = generate_embedding(query)
    embedding_literal = "[" + ",".join(str(value) for value in query_embedding) + "]"

    results = await database.execute(
        text(
            """
            SELECT
                gmail_message_id,
                thread_id,
                subject,
                from_email,
                from_name,
                snippet,
                body_preview,
                email_date,
                embedding <=> :query_vector::vector AS distance
            FROM email_embeddings
            WHERE user_id = :user_id
            ORDER BY embedding <=> :query_vector::vector
            LIMIT :top_k
            """
        ),
        {
            "query_vector": embedding_literal,
            "user_id": str(user_id),
            "top_k": SEARCH_TOP_K,
        },
    )

    rows = results.fetchall()
    email_results = []
    context_parts = []

    for row_index, row in enumerate(rows):
        email_entry = {
            "message_id": row.gmail_message_id,
            "thread_id": row.thread_id,
            "subject": row.subject or "",
            "from_email": row.from_email or "",
            "from_name": row.from_name or "",
            "snippet": row.snippet or "",
            "body_preview": row.body_preview or "",
            "date": row.email_date.isoformat() if row.email_date else "",
            "relevance_score": round(1 - row.distance, 4),
        }
        email_results.append(email_entry)

        context_parts.append(
            f"Email {row_index + 1}:\n"
            f"  Subject: {email_entry['subject']}\n"
            f"  From: {email_entry['from_name'] or email_entry['from_email']}\n"
            f"  Date: {email_entry['date']}\n"
            f"  Preview: {email_entry['body_preview'][:500]}\n"
        )

    if not email_results:
        return {
            "emails": [],
            "summary": "No emails found matching your search.",
            "newly_indexed": newly_indexed,
        }

    synthesis_prompt = (
        f"The user searched their emails for: \"{query}\"\n\n"
        f"Here are the top matching emails:\n\n"
        + "\n".join(context_parts)
        + "\n\nProvide a concise, helpful summary answering the user's query based on these emails. "
        "Mention specific emails, senders, and dates when relevant. "
        "If the results don't seem relevant to the query, say so honestly."
    )

    summary = call_llm(
        system_prompt="You are a helpful email assistant. Summarize search results clearly and concisely.",
        user_prompt=synthesis_prompt,
        max_tokens=500,
    )

    return {
        "emails": email_results,
        "summary": summary,
        "newly_indexed": newly_indexed,
    }
