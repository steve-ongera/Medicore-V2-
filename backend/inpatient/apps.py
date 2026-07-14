import os
import sys

from django.apps import AppConfig
from django.conf import settings


class InpatientConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "inpatient"

    def ready(self):
        # Always register signals, regardless of which manage.py command is running.
        from . import signals  # noqa: F401

        # Only start the background scheduler for the actual serving process —
        # never during migrate/makemigrations/shell/seed_inpatient/etc, and
        # never twice under runserver's autoreloader.
        non_server_commands = {
            "makemigrations", "migrate", "shell", "test", "collectstatic",
            "seed_inpatient", "createsuperuser", "dbshell", "showmigrations",
        }
        if len(sys.argv) > 1 and sys.argv[1] in non_server_commands:
            return

        if os.environ.get("RUN_MAIN") == "true" or not settings.DEBUG:
            from . import scheduler
            scheduler.start()