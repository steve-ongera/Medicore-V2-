from django.core.management.base import BaseCommand
from django.db import transaction

from api.models import Department, ConsultationType, VisitStatus, Visit
from inpatient.models import Admission, BedCharge, MedicationAdministration


class Command(BaseCommand):
    help = "One-time backfill: creates a Visit for any Admission missing one, and relinks its existing bed-charge / medication invoices to that visit so they surface in billing."

    def handle(self, *args, **options):
        targets = Admission.objects.filter(visit__isnull=True).select_related("patient", "admitting_doctor", "admitted_by")
        count = targets.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No admissions missing a visit. Nothing to backfill."))
            return

        inpatient_dept, _ = Department.objects.get_or_create(
            name="Inpatient Admission",
            defaults={
                "consultation_fee": 0,
                "description": "Auto-created department for direct inpatient admissions without a prior OPD visit.",
            },
        )

        fixed = 0
        for admission in targets:
            with transaction.atomic():
                visit = Visit.objects.create(
                    patient=admission.patient,
                    department=inpatient_dept,
                    doctor=admission.admitting_doctor,
                    consultation_type=ConsultationType.OTHER,
                    status=VisitStatus.IN_CONSULTATION,
                    registered_by=admission.admitted_by,
                )
                admission.visit = visit
                admission.save(update_fields=["visit"])

                for charge in BedCharge.objects.filter(admission=admission).select_related("invoice"):
                    if charge.invoice and not charge.invoice.visit:
                        charge.invoice.visit = visit
                        charge.invoice.save(update_fields=["visit"])

                for admin_record in MedicationAdministration.objects.filter(
                    medication_order__admission=admission
                ).select_related("invoice"):
                    if admin_record.invoice and not admin_record.invoice.visit:
                        admin_record.invoice.visit = visit
                        admin_record.invoice.save(update_fields=["visit"])

                fixed += 1
                self.stdout.write(f"  + Backfilled visit for {admission.admission_number}")

        self.stdout.write(self.style.SUCCESS(f"Backfilled {fixed}/{count} admission(s)."))