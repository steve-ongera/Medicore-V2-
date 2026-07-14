from datetime import date

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from api.views import BaseModelViewSet, OutOfStockError
from api.models import (
    Patient, Visit, VisitStatus, ConsultationType, Department,
    User, Invoice, InvoiceSourceType, MedicineBatch, StockTransaction, StockTransactionType,
    Consultation, ConsultationStatus, LabOrder, LabOrderStatus, RadiologyOrder, RadiologyOrderStatus,
    LabTestCatalog, RadiologyTestCatalog,
)
from api.permissions import (
    HasRole, IsReceptionist, IsCashierOrAccountant, IsNurse, IsDoctor, ReadOnlyOrSuperAdmin,
)
from api.serializers import InvoiceSerializer, LabOrderSerializer, RadiologyOrderSerializer

from .services import generate_daily_bed_charges
from .services import generate_daily_bed_charges, ensure_admission_visit, ensure_admission_consultation, backfill_orphaned_invoices
from .models import (
    Ward, Bed, BedStatus, Admission, AdmissionStatus, BedTransfer,
    WardRound, NursingNote, InpatientVitals, MedicationOrder,
    MedicationAdministration, AdministrationStatus, BedCharge,
    ProcedureCatalog, InpatientProcedure, ProcedureStatus,
)
from .serializers import (
    WardSerializer, BedSerializer, AdmissionSerializer, AdmissionListSerializer,
    AdmitPatientSerializer, DischargeSerializer, BedTransferSerializer,
    WardRoundSerializer, NursingNoteSerializer, InpatientVitalsSerializer,
    MedicationOrderSerializer, MedicationAdministrationSerializer, BedChargeSerializer,
    ProcedureCatalogSerializer, InpatientProcedureSerializer,
    OrderProcedureSerializer, OrderLabSerializer, OrderRadiologySerializer,
)


