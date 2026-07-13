from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from api.models import (
    User, Department, Patient, Allergy, MedicalHistoryNote, Visit,
    Invoice, Payment, QueueEntry, VitalSigns, ICD10Code, Consultation,
    ConsultationDiagnosis, Prescription, LabTestCatalog, LabOrder, LabResult,
    RadiologyTestCatalog, RadiologyOrder, RadiologyResult, Supplier,
    Medicine, MedicineBatch, StockTransaction, PharmacyDispense, AuditLog,
    OTCSale, OTCSaleItem,
)


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "full_name",
            "role", "phone", "department", "profile_photo", "is_active_staff", "is_active",
        ]
        read_only_fields = ["id"]


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])

    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "role", "phone", "department", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])


# ---------------------------------------------------------------------------
# Hospital structure
# ---------------------------------------------------------------------------
class DepartmentSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = Department
        fields = ["id", "name", "consultation_fee", "description", "is_active"]


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------
class AllergySerializer(serializers.ModelSerializer):
    class Meta:
        model = Allergy
        fields = ["id", "patient", "substance", "reaction", "severity"]


class MedicalHistoryNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalHistoryNote
        fields = ["id", "patient", "condition", "notes", "diagnosed_date"]


class PatientSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)
    allergies = AllergySerializer(many=True, read_only=True)
    medical_history = MedicalHistoryNoteSerializer(many=True, read_only=True)

    class Meta:
        model = Patient
        fields = [
            "id", "hospital_number", "full_name", "gender", "dob", "age", "phone", "address",
            "national_id", "guardian_name", "guardian_phone", "guardian_relationship",
            "next_of_kin_name", "next_of_kin_phone", "next_of_kin_relationship",
            "allergies", "medical_history", "created_by", "created_at",
        ]
        read_only_fields = ["id", "hospital_number", "created_by", "created_at"]

    def validate(self, attrs):
        dob = attrs.get("dob")
        national_id = attrs.get("national_id")
        guardian_name = attrs.get("guardian_name")
        is_minor = dob is not None and (dob.year > 2008)  # rough check, refined via age property elsewhere
        if not is_minor and not national_id and not self.instance:
            # Adults should generally have a National ID; keep as a soft warning, not a hard block,
            # since some adults legitimately lack one (e.g. undocumented, foreign patients).
            pass
        return attrs


class PatientSearchResultSerializer(serializers.ModelSerializer):
    """Lightweight serializer used by the duplicate-check search endpoint."""

    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = Patient
        fields = ["id", "hospital_number", "full_name", "gender", "age", "phone", "national_id"]


# ---------------------------------------------------------------------------
# Visits
# ---------------------------------------------------------------------------
class VisitSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)
    doctor_name = serializers.CharField(source="doctor.get_full_name", read_only=True)

    class Meta:
        model = Visit
        fields = [
            "id", "visit_number", "patient", "patient_name", "department", "department_name",
            "doctor", "doctor_name", "consultation_type", "consultation_fee", "status",
            "visit_date", "registered_by",
        ]
        read_only_fields = ["id", "visit_number", "consultation_fee", "status", "visit_date", "registered_by"]


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------
class InvoiceSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id", "invoice_number", "patient", "patient_name", "visit", "source_type",
            "description", "amount", "amount_paid", "balance", "status", "created_at",
        ]
        read_only_fields = ["id", "invoice_number", "amount_paid", "status", "created_at"]


class PaymentSerializer(serializers.ModelSerializer):
    cashier_name = serializers.CharField(source="cashier.get_full_name", read_only=True)
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    patient_name = serializers.CharField(source="invoice.patient.full_name", read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id", "receipt_number", "invoice", "invoice_number", "patient_name", "amount",
            "method", "reference_number", "cashier", "cashier_name", "qr_code", "paid_at",
        ]
        read_only_fields = ["id", "receipt_number", "cashier", "qr_code", "paid_at"]

    def validate(self, attrs):
        invoice = attrs.get("invoice") or getattr(self.instance, "invoice", None)
        amount = attrs.get("amount")
        if invoice and amount and amount > invoice.balance:
            raise serializers.ValidationError(
                f"Payment amount ({amount}) exceeds outstanding balance ({invoice.balance})."
            )
        return attrs


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------
class QueueEntrySerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    hospital_number = serializers.CharField(source="patient.hospital_number", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True)

    class Meta:
        model = QueueEntry
        fields = [
            "id", "patient", "patient_name", "hospital_number", "visit", "queue_type", "status",
            "assigned_to", "assigned_to_name", "priority", "called_at", "completed_at", "created_at",
        ]
        read_only_fields = ["id", "created_at"]


# ---------------------------------------------------------------------------
# Triage
# ---------------------------------------------------------------------------
class VitalSignsSerializer(serializers.ModelSerializer):
    bmi = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = VitalSigns
        fields = [
            "id", "visit", "weight_kg", "height_cm", "bmi", "temperature_c", "pulse_bpm",
            "respiratory_rate", "bp_systolic", "bp_diastolic", "oxygen_saturation",
            "recorded_by", "recorded_at",
        ]
        read_only_fields = ["id", "bmi", "recorded_by", "recorded_at"]


