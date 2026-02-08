"""Rate limiting middleware using Redis."""
from __future__ import annotations

import logging
import time
from typing import Callable

from fastapi import Request, Response
from redis import Redis
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.env import load_settings

settings = load_settings()
logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple rate limiting middleware using Redis sliding window."""

    def __init__(
        self,
        app,
        requests_per_minute: int = 60,
        requests_per_hour: int = 1000,
    ):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour
        self._redis: Redis | None = None

    @property
    def redis(self) -> Redis | None:
        """Lazy load Redis connection."""
        if self._redis is None:
            try:
                self._redis = Redis.from_url(settings.redis_url)
                self._redis.ping()
            except Exception as e:
                logger.warning(f"Redis not available for rate limiting: {e}")
                self._redis = None
        return self._redis

    def _get_client_id(self, request: Request) -> str:
        """Get client identifier for rate limiting."""
        # Try to get session cookie first (authenticated user)
        session_cookie = request.cookies.get("sandbox_session")
        if session_cookie:
            return f"session:{session_cookie[:32]}"

        # Fall back to IP address
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"

        return f"ip:{ip}"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Check rate limits before processing request."""
        # Skip rate limiting if Redis is not available
        redis = self.redis
        if redis is None:
            return await call_next(request)

        if request.method == "OPTIONS":
            return await call_next(request)

        if request.url.path in ("/health", "/", "/docs", "/openapi.json"):
            return await call_next(request)

        client_id = self._get_client_id(request)
        now = time.time()

        # Check minute limit
        minute_key = f"ratelimit:minute:{client_id}"
        minute_count = self._increment_window(redis, minute_key, 60, now)

        if minute_count > self.requests_per_minute:
            return self._rate_limit_response(
                "minute", self.requests_per_minute, minute_count
            )

        # Check hour limit
        hour_key = f"ratelimit:hour:{client_id}"
        hour_count = self._increment_window(redis, hour_key, 3600, now)

        if hour_count > self.requests_per_hour:
            return self._rate_limit_response(
                "hour", self.requests_per_hour, hour_count
            )

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        response.headers["X-RateLimit-Limit-Minute"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining-Minute"] = str(
            max(0, self.requests_per_minute - minute_count)
        )
        response.headers["X-RateLimit-Limit-Hour"] = str(self.requests_per_hour)
        response.headers["X-RateLimit-Remaining-Hour"] = str(
            max(0, self.requests_per_hour - hour_count)
        )

        return response

    def _increment_window(
        self, redis: Redis, key: str, window_seconds: int, now: float
    ) -> int:
        """Increment sliding window counter and return current count."""
        # Use Redis sorted set for sliding window
        window_start = now - window_seconds

        # Remove expired entries and add current request
        pipeline = redis.pipeline()
        pipeline.zremrangebyscore(key, 0, window_start)
        pipeline.zadd(key, {str(now): now})
        pipeline.zcard(key)
        pipeline.expire(key, window_seconds + 1)
        results = pipeline.execute()

        return results[2]  # zcard result

    def _rate_limit_response(
        self, window: str, limit: int, current: int
    ) -> Response:
        """Create rate limit exceeded response."""
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=429,
            content={
                "detail": f"Rate limit exceeded. Maximum {limit} requests per {window}.",
                "limit": limit,
                "current": current,
                "window": window,
            },
            headers={
                "Retry-After": "60" if window == "minute" else "3600",
            },
        )


def create_rate_limiter(
    requests_per_minute: int = 60,
    requests_per_hour: int = 1000,
) -> Callable:
    """Factory function to create rate limit middleware with custom limits."""

    def middleware(app):
        return RateLimitMiddleware(
            app,
            requests_per_minute=requests_per_minute,
            requests_per_hour=requests_per_hour,
        )

    return middleware
