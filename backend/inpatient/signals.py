"""
Signals to keep inpatient billing in sync automatically, without any
frontend involvement.

On admission creation: immediately raise the first day's bed charge, using
ensure_admission_visit so the invoice is always linked to a Visit from the
moment it's created — never orphaned with visit=None.
"""
import logging
from datetime import date

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Admission, AdmissionStatus

logger = logging.getLogger(__name__)


@receiver(post_save, sender=Admission)
def charge_first_day_on_admission(sender, instance, created, **kwargs):
    if not created or instance.status != AdmissionStatus.ADMITTED:
        return

    from api.models import Invoice, InvoiceSourceType
    from .models import BedCharge
    from .services import ensure_admission_visit

    today = date.today()
    if BedCharge.objects.filter(admission=instance, charge_date=today).exists():
        return

    try:
        # ensure_admission_visit may call instance.save(update_fields=["visit"]).
        # That re-triggers this same signal with created=False, which the
        # guard above short-circuits — no infinite loop.
        visit = ensure_admission_visit(instance)

        amount = instance.bed.daily_rate
        invoice = Invoice.objects.create(
            patient=instance.patient,
            visit=visit,
            source_type=InvoiceSourceType.INPATIENT,
            description=f"Bed Charge - {instance.bed.ward.name} Bed {instance.bed.bed_number} ({today})",
            amount=amount,
        )
        BedCharge.objects.create(
            admission=instance, bed=instance.bed, charge_date=today,
            amount=amount, invoice=invoice,
        )
        logger.info("Auto-charged first day of admission %s.", instance.admission_number)
    except Exception:
        logger.exception("Failed to auto-charge first day for admission %s.", instance.admission_number)