from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from api import views

router = DefaultRouter()

# =============================================================================
# Accounts
# =============================================================================
router.register(r"users", views.UserViewSet, basename="user")

# =============================================================================
# Hospital Structure
# =============================================================================
router.register(r"departments", views.DepartmentViewSet, basename="department")

# =============================================================================
# Patients
# =============================================================================
router.register(r"patients", views.PatientViewSet, basename="patient")
router.register(r"allergies", views.AllergyViewSet, basename="allergy")
router.register(r"medical-history", views.MedicalHistoryNoteViewSet, basename="medical-history")

# =============================================================================
# Visits
# =============================================================================
router.register(r"visits", views.VisitViewSet, basename="visit")

# =============================================================================
# Billing
# =============================================================================
router.register(r"invoices", views.InvoiceViewSet, basename="invoice")
router.register(r"payments", views.PaymentViewSet, basename="payment")

# =============================================================================
# Queue
# =============================================================================
router.register(r"queue", views.QueueEntryViewSet, basename="queue")

# =============================================================================
# Triage
# =============================================================================
router.register(r"vitals", views.VitalSignsViewSet, basename="vitals")

# =============================================================================
# ICD-10
# =============================================================================
router.register(r"icd10", views.ICD10CodeViewSet, basename="icd10")

# =============================================================================
# Consultation
# =============================================================================
router.register(r"consultations", views.ConsultationViewSet, basename="consultation")
router.register(r"prescriptions", views.PrescriptionViewSet, basename="prescription")

# =============================================================================
# Laboratory
# =============================================================================
router.register(r"lab-tests-catalog", views.LabTestCatalogViewSet, basename="lab-test-catalog")
router.register(r"lab-orders", views.LabOrderViewSet, basename="lab-order")
router.register(r"lab-results", views.LabResultViewSet, basename="lab-result")

# =============================================================================
# Radiology
# =============================================================================
router.register(r"radiology-tests-catalog", views.RadiologyTestCatalogViewSet, basename="radiology-test-catalog")
router.register(r"radiology-orders", views.RadiologyOrderViewSet, basename="radiology-order")
router.register(r"radiology-results", views.RadiologyResultViewSet, basename="radiology-result")

# =============================================================================
# Pharmacy / Inventory
# =============================================================================
router.register(r"suppliers", views.SupplierViewSet, basename="supplier")
router.register(r"medicines", views.MedicineViewSet, basename="medicine")
router.register(r"medicine-batches", views.MedicineBatchViewSet, basename="medicine-batch")
router.register(r"stock-transactions", views.StockTransactionViewSet, basename="stock-transaction")
router.register(r"pharmacy-dispenses", views.PharmacyDispenseViewSet, basename="pharmacy-dispense")

# =============================================================================
# OTC Pharmacy POS
# =============================================================================
router.register(r"otc-sales", views.OTCSaleViewSet, basename="otc-sale")

# =============================================================================
# Audit
# =============================================================================
router.register(r"audit-logs", views.AuditLogViewSet, basename="audit-log")

urlpatterns = [
    # =========================================================================
    # Authentication
    # =========================================================================
    path("auth/login/", views.LoginView.as_view(), name="login"),
    path("auth/logout/", views.LogoutView.as_view(), name="logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("auth/me/", views.MeView.as_view(), name="me"),
    path("auth/change-password/", views.ChangePasswordView.as_view(), name="change-password"),

    # =========================================================================
    # Dashboard & Reports
    # =========================================================================
    path("dashboard/", views.DashboardView.as_view(), name="dashboard"),
    path("reports/", views.ReportsView.as_view(), name="reports"),
    path("transactions/", views.AllTransactionsView.as_view(), name="transactions"),

    # =========================================================================
    # API Endpoints
    # =========================================================================
    path("", include(router.urls)),
]