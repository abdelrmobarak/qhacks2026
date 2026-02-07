"""Job scheduler for periodic tasks.

This module sets up scheduled jobs using rq-scheduler.
Run with: rqscheduler --host localhost --port 6379 --db 0
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from redis import Redis
from rq_scheduler import Scheduler

from app.core.env import load_settings

settings = load_settings()
logger = logging.getLogger(__name__)


def get_scheduler() -> Scheduler:
    """Get the RQ scheduler instance."""
    connection = Redis.from_url(settings.redis_url)
    return Scheduler(queue_name=settings.rq_queue_name, connection=connection)


def schedule_cleanup_job(scheduler: Scheduler | None = None) -> None:
    """Schedule the daily cleanup job for expired snapshots.

    This should be called once at application startup or by a management command.
    The job will run daily at 3 AM UTC.
    """
    if scheduler is None:
        scheduler = get_scheduler()

    # Cancel any existing cleanup jobs
    for job in scheduler.get_jobs():
        if job.func_name == "app.jobs.cleanup.cleanup_expired_snapshots":
            scheduler.cancel(job)
            logger.info(f"Cancelled existing cleanup job: {job.id}")

    # Schedule new daily cleanup job
    # Run at 3 AM UTC every day
    job = scheduler.cron(
        "0 3 * * *",  # Cron expression: 3 AM UTC daily
        func="app.jobs.cleanup.cleanup_expired_snapshots",
        queue_name=settings.rq_queue_name,
        use_local_timezone=False,
    )

    logger.info(f"Scheduled daily cleanup job: {job.id}")
    return job


def schedule_all_jobs() -> None:
    """Schedule all periodic jobs.

    Call this at application startup.
    """
    scheduler = get_scheduler()

    # Schedule cleanup job
    schedule_cleanup_job(scheduler)

    logger.info("All scheduled jobs configured")


if __name__ == "__main__":
    # CLI: python -m app.jobs.scheduler
    logging.basicConfig(level=logging.INFO)
    schedule_all_jobs()
    print("Scheduled jobs configured. Run 'rqscheduler' to start the scheduler.")
