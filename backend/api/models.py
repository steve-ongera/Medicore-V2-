import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.core.validators import MinValueValidator

from api.managers import SoftDeleteManager, AllObjectsManager
from api.utils import (
    generate_hospital_number,
    generate_visit_number,
    generate_invoice_number,
    generate_receipt_number,
    generate_otc_sale_number,
    calculate_bmi,
)


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------
class BaseModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)

    objects = SoftDeleteManager()
    all_objects = AllObjectsManager()

    class Meta:
        abstract = True
        ordering = ["-created_at"]

    def soft_delete(self):
        from django.utils import timezone

        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=["is_deleted", "deleted_at"])


# ---------------------------------------------------------------------------
# Accounts / RBAC
# ---------------------------------------------------------------------------
class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    RECEPTIONIST = "RECEPTIONIST", "Receptionist"
    CASHIER = "CASHIER", "Cashier"
    NURSE = "NURSE", "Nurse"
    DOCTOR = "DOCTOR", "Doctor"
    LAB_TECHNOLOGIST = "LAB_TECHNOLOGIST", "Laboratory Technologist"
    RADIOLOGIST = "RADIOLOGIST", "Radiologist"
    PHARMACIST = "PHARMACIST", "Pharmacist"
    ACCOUNTANT = "ACCOUNTANT", "Accountant"


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=30, choices=Role.choices)
    phone = models.CharField(max_length=20, blank=True)
    department = models.ForeignKey(
        "Department", null=True, blank=True, on_delete=models.SET_NULL, related_name="staff"
    )
    profile_photo = models.ImageField(upload_to="staff_photos/", null=True, blank=True)
    is_active_staff = models.BooleanField(default=True)

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.get_full_name() or self.username} ({self.role})"


class AuditLog(models.Model):
    """Immutable trail of who changed what, when."""

    ACTION_CHOICES = [("CREATE", "Create"), ("UPDATE", "Update"), ("DELETE", "Delete")]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="audit_logs")
    action = models.CharField(max_length=10, choices=ACTION_CHOICES)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=64)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-timestamp"]

    def __str__(self):
        return f"{self.action} {self.model_name}#{self.object_id} by {self.user}"


# ---------------------------------------------------------------------------
# Hospital structure
# ---------------------------------------------------------------------------
class Department(BaseModel):
    name = models.CharField(max_length=120, unique=True)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "departments"

    def __str__(self):
        return self.name


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------
class Gender(models.TextChoices):
    MALE = "MALE", "Male"
    FEMALE = "FEMALE", "Female"
    OTHER = "OTHER", "Other"


class Patient(BaseModel):
    hospital_number = models.CharField(max_length=20, unique=True, editable=False)
    full_name = models.CharField(max_length=150)
    gender = models.CharField(max_length=10, choices=Gender.choices)
    dob = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=20, blank=True, db_index=True)
    address = models.CharField(max_length=255, blank=True)
    national_id = models.CharField(max_length=30, blank=True, null=True, unique=True, db_index=True)

    # Minors
    guardian_name = models.CharField(max_length=150, blank=True)
    guardian_phone = models.CharField(max_length=20, blank=True)
    guardian_relationship = models.CharField(max_length=50, blank=True)

    # Next of kin
    next_of_kin_name = models.CharField(max_length=150, blank=True)
    next_of_kin_phone = models.CharField(max_length=20, blank=True)
    next_of_kin_relationship = models.CharField(max_length=50, blank=True)

    created_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="patients_registered")

    class Meta:
        db_table = "patients"
        indexes = [
            models.Index(fields=["phone"]),
            models.Index(fields=["national_id"]),
            models.Index(fields=["hospital_number"]),
        ]

    def save(self, *args, **kwargs):
        if not self.hospital_number:
            self.hospital_number = generate_hospital_number()
        super().save(*args, **kwargs)

    @property
    def age(self):
        from api.utils import calculate_age

        return calculate_age(self.dob)

    def __str__(self):
        return f"{self.full_name} ({self.hospital_number})"


class Allergy(BaseModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="allergies")
    substance = models.CharField(max_length=150)
    reaction = models.CharField(max_length=255, blank=True)
    severity = models.CharField(
        max_length=20,
        choices=[("MILD", "Mild"), ("MODERATE", "Moderate"), ("SEVERE", "Severe")],
        default="MILD",
    )

    class Meta:
        db_table = "allergies"