# ---------------------------------------------------------------------------
# Wards & Beds
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Admissions
# ---------------------------------------------------------------------------
class AdmissionViewSet(BaseModelViewSet):
    queryset = Admission.objects.select_related("patient", "bed__ward", "attending_doctor", "visit").all()
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
            visit = None
            if data.get("visit"):
                visit = Visit.objects.filter(pk=data["visit"]).first()
                if not visit:
                    raise ValidationError({"visit": "Visit not found."})

            admission = Admission.objects.create(
                patient=patient,
                visit=visit,
                bed=bed,
                admitting_doctor_id=data["admitting_doctor"],
                attending_doctor_id=data.get("attending_doctor") or data["admitting_doctor"],
                admitted_by=request.user,
                admission_type=data["admission_type"],
                admission_diagnosis=data.get("admission_diagnosis", ""),
                expected_discharge_date=data.get("expected_discharge_date"),
            )
            # The post_save signal already calls ensure_admission_visit if no
            # visit was supplied — this is now a safe no-op confirming it.
            ensure_admission_visit(admission)

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

    @action(detail=True, methods=["get"], url_path="billing")
    def billing(self, request, pk=None):
        """
        Consolidated bill for this admission. Self-healing runs on every
        lookup (not just when visit is entirely missing) — this catches
        invoices that were created before their admission had a visit, such
        as the first-day bed charge raised at admission time.
        """
        admission = self.get_object()

        with transaction.atomic():
            ensure_admission_visit(admission)
            backfill_orphaned_invoices(admission)

        invoices = Invoice.objects.filter(visit=admission.visit).order_by("created_at")

        breakdown = {}
        grand_total = 0
        amount_paid = 0
        for inv in invoices:
            bucket = breakdown.setdefault(inv.source_type, {"count": 0, "total": 0, "paid": 0})
            bucket["count"] += 1
            bucket["total"] += inv.amount
            bucket["paid"] += inv.amount_paid
            grand_total += inv.amount
            amount_paid += inv.amount_paid

        return Response({
            "admission_number": admission.admission_number,
            "patient_name": admission.patient.full_name,
            "has_visit": True,
            "visit_number": admission.visit.visit_number,
            "invoices": InvoiceSerializer(invoices, many=True).data,
            "breakdown": {
                k: {"count": v["count"], "total": str(v["total"]), "paid": str(v["paid"])}
                for k, v in breakdown.items()
            },
            "grand_total": str(grand_total),
            "amount_paid": str(amount_paid),
            "balance": str(grand_total - amount_paid),
        })

    @action(detail=True, methods=["post"], url_path="order-lab")
    def order_lab(self, request, pk=None):
        admission = self.get_object()
        serializer = OrderLabSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        test = LabTestCatalog.objects.filter(pk=serializer.validated_data["test"], is_active=True).first()
        if not test:
            raise ValidationError({"test": "Lab test not found."})

        with transaction.atomic():
            consultation = ensure_admission_consultation(admission)
            order = LabOrder.objects.create(
                consultation=consultation, test=test, ordered_by=request.user,
            )
            invoice = Invoice.objects.create(
                patient=admission.patient,
                visit=consultation.visit,
                source_type=InvoiceSourceType.LAB,
                description=f"Lab Test - {test.name} ({admission.admission_number})",
                amount=test.price,
            )
            order.invoice = invoice
            order.save(update_fields=["invoice"])

        return Response(LabOrderSerializer(order, context={"request": request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="order-radiology")
    def order_radiology(self, request, pk=None):
        admission = self.get_object()
        serializer = OrderRadiologySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        test = RadiologyTestCatalog.objects.filter(pk=serializer.validated_data["test"], is_active=True).first()
        if not test:
            raise ValidationError({"test": "Radiology test not found."})

        with transaction.atomic():
            consultation = ensure_admission_consultation(admission)
            order = RadiologyOrder.objects.create(
                consultation=consultation, test=test, ordered_by=request.user,
            )
            invoice = Invoice.objects.create(
                patient=admission.patient,
                visit=consultation.visit,
                source_type=InvoiceSourceType.RADIOLOGY,
                description=f"Radiology - {test.name} ({admission.admission_number})",
                amount=test.price,
            )
            order.invoice = invoice
            order.save(update_fields=["invoice"])

        return Response(RadiologyOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="order-procedure")
    def order_procedure(self, request, pk=None):
        admission = self.get_object()
        serializer = OrderProcedureSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        procedure = ProcedureCatalog.objects.filter(pk=serializer.validated_data["procedure"], is_active=True).first()
        if not procedure:
            raise ValidationError({"procedure": "Procedure not found."})

        with transaction.atomic():
            visit = ensure_admission_visit(admission)
            proc = InpatientProcedure.objects.create(
                admission=admission, procedure=procedure,
                notes=serializer.validated_data.get("notes", ""),
                ordered_by=request.user,
            )
            invoice = Invoice.objects.create(
                patient=admission.patient,
                visit=visit,
                source_type=InvoiceSourceType.PROCEDURE,
                description=f"Procedure - {procedure.name} ({admission.admission_number})",
                amount=procedure.price,
            )
            proc.invoice = invoice
            proc.save(update_fields=["invoice"])

        return Response(InpatientProcedureSerializer(proc).data, status=status.HTTP_201_CREATED)

class BedTransferViewSet(BaseModelViewSet):
    queryset = BedTransfer.objects.select_related("from_bed", "to_bed").all()
    serializer_class = BedTransferSerializer
    filterset_fields = ["admission"]
    http_method_names = ["get", "head", "options"]  # created only via Admission.transfer-bed


# ---------------------------------------------------------------------------
# Clinical activity while admitted
# ---------------------------------------------------------------------------
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


# ---------------------------------------------------------------------------
# Inpatient medication (separate from OPD Prescription/PharmacyDispense)
# ---------------------------------------------------------------------------
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
    queryset = MedicationAdministration.objects.select_related(
        "medication_order__medicine", "batch", "invoice"
    ).all()
    serializer_class = MedicationAdministrationSerializer
    filterset_fields = ["medication_order", "status"]

    def perform_create(self, serializer):
        order = serializer.validated_data["medication_order"]
        status_value = serializer.validated_data.get("status", AdministrationStatus.GIVEN)

        if status_value != AdministrationStatus.GIVEN:
            serializer.save(administered_by=self.request.user)
            return

        medicine = order.medicine
        quantity = order.quantity

        batch = (
            MedicineBatch.objects.filter(medicine=medicine, quantity_remaining__gte=quantity)
            .order_by("expiry_date").first()
        )
        if not batch:
            raise OutOfStockError(f"{medicine.name} is out of stock.")

        with transaction.atomic():
            admin_record = serializer.save(administered_by=self.request.user, batch=batch)

            batch.quantity_remaining -= quantity
            batch.save(update_fields=["quantity_remaining"])

            StockTransaction.objects.create(
                medicine=medicine, batch=batch, transaction_type=StockTransactionType.STOCK_OUT,
                quantity=quantity, reason=f"Inpatient administration - {order.admission.admission_number}",
                performed_by=self.request.user,
            )

            invoice = Invoice.objects.create(
                patient=order.admission.patient,
                visit=order.admission.visit,
                source_type=InvoiceSourceType.PHARMACY,
                description=f"Inpatient Medication - {medicine.name} x{quantity} ({order.admission.admission_number})",
                amount=medicine.unit_price * quantity,
            )
            admin_record.invoice = invoice
            admin_record.save(update_fields=["invoice"])


# ---------------------------------------------------------------------------
# Procedures (catalog + performed)
# ---------------------------------------------------------------------------
class ProcedureCatalogViewSet(BaseModelViewSet):
    queryset = ProcedureCatalog.objects.filter(is_active=True)
    serializer_class = ProcedureCatalogSerializer
    permission_classes = [ReadOnlyOrSuperAdmin]
    search_fields = ["name", "code"]


class InpatientProcedureViewSet(BaseModelViewSet):
    queryset = InpatientProcedure.objects.select_related("procedure", "admission").all()
    serializer_class = InpatientProcedureSerializer
    filterset_fields = ["admission", "status"]

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        proc = self.get_object()
        proc.status = ProcedureStatus.COMPLETED
        proc.performed_by = request.user
        proc.completed_at = timezone.now()
        proc.save(update_fields=["status", "performed_by", "completed_at"])
        return Response(InpatientProcedureSerializer(proc).data)


# ---------------------------------------------------------------------------
# Bed / ward billing
# ---------------------------------------------------------------------------
class BedChargeViewSet(BaseModelViewSet):
    queryset = BedCharge.objects.select_related("bed").all()
    serializer_class = BedChargeSerializer
    filterset_fields = ["admission"]
    permission_classes = [IsCashierOrAccountant]
    http_method_names = ["get", "post", "head", "options"]

    @action(detail=False, methods=["post"], url_path="generate-today")
    def generate_today(self, request):
        created = generate_daily_bed_charges()
        return Response({"generated": len(created), "charge_ids": created})