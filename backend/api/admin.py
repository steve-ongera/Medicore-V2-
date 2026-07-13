from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.utils.html import format_html

from api.models import (
    User,
    AuditLog,
    Department,
    Patient,
    Allergy,
    MedicalHistoryNote,
    Visit,
    Invoice,
    Payment,
    QueueEntry,
    VitalSigns,
    ICD10Code,
    Consultation,
    ConsultationDiagnosis,
    Prescription,
    LabTestCatalog,
    LabOrder,
    LabResult,
    RadiologyTestCatalog,
    RadiologyOrder,
    RadiologyResult,
    Supplier,
    Medicine,
    MedicineBatch,
    StockTransaction,
    PharmacyDispense,
)


# ---------------------------------------------------------------------------
# Shared mixin: hide soft-deleted rows by default, show a restore action
# ---------------------------------------------------------------------------
class SoftDeleteAdminMixin:
    list_filter_soft_delete = ("is_deleted",)
    actions = ["soft_delete_selected", "restore_selected"]

    def get_queryset(self, request):
        # Use all_objects so admins can see + restore soft-deleted rows
        qs = self.model.all_objects.get_queryset()
        ordering = self.get_ordering(request)
        if ordering:
            qs = qs.order_by(*ordering)
        return qs

    @admin.action(description="Soft delete selected")
    def soft_delete_selected(self, request, queryset):
        for obj in queryset:
            obj.soft_delete()
        self.message_user(request, f"{queryset.count()} record(s) soft-deleted.")

    @admin.action(description="Restore selected")
    def restore_selected(self, request, queryset):
        queryset.update(is_deleted=False, deleted_at=None)
        self.message_user(request, f"{queryset.count()} record(s) restored.")