class MedicalHistoryNote(BaseModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="medical_history")
    condition = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    diagnosed_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "medical_history_notes"


# ---------------------------------------------------------------------------
# Visits
# ---------------------------------------------------------------------------
class ConsultationType(models.TextChoices):
    GENERAL = "GENERAL", "General Consultation"
    GYNECOLOGY = "GYNECOLOGY", "Gynecologist"
    DENTAL = "DENTAL", "Dentist"
    PEDIATRIC = "PEDIATRIC", "Pediatrician"
    OTHER = "OTHER", "Other Specialist"


class VisitStatus(models.TextChoices):
    REGISTERED = "REGISTERED", "Registered"
    AWAITING_PAYMENT = "AWAITING_PAYMENT", "Awaiting Payment"
    IN_QUEUE = "IN_QUEUE", "In Queue"
    IN_CONSULTATION = "IN_CONSULTATION", "In Consultation"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class Visit(BaseModel):
    visit_number = models.CharField(max_length=30, unique=True, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="visits")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="visits")
    doctor = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="assigned_visits", limit_choices_to={"role": Role.DOCTOR},
    )
    consultation_type = models.CharField(max_length=20, choices=ConsultationType.choices, default=ConsultationType.GENERAL)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=VisitStatus.choices, default=VisitStatus.REGISTERED)
    visit_date = models.DateTimeField(auto_now_add=True)
    registered_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="visits_registered")

    class Meta:
        db_table = "visits"

    def save(self, *args, **kwargs):
        if not self.visit_number:
            self.visit_number = generate_visit_number()
        if not self.consultation_fee:
            self.consultation_fee = self.department.consultation_fee
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.visit_number} - {self.patient.full_name}"


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------
class InvoiceSourceType(models.TextChoices):
    CONSULTATION = "CONSULTATION", "Consultation"
    LAB = "LAB", "Laboratory"
    RADIOLOGY = "RADIOLOGY", "Radiology"
    PHARMACY = "PHARMACY", "Pharmacy"


class InvoiceStatus(models.TextChoices):
    UNPAID = "UNPAID", "Unpaid"
    PARTIAL = "PARTIAL", "Partially Paid"
    PAID = "PAID", "Paid"
    CANCELLED = "CANCELLED", "Cancelled"


class Invoice(BaseModel):
    invoice_number = models.CharField(max_length=30, unique=True, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="invoices")
    visit = models.ForeignKey(Visit, null=True, blank=True, on_delete=models.SET_NULL, related_name="invoices")
    source_type = models.CharField(max_length=20, choices=InvoiceSourceType.choices)
    description = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=InvoiceStatus.choices, default=InvoiceStatus.UNPAID)

    class Meta:
        db_table = "invoices"

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = generate_invoice_number()
        super().save(*args, **kwargs)

    @property
    def balance(self):
        return self.amount - self.amount_paid

    def recalculate_status(self):
        if self.amount_paid <= 0:
            self.status = InvoiceStatus.UNPAID
        elif self.amount_paid < self.amount:
            self.status = InvoiceStatus.PARTIAL
        else:
            self.status = InvoiceStatus.PAID
        self.save(update_fields=["status", "amount_paid"])

    def __str__(self):
        return f"{self.invoice_number} ({self.status})"


class PaymentMethod(models.TextChoices):
    CASH = "CASH", "Cash"
    MPESA = "MPESA", "M-Pesa"
    CARD = "CARD", "Card"
    INSURANCE = "INSURANCE", "Insurance"


class Payment(BaseModel):
    receipt_number = models.CharField(max_length=30, unique=True, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0.01)])
    method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    reference_number = models.CharField(max_length=100, blank=True)  # M-Pesa code, card auth, insurance claim no.
    cashier = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="payments_processed")
    qr_code = models.ImageField(upload_to="receipts/qr/", null=True, blank=True)
    paid_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payments"

    def save(self, *args, **kwargs):
        if not self.receipt_number:
            self.receipt_number = generate_receipt_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.receipt_number} - KES {self.amount}"


