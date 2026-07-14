from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    WardViewSet, BedViewSet, AdmissionViewSet, BedTransferViewSet,
    WardRoundViewSet, NursingNoteViewSet, InpatientVitalsViewSet,
    MedicationOrderViewSet, MedicationAdministrationViewSet, BedChargeViewSet,
    ProcedureCatalogViewSet, InpatientProcedureViewSet,
)

router = DefaultRouter()
router.register(r"wards", WardViewSet, basename="ward")
router.register(r"beds", BedViewSet, basename="bed")
router.register(r"admissions", AdmissionViewSet, basename="admission")
router.register(r"bed-transfers", BedTransferViewSet, basename="bed-transfer")
router.register(r"ward-rounds", WardRoundViewSet, basename="ward-round")
router.register(r"nursing-notes", NursingNoteViewSet, basename="nursing-note")
router.register(r"inpatient-vitals", InpatientVitalsViewSet, basename="inpatient-vitals")
router.register(r"medication-orders", MedicationOrderViewSet, basename="medication-order")
router.register(r"medication-administrations", MedicationAdministrationViewSet, basename="medication-administration")
router.register(r"bed-charges", BedChargeViewSet, basename="bed-charge")
router.register(r"procedure-catalog", ProcedureCatalogViewSet, basename="procedure-catalog")
router.register(r"inpatient-procedures", InpatientProcedureViewSet, basename="inpatient-procedure")

urlpatterns = [path("", include(router.urls))]