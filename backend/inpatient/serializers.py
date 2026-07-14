from rest_framework import serializers

from api.models import Invoice, InvoiceSourceType
from .models import (
    Ward, Bed, Admission, BedTransfer, WardRound, NursingNote,
    InpatientVitals, MedicationOrder, MedicationAdministration, BedCharge,
)


class WardSerializer(serializers.ModelSerializer):
    bed_capacity = serializers.IntegerField(read_only=True)
    occupied_beds = serializers.IntegerField(read_only=True)
    is_active = serializers.BooleanField(default=True)

    class Meta:
        model = Ward
        fields = [
            "id", "name", "ward_type", "floor", "gender_restriction",
            "default_daily_rate", "bed_capacity", "occupied_beds", "is_active",
        ]


class BedSerializer(serializers.ModelSerializer):
    ward_name = serializers.CharField(source="ward.name", read_only=True)
    daily_rate = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    current_patient = serializers.SerializerMethodField()

    class Meta:
        model = Bed
        fields = [
            "id", "ward", "ward_name", "bed_number", "status",
            "daily_rate_override", "daily_rate", "current_patient",
        ]

    def get_current_patient(self, obj):
        admission = obj.admissions.filter(status="ADMITTED").first()
        if not admission:
            return None
        return {"admission_id": str(admission.id), "patient_name": admission.patient.full_name}


class BedTransferSerializer(serializers.ModelSerializer):
    from_bed_label = serializers.CharField(source="from_bed.bed_number", read_only=True)
    to_bed_label = serializers.CharField(source="to_bed.bed_number", read_only=True)

    class Meta:
        model = BedTransfer
        fields = [
            "id", "admission", "from_bed", "from_bed_label", "to_bed", "to_bed_label",
            "reason", "transferred_by", "transferred_at",
        ]
        read_only_fields = ["id", "from_bed", "transferred_by", "transferred_at"]


class WardRoundSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source="doctor.get_full_name", read_only=True)

    class Meta:
        model = WardRound
        fields = ["id", "admission", "doctor", "doctor_name", "notes", "plan", "round_date"]
        read_only_fields = ["id", "doctor", "round_date"]


class NursingNoteSerializer(serializers.ModelSerializer):
    nurse_name = serializers.CharField(source="nurse.get_full_name", read_only=True)

    class Meta:
        model = NursingNote
        fields = ["id", "admission", "nurse", "nurse_name", "shift", "note", "created_at"]
        read_only_fields = ["id", "nurse", "created_at"]


class InpatientVitalsSerializer(serializers.ModelSerializer):
    bmi = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = InpatientVitals
        fields = [
            "id", "admission", "shift", "weight_kg", "height_cm", "bmi", "temperature_c",
            "pulse_bpm", "respiratory_rate", "bp_systolic", "bp_diastolic",
            "oxygen_saturation", "recorded_by", "recorded_at",
        ]
        read_only_fields = ["id", "bmi", "recorded_by", "recorded_at"]


class MedicationOrderSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source="medicine.name", read_only=True)
    ordered_by_name = serializers.CharField(source="ordered_by.get_full_name", read_only=True)

    class Meta:
        model = MedicationOrder
        fields = [
            "id", "admission", "medicine", "medicine_name", "dosage", "route", "frequency",
            "quantity", "start_date", "end_date", "is_active", "ordered_by", "ordered_by_name",
        ]
        read_only_fields = ["id", "start_date", "ordered_by"]


class MedicationAdministrationSerializer(serializers.ModelSerializer):
    administered_by_name = serializers.CharField(source="administered_by.get_full_name", read_only=True)
    medicine_name = serializers.CharField(source="medication_order.medicine.name", read_only=True)

    class Meta:
        model = MedicationAdministration
        fields = [
            "id", "medication_order", "medicine_name", "administered_by", "administered_by_name",
            "status", "notes", "batch", "invoice", "administered_at",
        ]
        read_only_fields = ["id", "administered_by", "batch", "invoice", "administered_at"]


class BedChargeSerializer(serializers.ModelSerializer):
    bed_label = serializers.CharField(source="bed.bed_number", read_only=True)

    class Meta:
        model = BedCharge
        fields = ["id", "admission", "bed", "bed_label", "charge_date", "amount", "invoice"]
        read_only_fields = ["id", "invoice"]


class AdmissionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    hospital_number = serializers.CharField(source="patient.hospital_number", read_only=True)
    ward_name = serializers.CharField(source="bed.ward.name", read_only=True)
    bed_number = serializers.CharField(source="bed.bed_number", read_only=True)
    admitting_doctor_name = serializers.CharField(source="admitting_doctor.get_full_name", read_only=True)
    attending_doctor_name = serializers.CharField(source="attending_doctor.get_full_name", read_only=True)
    length_of_stay_days = serializers.IntegerField(read_only=True)

    ward_rounds = WardRoundSerializer(many=True, read_only=True)
    nursing_notes = NursingNoteSerializer(many=True, read_only=True)
    vitals = InpatientVitalsSerializer(many=True, read_only=True)
    medication_orders = MedicationOrderSerializer(many=True, read_only=True)
    bed_transfers = BedTransferSerializer(many=True, read_only=True)

    class Meta:
        model = Admission
        fields = [
            "id", "admission_number", "patient", "patient_name", "hospital_number", "visit",
            "bed", "ward_name", "bed_number", "admitting_doctor", "admitting_doctor_name",
            "attending_doctor", "attending_doctor_name", "admitted_by", "admission_type",
            "admission_diagnosis", "icd10_codes", "admission_date", "expected_discharge_date",
            "status", "discharge_date", "discharge_type", "discharge_summary", "discharge_by",
            "length_of_stay_days", "ward_rounds", "nursing_notes", "vitals",
            "medication_orders", "bed_transfers",
        ]
        read_only_fields = [
            "id", "admission_number", "admitted_by", "admission_date", "status",
            "discharge_date", "discharge_by",
        ]


class AdmissionListSerializer(serializers.ModelSerializer):
    """Lightweight shape for the admissions/ward board list."""
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    hospital_number = serializers.CharField(source="patient.hospital_number", read_only=True)
    ward_name = serializers.CharField(source="bed.ward.name", read_only=True)
    bed_number = serializers.CharField(source="bed.bed_number", read_only=True)
    attending_doctor_name = serializers.CharField(source="attending_doctor.get_full_name", read_only=True)
    length_of_stay_days = serializers.IntegerField(read_only=True)

    class Meta:
        model = Admission
        fields = [
            "id", "admission_number", "patient_name", "hospital_number", "ward_name",
            "bed_number", "attending_doctor_name", "admission_type", "status",
            "admission_date", "length_of_stay_days",
        ]


class DischargeSerializer(serializers.Serializer):
    discharge_type = serializers.ChoiceField(choices=["NORMAL", "DAMA", "REFERRED", "DECEASED", "ABSCONDED"])
    discharge_summary = serializers.CharField()


class AdmitPatientSerializer(serializers.Serializer):
    """Accepts patient + bed + clinical info in one shot to open an Admission."""
    patient = serializers.UUIDField()
    visit = serializers.UUIDField(required=False, allow_null=True)
    bed = serializers.UUIDField()
    admitting_doctor = serializers.UUIDField()
    attending_doctor = serializers.UUIDField(required=False, allow_null=True)
    admission_type = serializers.ChoiceField(choices=["EMERGENCY", "ELECTIVE", "TRANSFER_IN", "MATERNITY"])
    admission_diagnosis = serializers.CharField(required=False, allow_blank=True, default="")
    expected_discharge_date = serializers.DateField(required=False, allow_null=True)