# ---------------------------------------------------------------------------
# Queue Management
# ---------------------------------------------------------------------------
class QueueType(models.TextChoices):
    NURSE = "NURSE", "Nurse Queue"
    DOCTOR = "DOCTOR", "Doctor Queue"
    LAB = "LAB", "Lab Queue"
    RADIOLOGY = "RADIOLOGY", "Radiology Queue"
    PHARMACY = "PHARMACY", "Pharmacy Queue"


class QueueStatus(models.TextChoices):
    WAITING = "WAITING", "Waiting"
    WITH_NURSE = "WITH_NURSE", "With Nurse"
    WAITING_DOCTOR = "WAITING_DOCTOR", "Waiting Doctor"
    CONSULTING = "CONSULTING", "Consulting"
    PAUSED = "PAUSED", "Paused"
    LAB = "LAB", "Lab"
    RADIOLOGY = "RADIOLOGY", "Radiology"
    PHARMACY = "PHARMACY", "Pharmacy"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class QueueEntry(BaseModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="queue_entries")
    visit = models.ForeignKey(Visit, on_delete=models.CASCADE, related_name="queue_entries")
    queue_type = models.CharField(max_length=20, choices=QueueType.choices)
    status = models.CharField(max_length=20, choices=QueueStatus.choices, default=QueueStatus.WAITING)
    assigned_to = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="queue_assignments")
    priority = models.PositiveSmallIntegerField(default=0)  # higher = seen sooner (emergencies)
    called_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "queue_entries"
        ordering = ["-priority", "created_at"]

    def __str__(self):
        return f"{self.patient.full_name} - {self.queue_type} ({self.status})"


# ---------------------------------------------------------------------------
# Triage / Vitals
# ---------------------------------------------------------------------------
class VitalSigns(BaseModel):
    visit = models.OneToOneField(Visit, on_delete=models.CASCADE, related_name="vitals")
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    bmi = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, editable=False)
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    pulse_bpm = models.PositiveSmallIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_systolic = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_diastolic = models.PositiveSmallIntegerField(null=True, blank=True)
    oxygen_saturation = models.PositiveSmallIntegerField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="vitals_recorded")
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vital_signs"

    def save(self, *args, **kwargs):
        self.bmi = calculate_bmi(self.weight_kg, self.height_cm)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# ICD-10
# ---------------------------------------------------------------------------
class ICD10Code(models.Model):
    code = models.CharField(max_length=10, primary_key=True)
    description = models.CharField(max_length=500)
    category = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "icd10_codes"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.description}"


# ---------------------------------------------------------------------------
# Consultation
# ---------------------------------------------------------------------------
class ConsultationStatus(models.TextChoices):
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    PAUSED = "PAUSED", "Paused"
    COMPLETED = "COMPLETED", "Completed"


class PauseReason(models.TextChoices):
    WAITING_LAB = "WAITING_LAB", "Waiting Lab"
    WAITING_RADIOLOGY = "WAITING_RADIOLOGY", "Waiting Radiology"
    PATIENT_NOT_READY = "PATIENT_NOT_READY", "Patient Not Ready"
    OTHER = "OTHER", "Other"


class Consultation(BaseModel):
    visit = models.OneToOneField(Visit, on_delete=models.CASCADE, related_name="consultation")
    doctor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="consultations")

    chief_complaint = models.TextField(blank=True)
    history_of_present_illness = models.TextField(blank=True)
    physical_examination = models.TextField(blank=True)
    treatment_plan = models.TextField(blank=True)
    clinical_notes = models.TextField(blank=True)

    diagnoses = models.ManyToManyField(ICD10Code, through="ConsultationDiagnosis", related_name="consultations")

    status = models.CharField(max_length=20, choices=ConsultationStatus.choices, default=ConsultationStatus.IN_PROGRESS)
    pause_reason = models.CharField(max_length=30, choices=PauseReason.choices, blank=True)
    pause_notes = models.CharField(max_length=255, blank=True)

    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "consultations"

    def __str__(self):
        return f"Consultation - {self.visit.visit_number}"


