"""
Lightweight in-process scheduler for inpatient billing automation.

Runs inside the same process as the Django server using APScheduler's
BackgroundScheduler — no external cron or OS task scheduler required.

Job: generate_daily_bed_charges — fires once immediately on server startup
(catches admissions from before the server was last restarted, missed days,
etc.) and then every 24 hours after that, for as long as the server runs.

The manual "Generate Today's Charges" button (BedChargeViewSet.generate_today)
still exists as a fallback/manual override — this scheduler just means nobody
has to remember to click it.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

_scheduler = None


def _run_bed_charges_job():
    from .services import generate_daily_bed_charges
    try:
        created = generate_daily_bed_charges()
        if created:
            logger.info("Auto-generated %d bed charge(s).", len(created))
    except Exception:
        logger.exception("Scheduled bed charge generation failed.")


def start():
    global _scheduler
    if _scheduler is not None:
        return  # already running in this process

    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        _run_bed_charges_job,
        trigger=IntervalTrigger(hours=24),
        id="generate_daily_bed_charges",
        replace_existing=True,
    )
    _scheduler.start()

    # Fire once immediately on startup too, so today's charges exist as soon
    # as the server comes up — covers restarts and missed cycles without
    # waiting up to 24h for the next scheduled run.
    _run_bed_charges_job()

    logger.info("Inpatient background scheduler started (bed charges every 24h).")