from __future__ import annotations

from redis import Redis
from rq import Queue

from app.core.env import load_settings


_queue: Queue | None = None


def get_queue() -> Queue:
    """Get or create the RQ queue instance."""
    global _queue
    if _queue is None:
        settings = load_settings()
        connection = Redis.from_url(settings.redis_url)
        _queue = Queue(name=settings.rq_queue_name, connection=connection)
    return _queue


def build_queue() -> Queue:
    """Build a new queue instance (for worker processes)."""
    settings = load_settings()
    connection = Redis.from_url(settings.redis_url)
    return Queue(name=settings.rq_queue_name, connection=connection)