class ConsultationDiagnosis(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE)
    icd10_code = models.ForeignKey(ICD10Code, on_delete=models.PROTECT)
    is_primary = models.BooleanField(default=False)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "consultation_diagnoses"
        unique_together = ("consultation", "icd10_code")


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------
class Prescription(BaseModel):
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name="prescriptions")
    medicine = models.ForeignKey("Medicine", on_delete=models.PROTECT, related_name="prescriptions")
    dosage = models.CharField(max_length=100)          # e.g. "500mg"
    frequency = models.CharField(max_length=100)        # e.g. "3x daily"
    duration = models.CharField(max_length=100)          # e.g. "5 days"
    quantity = models.PositiveIntegerField()
    instructions = models.CharField(max_length=255, blank=True)  # e.g. "After meals"
    is_dispensed = models.BooleanField(default=False)

    class Meta:
        db_table = "prescriptions"

    def __str__(self):
        return f"{self.medicine.name} for {self.consultation.visit.patient.full_name}"


# ---------------------------------------------------------------------------
# Laboratory
# ---------------------------------------------------------------------------
class LabTestCatalog(BaseModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=150)   # CBC, Malaria, Urinalysis, Blood Sugar, LFT, KFT...
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "lab_test_catalog"

    def __str__(self):
        return self.name


class LabOrderStatus(models.TextChoices):
    ORDERED = "ORDERED", "Ordered"
    COLLECTED = "COLLECTED", "Collected"
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class LabOrder(BaseModel):
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name="lab_orders")
    test = models.ForeignKey(LabTestCatalog, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=LabOrderStatus.choices, default=LabOrderStatus.ORDERED)
    is_paid = models.BooleanField(default=False)
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name="lab_orders")
    ordered_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="lab_orders_placed")
    ordered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "lab_orders"

    def __str__(self):
        return f"{self.test.name} - {self.consultation.visit.patient.full_name}"


class LabResult(BaseModel):
    lab_order = models.OneToOneField(LabOrder, on_delete=models.CASCADE, related_name="result")
    result_text = models.TextField(blank=True)
    result_file = models.FileField(upload_to="lab_results/", null=True, blank=True)
    technologist = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="lab_results_entered")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "lab_results"


# ---------------------------------------------------------------------------
# Radiology
# ---------------------------------------------------------------------------
class RadiologyTestCatalog(BaseModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=150)   # X-Ray, CT Scan, MRI, Ultrasound, ECG...
    price = models.DecimalField(max_digits=10, decimal_places=2)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "radiology_test_catalog"

    def __str__(self):
        return self.name


class RadiologyOrderStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PAID = "PAID", "Paid"
    DONE = "DONE", "Done"
    REPORTED = "REPORTED", "Reported"
    CANCELLED = "CANCELLED", "Cancelled"


class RadiologyOrder(BaseModel):
    consultation = models.ForeignKey(Consultation, on_delete=models.CASCADE, related_name="radiology_orders")
    test = models.ForeignKey(RadiologyTestCatalog, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=RadiologyOrderStatus.choices, default=RadiologyOrderStatus.PENDING)
    is_paid = models.BooleanField(default=False)
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name="radiology_orders")
    ordered_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="radiology_orders_placed")
    ordered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "radiology_orders"

    def __str__(self):
        return f"{self.test.name} - {self.consultation.visit.patient.full_name}"


class RadiologyResult(BaseModel):
    radiology_order = models.OneToOneField(RadiologyOrder, on_delete=models.CASCADE, related_name="result")
    image_file = models.FileField(upload_to="radiology_images/", null=True, blank=True)
    report_file = models.FileField(upload_to="radiology_reports/", null=True, blank=True)
    radiologist_notes = models.TextField(blank=True)
    radiologist = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="radiology_reports")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "radiology_results"


# ---------------------------------------------------------------------------
# Pharmacy / Inventory
# ---------------------------------------------------------------------------
class Supplier(BaseModel):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "suppliers"

    def __str__(self):
        return self.name


class Medicine(BaseModel):
    name = models.CharField(max_length=150)
    generic_name = models.CharField(max_length=150, blank=True)
    category = models.CharField(max_length=100, blank=True)
    unit = models.CharField(max_length=30, default="tablet")  # tablet, syrup, injection...
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    reorder_level = models.PositiveIntegerField(default=20)

    class Meta:
        db_table = "medicines"

    @property
    def current_stock(self):
        return sum(b.quantity_remaining for b in self.batches.filter(is_deleted=False))

    @property
    def is_low_stock(self):
        return self.current_stock <= self.reorder_level

    def __str__(self):
        return self.name


