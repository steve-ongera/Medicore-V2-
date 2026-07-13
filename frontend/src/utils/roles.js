export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  RECEPTIONIST: "RECEPTIONIST",
  CASHIER: "CASHIER",
  NURSE: "NURSE",
  DOCTOR: "DOCTOR",
  LAB_TECHNOLOGIST: "LAB_TECHNOLOGIST",
  RADIOLOGIST: "RADIOLOGIST",
  PHARMACIST: "PHARMACIST",
  ACCOUNTANT: "ACCOUNTANT",
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.RECEPTIONIST]: "Receptionist",
  [ROLES.CASHIER]: "Cashier",
  [ROLES.NURSE]: "Nurse",
  [ROLES.DOCTOR]: "Doctor",
  [ROLES.LAB_TECHNOLOGIST]: "Laboratory Technologist",
  [ROLES.RADIOLOGIST]: "Radiologist",
  [ROLES.PHARMACIST]: "Pharmacist",
  [ROLES.ACCOUNTANT]: "Accountant",
};

// Maps each route path to the roles allowed to view it.
// SUPER_ADMIN can always access everything (enforced in ProtectedRoute).
export const PAGE_ACCESS = {
  "/dashboard": Object.values(ROLES),
  "/patients": [ROLES.RECEPTIONIST],
  "/patients/register": [ROLES.RECEPTIONIST],
  "/visits/register": [ROLES.RECEPTIONIST],
  "/billing": [ROLES.CASHIER, ROLES.ACCOUNTANT],
  "/payments": [ROLES.CASHIER, ROLES.ACCOUNTANT],
  "/queue": [ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.DOCTOR],
  "/nurse": [ROLES.NURSE],
  "/doctor": [ROLES.DOCTOR],
  "/doctor/consultation/:visitId": [ROLES.DOCTOR],
  "/laboratory": [ROLES.LAB_TECHNOLOGIST],
  "/radiology": [ROLES.RADIOLOGIST],
  "/pharmacy": [ROLES.PHARMACIST],
  "/inventory": [ROLES.PHARMACIST, ROLES.ACCOUNTANT],
  "/reports": [ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN],
  "/settings": [ROLES.SUPER_ADMIN],
  "/profile": Object.values(ROLES),
};

// Sidebar link definitions, grouped and filtered by role in Sidebar.jsx
export const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: "bi-speedometer2", roles: Object.values(ROLES) },
  { to: "/patients", label: "Patients", icon: "bi-people", roles: [ROLES.RECEPTIONIST] },
  { to: "/visits/register", label: "Register Visit", icon: "bi-clipboard-plus", roles: [ROLES.RECEPTIONIST] },
  { to: "/billing", label: "Billing", icon: "bi-receipt", roles: [ROLES.CASHIER, ROLES.ACCOUNTANT] },
  { to: "/payments", label: "Payments", icon: "bi-cash-coin", roles: [ROLES.CASHIER, ROLES.ACCOUNTANT] },
  { to: "/queue", label: "Queue", icon: "bi-hourglass-split", roles: [ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.DOCTOR] },
  { to: "/nurse", label: "Nurse Dashboard", icon: "bi-heart-pulse", roles: [ROLES.NURSE] },
  { to: "/doctor", label: "Doctor Dashboard", icon: "bi-clipboard2-pulse", roles: [ROLES.DOCTOR] },
  { to: "/laboratory", label: "Laboratory", icon: "bi-droplet-half", roles: [ROLES.LAB_TECHNOLOGIST] },
  { to: "/radiology", label: "Radiology", icon: "bi-radioactive", roles: [ROLES.RADIOLOGIST] },
  { to: "/pharmacy", label: "Pharmacy", icon: "bi-capsule", roles: [ROLES.PHARMACIST] },
  { to: "/inventory", label: "Inventory", icon: "bi-boxes", roles: [ROLES.PHARMACIST, ROLES.ACCOUNTANT] },
  { to: "/reports", label: "Reports", icon: "bi-bar-chart-line", roles: [ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN] },
  { to: "/settings", label: "Settings", icon: "bi-gear", roles: [ROLES.SUPER_ADMIN] },
];

export function canAccess(role, path) {
  if (role === ROLES.SUPER_ADMIN) return true;
  const allowed = PAGE_ACCESS[path];
  return !allowed || allowed.includes(role);
}