# ---------------------------------------------------------------------------
# Accounts / RBAC
# ---------------------------------------------------------------------------
@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "get_full_name", "role", "department", "phone", "is_active_staff", "is_staff", "is_superuser")
    list_filter = ("role", "department", "is_active_staff", "is_staff", "is_superuser")
    search_fields = ("username", "first_name", "last_name", "email", "phone")
    ordering = ("username",)

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("Hospital Role", {"fields": ("role", "phone", "department", "profile_photo", "is_active_staff")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("Hospital Role", {"fields": ("role", "phone", "department", "is_active_staff")}),
    )

    @admin.display(description="Full Name")
    def get_full_name(self, obj):
        return obj.get_full_name() or "—"


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("timestamp", "user", "action", "model_name", "object_id", "ip_address")
    list_filter = ("action", "model_name", "timestamp")
    search_fields = ("model_name", "object_id", "user__username")
    readonly_fields = ("id", "user", "action", "model_name", "object_id", "changes", "ip_address", "timestamp")
    ordering = ("-timestamp",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


# ---------------------------------------------------------------------------
# Hospital structure
# ---------------------------------------------------------------------------
@admin.register(Department)
class DepartmentAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("name", "consultation_fee_display", "is_active", "is_deleted")
    list_filter = ("is_active", "is_deleted")
    search_fields = ("name",)

    @admin.display(description="Consultation Fee")
    def consultation_fee_display(self, obj):
        return f"KES {obj.consultation_fee:,.2f}"


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------
class AllergyInline(admin.TabularInline):
    model = Allergy
    extra = 0
    fields = ("substance", "reaction", "severity")


class MedicalHistoryInline(admin.TabularInline):
    model = MedicalHistoryNote
    extra = 0
    fields = ("condition", "notes", "diagnosed_date")


@admin.register(Patient)
class PatientAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("hospital_number", "full_name", "gender", "age_display", "phone", "national_id", "is_deleted")
    list_filter = ("gender", "is_deleted")
    search_fields = ("hospital_number", "full_name", "phone", "national_id")
    readonly_fields = ("hospital_number",)
    inlines = [AllergyInline, MedicalHistoryInline]
    fieldsets = (
        ("Identification", {"fields": ("hospital_number", "full_name", "gender", "dob", "national_id")}),
        ("Contact", {"fields": ("phone", "address")}),
        ("Guardian (Minors)", {"fields": ("guardian_name", "guardian_phone", "guardian_relationship")}),
        ("Next of Kin", {"fields": ("next_of_kin_name", "next_of_kin_phone", "next_of_kin_relationship")}),
        ("Meta", {"fields": ("created_by", "is_deleted", "deleted_at")}),
    )

    @admin.display(description="Age")
    def age_display(self, obj):
        return obj.age if obj.age is not None else "—"


# ---------------------------------------------------------------------------
# Visits
# ---------------------------------------------------------------------------
@admin.register(Visit)
class VisitAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("visit_number", "patient", "department", "doctor", "status", "consultation_fee_display", "visit_date")
    list_filter = ("status", "department", "consultation_type", "is_deleted")
    search_fields = ("visit_number", "patient__full_name", "patient__hospital_number")
    readonly_fields = ("visit_number", "visit_date")
    autocomplete_fields = ("patient",)
    date_hierarchy = "visit_date"

    @admin.display(description="Fee")
    def consultation_fee_display(self, obj):
        return f"KES {obj.consultation_fee:,.2f}"


@admin.register(VitalSigns)
class VitalSignsAdmin(admin.ModelAdmin):
    list_display = ("visit", "weight_kg", "height_cm", "bmi", "bp_display", "pulse_bpm", "recorded_by", "recorded_at")
    search_fields = ("visit__visit_number", "visit__patient__full_name")
    readonly_fields = ("bmi", "recorded_at")

    @admin.display(description="BP")
    def bp_display(self, obj):
        if obj.bp_systolic and obj.bp_diastolic:
            return f"{obj.bp_systolic}/{obj.bp_diastolic}"
        return "—"


# ---------------------------------------------------------------------------
# Billing
# ---------------------------------------------------------------------------
class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ("receipt_number", "paid_at")
    fields = ("receipt_number", "amount", "method", "reference_number", "cashier", "paid_at")


@admin.register(Invoice)
class InvoiceAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("invoice_number", "patient", "source_type", "amount_display", "amount_paid_display", "balance_display", "status")
    list_filter = ("source_type", "status", "is_deleted")
    search_fields = ("invoice_number", "patient__full_name", "patient__hospital_number")
    readonly_fields = ("invoice_number",)
    autocomplete_fields = ("patient", "visit")
    inlines = [PaymentInline]

    @admin.display(description="Amount")
    def amount_display(self, obj):
        return f"KES {obj.amount:,.2f}"

    @admin.display(description="Paid")
    def amount_paid_display(self, obj):
        return f"KES {obj.amount_paid:,.2f}"

    @admin.display(description="Balance")
    def balance_display(self, obj):
        color = "red" if obj.balance > 0 else "green"
        return format_html('<span style="color:{};">KES {:,.2f}</span>', color, obj.balance)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "invoice", "amount_display", "method", "reference_number", "cashier", "paid_at")
    list_filter = ("method", "paid_at")
    search_fields = ("receipt_number", "reference_number", "invoice__invoice_number", "invoice__patient__full_name")
    readonly_fields = ("receipt_number", "paid_at")
    date_hierarchy = "paid_at"

    @admin.display(description="Amount")
    def amount_display(self, obj):
        return f"KES {obj.amount:,.2f}"


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------
@admin.register(QueueEntry)
class QueueEntryAdmin(admin.ModelAdmin):
    list_display = ("patient", "visit", "queue_type", "status", "assigned_to", "priority", "called_at", "completed_at")
    list_filter = ("queue_type", "status")
    search_fields = ("patient__full_name", "visit__visit_number")
    ordering = ("-priority", "created_at")


# ---------------------------------------------------------------------------
# ICD-10
# ---------------------------------------------------------------------------
@admin.register(ICD10Code)
class ICD10CodeAdmin(admin.ModelAdmin):
    list_display = ("code", "description", "category")
    list_filter = ("category",)
    search_fields = ("code", "description")


# ---------------------------------------------------------------------------
# Consultation
# ---------------------------------------------------------------------------
class ConsultationDiagnosisInline(admin.TabularInline):
    model = ConsultationDiagnosis
    extra = 0
    autocomplete_fields = ("icd10_code",)


class PrescriptionInline(admin.TabularInline):
    model = Prescription
    extra = 0
    fields = ("medicine", "dosage", "frequency", "duration", "quantity", "instructions", "is_dispensed")


class LabOrderInline(admin.TabularInline):
    model = LabOrder
    extra = 0
    fields = ("test", "status", "is_paid", "ordered_by")


class RadiologyOrderInline(admin.TabularInline):
    model = RadiologyOrder
    extra = 0
    fields = ("test", "status", "is_paid", "ordered_by")


@admin.register(Consultation)
class ConsultationAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("visit", "doctor", "status", "started_at", "completed_at")
    list_filter = ("status", "pause_reason", "is_deleted")
    search_fields = ("visit__visit_number", "visit__patient__full_name", "doctor__username")
    autocomplete_fields = ("visit", "doctor")
    inlines = [ConsultationDiagnosisInline, PrescriptionInline, LabOrderInline, RadiologyOrderInline]
    fieldsets = (
        ("Visit", {"fields": ("visit", "doctor", "status")}),
        ("Clinical Notes", {"fields": ("chief_complaint", "history_of_present_illness", "physical_examination", "treatment_plan", "clinical_notes")}),
        ("Pause Details", {"fields": ("pause_reason", "pause_notes"), "classes": ("collapse",)}),
        ("Timestamps", {"fields": ("started_at", "completed_at")}),
    )
    readonly_fields = ("started_at",)


# ---------------------------------------------------------------------------
# Laboratory
# ---------------------------------------------------------------------------
@admin.register(LabTestCatalog)
class LabTestCatalogAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("code", "name", "price_display", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")

    @admin.display(description="Price")
    def price_display(self, obj):
        return f"KES {obj.price:,.2f}"


@admin.register(LabOrder)
class LabOrderAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("test", "consultation", "status", "is_paid", "ordered_by", "ordered_at")
    list_filter = ("status", "is_paid", "is_deleted")
    search_fields = ("test__name", "consultation__visit__visit_number", "consultation__visit__patient__full_name")


@admin.register(LabResult)
class LabResultAdmin(admin.ModelAdmin):
    list_display = ("lab_order", "technologist", "completed_at")
    search_fields = ("lab_order__test__name", "lab_order__consultation__visit__patient__full_name")


# ---------------------------------------------------------------------------
# Radiology
# ---------------------------------------------------------------------------
@admin.register(RadiologyTestCatalog)
class RadiologyTestCatalogAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("code", "name", "price_display", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")

    @admin.display(description="Price")
    def price_display(self, obj):
        return f"KES {obj.price:,.2f}"


@admin.register(RadiologyOrder)
class RadiologyOrderAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("test", "consultation", "status", "is_paid", "ordered_by", "ordered_at")
    list_filter = ("status", "is_paid", "is_deleted")
    search_fields = ("test__name", "consultation__visit__visit_number", "consultation__visit__patient__full_name")


@admin.register(RadiologyResult)
class RadiologyResultAdmin(admin.ModelAdmin):
    list_display = ("radiology_order", "radiologist", "completed_at")
    search_fields = ("radiology_order__test__name", "radiology_order__consultation__visit__patient__full_name")


# ---------------------------------------------------------------------------
# Pharmacy / Inventory
# ---------------------------------------------------------------------------
@admin.register(Supplier)
class SupplierAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("name", "phone", "email", "address")
    search_fields = ("name", "phone", "email")


class MedicineBatchInline(admin.TabularInline):
    model = MedicineBatch
    extra = 0
    fields = ("batch_number", "supplier", "quantity_received", "quantity_remaining", "expiry_date", "received_date")
    readonly_fields = ("received_date",)


@admin.register(Medicine)
class MedicineAdmin(SoftDeleteAdminMixin, admin.ModelAdmin):
    list_display = ("name", "generic_name", "category", "unit", "unit_price_display", "current_stock", "stock_status")
    list_filter = ("category", "unit", "is_deleted")
    search_fields = ("name", "generic_name", "category")
    inlines = [MedicineBatchInline]

    @admin.display(description="Unit Price")
    def unit_price_display(self, obj):
        return f"KES {obj.unit_price:,.2f}"

    @admin.display(description="Stock Level")
    def stock_status(self, obj):
        if obj.is_low_stock:
            return format_html('<span style="color:red;font-weight:bold;">Low Stock</span>')
        return format_html('<span style="color:green;">OK</span>')


@admin.register(MedicineBatch)
class MedicineBatchAdmin(admin.ModelAdmin):
    list_display = ("medicine", "batch_number", "supplier", "quantity_received", "quantity_remaining", "expiry_date", "is_expiring_soon")
    list_filter = ("supplier",)
    search_fields = ("medicine__name", "batch_number")
    date_hierarchy = "expiry_date"

    @admin.display(description="Expiring Soon", boolean=True)
    def is_expiring_soon(self, obj):
        from datetime import date, timedelta
        return obj.expiry_date <= date.today() + timedelta(days=90)


@admin.register(StockTransaction)
class StockTransactionAdmin(admin.ModelAdmin):
    list_display = ("medicine", "batch", "transaction_type", "quantity", "performed_by", "created_at")
    list_filter = ("transaction_type",)
    search_fields = ("medicine__name", "batch__batch_number", "reason")
    date_hierarchy = "created_at"


@admin.register(PharmacyDispense)
class PharmacyDispenseAdmin(admin.ModelAdmin):
    list_display = ("prescription", "batch", "quantity_dispensed", "dispensed_by", "dispensed_at")
    search_fields = ("prescription__medicine__name", "prescription__consultation__visit__patient__full_name")
    date_hierarchy = "dispensed_at"