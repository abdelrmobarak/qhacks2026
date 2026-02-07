from __future__ import annotations

import base64
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from itsdangerous import BadSignature, URLSafeTimedSerializer

from app.core.env import load_settings


def get_fernet() -> Fernet:
    """Get Fernet instance for token encryption."""
    settings = load_settings()
    key = settings.token_encryption_key
    if not key or key == "change-me":
        # Generate a valid key for development if not set
        key = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()
    # Ensure key is properly padded
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception:
        # If key is invalid, generate a new one for development
        key = Fernet.generate_key()
        return Fernet(key)


def encrypt_token(token: str) -> str:
    """Encrypt an OAuth token for storage."""
    f = get_fernet()
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> Optional[str]:
    """Decrypt an OAuth token from storage."""
    try:
        f = get_fernet()
        return f.decrypt(encrypted_token.encode()).decode()
    except InvalidToken:
        return None


def get_serializer(secret: str) -> URLSafeTimedSerializer:
    """Get serializer for session tokens and OAuth state."""
    return URLSafeTimedSerializer(secret)


def create_session_token(session_id: UUID, secret: str) -> str:
    """Create a signed session token."""
    serializer = get_serializer(secret)
    return serializer.dumps(str(session_id))


def verify_session_token(token: str, secret: str, max_age: int) -> Optional[UUID]:
    """Verify and decode a session token."""
    serializer = get_serializer(secret)
    try:
        session_id_str = serializer.loads(token, max_age=max_age)
        return UUID(session_id_str)
    except (BadSignature, ValueError):
        return None


def create_oauth_state(secret: str) -> str:
    """Create a signed OAuth state token."""
    serializer = get_serializer(secret)
    state_data = {
        "nonce": secrets.token_urlsafe(16),
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    return serializer.dumps(state_data)


def verify_oauth_state(state: str, secret: str, max_age: int = 600) -> bool:
    """Verify an OAuth state token (default 10 min expiry)."""
    serializer = get_serializer(secret)
    try:
        serializer.loads(state, max_age=max_age)
        return True
    except BadSignature:
        return False


def generate_session_expiry(days: int = 7) -> datetime:
    """Generate a session expiry datetime."""
    return datetime.now(timezone.utc) + timedelta(days=days)
