from django.contrib import admin

from .models import (
    Ward, Bed, Admission, BedTransfer, WardRound, NursingNote,
    InpatientVitals, MedicationOrder, MedicationAdministration, BedCharge, ProcedureCatalog , InpatientProcedure
)


@admin.register(Ward)
class WardAdmin(admin.ModelAdmin):
    list_display = ("name", "ward_type", "gender_restriction", "default_daily_rate", "bed_capacity", "occupied_beds", "is_active")
    list_filter = ("ward_type", "gender_restriction", "is_active")
    search_fields = ("name",)


@admin.register(Bed)
class BedAdmin(admin.ModelAdmin):
    list_display = ("bed_number", "ward", "status", "daily_rate")
    list_filter = ("status", "ward")
    search_fields = ("bed_number", "ward__name")
    autocomplete_fields = ("ward",)


class WardRoundInline(admin.TabularInline):
    model = WardRound
    extra = 0
    fields = ("doctor", "notes", "plan", "round_date")
    readonly_fields = ("round_date",)


class NursingNoteInline(admin.TabularInline):
    model = NursingNote
    extra = 0
    fields = ("nurse", "shift", "note", "created_at")
    readonly_fields = ("created_at",)


class InpatientVitalsInline(admin.TabularInline):
    model = InpatientVitals
    extra = 0
    fields = ("shift", "temperature_c", "pulse_bpm", "bp_systolic", "bp_diastolic", "oxygen_saturation", "recorded_at")
    readonly_fields = ("recorded_at",)


class MedicationOrderInline(admin.TabularInline):
    model = MedicationOrder
    extra = 0
    fields = ("medicine", "dosage", "route", "frequency", "is_active")


class BedChargeInline(admin.TabularInline):
    model = BedCharge
    extra = 0
    fields = ("bed", "charge_date", "amount", "invoice")


@admin.register(Admission)
class AdmissionAdmin(admin.ModelAdmin):
    list_display = (
        "admission_number", "patient", "bed", "admission_type", "status",
        "admitting_doctor", "attending_doctor", "admission_date", "discharge_date",
    )
    list_filter = ("status", "admission_type", "bed__ward")
    search_fields = ("admission_number", "patient__full_name", "patient__hospital_number")
    autocomplete_fields = ("patient", "visit", "bed", "admitting_doctor", "attending_doctor", "admitted_by", "discharge_by")
    readonly_fields = ("admission_number", "admission_date")
    inlines = [WardRoundInline, NursingNoteInline, InpatientVitalsInline, MedicationOrderInline, BedChargeInline]


@admin.register(BedTransfer)
class BedTransferAdmin(admin.ModelAdmin):
    list_display = ("admission", "from_bed", "to_bed", "transferred_by", "transferred_at")
    list_filter = ("transferred_at",)
    search_fields = ("admission__admission_number", "admission__patient__full_name")
    autocomplete_fields = ("admission", "from_bed", "to_bed", "transferred_by")


@admin.register(WardRound)
class WardRoundAdmin(admin.ModelAdmin):
    list_display = ("admission", "doctor", "round_date")
    list_filter = ("round_date",)
    search_fields = ("admission__admission_number", "admission__patient__full_name")
    autocomplete_fields = ("admission", "doctor")


@admin.register(NursingNote)
class NursingNoteAdmin(admin.ModelAdmin):
    list_display = ("admission", "nurse", "shift", "created_at")
    list_filter = ("shift", "created_at")
    search_fields = ("admission__admission_number", "admission__patient__full_name")
    autocomplete_fields = ("admission", "nurse")


@admin.register(InpatientVitals)
class InpatientVitalsAdmin(admin.ModelAdmin):
    list_display = ("admission", "shift", "bp_systolic", "bp_diastolic", "pulse_bpm", "temperature_c", "recorded_at")
    list_filter = ("shift", "recorded_at")
    search_fields = ("admission__admission_number", "admission__patient__full_name")
    autocomplete_fields = ("admission", "recorded_by")


@admin.register(MedicationOrder)
class MedicationOrderAdmin(admin.ModelAdmin):
    list_display = ("admission", "medicine", "dosage", "route", "frequency", "is_active", "start_date")
    list_filter = ("route", "is_active")
    search_fields = ("admission__admission_number", "medicine__name")
    autocomplete_fields = ("admission", "medicine", "ordered_by")


@admin.register(MedicationAdministration)
class MedicationAdministrationAdmin(admin.ModelAdmin):
    list_display = ("medication_order", "status", "administered_by", "administered_at")
    list_filter = ("status", "administered_at")
    search_fields = ("medication_order__admission__admission_number", "medication_order__medicine__name")
    autocomplete_fields = ("medication_order", "administered_by")


@admin.register(BedCharge)
class BedChargeAdmin(admin.ModelAdmin):
    list_display = ("admission", "bed", "charge_date", "amount", "invoice")
    list_filter = ("charge_date",)
    search_fields = ("admission__admission_number", "admission__patient__full_name")
    autocomplete_fields = ("admission", "bed", "invoice")
    
    

@admin.register(ProcedureCatalog)
class ProcedureCatalogAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "price", "is_active"]
    search_fields = ["code", "name"]


@admin.register(InpatientProcedure)
class InpatientProcedureAdmin(admin.ModelAdmin):
    list_display = ["admission", "procedure", "status", "ordered_by", "performed_by", "ordered_at"]
    list_filter = ["status"]
    search_fields = ["admission__admission_number", "procedure__name"]