class MedicineBatch(BaseModel):
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="batches")
    supplier = models.ForeignKey(Supplier, null=True, on_delete=models.SET_NULL, related_name="batches")
    batch_number = models.CharField(max_length=60)
    quantity_received = models.PositiveIntegerField()
    quantity_remaining = models.PositiveIntegerField()
    expiry_date = models.DateField()
    received_date = models.DateField(auto_now_add=True)

    class Meta:
        db_table = "medicine_batches"
        unique_together = ("medicine", "batch_number")

    def __str__(self):
        return f"{self.medicine.name} - {self.batch_number}"


class StockTransactionType(models.TextChoices):
    STOCK_IN = "STOCK_IN", "Stock In"
    STOCK_OUT = "STOCK_OUT", "Stock Out"
    ADJUSTMENT = "ADJUSTMENT", "Adjustment"
    EXPIRED = "EXPIRED", "Expired / Written Off"


class StockTransaction(BaseModel):
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name="stock_transactions")
    batch = models.ForeignKey(MedicineBatch, null=True, blank=True, on_delete=models.SET_NULL, related_name="stock_transactions")
    transaction_type = models.CharField(max_length=20, choices=StockTransactionType.choices)
    quantity = models.IntegerField()
    reason = models.CharField(max_length=255, blank=True)
    performed_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="stock_transactions")

    class Meta:
        db_table = "stock_transactions"


class PharmacyDispense(BaseModel):
    prescription = models.OneToOneField(Prescription, on_delete=models.CASCADE, related_name="dispense")
    batch = models.ForeignKey(MedicineBatch, null=True, on_delete=models.SET_NULL, related_name="dispenses")
    quantity_dispensed = models.PositiveIntegerField()
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name="pharmacy_dispenses")
    dispensed_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="dispenses_made")
    dispensed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "pharmacy_dispenses"


# ---------------------------------------------------------------------------
# Walk-in / OTC Pharmacy Sales (POS)
# ---------------------------------------------------------------------------
# Level 3-5 facilities routinely sell over-the-counter medicine to people who
# are not, and never will be, a registered Patient — someone buying
# paracetamol doesn't need a hospital number. OTCSale is deliberately
# independent of Patient/Visit/Invoice: it's a self-contained retail ledger
# that still uses the same MedicineBatch/StockTransaction stock machinery as
# PharmacyDispense (FEFO batch selection, stock deduction, audit trail).
class OTCSale(BaseModel):
    sale_number = models.CharField(max_length=30, unique=True, editable=False)

    # Optional — a walk-in customer is not required to give any identifying
    # information. Kept as free text rather than a Patient FK on purpose.
    customer_name = models.CharField(max_length=150, blank=True)
    customer_phone = models.CharField(max_length=20, blank=True)

    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=0, editable=False)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0, validators=[MinValueValidator(0)])
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, editable=False)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    reference_number = models.CharField(max_length=100, blank=True)  # M-Pesa code, card auth...

    served_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="otc_sales")
    qr_code = models.ImageField(upload_to="otc_receipts/qr/", null=True, blank=True)
    sold_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "otc_sales"

    def save(self, *args, **kwargs):
        if not self.sale_number:
            self.sale_number = generate_otc_sale_number()
        super().save(*args, **kwargs)

    def recalculate_totals(self):
        self.subtotal = sum(item.subtotal for item in self.items.all())
        self.total_amount = self.subtotal - self.discount
        self.save(update_fields=["subtotal", "total_amount"])

    @property
    def balance(self):
        return self.total_amount - self.amount_paid

    def __str__(self):
        return f"{self.sale_number} - KES {self.total_amount}"


class OTCSaleItem(BaseModel):
    sale = models.ForeignKey(OTCSale, on_delete=models.CASCADE, related_name="items")
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name="otc_sale_items")
    batch = models.ForeignKey(MedicineBatch, null=True, on_delete=models.SET_NULL, related_name="otc_sale_items")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, editable=False)

    class Meta:
        db_table = "otc_sale_items"

    def save(self, *args, **kwargs):
        self.subtotal = self.unit_price * self.quantity
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.medicine.name} x{self.quantity}"