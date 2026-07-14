from django.core.management.base import BaseCommand

from inpatient.services import generate_daily_bed_charges


class Command(BaseCommand):
    help = "Generates today's bed charges (+ invoices) for every currently admitted patient. Run once daily via cron / Windows Task Scheduler."

    def handle(self, *args, **options):
        created = generate_daily_bed_charges()
        if created:
            self.stdout.write(self.style.SUCCESS(f"Generated {len(created)} bed charge(s)."))
        else:
            self.stdout.write("No new bed charges needed — all active admissions already charged for today.")