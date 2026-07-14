from datetime import date

from api.models import Invoice, InvoiceSourceType
from .models import Admission, AdmissionStatus, BedCharge


def ensure_admission_visit(admission):
    """
    Guarantees this admission has a Visit, creating one lazily if needed.
    Single source of truth — used by the admission signal, AdmissionViewSet,
    and the daily bed-charge job, so a Visit is always available before any
    Invoice gets created against this admission.
    """
    if admission.visit:
        return admission.visit

    from api.models import Department, ConsultationType, VisitStatus, Visit

    inpatient_dept, _ = Department.objects.get_or_create(
        name="Inpatient Admission",
        defaults={
            "consultation_fee": 0,
            "description": "Auto-created department for direct inpatient admissions without a prior OPD visit.",
        },
    )
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
    return visit


def ensure_admission_consultation(admission):
    """Guarantees a Consultation exists on this admission's Visit, for lab/radiology ordering."""
    from api.models import Consultation, ConsultationStatus

    visit = ensure_admission_visit(admission)
    if hasattr(visit, "consultation"):
        return visit.consultation

    return Consultation.objects.create(
        visit=visit,
        doctor=admission.attending_doctor or admission.admitting_doctor,
        chief_complaint=admission.admission_diagnosis,
        status=ConsultationStatus.IN_PROGRESS,
    )


def backfill_orphaned_invoices(admission):
    """
    Relinks any bed-charge / medication / procedure invoices that were
    created before this admission had a Visit (e.g. the first-day bed charge
    raised by the post_save signal before the visit-ensuring logic ran).
    Idempotent — safe to call on every billing lookup.
    """
    from .models import MedicationAdministration, InpatientProcedure

    if not admission.visit:
        return

    visit = admission.visit

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

    for proc in InpatientProcedure.objects.filter(admission=admission).select_related("invoice"):
        if proc.invoice and not proc.invoice.visit:
            proc.invoice.visit = visit
            proc.invoice.save(update_fields=["visit"])


def generate_daily_bed_charges(for_date=None):
    """
    Creates today's (or a given date's) bed charge + Invoice for every
    currently admitted patient who doesn't already have one for that date.
    Idempotent — safe to run multiple times a day.
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

        visit = ensure_admission_visit(admission)
        amount = admission.bed.daily_rate
        invoice = Invoice.objects.create(
            patient=admission.patient,
            visit=visit,
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