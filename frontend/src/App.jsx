// src/App.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout.jsx";
import AuthLayout from "./layouts/AuthLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { ROLES } from "./utils/roles.js";

import Login from "./pages/auth/Login.jsx";
import Unauthorized from "./pages/auth/Unauthorized.jsx";
import NotFound from "./pages/NotFound.jsx";

import Dashboard from "./pages/dashboard/Dashboard.jsx";

import PatientList from "./pages/reception/PatientList.jsx";
import RegisterPatient from "./pages/reception/RegisterPatient.jsx";
import RegisterVisit from "./pages/reception/RegisterVisit.jsx";
import PatientVisits from "./pages/reception/PatientVisits.jsx";
import EditPatient from "./pages/reception/EditPatient.jsx";
import PatientProfile from "./pages/reception/PatientProfile.jsx";

import Billing from "./pages/billing/Billing.jsx";
import Payments from "./pages/billing/Payments.jsx";
import WalkInSale from "./pages/billing/WalkInSale.jsx";

import QueueBoard from "./pages/queue/QueueBoard.jsx";

import NurseDashboard from "./pages/nurse/NurseDashboard.jsx";

import DoctorDashboard from "./pages/doctor/DoctorDashboard.jsx";
import Consultation from "./pages/doctor/Consultation.jsx";
import ConsultationList from "./pages/doctor/ConsultationList.jsx";
import ConsultationDetail from "./pages/doctor/ConsultationDetail.jsx";

import Laboratory from "./pages/laboratory/Laboratory.jsx";
import Radiology from "./pages/radiology/Radiology.jsx";
import Pharmacy from "./pages/pharmacy/Pharmacy.jsx";
import Inventory from "./pages/inventory/Inventory.jsx";
import Suppliers from "./pages/pharmacy/Suppliers.jsx";

import Reports from "./pages/reports/Reports.jsx";
import Settings from "./pages/settings/Settings.jsx";
import Profile from "./pages/profile/Profile.jsx";

// Super Admin management pages
import Users from "./pages/settings/Users.jsx";
import Departments from "./pages/settings/Departments.jsx";
import AuditLog from "./pages/settings/AuditLog.jsx";
import TestCatalog from "./pages/settings/TestCatalog.jsx";

// Preserves query params (e.g. ?invoice=xxx) when redirecting old /payments
// links to the new /billing/payments path.
function LegacyPaymentsRedirect() {
  const location = useLocation();
  return <Navigate to={`/billing/payments${location.search}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>

      {/* Authenticated shell */}
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Reception */}
        <Route
          path="/patients"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST]}>
              <PatientList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/register"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST]}>
              <RegisterPatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.DOCTOR]}>
              <PatientProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id/visits"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST]}>
              <PatientVisits />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patients/:id/edit"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST]}>
              <EditPatient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/visits/register"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST]}>
              <RegisterVisit />
            </ProtectedRoute>
          }
        />

        {/* Billing */}
        <Route
          path="/billing"
          element={
            <ProtectedRoute allowedRoles={[ROLES.CASHIER, ROLES.ACCOUNTANT]}>
              <Billing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/payments"
          element={
            <ProtectedRoute allowedRoles={[ROLES.CASHIER, ROLES.ACCOUNTANT]}>
              <Payments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/walk-in-sale"
          element={
            <ProtectedRoute allowedRoles={[ROLES.CASHIER, ROLES.ACCOUNTANT]}>
              <WalkInSale />
            </ProtectedRoute>
          }
        />

        {/* Legacy redirect: old /payments links (with query params like ?invoice=xxx)
            now forward to /billing/payments */}
        <Route path="/payments" element={<LegacyPaymentsRedirect />} />

        {/* Queue */}
        <Route
          path="/queue"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.DOCTOR]}>
              <QueueBoard />
            </ProtectedRoute>
          }
        />

        {/* Nurse */}
        <Route
          path="/nurse"
          element={
            <ProtectedRoute allowedRoles={[ROLES.NURSE]}>
              <NurseDashboard />
            </ProtectedRoute>
          }
        />

        {/* Doctor */}
        <Route
          path="/doctor"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
              <DoctorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/consultation/:visitId"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
              <Consultation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/consultations"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
              <ConsultationList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/doctor/consultations/:id"
          element={
            <ProtectedRoute allowedRoles={[ROLES.DOCTOR]}>
              <ConsultationDetail />
            </ProtectedRoute>
          }
        />

        {/* Laboratory */}
        <Route
          path="/laboratory"
          element={
            <ProtectedRoute allowedRoles={[ROLES.LAB_TECHNOLOGIST]}>
              <Laboratory />
            </ProtectedRoute>
          }
        />

        {/* Radiology */}
        <Route
          path="/radiology"
          element={
            <ProtectedRoute allowedRoles={[ROLES.RADIOLOGIST]}>
              <Radiology />
            </ProtectedRoute>
          }
        />

        {/* Pharmacy */}
        <Route
          path="/pharmacy"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PHARMACIST]}>
              <Pharmacy />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PHARMACIST, ROLES.ACCOUNTANT]}>
              <Suppliers />
            </ProtectedRoute>
          }
        />

        {/* Inventory */}
        <Route
          path="/inventory"
          element={
            <ProtectedRoute allowedRoles={[ROLES.PHARMACIST, ROLES.ACCOUNTANT]}>
              <Inventory />
            </ProtectedRoute>
          }
        />

        {/* Reports */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={[ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* Settings (Super Admin) */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Staff, Departments, Audit Log, Test Catalog (Super Admin) */}
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/departments"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <AuditLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/test-catalog"
          element={
            <ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]}>
              <TestCatalog />
            </ProtectedRoute>
          }
        />

        {/* Profile - any authenticated user */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}