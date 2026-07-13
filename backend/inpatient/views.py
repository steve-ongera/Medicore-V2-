from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from api.views import BaseModelViewSet
from api.models import Patient, Visit, User, Invoice, InvoiceSourceType
from api.permissions import IsDoctor, IsNurse, IsReceptionist, IsCashierOrAccountant, ReadOnlyOrSuperAdmin

from .models import (
    Ward, Bed, BedStatus, Admission, AdmissionStatus, BedTransfer,
    WardRound, NursingNote, InpatientVitals, MedicationOrder,
    MedicationAdministration, BedCharge,
)
from .serializers import (
    WardSerializer, BedSerializer, AdmissionSerializer, AdmissionListSerializer,
    AdmitPatientSerializer, DischargeSerializer, BedTransferSerializer,
    WardRoundSerializer, NursingNoteSerializer, InpatientVitalsSerializer,
    MedicationOrderSerializer, MedicationAdministrationSerializer, BedChargeSerializer,
)


class WardViewSet(BaseModelViewSet):
    queryset = Ward.objects.filter(is_active=True)
    serializer_class = WardSerializer
    permission_classes = [ReadOnlyOrSuperAdmin]
    search_fields = ["name"]

    @action(detail=False, methods=["get"], url_path="occupancy")
    def occupancy(self, request):
        data = [
            {
                "id": str(w.id),
                "name": w.name,
                "ward_type": w.ward_type,
                "capacity": w.bed_capacity,
                "occupied": w.occupied_beds,
                "available": w.bed_capacity - w.occupied_beds,
            }
            for w in self.get_queryset()
        ]
        return Response(data)


class BedViewSet(BaseModelViewSet):
    queryset = Bed.objects.select_related("ward").all()
    serializer_class = BedSerializer
    filterset_fields = ["ward", "status"]

    @action(detail=False, methods=["get"], url_path="available")
    def available(self, request):
        ward_id = request.query_params.get("ward")
        qs = self.get_queryset().filter(status=BedStatus.AVAILABLE)
        if ward_id:
            qs = qs.filter(ward_id=ward_id)
        return Response(BedSerializer(qs, many=True).data)


class AdmissionViewSet(BaseModelViewSet):
    queryset = Admission.objects.select_related("patient", "bed__ward", "attending_doctor").all()
    filterset_fields = ["status", "admission_type", "bed__ward"]
    search_fields = ["admission_number", "patient__full_name", "patient__hospital_number"]

    def get_serializer_class(self):
        if self.action == "list":
            return AdmissionListSerializer
        return AdmissionSerializer

    def create(self, request, *args, **kwargs):
        serializer = AdmitPatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        bed = Bed.objects.select_related("ward").filter(pk=data["bed"]).first()
        if not bed:
            raise ValidationError({"bed": "Bed not found."})
        if bed.status != BedStatus.AVAILABLE:
            raise ValidationError({"bed": "Bed is not available."})

        patient = Patient.objects.filter(pk=data["patient"]).first()
        if not patient:
            raise ValidationError({"patient": "Patient not found."})

        with transaction.atomic():
            admission = Admission.objects.create(
                patient=patient,
                visit_id=data.get("visit"),
                bed=bed,
                admitting_doctor_id=data["admitting_doctor"],
                attending_doctor_id=data.get("attending_doctor") or data["admitting_doctor"],
                admitted_by=request.user,
                admission_type=data["admission_type"],
                admission_diagnosis=data.get("admission_diagnosis", ""),
                expected_discharge_date=data.get("expected_discharge_date"),
            )
            bed.status = BedStatus.OCCUPIED
            bed.save(update_fields=["status"])

        return Response(AdmissionSerializer(admission).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="discharge")
    def discharge(self, request, pk=None):
        admission = self.get_object()
        if admission.status != AdmissionStatus.ADMITTED:
            raise ValidationError({"detail": "Admission is already closed."})

        serializer = DischargeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            admission.status = (
                AdmissionStatus.DECEASED if serializer.validated_data["discharge_type"] == "DECEASED"
                else AdmissionStatus.DISCHARGED
            )
            admission.discharge_type = serializer.validated_data["discharge_type"]
            admission.discharge_summary = serializer.validated_data["discharge_summary"]
            admission.discharge_date = timezone.now()
            admission.discharge_by = request.user
            admission.save()

            admission.bed.status = BedStatus.AVAILABLE
            admission.bed.save(update_fields=["status"])

        return Response(AdmissionSerializer(admission).data)

    @action(detail=True, methods=["post"], url_path="transfer-bed")
    def transfer_bed(self, request, pk=None):
        admission = self.get_object()
        to_bed_id = request.data.get("to_bed")
        reason = request.data.get("reason", "")
        to_bed = Bed.objects.filter(pk=to_bed_id).first()
        if not to_bed:
            raise ValidationError({"to_bed": "Bed not found."})
        if to_bed.status != BedStatus.AVAILABLE:
            raise ValidationError({"to_bed": "Destination bed is not available."})

        with transaction.atomic():
            old_bed = admission.bed
            BedTransfer.objects.create(
                admission=admission, from_bed=old_bed, to_bed=to_bed,
                reason=reason, transferred_by=request.user,
            )
            old_bed.status = BedStatus.AVAILABLE
            old_bed.save(update_fields=["status"])
            to_bed.status = BedStatus.OCCUPIED
            to_bed.save(update_fields=["status"])
            admission.bed = to_bed
            admission.save(update_fields=["bed"])

        return Response(AdmissionSerializer(admission).data)

    @action(detail=False, methods=["get"], url_path="active")
    def active(self, request):
        qs = self.get_queryset().filter(status=AdmissionStatus.ADMITTED)
        return Response(AdmissionListSerializer(qs, many=True).data)


