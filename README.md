# Medicore V2  HMIS Backend — Hospital Management Information System

A comprehensive Hospital Management Information System (HMIS) built as a **single-app Django REST Framework backend** that manages the complete patient journey—from **registration, billing, queue management, triage, consultation, laboratory and radiology services, pharmacy, to reporting**. Developed with **Python 3.13, Django 5, Django REST Framework, and PostgreSQL**, the system features **JWT authentication**, **Role-Based Access Control (RBAC)**, **soft deletes**, **audit logging**, **QR-coded receipts**, and **OpenAPI/Swagger documentation**. Designed with simplicity and maintainability in mind, all backend functionality is contained within a single Django application (`api`), providing a secure, scalable, and efficient foundation for modern healthcare management.


---

## Project Structure

```
hmis/
│
├── hmis_backend/                       # Django REST Framework (single "api" app)
│   ├── manage.py
│   ├── requirements.txt
│   ├── .env.example
│   │
│   ├── backend/                        # Project config
│   │   ├── __init__.py
│   │   ├── settings.py                 # DB, DRF, JWT, CORS, Swagger
│   │   └── urls.py                     # Root URLConf + Swagger/Redoc
│   │
│   ├── api/                            # ⭐ Everything lives here
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── admin.py
│   │   ├── models.py                   # All tables (patients → reports)
│   │   ├── serializers.py
│   │   ├── views.py                    # ViewSets + auth/dashboard/report views
│   │   ├── urls.py                     # DRF router
│   │   ├── permissions.py              # RBAC per role
│   │   ├── filters.py
│   │   ├── signals.py                  # Audit log + workflow automation
│   │   ├── managers.py                 # Soft delete
│   │   ├── middleware.py
│   │   ├── exceptions.py
│   │   ├── utils.py                    # Number/QR/BMI generators
│   │   ├── management/commands/
│   │   └── migrations/
│   │
│   ├── media/                          # Uploads (lab results, QR receipts, radiology images)
│   └── static/                         # Hospital logo, static assets
│
└── hmis_frontend/                      # React 19 (JSX)
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example                    # VITE_API_BASE_URL=...
    │
    └── src/
        ├── main.jsx
        ├── App.jsx                     # ⭐ ALL routes defined here
        │__ styles/main.css
        ├── components/                 # Reusable, dumb/presentational
        │   ├── Navbar.jsx
        │   ├── Sidebar.jsx
        │   ├── DataTable.jsx
        │   ├── SearchBar.jsx
        │   ├── Pagination.jsx
        │   ├── StatusBadge.jsx
        │   ├── StatCard.jsx
        │   ├── Modal.jsx
        │   ├── ConfirmDialog.jsx
        │   ├── LoadingSpinner.jsx
        │   ├── SkeletonLoader.jsx
        │   ├── ProtectedRoute.jsx      # Role-based route guard
        │   └── PrintableReceipt.jsx    # Receipt w/ QR + logo
        │
        ├── layouts/
        │   ├── DashboardLayout.jsx     # Navbar + Sidebar shell
        │   └── AuthLayout.jsx          # Centered login shell
        │
        ├── pages/
        │   ├── auth/
        │   │   ├── Login.jsx
        │   │   └── Unauthorized.jsx
        │   ├── reception/
        │   │   ├── PatientList.jsx
        │   │   ├── RegisterPatient.jsx
        │   │   └── RegisterVisit.jsx
        │   ├── billing/
        │   │   ├── Billing.jsx
        │   │   └── Payments.jsx
        │   ├── queue/
        │   │   └── QueueBoard.jsx
        │   ├── nurse/
        │   │   └── NurseDashboard.jsx  # Triage / vitals
        │   ├── doctor/
        │   │   ├── DoctorDashboard.jsx # "My Queue"
        │   │   └── Consultation.jsx    # History, ICD10, Rx, Lab/Radiology orders
        │   ├── laboratory/
        │   │   └── Laboratory.jsx
        │   ├── radiology/
        │   │   └── Radiology.jsx
        │   ├── pharmacy/
        │   │   └── Pharmacy.jsx
        │   ├── inventory/
        │   │   └── Inventory.jsx       # Medicines, suppliers, batches, stock
        │   ├── reports/
        │   │   └── Reports.jsx
        │   ├── dashboard/
        │   │   └── Dashboard.jsx       # Cards + charts
        │   ├── settings/
        │   │   └── Settings.jsx
        │   ├── profile/
        │   │   └── Profile.jsx
        │   └── NotFound.jsx
        │
        ├── services/
        │   └── api.js                  # ⭐ ONLY file that calls axios — every endpoint
        │
        ├── context/
        │   ├── AuthContext.jsx         # user, token, login/logout, role
        │   └── ToastContext.jsx        # (or use react-toastify directly)
        │
        ├── hooks/
        │   ├── useAuth.js
        │   ├── usePagination.js
        │   └── useDebounce.js          # For search inputs
        │
        └── utils/
            ├── roles.js                 # Role constants + page-access map
            ├── formatters.js            # Currency, date formatting
            └── validators.js            # Frontend form validation helpers
```

