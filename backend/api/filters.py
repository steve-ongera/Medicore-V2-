import django_filters as df
from api.models import (
    Patient, Visit, Invoice, Payment, QueueEntry, LabOrder,
    RadiologyOrder, Medicine, MedicineBatch, ConsultationDiagnosis,
)


class PatientFilter(df.FilterSet):
    phone = df.CharFilter(field_name="phone", lookup_expr="icontains")
    national_id = df.CharFilter(field_name="national_id", lookup_expr="iexact")
    hospital_number = df.CharFilter(field_name="hospital_number", lookup_expr="iexact")

    class Meta:
        model = Patient
        fields = ["gender", "phone", "national_id", "hospital_number"]


class VisitFilter(df.FilterSet):
    date_from = df.DateFilter(field_name="visit_date", lookup_expr="gte")
    date_to = df.DateFilter(field_name="visit_date", lookup_expr="lte")

    class Meta:
        model = Visit
        fields = ["status", "department", "doctor", "consultation_type", "date_from", "date_to"]


class InvoiceFilter(df.FilterSet):
    class Meta:
        model = Invoice
        fields = ["status", "source_type", "patient", "visit"]


class PaymentFilter(df.FilterSet):
    date_from = df.DateFilter(field_name="paid_at", lookup_expr="gte")
    date_to = df.DateFilter(field_name="paid_at", lookup_expr="lte")

    class Meta:
        model = Payment
        fields = ["method", "cashier", "date_from", "date_to"]


class QueueEntryFilter(df.FilterSet):
    class Meta:
        model = QueueEntry
        fields = ["queue_type", "status", "assigned_to"]


class LabOrderFilter(df.FilterSet):
    class Meta:
        model = LabOrder
        fields = ["status", "is_paid", "test"]


class RadiologyOrderFilter(df.FilterSet):
    class Meta:
        model = RadiologyOrder
        fields = ["status", "is_paid", "test"]


class MedicineFilter(df.FilterSet):
    low_stock = df.BooleanFilter(method="filter_low_stock")

    class Meta:
        model = Medicine
        fields = ["category"]

    def filter_low_stock(self, queryset, name, value):
        ids = [m.id for m in queryset if m.is_low_stock] if value else None
        return queryset.filter(id__in=ids) if ids is not None else queryset


class MedicineBatchFilter(df.FilterSet):
    expiring_before = df.DateFilter(field_name="expiry_date", lookup_expr="lte")

    class Meta:
        model = MedicineBatch
        fields = ["medicine", "supplier", "expiring_before"]