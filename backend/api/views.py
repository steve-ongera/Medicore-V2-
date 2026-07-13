from datetime import date, timedelta

from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.utils import timezone
from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView  # noqa: F401 (re-exported via urls)

from api.middleware import set_current_user
from api.models import (
    User, Role, Department, Patient, Allergy, MedicalHistoryNote, Visit,
    VisitStatus, Invoice, Payment, QueueEntry, QueueType, QueueStatus,
    VitalSigns, ICD10Code, Consultation, ConsultationStatus, ConsultationDiagnosis,
    Prescription, LabTestCatalog, LabOrder, LabOrderStatus, LabResult,
    RadiologyTestCatalog, RadiologyOrder, RadiologyOrderStatus, RadiologyResult,
    Supplier, Medicine, MedicineBatch, StockTransaction, StockTransactionType,
    PharmacyDispense, AuditLog, InvoiceSourceType, OTCSale, OTCSaleItem,
)
from api.permissions import (
    HasRole, IsReceptionist, IsCashierOrAccountant, IsNurse, IsDoctor,
    IsLabTechnologist, IsRadiologist, IsPharmacist, ReadOnlyOrSuperAdmin, IsSuperAdmin,
)
from api.filters import (
    PatientFilter, VisitFilter, InvoiceFilter, PaymentFilter, QueueEntryFilter,
    LabOrderFilter, RadiologyOrderFilter, MedicineFilter, MedicineBatchFilter,
)
from api.serializers import (
    UserSerializer, UserCreateSerializer, ChangePasswordSerializer, DepartmentSerializer,
    PatientSerializer, PatientSearchResultSerializer, AllergySerializer, MedicalHistoryNoteSerializer,
    VisitSerializer, InvoiceSerializer, PaymentSerializer, QueueEntrySerializer, VitalSignsSerializer,
    ICD10CodeSerializer, ConsultationSerializer, ConsultationPauseSerializer, ConsultationDiagnosisSerializer,
    PrescriptionSerializer, LabTestCatalogSerializer, LabOrderSerializer, LabResultSerializer,
    RadiologyTestCatalogSerializer, RadiologyOrderSerializer, RadiologyResultSerializer,
    SupplierSerializer, MedicineSerializer, MedicineBatchSerializer, StockTransactionSerializer,
    PharmacyDispenseSerializer, AuditLogSerializer, OTCSaleSerializer, OTCSaleCreateSerializer,
    TransactionSerializer,
)
from api.utils import generate_qr_code


