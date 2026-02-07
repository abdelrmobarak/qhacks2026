from __future__ import annotations

from typing import Annotated, Optional

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.auth import require_current_user
from app.core.env import load_settings
from app.db import get_db
from app.db.models import Artifact, ArtifactType, Entitlement, Entity, EntityKind, Snapshot, SnapshotStatus, User
from app.queue import get_queue
from app.jobs.generate_story import generate_story

router = APIRouter()
settings = load_settings()

# Configure Stripe
if settings.stripe_secret_key:
    stripe.api_key = settings.stripe_secret_key


class CheckoutResponse(BaseModel):
    checkout_url: str


class BillingStatusResponse(BaseModel):
    unlocked_story_count: int
    has_paid: bool


class WebhookResponse(BaseModel):
    received: bool


@router.post("/checkout", response_model=CheckoutResponse)
async def checkout(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> CheckoutResponse:
    """Create a Stripe Checkout session for unlocking more stories."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    # Get user's snapshot
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.user_id == user.id)
        .where(Snapshot.status == SnapshotStatus.done)
        .order_by(Snapshot.created_at.desc())
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        raise HTTPException(status_code=400, detail="No completed snapshot found")

    # Get or create entitlement
    result = await db.execute(
        select(Entitlement).where(Entitlement.snapshot_id == snapshot.id)
    )
    entitlement = result.scalar_one_or_none()

    if entitlement and entitlement.unlocked_story_count >= 5:
        raise HTTPException(status_code=400, detail="All stories already unlocked")

    # Create Stripe checkout session
    frontend_url = settings.cors_origins[0] if settings.cors_origins else "http://localhost:3000"

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price": settings.stripe_price_id,
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=f"{frontend_url}/wrapped?payment=success",
            cancel_url=f"{frontend_url}/wrapped?payment=cancelled",
            customer_email=user.email,
            metadata={
                "snapshot_id": str(snapshot.id),
                "user_id": str(user.id),
            },
        )
    except stripe.StripeError as e:
        raise HTTPException(status_code=500, detail=f"Stripe error: {str(e)}")

    # Store checkout session ID
    if entitlement:
        entitlement.stripe_checkout_session_id = checkout_session.id
    else:
        entitlement = Entitlement(
            snapshot_id=snapshot.id,
            unlocked_story_count=1,
            stripe_checkout_session_id=checkout_session.id,
        )
        db.add(entitlement)

    await db.commit()

    return CheckoutResponse(checkout_url=checkout_session.url)


@router.post("/webhook", response_model=WebhookResponse)
async def webhook(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> WebhookResponse:
    """Handle Stripe webhook events."""
    if not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook not configured")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle checkout.session.completed
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]

        snapshot_id = session.get("metadata", {}).get("snapshot_id")
        if not snapshot_id:
            return WebhookResponse(received=True)

        # Idempotency check
        result = await db.execute(
            select(Entitlement).where(Entitlement.stripe_event_id == event["id"])
        )
        if result.scalar_one_or_none():
            return WebhookResponse(received=True)

        # Get entitlement
        from uuid import UUID

        result = await db.execute(
            select(Entitlement).where(Entitlement.snapshot_id == UUID(snapshot_id))
        )
        entitlement = result.scalar_one_or_none()

        if entitlement:
            # Update entitlement
            entitlement.unlocked_story_count = 5  # Unlock all stories
            entitlement.stripe_customer_id = session.get("customer")
            entitlement.stripe_event_id = event["id"]
            await db.commit()

            # Get top entities that need stories generated
            result = await db.execute(
                select(Entity)
                .where(Entity.snapshot_id == UUID(snapshot_id))
                .where(Entity.kind == EntityKind.person)
                .order_by(Entity.score.desc())
                .limit(5)
            )
            entities = result.scalars().all()

            # Check which entities already have stories
            result = await db.execute(
                select(Artifact)
                .where(Artifact.snapshot_id == UUID(snapshot_id))
                .where(Artifact.type == ArtifactType.story_text)
            )
            existing_stories = result.scalars().all()
            existing_keys = {a.key for a in existing_stories}

            # Enqueue story generation jobs for entities without stories
            queue = get_queue()
            for entity in entities:
                story_key = f"entity:{entity.id}:story"
                if story_key not in existing_keys:
                    queue.enqueue(
                        generate_story,
                        snapshot_id,
                        str(entity.id),
                        job_id=f"story:{snapshot_id}:{entity.id}",
                        job_timeout=300,  # 5 minute timeout per story
                    )

    return WebhookResponse(received=True)


@router.get("/status", response_model=BillingStatusResponse)
async def billing_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_current_user)],
) -> BillingStatusResponse:
    """Get the user's billing status."""
    # Get user's snapshot
    result = await db.execute(
        select(Snapshot)
        .where(Snapshot.user_id == user.id)
        .where(Snapshot.status == SnapshotStatus.done)
        .order_by(Snapshot.created_at.desc())
    )
    snapshot = result.scalar_one_or_none()

    if not snapshot:
        return BillingStatusResponse(unlocked_story_count=0, has_paid=False)

    # Get entitlement
    result = await db.execute(
        select(Entitlement).where(Entitlement.snapshot_id == snapshot.id)
    )
    entitlement = result.scalar_one_or_none()

    if not entitlement:
        return BillingStatusResponse(unlocked_story_count=1, has_paid=False)

    return BillingStatusResponse(
        unlocked_story_count=entitlement.unlocked_story_count,
        has_paid=entitlement.unlocked_story_count > 1,
    )
