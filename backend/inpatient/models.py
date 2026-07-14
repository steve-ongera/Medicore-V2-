import uuid
from django.db import models
from django.core.validators import MinValueValidator

from api.models import BaseModel, User, Patient, Visit, Invoice, Medicine, ICD10Code, Role


# ---------------------------------------------------------------------------
# Wards & Beds
# ---------------------------------------------------------------------------
class WardType(models.TextChoices):
    GENERAL = "GENERAL", "General Ward"
    MATERNITY = "MATERNITY", "Maternity"
    PEDIATRIC = "PEDIATRIC", "Pediatric"
    ICU = "ICU", "ICU"
    HDU = "HDU", "High Dependency Unit"
    SURGICAL = "SURGICAL", "Surgical"
    ISOLATION = "ISOLATION", "Isolation"
    PRIVATE = "PRIVATE", "Private Wing"


class GenderRestriction(models.TextChoices):
    MALE = "MALE", "Male Only"
    FEMALE = "FEMALE", "Female Only"
    MIXED = "MIXED", "Mixed"


class Ward(BaseModel):
    name = models.CharField(max_length=120, unique=True)
    ward_type = models.CharField(max_length=20, choices=WardType.choices)
    floor = models.CharField(max_length=30, blank=True)
    gender_restriction = models.CharField(max_length=10, choices=GenderRestriction.choices, default=GenderRestriction.MIXED)
    default_daily_rate = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(0)])
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "wards"

    @property
    def bed_capacity(self):
        return self.beds.filter(is_deleted=False).count()

    @property
    def occupied_beds(self):
        return self.beds.filter(is_deleted=False, status=BedStatus.OCCUPIED).count()

    def __str__(self):
        return self.name


class BedStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    OCCUPIED = "OCCUPIED", "Occupied"
    MAINTENANCE = "MAINTENANCE", "Under Maintenance"
    RESERVED = "RESERVED", "Reserved"


class Bed(BaseModel):
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name="beds")
    bed_number = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=BedStatus.choices, default=BedStatus.AVAILABLE)
    daily_rate_override = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        db_table = "beds"
        unique_together = ("ward", "bed_number")

    @property
    def daily_rate(self):
        return self.daily_rate_override or self.ward.default_daily_rate

    def __str__(self):
        return f"{self.ward.name} - Bed {self.bed_number}"


# ---------------------------------------------------------------------------
# Admissions
# ---------------------------------------------------------------------------
class AdmissionType(models.TextChoices):
    EMERGENCY = "EMERGENCY", "Emergency"
    ELECTIVE = "ELECTIVE", "Elective"
    TRANSFER_IN = "TRANSFER_IN", "Transfer In"
    MATERNITY = "MATERNITY", "Maternity"


class AdmissionStatus(models.TextChoices):
    ADMITTED = "ADMITTED", "Admitted"
    DISCHARGED = "DISCHARGED", "Discharged"
    TRANSFERRED_OUT = "TRANSFERRED_OUT", "Transferred Out"
    DECEASED = "DECEASED", "Deceased"
    ABSCONDED = "ABSCONDED", "Absconded"


class DischargeType(models.TextChoices):
    NORMAL = "NORMAL", "Normal Discharge"
    DAMA = "DAMA", "Discharge Against Medical Advice"
    REFERRED = "REFERRED", "Referred Out"
    DECEASED = "DECEASED", "Deceased"
    ABSCONDED = "ABSCONDED", "Absconded"


class Admission(BaseModel):
    admission_number = models.CharField(max_length=30, unique=True, editable=False)
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="admissions")
    visit = models.ForeignKey(Visit, null=True, blank=True, on_delete=models.SET_NULL, related_name="admissions")
    bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name="admissions")

    admitting_doctor = models.ForeignKey(
        User, null=True, on_delete=models.SET_NULL, related_name="admissions_ordered",
        limit_choices_to={"role": Role.DOCTOR},
    )
    attending_doctor = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL, related_name="admissions_attending",
        limit_choices_to={"role": Role.DOCTOR},
    )
    admitted_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="admissions_processed")

    admission_type = models.CharField(max_length=20, choices=AdmissionType.choices, default=AdmissionType.EMERGENCY)
    admission_diagnosis = models.TextField(blank=True)
    icd10_codes = models.ManyToManyField(ICD10Code, blank=True, related_name="admissions")

    admission_date = models.DateTimeField(auto_now_add=True)
    expected_discharge_date = models.DateField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=AdmissionStatus.choices, default=AdmissionStatus.ADMITTED)

    discharge_date = models.DateTimeField(null=True, blank=True)
    discharge_type = models.CharField(max_length=20, choices=DischargeType.choices, blank=True)
    discharge_summary = models.TextField(blank=True)
    discharge_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL, related_name="admissions_discharged")

    class Meta:
        db_table = "admissions"

    def save(self, *args, **kwargs):
        if not self.admission_number:
            from api.utils import generate_admission_number
            self.admission_number = generate_admission_number()
        super().save(*args, **kwargs)

    @property
    def length_of_stay_days(self):
        from django.utils import timezone
        end = self.discharge_date or timezone.now()
        return (end - self.admission_date).days

    def __str__(self):
        return f"{self.admission_number} - {self.patient.full_name}"


