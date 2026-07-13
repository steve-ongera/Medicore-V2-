from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict

from api.middleware import get_current_user, get_current_request
from api.models import (
    AuditLog, Visit, Payment, QueueEntry, QueueType, QueueStatus,
    Invoice, InvoiceSourceType, LabOrder, RadiologyOrder, Consultation,
    ConsultationStatus, Prescription,
)

AUDITED_MODELS = (
    "Patient", "Visit", "Invoice", "Payment", "Consultation", "Prescription",
    "LabOrder", "LabResult", "RadiologyOrder", "RadiologyResult",
    "MedicineBatch", "StockTransaction", "PharmacyDispense", "User",
)


def _safe_dict(instance):
    try:
        return {k: str(v) for k, v in model_to_dict(instance).items()}
    except Exception:
        return {}


@receiver(post_save)
def write_audit_log_on_save(sender, instance, created, **kwargs):
    model_name = sender.__name__
    if model_name not in AUDITED_MODELS:
        return
    user = get_current_user()
    request = get_current_request()
    ip = request.META.get("REMOTE_ADDR") if request else None

    AuditLog.objects.create(
        user=user if user and getattr(user, "is_authenticated", False) else None,
        action="CREATE" if created else "UPDATE",
        model_name=model_name,
        object_id=str(instance.pk),
        changes=_safe_dict(instance),
        ip_address=ip,
    )


@receiver(post_delete)
def write_audit_log_on_delete(sender, instance, **kwargs):
    model_name = sender.__name__
    if model_name not in AUDITED_MODELS:
        return
    user = get_current_user()
    AuditLog.objects.create(
        user=user if user and getattr(user, "is_authenticated", False) else None,
        action="DELETE",
        model_name=model_name,
        object_id=str(instance.pk),
        changes={},
    )


# ---------------------------------------------------------------------------
# Business flow automation
# ---------------------------------------------------------------------------
@receiver(post_save, sender=Visit)
def create_consultation_invoice_on_visit(sender, instance, created, **kwargs):
    """Every new visit immediately generates a consultation-fee invoice."""
    if created and not instance.invoices.filter(source_type=InvoiceSourceType.CONSULTATION).exists():
        Invoice.objects.create(
            patient=instance.patient,
            visit=instance,
            source_type=InvoiceSourceType.CONSULTATION,
            description=f"Consultation - {instance.get_consultation_type_display()}",
            amount=instance.consultation_fee,
        )


@receiver(post_save, sender=Payment)
def apply_payment_to_invoice(sender, instance, created, **kwargs):
    """Update invoice balance/status, and once a consultation invoice is
    fully paid, push the patient into the Nurse queue."""
    if not created:
        return
    invoice = instance.invoice
    invoice.amount_paid = (invoice.amount_paid or 0) + instance.amount
    invoice.recalculate_status()

    if invoice.status == "PAID" and invoice.source_type == InvoiceSourceType.CONSULTATION and invoice.visit:
        QueueEntry.objects.get_or_create(
            visit=invoice.visit,
            queue_type=QueueType.NURSE,
            defaults={"patient": invoice.patient, "status": QueueStatus.WAITING},
        )
        invoice.visit.status = "IN_QUEUE"
        invoice.visit.save(update_fields=["status"])

    # Mark lab/radiology orders tied to this invoice as paid too
    LabOrder.objects.filter(invoice=invoice).update(is_paid=True)
    RadiologyOrder.objects.filter(invoice=invoice).update(is_paid=True, status="PAID")


@receiver(post_save, sender=Consultation)
def move_queue_on_consultation_change(sender, instance, created, **kwargs):
    """Keep the doctor queue entry status in sync with consultation state."""
    entry = QueueEntry.objects.filter(visit=instance.visit, queue_type=QueueType.DOCTOR).order_by("-created_at").first()
    if not entry:
        return
    if instance.status == ConsultationStatus.IN_PROGRESS:
        entry.status = QueueStatus.CONSULTING
    elif instance.status == ConsultationStatus.PAUSED:
        entry.status = QueueStatus.PAUSED
    elif instance.status == ConsultationStatus.COMPLETED:
        entry.status = QueueStatus.COMPLETED
        from django.utils import timezone
        entry.completed_at = timezone.now()
        instance.visit.status = "COMPLETED"
        instance.visit.save(update_fields=["status"])
    entry.save(update_fields=["status", "completed_at"] if instance.status == ConsultationStatus.COMPLETED else ["status"])


@receiver(post_save, sender=Prescription)
def create_pharmacy_queue_on_prescription(sender, instance, created, **kwargs):
    """When the consultation completes, any prescriptions push the patient to the pharmacy queue."""
    if created and instance.consultation.status == ConsultationStatus.COMPLETED:
        QueueEntry.objects.get_or_create(
            visit=instance.consultation.visit,
            queue_type=QueueType.PHARMACY,
            defaults={"patient": instance.consultation.visit.patient, "status": QueueStatus.WAITING},
        )