---

## Setup

### 1. Create a virtual environment & install dependencies
```bash
python3 -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment variables
```bash
cp .env.example .env
# then edit .env with your real SECRET_KEY and PostgreSQL credentials
```

### 3. Create the PostgreSQL database
```bash
createdb hmis_db
```

### 4. Run migrations
```bash
python manage.py makemigrations api
python manage.py migrate
```

### 5. Create a Super Admin
```bash
python manage.py createsuperuser
```
(Note: `role` isn't prompted by `createsuperuser` — set it via `/admin/` or the shell:
`User.objects.filter(username="you").update(role="SUPER_ADMIN")`)

### 6. Run the server
```bash
python manage.py runserver
```

---

## API Documentation

Once running, the full interactive API reference is available at:

| URL | Purpose |
|---|---|
| `/api/docs/` | Swagger UI |
| `/api/redoc/` | ReDoc UI |
| `/api/schema/` | Raw OpenAPI 3 schema (JSON) |
| `/admin/` | Django admin back-office |

---

## Key Endpoint Groups (under `/api/`)

| Group | Base path | Notes |
|---|---|---|
| Auth | `auth/login/`, `auth/refresh/`, `auth/me/`, `auth/change-password/` | JWT via SimpleJWT |
| Users | `users/` | Super Admin only |
| Departments | `departments/` | Consultation fees per department |
| Patients | `patients/`, `patients/search/?q=`, `patients/{id}/summary/` | Duplicate-check search built in |
| Visits | `visits/` | Auto-generates a consultation invoice on creation |
| Billing | `invoices/`, `payments/`, `payments/{id}/receipt/` | Payments auto-update invoice balance + push to Nurse queue |
| Queue | `queue/`, `queue/my-queue/`, `queue/{id}/call-next/` | Nurse/Doctor/Lab/Radiology/Pharmacy queues |
| Triage | `vitals/` | Auto-computes BMI, moves patient to Doctor queue |
| ICD-10 | `icd10/`, `icd10/lookup/?q=` | Autocomplete by code or description |
| Consultation | `consultations/`, `.../pause/`, `.../resume/`, `.../complete/`, `.../add-diagnosis/` | Full clinical workflow incl. pause/resume |
| Prescriptions | `prescriptions/` | Linked to Pharmacy dispensing |
| Laboratory | `lab-tests-catalog/`, `lab-orders/`, `lab-orders/pending/`, `lab-results/` | Blocks result entry until payment confirmed |
| Radiology | `radiology-tests-catalog/`, `radiology-orders/`, `radiology-results/` | Same payment-gate pattern |
| Pharmacy | `medicines/`, `medicine-batches/`, `pharmacy-dispenses/` | FEFO batch selection, auto stock deduction & invoicing |
| Inventory | `suppliers/`, `stock-transactions/` | Stock in/out audit trail |
| Reports | `reports/?type=...` | daily/doctor/department/consultation/lab/radiology revenue, patient stats, medicine sales |
| Dashboard | `dashboard/` | Today's cards + 7-day revenue/visits charts + department breakdown |
| Audit Log | `audit-logs/` | Read-only, Super Admin only |

---

## Roles (RBAC)

`SUPER_ADMIN`, `RECEPTIONIST`, `CASHIER`, `NURSE`, `DOCTOR`, `LAB_TECHNOLOGIST`,
`RADIOLOGIST`, `PHARMACIST`, `ACCOUNTANT` — enforced per-endpoint via classes in
`api/permissions.py`. Super Admin always has full access.

---

## Automated Business Flow (via `api/signals.py`)

1. **Visit created** → consultation invoice auto-generated.
2. **Invoice paid in full** → patient auto-enters the Nurse queue.
3. **Vitals recorded** → patient auto-moves to the Doctor queue.
4. **Lab/Radiology order placed** → invoice auto-generated; results are blocked until `is_paid=True`.
5. **Consultation completed** → visit marked completed; prescriptions push patient to the Pharmacy queue.
6. **Every create/update/delete** on clinical/financial models is written to `AuditLog` automatically.

---

## Notes

- All primary keys are UUIDs.
- Deletes are **soft** (`is_deleted` + `deleted_at`) — nothing is hard-deleted by the API.
- Pagination, search, and filtering are enabled globally via DRF defaults + `django-filter`.
- This backend intentionally uses **one app (`api`)** instead of the originally-proposed
  multi-app layout (`accounts/`, `patients/`, `visits/`, ...) per your request — all of that
  logic is organized by *file* within `api/` instead of by separate Django apps.