# ---------------------------------------------------------------------------
# Base ViewSet: keeps thread-local user in sync (for audit signals) and
# gives every subclass search + ordering + pagination + filtering for free.
# ---------------------------------------------------------------------------
class BaseModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        set_current_user(request.user)

    def perform_destroy(self, instance):
        # Global soft-delete: never hard-delete clinical/financial records.
        instance.soft_delete()


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        user = authenticate(request, username=username, password=password)
        if not user:
            return Response({"detail": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)
        if not user.is_active or not user.is_active_staff:
            return Response({"detail": "Account is deactivated."}, status=status.HTTP_403_FORBIDDEN)

        refresh = RefreshToken.for_user(user)
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserSerializer(user).data,
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception:
            pass
        return Response({"detail": "Logged out."}, status=status.HTTP_205_RESET_CONTENT)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response({"old_password": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data["new_password"])
        user.save()
        return Response({"detail": "Password updated."})


# ---------------------------------------------------------------------------
# Accounts / Users (Super Admin manages staff)
# ---------------------------------------------------------------------------
class UserViewSet(BaseModelViewSet):
    queryset = User.objects.all().order_by("first_name")
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["role", "department", "is_active_staff"]
    search_fields = ["username", "first_name", "last_name", "email", "phone"]
    ordering_fields = ["first_name", "date_joined"]

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer


# ---------------------------------------------------------------------------
# Departments (lookup table)
# ---------------------------------------------------------------------------
class DepartmentViewSet(BaseModelViewSet):
    queryset = Department.objects.filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [ReadOnlyOrSuperAdmin]
    search_fields = ["name"]


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------
class PatientViewSet(BaseModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    filterset_class = PatientFilter
    search_fields = ["full_name", "phone", "national_id", "hospital_number"]
    ordering_fields = ["full_name", "created_at"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="search")
    def search(self, request):
        """
        Duplicate-check search used before registering a new patient.
        Matches on phone, national_id, or hospital_number.
        """
        query = request.query_params.get("q", "").strip()
        if not query:
            return Response({"detail": "Provide a search query (?q=)."}, status=status.HTTP_400_BAD_REQUEST)

        matches = Patient.objects.filter(
            Q(phone__icontains=query) | Q(national_id__iexact=query) | Q(hospital_number__iexact=query)
        )
        if matches.exists():
            return Response({
                "found": True,
                "message": "Patient Found",
                "patients": PatientSearchResultSerializer(matches, many=True).data,
            })
        return Response({"found": False, "message": "No matching patient. You may register a new one."})

    @action(detail=True, methods=["get"], url_path="visits")
    def visits(self, request, pk=None):
        patient = self.get_object()
        visits = patient.visits.all().order_by("-visit_date")
        return Response(VisitSerializer(visits, many=True).data)

    @action(detail=True, methods=["get"], url_path="summary")
    def summary(self, request, pk=None):
        """Full clinical snapshot shown on the doctor's consultation screen."""
        patient = self.get_object()
        return Response({
            "patient": PatientSerializer(patient).data,
            "previous_visits": VisitSerializer(patient.visits.exclude(status=VisitStatus.REGISTERED)[:10], many=True).data,
            "allergies": AllergySerializer(patient.allergies.all(), many=True).data,
            "medical_history": MedicalHistoryNoteSerializer(patient.medical_history.all(), many=True).data,
            "current_medications": PrescriptionSerializer(
                Prescription.objects.filter(consultation__visit__patient=patient, is_dispensed=False).order_by("-created_at"),
                many=True,
            ).data,
        })


class AllergyViewSet(BaseModelViewSet):
    queryset = Allergy.objects.all()
    serializer_class = AllergySerializer
    filterset_fields = ["patient"]


class MedicalHistoryNoteViewSet(BaseModelViewSet):
    queryset = MedicalHistoryNote.objects.all()
    serializer_class = MedicalHistoryNoteSerializer
    filterset_fields = ["patient"]


# ---------------------------------------------------------------------------
# Visits
# ---------------------------------------------------------------------------
class VisitViewSet(BaseModelViewSet):
    queryset = Visit.objects.select_related("patient", "department", "doctor").all()
    serializer_class = VisitSerializer
    filterset_class = VisitFilter
    search_fields = ["visit_number", "patient__full_name", "patient__hospital_number"]
    ordering_fields = ["visit_date"]

    def perform_create(self, serializer):
        visit = serializer.save(registered_by=self.request.user, status=VisitStatus.AWAITING_PAYMENT)
        return visit


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------
class InvoiceViewSet(BaseModelViewSet):
    queryset = Invoice.objects.select_related("patient", "visit").all()
    serializer_class = InvoiceSerializer
    filterset_class = InvoiceFilter
    search_fields = ["invoice_number", "patient__full_name"]
    http_method_names = ["get", "post", "head", "options"]  # invoices are system-generated, not hand-edited


class PaymentViewSet(BaseModelViewSet):
    queryset = Payment.objects.select_related("invoice", "cashier").all()
    serializer_class = PaymentSerializer
    filterset_class = PaymentFilter
    search_fields = ["receipt_number", "invoice__invoice_number", "invoice__patient__full_name"]
    http_method_names = ["get", "post", "head", "options"]  # payments are immutable once made

    def perform_create(self, serializer):
        payment = serializer.save(cashier=self.request.user)
        # Generate a printable QR code encoding the receipt number + amount,
        # for verification at pickup / audit time.
        qr_payload = f"RECEIPT:{payment.receipt_number}|AMOUNT:{payment.amount}|INVOICE:{payment.invoice.invoice_number}"
        payment.qr_code = generate_qr_code(qr_payload, f"receipt_{payment.receipt_number}")
        payment.save(update_fields=["qr_code"])

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, pk=None):
        """Structured receipt payload for the frontend to render/print."""
        payment = self.get_object()
        invoice = payment.invoice
        qr_code_url = None
        if payment.qr_code:
            qr_code_url = request.build_absolute_uri(payment.qr_code.url)

        return Response({
            "hospital_name": "City General Hospital",
            "receipt_number": payment.receipt_number,
            "patient_name": invoice.patient.full_name,
            "visit_number": invoice.visit.visit_number if invoice.visit else None,
            "cashier": payment.cashier.get_full_name() if payment.cashier else None,
            "payment_method": payment.method,
            "amount_paid": str(payment.amount),
            "invoice_balance": str(invoice.balance),
            "qr_code_url": qr_code_url,
            "paid_at": payment.paid_at,
        })


# ---------------------------------------------------------------------------
# Queue Management
# ---------------------------------------------------------------------------
class QueueEntryViewSet(BaseModelViewSet):
    queryset = QueueEntry.objects.select_related("patient", "visit", "assigned_to").exclude(
        status__in=[QueueStatus.COMPLETED, QueueStatus.CANCELLED]
    )
    serializer_class = QueueEntrySerializer
    filterset_class = QueueEntryFilter
    search_fields = ["patient__full_name", "patient__hospital_number"]

    @action(detail=True, methods=["post"], url_path="call-next")
    def call_next(self, request, pk=None):
        entry = self.get_object()
        entry.status = QueueStatus.WITH_NURSE if entry.queue_type == QueueType.NURSE else QueueStatus.CONSULTING
        entry.assigned_to = request.user
        entry.called_at = timezone.now()
        entry.save()
        return Response(QueueEntrySerializer(entry).data)

    @action(detail=False, methods=["get"], url_path="my-queue")
    def my_queue(self, request):
        """Doctor/Nurse dashboard: entries assigned to me or waiting in my queue type."""
        queue_type = request.query_params.get("queue_type", QueueType.DOCTOR if request.user.role == Role.DOCTOR else QueueType.NURSE)
        entries = self.get_queryset().filter(queue_type=queue_type).order_by("-priority", "created_at")
        return Response(QueueEntrySerializer(entries, many=True).data)


# ---------------------------------------------------------------------------
# Triage / Vitals
# ---------------------------------------------------------------------------
class VitalSignsViewSet(BaseModelViewSet):
    queryset = VitalSigns.objects.select_related("visit").all()
    serializer_class = VitalSignsSerializer
    filterset_fields = ["visit"]

    def perform_create(self, serializer):
        vitals = serializer.save(recorded_by=self.request.user)
        # Move patient from Nurse queue -> Waiting Doctor, and open the doctor queue.
        QueueEntry.objects.filter(visit=vitals.visit, queue_type=QueueType.NURSE).update(
            status=QueueStatus.COMPLETED, completed_at=timezone.now()
        )
        QueueEntry.objects.get_or_create(
            visit=vitals.visit, queue_type=QueueType.DOCTOR,
            defaults={"patient": vitals.visit.patient, "status": QueueStatus.WAITING_DOCTOR},
        )
        vitals.visit.status = VisitStatus.IN_QUEUE
        vitals.visit.save(update_fields=["status"])


# ---------------------------------------------------------------------------
# ICD-10
# ---------------------------------------------------------------------------
class ICD10CodeViewSet(BaseModelViewSet):
    queryset = ICD10Code.objects.all()
    serializer_class = ICD10CodeSerializer
    permission_classes = [ReadOnlyOrSuperAdmin]
    search_fields = ["code", "description"]
    lookup_field = "code"

    @action(detail=False, methods=["get"], url_path="lookup")
    def lookup(self, request):
        """Autocomplete: search by code or description. e.g. ?q=A09"""
        query = request.query_params.get("q", "").strip()
        results = ICD10Code.objects.filter(Q(code__istartswith=query) | Q(description__icontains=query))[:20]
        return Response(ICD10CodeSerializer(results, many=True).data)


# ---------------------------------------------------------------------------
# Consultation
# ---------------------------------------------------------------------------
class ConsultationViewSet(BaseModelViewSet):
    queryset = Consultation.objects.select_related("visit__patient", "doctor").all()
    serializer_class = ConsultationSerializer
    filterset_fields = ["status", "doctor", "visit"]
    search_fields = ["visit__patient__full_name", "visit__visit_number"]

    def perform_create(self, serializer):
        visit = serializer.validated_data["visit"]
        existing = Consultation.objects.filter(visit=visit).first()
        if existing:
            serializer.instance = existing
            return

        consultation = serializer.save(doctor=self.request.user)
        consultation.visit.status = VisitStatus.IN_CONSULTATION
        consultation.visit.save(update_fields=["status"])
        QueueEntry.objects.filter(visit=consultation.visit, queue_type=QueueType.DOCTOR).update(
            status=QueueStatus.CONSULTING, assigned_to=self.request.user
        )

    @action(detail=True, methods=["post"], url_path="add-diagnosis")
    def add_diagnosis(self, request, pk=None):
        consultation = self.get_object()
        icd10_code = request.data.get("icd10_code")
        is_primary = request.data.get("is_primary", False)
        notes = request.data.get("notes", "")
        try:
            code_obj = ICD10Code.objects.get(code=icd10_code)
        except ICD10Code.DoesNotExist:
            return Response({"detail": "Unknown ICD-10 code."}, status=status.HTTP_404_NOT_FOUND)
        diagnosis, _ = ConsultationDiagnosis.objects.update_or_create(
            consultation=consultation, icd10_code=code_obj,
            defaults={"is_primary": is_primary, "notes": notes},
        )
        return Response(ConsultationDiagnosisSerializer(diagnosis).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="pause")
    def pause(self, request, pk=None):
        consultation = self.get_object()
        serializer = ConsultationPauseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        consultation.status = ConsultationStatus.PAUSED
        consultation.pause_reason = serializer.validated_data["pause_reason"]
        consultation.pause_notes = serializer.validated_data.get("pause_notes", "")
        consultation.save()
        return Response(ConsultationSerializer(consultation).data)

    @action(detail=True, methods=["post"], url_path="resume")
    def resume(self, request, pk=None):
        consultation = self.get_object()
        consultation.status = ConsultationStatus.IN_PROGRESS
        consultation.pause_reason = ""
        consultation.pause_notes = ""
        consultation.save()
        return Response(ConsultationSerializer(consultation).data)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        consultation = self.get_object()
        consultation.status = ConsultationStatus.COMPLETED
        consultation.completed_at = timezone.now()
        consultation.save()
        return Response(ConsultationSerializer(consultation).data)


class PrescriptionViewSet(BaseModelViewSet):
    queryset = Prescription.objects.select_related("medicine", "consultation").all()
    serializer_class = PrescriptionSerializer
    filterset_fields = ["consultation", "is_dispensed"]
    search_fields = ["medicine__name"]


# ---------------------------------------------------------------------------
# Laboratory
# ---------------------------------------------------------------------------
class LabTestCatalogViewSet(BaseModelViewSet):
    queryset = LabTestCatalog.objects.filter(is_active=True)
    serializer_class = LabTestCatalogSerializer
    permission_classes = [ReadOnlyOrSuperAdmin]
    search_fields = ["name", "code"]


class LabOrderViewSet(BaseModelViewSet):
    queryset = LabOrder.objects.select_related("test", "consultation__visit__patient").all()
    serializer_class = LabOrderSerializer
    filterset_class = LabOrderFilter
    search_fields = ["consultation__visit__patient__full_name", "test__name"]

    def perform_create(self, serializer):
        order = serializer.save(ordered_by=self.request.user)
        invoice = Invoice.objects.create(
            patient=order.consultation.visit.patient,
            visit=order.consultation.visit,
            source_type=InvoiceSourceType.LAB,
            description=f"Lab Test - {order.test.name}",
            amount=order.test.price,
        )
        order.invoice = invoice
        order.save(update_fields=["invoice"])

    @action(detail=False, methods=["get"], url_path="pending")
    def pending(self, request):
        """Lab dashboard: orders awaiting collection/processing."""
        orders = self.get_queryset().exclude(status__in=[LabOrderStatus.COMPLETED, LabOrderStatus.CANCELLED])
        return Response(LabOrderSerializer(orders, many=True).data)

    @action(detail=True, methods=["post"], url_path="collect")
    def collect(self, request, pk=None):
        order = self.get_object()
        if not order.is_paid:
            return Response({"detail": "Payment Required"}, status=status.HTTP_402_PAYMENT_REQUIRED)
        order.status = LabOrderStatus.COLLECTED
        order.save(update_fields=["status"])
        return Response(LabOrderSerializer(order).data)


class LabResultViewSet(BaseModelViewSet):
    queryset = LabResult.objects.select_related("lab_order").all()
    serializer_class = LabResultSerializer
    filterset_fields = ["lab_order"]

    def perform_create(self, serializer):
        order = serializer.validated_data["lab_order"]
        if not order.is_paid:
            raise PermissionDeniedPaymentRequired()
        result = serializer.save(technologist=self.request.user, completed_at=timezone.now())
        order.status = LabOrderStatus.COMPLETED
        order.save(update_fields=["status"])


# Small helper exception so LabResultViewSet.perform_create can short-circuit with 402.
from rest_framework.exceptions import APIException


class PermissionDeniedPaymentRequired(APIException):
    status_code = status.HTTP_402_PAYMENT_REQUIRED
    default_detail = "Payment Required. Cannot proceed until the lab order is paid."
    default_code = "payment_required"


# ---------------------------------------------------------------------------
# Radiology
# ---------------------------------------------------------------------------
class RadiologyTestCatalogViewSet(BaseModelViewSet):
    queryset = RadiologyTestCatalog.objects.filter(is_active=True)
    serializer_class = RadiologyTestCatalogSerializer
    permission_classes = [ReadOnlyOrSuperAdmin]
    search_fields = ["name", "code"]


class RadiologyOrderViewSet(BaseModelViewSet):
    queryset = RadiologyOrder.objects.select_related("test", "consultation__visit__patient").all()
    serializer_class = RadiologyOrderSerializer
    filterset_class = RadiologyOrderFilter
    search_fields = ["consultation__visit__patient__full_name", "test__name"]

    def perform_create(self, serializer):
        order = serializer.save(ordered_by=self.request.user)
        invoice = Invoice.objects.create(
            patient=order.consultation.visit.patient,
            visit=order.consultation.visit,
            source_type=InvoiceSourceType.RADIOLOGY,
            description=f"Radiology - {order.test.name}",
            amount=order.test.price,
        )
        order.invoice = invoice
        order.save(update_fields=["invoice"])

    @action(detail=False, methods=["get"], url_path="pending")
    def pending(self, request):
        orders = self.get_queryset().exclude(status__in=[RadiologyOrderStatus.REPORTED, RadiologyOrderStatus.CANCELLED])
        return Response(RadiologyOrderSerializer(orders, many=True).data)


class RadiologyResultViewSet(BaseModelViewSet):
    queryset = RadiologyResult.objects.select_related("radiology_order").all()
    serializer_class = RadiologyResultSerializer
    filterset_fields = ["radiology_order"]

    def perform_create(self, serializer):
        order = serializer.validated_data["radiology_order"]
        if not order.is_paid:
            raise PermissionDeniedPaymentRequired()
        result = serializer.save(radiologist=self.request.user, completed_at=timezone.now())
        order.status = RadiologyOrderStatus.REPORTED
        order.save(update_fields=["status"])


# ---------------------------------------------------------------------------
# Pharmacy / Inventory
# ---------------------------------------------------------------------------
class SupplierViewSet(BaseModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    search_fields = ["name", "phone", "email"]


class MedicineViewSet(BaseModelViewSet):
    queryset = Medicine.objects.all()
    serializer_class = MedicineSerializer
    filterset_class = MedicineFilter
    search_fields = ["name", "generic_name", "category"]

    @action(detail=False, methods=["get"], url_path="autocomplete")
    def autocomplete(self, request):
        query = request.query_params.get("q", "").strip()
        results = Medicine.objects.filter(Q(name__icontains=query) | Q(generic_name__icontains=query))[:20]
        return Response(MedicineSerializer(results, many=True).data)

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        low = [m for m in Medicine.objects.all() if m.is_low_stock]
        return Response(MedicineSerializer(low, many=True).data)


class MedicineBatchViewSet(BaseModelViewSet):
    queryset = MedicineBatch.objects.select_related("medicine", "supplier").all()
    serializer_class = MedicineBatchSerializer
    filterset_class = MedicineBatchFilter
    search_fields = ["medicine__name", "batch_number"]

    def perform_create(self, serializer):
        batch = serializer.save(quantity_remaining=serializer.validated_data["quantity_received"])
        StockTransaction.objects.create(
            medicine=batch.medicine, batch=batch, transaction_type=StockTransactionType.STOCK_IN,
            quantity=batch.quantity_received, reason="New batch received",
            performed_by=self.request.user,
        )


class StockTransactionViewSet(BaseModelViewSet):
    queryset = StockTransaction.objects.select_related("medicine", "batch").all()
    serializer_class = StockTransactionSerializer
    filterset_fields = ["medicine", "transaction_type"]
    http_method_names = ["get", "post", "head", "options"]

    def perform_create(self, serializer):
        serializer.save(performed_by=self.request.user)


class PharmacyDispenseViewSet(BaseModelViewSet):
    queryset = PharmacyDispense.objects.select_related("prescription__medicine", "batch").all()
    serializer_class = PharmacyDispenseSerializer
    filterset_fields = ["prescription"]

    def perform_create(self, serializer):
        prescription = serializer.validated_data["prescription"]
        quantity = serializer.validated_data["quantity_dispensed"]
        medicine = prescription.medicine

        # Pick the earliest-expiring batch with enough stock (FEFO).
        batch = (
            MedicineBatch.objects.filter(medicine=medicine, quantity_remaining__gte=quantity)
            .order_by("expiry_date").first()
        )
        if not batch:
            raise OutOfStockError()

        with transaction.atomic():
            dispense = serializer.save(batch=batch, dispensed_by=self.request.user)

            batch.quantity_remaining -= quantity
            batch.save(update_fields=["quantity_remaining"])

            StockTransaction.objects.create(
                medicine=medicine, batch=batch, transaction_type=StockTransactionType.STOCK_OUT,
                quantity=quantity, reason=f"Dispensed for prescription {prescription.id}",
                performed_by=self.request.user,
            )

            invoice = Invoice.objects.create(
                patient=prescription.consultation.visit.patient,
                visit=prescription.consultation.visit,
                source_type=InvoiceSourceType.PHARMACY,
                description=f"Pharmacy - {medicine.name} x{quantity}",
                amount=medicine.unit_price * quantity,
            )
            dispense.invoice = invoice
            dispense.save(update_fields=["invoice"])

            prescription.is_dispensed = True
            prescription.save(update_fields=["is_dispensed"])


class OutOfStockError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Out of Stock. Cannot dispense this medicine."
    default_code = "out_of_stock"


# ---------------------------------------------------------------------------
# Walk-in / OTC Pharmacy Sales (POS)
# ---------------------------------------------------------------------------
class OTCSaleViewSet(BaseModelViewSet):
    """
    Direct, patient-free medicine sales — a retail POS transaction rather
    than a clinical workflow. Sales are immutable once made (no PATCH/PUT),
    matching the PaymentViewSet/InvoiceViewSet convention elsewhere.
    """
    queryset = OTCSale.objects.prefetch_related("items__medicine").select_related("served_by").all()
    serializer_class = OTCSaleSerializer
    search_fields = ["sale_number", "customer_name", "customer_phone"]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return OTCSaleCreateSerializer
        return OTCSaleSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            sale = OTCSale.objects.create(
                customer_name=data.get("customer_name", ""),
                customer_phone=data.get("customer_phone", ""),
                discount=data.get("discount", 0),
                payment_method=data["payment_method"],
                reference_number=data.get("reference_number", ""),
                amount_paid=data["amount_paid"],
                served_by=request.user,
            )

            subtotal = 0
            for item in data["items"]:
                medicine = item["medicine"]
                quantity = item["quantity"]

                # FEFO: earliest-expiring batch with enough stock, same as PharmacyDispenseViewSet.
                batch = (
                    MedicineBatch.objects.filter(medicine=medicine, quantity_remaining__gte=quantity)
                    .order_by("expiry_date").first()
                )
                if not batch:
                    raise OutOfStockError(f"{medicine.name} is out of stock.")

                sale_item = OTCSaleItem.objects.create(
                    sale=sale, medicine=medicine, batch=batch,
                    quantity=quantity, unit_price=medicine.unit_price,
                )
                subtotal += sale_item.subtotal

                batch.quantity_remaining -= quantity
                batch.save(update_fields=["quantity_remaining"])

                StockTransaction.objects.create(
                    medicine=medicine, batch=batch, transaction_type=StockTransactionType.STOCK_OUT,
                    quantity=quantity, reason=f"OTC sale {sale.sale_number}",
                    performed_by=request.user,
                )

            sale.subtotal = subtotal
            sale.total_amount = subtotal - sale.discount
            sale.save(update_fields=["subtotal", "total_amount"])

            qr_payload = f"OTC:{sale.sale_number}|AMOUNT:{sale.total_amount}"
            sale.qr_code = generate_qr_code(qr_payload, f"otc_receipt_{sale.sale_number}")
            sale.save(update_fields=["qr_code"])

        return Response(
            OTCSaleSerializer(sale, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, pk=None):
        """Structured receipt payload for the frontend to render/print — mirrors PaymentViewSet.receipt."""
        sale = self.get_object()
        qr_code_url = request.build_absolute_uri(sale.qr_code.url) if sale.qr_code else None

        return Response({
            "hospital_name": "City General Hospital",
            "sale_number": sale.sale_number,
            "customer_name": sale.customer_name or "Walk-in Customer",
            "customer_phone": sale.customer_phone,
            "served_by": sale.served_by.get_full_name() if sale.served_by else None,
            "items": [
                {
                    "medicine_name": item.medicine.name,
                    "quantity": item.quantity,
                    "unit_price": str(item.unit_price),
                    "subtotal": str(item.subtotal),
                }
                for item in sale.items.all()
            ],
            "subtotal": str(sale.subtotal),
            "discount": str(sale.discount),
            "total_amount": str(sale.total_amount),
            "amount_paid": str(sale.amount_paid),
            "balance": str(sale.balance),
            "payment_method": sale.payment_method,
            "reference_number": sale.reference_number,
            "qr_code_url": qr_code_url,
            "sold_at": sale.sold_at,
        })


# ---------------------------------------------------------------------------
# Audit Log (read-only, Super Admin)
# ---------------------------------------------------------------------------
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related("user").all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]
    filterset_fields = ["model_name", "action", "user"]
    search_fields = ["object_id", "model_name"]


# ---------------------------------------------------------------------------
# Unified Transactions (read-only, merges Payment + OTCSale)
# ---------------------------------------------------------------------------
class AllTransactionsView(APIView):
    """
    GET /api/transactions/?date_from=&date_to=&source=HOSPITAL|OTC

    Merges hospital billing (Payment) and walk-in pharmacy sales (OTCSale)
    into a single, newest-first feed so "all my money" can be viewed in one
    place. This is purely a read-only aggregation: it does not write to,
    modify, or reroute either model. Payment/Invoice and OTCSale creation
    behave exactly as before — nothing about those flows changes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        source = request.query_params.get("source")

        rows = []

        if source in (None, "", "HOSPITAL"):
            payments = Payment.objects.select_related("invoice__patient", "cashier").all()
            if date_from:
                payments = payments.filter(paid_at__date__gte=date_from)
            if date_to:
                payments = payments.filter(paid_at__date__lte=date_to)
            for p in payments:
                rows.append({
                    "id": p.id,
                    "source": "HOSPITAL",
                    "reference_number": p.receipt_number,
                    "payer_name": p.invoice.patient.full_name,
                    "amount": p.amount,
                    "method": p.method,
                    "served_by": p.cashier.get_full_name() if p.cashier else None,
                    "occurred_at": p.paid_at,
                })

        if source in (None, "", "OTC"):
            sales = OTCSale.objects.select_related("served_by").all()
            if date_from:
                sales = sales.filter(sold_at__date__gte=date_from)
            if date_to:
                sales = sales.filter(sold_at__date__lte=date_to)
            for s in sales:
                rows.append({
                    "id": s.id,
                    "source": "OTC",
                    "reference_number": s.sale_number,
                    "payer_name": s.customer_name or "Walk-in Customer",
                    "amount": s.amount_paid,
                    "method": s.payment_method,
                    "served_by": s.served_by.get_full_name() if s.served_by else None,
                    "occurred_at": s.sold_at,
                })

        rows.sort(key=lambda r: r["occurred_at"], reverse=True)
        return Response(TransactionSerializer(rows, many=True).data)


# ---------------------------------------------------------------------------
# Dashboard & Reports
# ---------------------------------------------------------------------------
class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        todays_visits = Visit.objects.filter(visit_date__date=today)
        todays_payments = Payment.objects.filter(paid_at__date=today)
        todays_otc = OTCSale.objects.filter(sold_at__date=today)

        cards = {
            "todays_patients": todays_visits.values("patient").distinct().count(),
            "waiting_patients": QueueEntry.objects.exclude(
                status__in=[QueueStatus.COMPLETED, QueueStatus.CANCELLED]
            ).count(),
            "todays_revenue": str(
                (todays_payments.aggregate(total=Sum("amount"))["total"] or 0)
                + (todays_otc.aggregate(total=Sum("amount_paid"))["total"] or 0)
            ),
            "pending_lab": LabOrder.objects.exclude(
                status__in=[LabOrderStatus.COMPLETED, LabOrderStatus.CANCELLED]
            ).count(),
            "pending_radiology": RadiologyOrder.objects.exclude(
                status__in=[RadiologyOrderStatus.REPORTED, RadiologyOrderStatus.CANCELLED]
            ).count(),
            "todays_consultations": Consultation.objects.filter(started_at__date=today).count(),
            "medicine_stock_alerts": len([m for m in Medicine.objects.all() if m.is_low_stock]),
        }

        last_7_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        revenue_chart = []
        for d in last_7_days:
            hospital_total = Payment.objects.filter(paid_at__date=d).aggregate(t=Sum("amount"))["t"] or 0
            otc_total = OTCSale.objects.filter(sold_at__date=d).aggregate(t=Sum("amount_paid"))["t"] or 0
            revenue_chart.append({"date": d.isoformat(), "revenue": str(hospital_total + otc_total)})

        visits_chart = [
            {"date": d.isoformat(), "visits": Visit.objects.filter(visit_date__date=d).count()}
            for d in last_7_days
        ]
        department_chart = list(
            Visit.objects.filter(visit_date__date__gte=today - timedelta(days=30))
            .values("department__name").annotate(count=Count("id")).order_by("-count")
        )

        return Response({
            "cards": cards,
            "charts": {"revenue": revenue_chart, "visits": visits_chart, "departments": department_chart},
        })


class ReportsView(APIView):
    """
    GET /api/reports/?type=daily_revenue|doctor_revenue|department_revenue|patient_statistics
                        |medicine_sales|lab_revenue|radiology_revenue|consultation_revenue|otc_sales
        &date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get("type", "daily_revenue")
        date_from = request.query_params.get("date_from") or str(date.today() - timedelta(days=30))
        date_to = request.query_params.get("date_to") or str(date.today())

        payments = Payment.objects.filter(paid_at__date__gte=date_from, paid_at__date__lte=date_to)
        invoices = Invoice.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to)

        if report_type == "daily_revenue":
            # Combine hospital billing (Payment) with walk-in pharmacy sales
            # (OTCSale) so the daily revenue report reflects all money taken,
            # not just hospital invoices.
            hospital_by_day = {
                row["paid_at__date"]: row["total"] or 0
                for row in payments.values("paid_at__date").annotate(total=Sum("amount"))
            }
            otc_qs = OTCSale.objects.filter(sold_at__date__gte=date_from, sold_at__date__lte=date_to)
            otc_by_day = {
                row["sold_at__date"]: row["total"] or 0
                for row in otc_qs.values("sold_at__date").annotate(total=Sum("amount_paid"))
            }
            all_days = sorted(set(hospital_by_day) | set(otc_by_day))
            data = [
                {
                    "date": d.isoformat(),
                    "hospital_total": str(hospital_by_day.get(d, 0)),
                    "otc_total": str(otc_by_day.get(d, 0)),
                    "total": str(hospital_by_day.get(d, 0) + otc_by_day.get(d, 0)),
                }
                for d in all_days
            ]
        elif report_type == "doctor_revenue":
            data = list(
                invoices.filter(source_type=InvoiceSourceType.CONSULTATION, visit__doctor__isnull=False)
                .values("visit__doctor__first_name", "visit__doctor__last_name")
                .annotate(total=Sum("amount_paid")).order_by("-total")
            )
        elif report_type == "department_revenue":
            data = list(
                invoices.filter(source_type=InvoiceSourceType.CONSULTATION)
                .values("visit__department__name").annotate(total=Sum("amount_paid")).order_by("-total")
            )
        elif report_type == "patient_statistics":
            data = {
                "total_patients": Patient.objects.count(),
                "new_patients_in_range": Patient.objects.filter(created_at__date__gte=date_from, created_at__date__lte=date_to).count(),
                "total_visits_in_range": Visit.objects.filter(visit_date__date__gte=date_from, visit_date__date__lte=date_to).count(),
            }
        elif report_type == "medicine_sales":
            data = list(
                PharmacyDispense.objects.filter(dispensed_at__date__gte=date_from, dispensed_at__date__lte=date_to)
                .values("prescription__medicine__name")
                .annotate(total_qty=Sum("quantity_dispensed")).order_by("-total_qty")
            )
        elif report_type == "otc_sales":
            data = list(
                OTCSaleItem.objects.filter(sale__sold_at__date__gte=date_from, sale__sold_at__date__lte=date_to)
                .values("medicine__name")
                .annotate(total_qty=Sum("quantity"), total_revenue=Sum("subtotal")).order_by("-total_revenue")
            )
        elif report_type == "lab_revenue":
            data = list(invoices.filter(source_type=InvoiceSourceType.LAB).aggregate(total=Sum("amount_paid")).items())
        elif report_type == "radiology_revenue":
            data = list(invoices.filter(source_type=InvoiceSourceType.RADIOLOGY).aggregate(total=Sum("amount_paid")).items())
        elif report_type == "consultation_revenue":
            data = list(invoices.filter(source_type=InvoiceSourceType.CONSULTATION).aggregate(total=Sum("amount_paid")).items())
        else:
            return Response({"detail": "Unknown report type."}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"type": report_type, "date_from": date_from, "date_to": date_to, "data": data})