class BedTransfer(BaseModel):
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name="bed_transfers")
    from_bed = models.ForeignKey(Bed, null=True, on_delete=models.SET_NULL, related_name="transfers_from")
    to_bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name="transfers_to")
    reason = models.CharField(max_length=255, blank=True)
    transferred_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="bed_transfers_made")
    transferred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "bed_transfers"


# ---------------------------------------------------------------------------
# Clinical activity while admitted
# ---------------------------------------------------------------------------
class Shift(models.TextChoices):
    MORNING = "MORNING", "Morning"
    AFTERNOON = "AFTERNOON", "Afternoon"
    NIGHT = "NIGHT", "Night"


class WardRound(BaseModel):
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name="ward_rounds")
    doctor = models.ForeignKey(User, on_delete=models.PROTECT, related_name="ward_rounds")
    notes = models.TextField()
    plan = models.TextField(blank=True)
    round_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ward_rounds"


class NursingNote(BaseModel):
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name="nursing_notes")
    nurse = models.ForeignKey(User, on_delete=models.PROTECT, related_name="nursing_notes")
    shift = models.CharField(max_length=20, choices=Shift.choices)
    note = models.TextField()

    class Meta:
        db_table = "nursing_notes"


class InpatientVitals(BaseModel):
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name="vitals")
    shift = models.CharField(max_length=20, choices=Shift.choices, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    bmi = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, editable=False)
    temperature_c = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    pulse_bpm = models.PositiveSmallIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_systolic = models.PositiveSmallIntegerField(null=True, blank=True)
    bp_diastolic = models.PositiveSmallIntegerField(null=True, blank=True)
    oxygen_saturation = models.PositiveSmallIntegerField(null=True, blank=True)
    recorded_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="inpatient_vitals_recorded")
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "inpatient_vitals"

    def save(self, *args, **kwargs):
        from api.utils import calculate_bmi
        self.bmi = calculate_bmi(self.weight_kg, self.height_cm)
        super().save(*args, **kwargs)


# ---------------------------------------------------------------------------
# Inpatient medication (separate from OPD Prescription/PharmacyDispense)
# ---------------------------------------------------------------------------
class MedicationRoute(models.TextChoices):
    ORAL = "ORAL", "Oral"
    IV = "IV", "Intravenous"
    IM = "IM", "Intramuscular"
    SC = "SC", "Subcutaneous"
    TOPICAL = "TOPICAL", "Topical"
    OTHER = "OTHER", "Other"


class MedicationOrder(BaseModel):
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name="medication_orders")
    medicine = models.ForeignKey(Medicine, on_delete=models.PROTECT, related_name="inpatient_orders")
    dosage = models.CharField(max_length=100)
    route = models.CharField(max_length=20, choices=MedicationRoute.choices, default=MedicationRoute.ORAL)
    frequency = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField(default=1)  # <-- NEW: units consumed per administration, used for stock + billing
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    ordered_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="medication_orders_placed")

    class Meta:
        db_table = "medication_orders"


class AdministrationStatus(models.TextChoices):
    GIVEN = "GIVEN", "Given"
    MISSED = "MISSED", "Missed"
    REFUSED = "REFUSED", "Refused"
    HELD = "HELD", "Held"


class MedicationAdministration(BaseModel):
    medication_order = models.ForeignKey(MedicationOrder, on_delete=models.CASCADE, related_name="administrations")
    administered_by = models.ForeignKey(User, null=True, on_delete=models.SET_NULL, related_name="medications_administered")
    status = models.CharField(max_length=20, choices=AdministrationStatus.choices, default=AdministrationStatus.GIVEN)
    notes = models.CharField(max_length=255, blank=True)
    administered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "medication_administrations"


# ---------------------------------------------------------------------------
# Bed / ward billing
# ---------------------------------------------------------------------------
class BedCharge(BaseModel):
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name="bed_charges")
    bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name="charges")
    charge_date = models.DateField()
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    invoice = models.ForeignKey(Invoice, null=True, blank=True, on_delete=models.SET_NULL, related_name="bed_charges")

    class Meta:
        db_table = "bed_charges"
        unique_together = ("admission", "charge_date")