class BedTransferViewSet(BaseModelViewSet):
    queryset = BedTransfer.objects.select_related("from_bed", "to_bed").all()
    serializer_class = BedTransferSerializer
    filterset_fields = ["admission"]
    http_method_names = ["get", "head", "options"]  # created only via Admission.transfer-bed


class WardRoundViewSet(BaseModelViewSet):
    queryset = WardRound.objects.select_related("doctor").all()
    serializer_class = WardRoundSerializer
    filterset_fields = ["admission", "doctor"]

    def perform_create(self, serializer):
        serializer.save(doctor=self.request.user)


class NursingNoteViewSet(BaseModelViewSet):
    queryset = NursingNote.objects.select_related("nurse").all()
    serializer_class = NursingNoteSerializer
    filterset_fields = ["admission", "shift"]

    def perform_create(self, serializer):
        serializer.save(nurse=self.request.user)


class InpatientVitalsViewSet(BaseModelViewSet):
    queryset = InpatientVitals.objects.all()
    serializer_class = InpatientVitalsSerializer
    filterset_fields = ["admission"]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class MedicationOrderViewSet(BaseModelViewSet):
    queryset = MedicationOrder.objects.select_related("medicine").all()
    serializer_class = MedicationOrderSerializer
    filterset_fields = ["admission", "is_active"]

    def perform_create(self, serializer):
        serializer.save(ordered_by=self.request.user)

    @action(detail=True, methods=["post"], url_path="discontinue")
    def discontinue(self, request, pk=None):
        order = self.get_object()
        order.is_active = False
        order.end_date = timezone.now()
        order.save(update_fields=["is_active", "end_date"])
        return Response(MedicationOrderSerializer(order).data)


class MedicationAdministrationViewSet(BaseModelViewSet):
    queryset = MedicationAdministration.objects.select_related("medication_order__medicine").all()
    serializer_class = MedicationAdministrationSerializer
    filterset_fields = ["medication_order", "status"]

    def perform_create(self, serializer):
        serializer.save(administered_by=self.request.user)


class BedChargeViewSet(BaseModelViewSet):
    queryset = BedCharge.objects.select_related("bed").all()
    serializer_class = BedChargeSerializer
    filterset_fields = ["admission"]
    permission_classes = [IsCashierOrAccountant]
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=False, methods=["post"], url_path="generate-today")
    def generate_today(self, request):
        """Creates today's bed charge (+ invoice) for every currently admitted patient who doesn't already have one."""
        today = date.today()
        created = []
        active_admissions = Admission.objects.filter(status=AdmissionStatus.ADMITTED).select_related("bed", "patient")

        for admission in active_admissions:
            if BedCharge.objects.filter(admission=admission, charge_date=today).exists():
                continue
            amount = admission.bed.daily_rate
            invoice = Invoice.objects.create(
                patient=admission.patient,
                visit=admission.visit,
                source_type=InvoiceSourceType.INPATIENT,
                description=f"Bed Charge - {admission.bed.ward.name} Bed {admission.bed.bed_number} ({today})",
                amount=amount,
            )
            charge = BedCharge.objects.create(
                admission=admission, bed=admission.bed, charge_date=today,
                amount=amount, invoice=invoice,
            )
            created.append(str(charge.id))

        return Response({"generated": len(created), "charge_ids": created})