# ---------------------------------------------------------------------------
# ICD-10
# ---------------------------------------------------------------------------
class ICD10CodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ICD10Code
        fields = ["code", "description", "category"]


# ---------------------------------------------------------------------------
# Consultation
# ---------------------------------------------------------------------------
class ConsultationDiagnosisSerializer(serializers.ModelSerializer):
    code = serializers.CharField(source="icd10_code.code", read_only=True)
    description = serializers.CharField(source="icd10_code.description", read_only=True)

    class Meta:
        model = ConsultationDiagnosis
        fields = ["id", "consultation", "icd10_code", "code", "description", "is_primary", "notes"]


class PrescriptionSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    patient_name = serializers.CharField(source="consultation.visit.patient.full_name", read_only=True)

    class Meta:
        model = Prescription
        fields = [
            "id", "consultation", "medicine", "medicine_name", "dosage", "frequency",
            "duration", "quantity", "instructions", "is_dispensed", "patient_name",
        ]
        read_only_fields = ["id", "is_dispensed"]


class LabOrderSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source="test.name", read_only=True)
    test_price = serializers.DecimalField(source="test.price", max_digits=10, decimal_places=2, read_only=True)
    patient_name = serializers.CharField(source="consultation.visit.patient.full_name", read_only=True)
    result = serializers.SerializerMethodField()

    class Meta:
        model = LabOrder
        fields = [
            "id", "consultation", "test", "test_name", "test_price", "patient_name",
            "status", "is_paid", "invoice", "ordered_by", "ordered_at", "result",
        ]
        read_only_fields = ["id", "status", "is_paid", "invoice", "ordered_by", "ordered_at"]

    def get_result(self, obj):
        result = getattr(obj, "result", None)
        if result is None:
            return None
        request = self.context.get("request")
        file_url = result.result_file.url if result.result_file else None
        if file_url and request is not None:
            file_url = request.build_absolute_uri(file_url)
        return {
            "id": str(result.id),
            "result_text": result.result_text,
            "result_file": file_url,
            "completed_at": result.completed_at,
        }
        
        
class RadiologyOrderSerializer(serializers.ModelSerializer):
    test_name = serializers.CharField(source="test.name", read_only=True)
    test_price = serializers.DecimalField(source="test.price", max_digits=10, decimal_places=2, read_only=True)
    patient_name = serializers.CharField(source="consultation.visit.patient.full_name", read_only=True)

    class Meta:
        model = RadiologyOrder
        fields = [
            "id", "consultation", "test", "test_name", "test_price", "patient_name",
            "status", "is_paid", "invoice", "ordered_by", "ordered_at",
        ]
        read_only_fields = ["id", "status", "is_paid", "invoice", "ordered_by", "ordered_at"]

class ConsultationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="visit.patient.full_name", read_only=True)
    diagnoses = ConsultationDiagnosisSerializer(source="consultationdiagnosis_set", many=True, read_only=True)
    prescriptions = PrescriptionSerializer(many=True, read_only=True)
    lab_orders = LabOrderSerializer(many=True, read_only=True)
    radiology_orders = RadiologyOrderSerializer(many=True, read_only=True)
    vitals = VitalSignsSerializer(source="visit.vitals", read_only=True)

    class Meta:
        model = Consultation
        fields = [
            "id", "visit", "patient_name", "doctor", "chief_complaint",
            "history_of_present_illness", "physical_examination", "treatment_plan",
            "clinical_notes", "diagnoses", "prescriptions", "lab_orders", "radiology_orders",
            "vitals", "status", "pause_reason", "pause_notes", "started_at", "completed_at",
        ]
        read_only_fields = ["id", "doctor", "started_at", "completed_at"]  # ✅ added "doctor"


class ConsultationPauseSerializer(serializers.Serializer):
    pause_reason = serializers.ChoiceField(choices=["WAITING_LAB", "WAITING_RADIOLOGY", "PATIENT_NOT_READY", "OTHER"])
    pause_notes = serializers.CharField(required=False, allow_blank=True)


# ---------------------------------------------------------------------------
# Laboratory
# ---------------------------------------------------------------------------
class LabTestCatalogSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = LabTestCatalog
        fields = ["id", "code", "name", "price", "is_active"]


class LabResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabResult
        fields = ["id", "lab_order", "result_text", "result_file", "technologist", "completed_at"]
        read_only_fields = ["id", "technologist", "completed_at"]


# ---------------------------------------------------------------------------
# Radiology
# ---------------------------------------------------------------------------
class RadiologyTestCatalogSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = RadiologyTestCatalog
        fields = ["id", "code", "name", "price", "is_active"]


class RadiologyResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = RadiologyResult
        fields = [
            "id", "radiology_order", "image_file", "report_file", "radiologist_notes",
            "radiologist", "completed_at",
        ]
        read_only_fields = ["id", "radiologist", "completed_at"]


# ---------------------------------------------------------------------------
# Pharmacy / Inventory
# ---------------------------------------------------------------------------
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "email", "address"]


class MedicineBatchSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)

    class Meta:
        model = MedicineBatch
        fields = [
            "id", "medicine", "medicine_name", "supplier", "supplier_name",
            "batch_number", "quantity_received", "quantity_remaining",
            "expiry_date", "received_date",
        ]
        read_only_fields = ["id", "received_date"]


class MedicineSerializer(serializers.ModelSerializer):
    current_stock = serializers.IntegerField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    batches = MedicineBatchSerializer(many=True, read_only=True)

    class Meta:
        model = Medicine
        fields = [
            "id", "name", "generic_name", "category", "unit", "unit_price",
            "reorder_level", "current_stock", "is_low_stock", "batches",
        ]
        read_only_fields = ["id"]


class StockTransactionSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)

    class Meta:
        model = StockTransaction
        fields = [
            "id", "medicine", "medicine_name", "batch", "transaction_type",
            "quantity", "reason", "performed_by", "created_at",
        ]
        read_only_fields = ["id", "performed_by", "created_at"]


class PharmacyDispenseSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="prescription.medicine.name", read_only=True)
    patient_name = serializers.CharField(source="prescription.consultation.visit.patient.full_name", read_only=True)

    class Meta:
        model = PharmacyDispense
        fields = [
            "id", "prescription", "medicine_name", "patient_name", "batch",
            "quantity_dispensed", "invoice", "dispensed_by", "dispensed_at",
        ]
        read_only_fields = ["id", "invoice", "dispensed_by", "dispensed_at"]


# ---------------------------------------------------------------------------
# Walk-in / OTC Pharmacy Sales (POS)
# ---------------------------------------------------------------------------
class OTCSaleItemSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    medicine_unit = serializers.CharField(source="medicine.unit", read_only=True)

    class Meta:
        model = OTCSaleItem
        fields = ["id", "sale", "medicine", "medicine_name", "medicine_unit", "batch", "quantity", "unit_price", "subtotal"]
        read_only_fields = ["id", "sale", "batch", "unit_price", "subtotal"]


class OTCSaleItemInputSerializer(serializers.Serializer):
    """Nested-write shape used only inside OTCSaleCreateSerializer's cart payload."""
    medicine = serializers.PrimaryKeyRelatedField(queryset=Medicine.objects.all())
    quantity = serializers.IntegerField(min_value=1)


class OTCSaleSerializer(serializers.ModelSerializer):
    items = OTCSaleItemSerializer(many=True, read_only=True)
    served_by_name = serializers.CharField(source="served_by.get_full_name", read_only=True)
    balance = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = OTCSale
        fields = [
            "id", "sale_number", "customer_name", "customer_phone", "items",
            "subtotal", "discount", "total_amount", "amount_paid", "balance",
            "payment_method", "reference_number", "served_by", "served_by_name",
            "qr_code", "sold_at",
        ]
        read_only_fields = [
            "id", "sale_number", "items", "subtotal", "total_amount", "served_by",
            "qr_code", "sold_at",
        ]


class OTCSaleCreateSerializer(serializers.Serializer):
    """
    Accepts a full POS cart in one shot: optional walk-in customer info,
    payment details, and a list of {medicine, quantity} line items. The view
    resolves stock (FEFO), computes totals, and creates OTCSale + OTCSaleItem
    rows inside a single transaction — mirroring PharmacyDispenseViewSet.
    """
    customer_name = serializers.CharField(required=False, allow_blank=True, default="")
    customer_phone = serializers.CharField(required=False, allow_blank=True, default="")
    discount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, default=0)
    payment_method = serializers.ChoiceField(choices=["CASH", "MPESA", "CARD", "INSURANCE"])
    reference_number = serializers.CharField(required=False, allow_blank=True, default="")
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2)
    items = OTCSaleItemInputSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("A sale must have at least one item.")
        return value


# ---------------------------------------------------------------------------
# Audit log (read-only)
# ---------------------------------------------------------------------------
class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.get_full_name", read_only=True)

    class Meta:
        model = AuditLog
        fields = ["id", "user", "user_name", "action", "model_name", "object_id", "changes", "ip_address", "timestamp"]
        
        
# api/serializers.py — add near the bottom

class TransactionSerializer(serializers.Serializer):
    """
    Read-only, unified view over Payment (hospital billing) and OTCSale
    (walk-in pharmacy). Purely a reporting shape — it doesn't map to a
    model and nothing writes through it.
    """
    id = serializers.UUIDField()
    source = serializers.CharField()          # "HOSPITAL" | "OTC"
    reference_number = serializers.CharField()
    payer_name = serializers.CharField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    method = serializers.CharField()
    served_by = serializers.CharField(allow_null=True)
    occurred_at = serializers.DateTimeField()