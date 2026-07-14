from datetime import date

from api.models import Invoice, InvoiceSourceType
from .models import Admission, AdmissionStatus, BedCharge


def generate_daily_bed_charges(for_date=None):
    """
    Creates today's (or a given date's) bed charge + Invoice for every
    currently admitted patient who doesn't already have one for that date.
    Idempotent — safe to run multiple times a day (unique_together on
    Admission+charge_date prevents duplicates).

    Used by:
      - BedChargeViewSet.generate_today (manual button on frontend)
      - management command generate_bed_charges (cron / Task Scheduler)
    """
    charge_date = for_date or date.today()
    created = []

    active_admissions = (
        Admission.objects.filter(status=AdmissionStatus.ADMITTED)
        .select_related("bed__ward", "patient", "visit")
    )

    for admission in active_admissions:
        if BedCharge.objects.filter(admission=admission, charge_date=charge_date).exists():
            continue

        amount = admission.bed.daily_rate
        invoice = Invoice.objects.create(
            patient=admission.patient,
            visit=admission.visit,
            source_type=InvoiceSourceType.INPATIENT,
            description=f"Bed Charge - {admission.bed.ward.name} Bed {admission.bed.bed_number} ({charge_date})",
            amount=amount,
        )
        charge = BedCharge.objects.create(
            admission=admission, bed=admission.bed, charge_date=charge_date,
            amount=amount, invoice=invoice,
        )
        created.append(str(charge.id))

    return created