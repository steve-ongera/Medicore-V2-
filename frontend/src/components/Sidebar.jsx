import { NavLink } from "react-router-dom";
import { useAuth, ROLES } from "../context/AuthContext";
import medicoreLogo from "../assets/medicore_logo.png";

// Each link declares which roles can see it. Omit `roles` to show it to
// everyone (Super Admin always sees everything, per useAuth().hasRole).
const NAV_GROUPS = [
  {
    label: "Overview",
    links: [{ to: "/", label: "Dashboard", icon: "bi-speedometer2" }],
  },
  {
    label: "Front Desk",
    roles: [ROLES.RECEPTIONIST],
    links: [
      { to: "/patients", label: "Patients", icon: "bi-people" },
      { to: "/patients/register", label: "Register Patient", icon: "bi-person-plus" },
      { to: "/visits/register", label: "Register Visit", icon: "bi-clipboard2-plus" },
    ],
  },
  {
    label: "Billing",
    roles: [ROLES.CASHIER, ROLES.ACCOUNTANT],
    links: [
      { to: "/billing", label: "Billing", icon: "bi-cash-stack" },
      { to: "/billing/walk-in-sale", label: "Walk-in Sale", icon: "bi-bag-check" },
      { to: "/billing/payments", label: "Payments", icon: "bi-receipt" },
    ],
  },
  {
    label: "Queue",
    roles: [ROLES.RECEPTIONIST, ROLES.NURSE, ROLES.DOCTOR],
    links: [{ to: "/queue", label: "Queue Board", icon: "bi-hourglass-split" }],
  },
  {
    label: "Clinical",
    roles: [ROLES.NURSE, ROLES.DOCTOR],
    links: [
      { to: "/nurse", label: "Triage / Vitals", icon: "bi-heart-pulse", roles: [ROLES.NURSE] },
      { to: "/doctor", label: "My Queue", icon: "bi-clipboard2-pulse", roles: [ROLES.DOCTOR] },
      { to: "/doctor/consultations", label: "Consultations", icon: "bi-journal-medical", roles: [ROLES.DOCTOR] },
    ],
  },
  {
    label: "Diagnostics",
    roles: [ROLES.LAB_TECHNOLOGIST, ROLES.RADIOLOGIST],
    links: [
      { to: "/laboratory", label: "Laboratory", icon: "bi-droplet-half", roles: [ROLES.LAB_TECHNOLOGIST] },
      { to: "/radiology", label: "Radiology", icon: "bi-camera", roles: [ROLES.RADIOLOGIST] },
    ],
  },
  {
    label: "Pharmacy",
    roles: [ROLES.PHARMACIST],
    links: [
      { to: "/pharmacy", label: "Pharmacy", icon: "bi-capsule" },
      { to: "/inventory", label: "Inventory", icon: "bi-box-seam" },
      { to: "/suppliers", label: "Suppliers", icon: "bi-truck" },
    ],
  },
  {
    label: "Insights",
    roles: [ROLES.ACCOUNTANT],
    links: [
      { to: "/reports", label: "Reports", icon: "bi-bar-chart-line" },
      { to: "/audit-logs", label: "Audit Log", icon: "bi-journal-text", roles: [] },
      { to: "/users", label: "Staff", icon: "bi-person-badge", roles: [] },
      { to: "/departments", label: "Departments", icon: "bi-building", roles: [] },
      { to: "/settings/test-catalog", label: "Test Catalog", icon: "bi-clipboard2-data", roles: [] },
    ],
  },
  {
    label: "Account",
    links: [
      { to: "/profile", label: "My Profile", icon: "bi-person-circle" },
      { to: "/settings", label: "Settings", icon: "bi-gear" },
    ],
  },
];

export default function Sidebar({ onNavigate }) {
  const { hasRole } = useAuth();

  // roles: [] on a link means "Super Admin only" (hasRole already grants
  // Super Admin everything, but an empty array blocks every other role).
  const canSee = (roles) => (roles === undefined ? true : hasRole(...roles));

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img 
          src={medicoreLogo} 
          alt="Medicore HMIS" 
          style={{ 
            height: 34, 
            width: 'auto',
            borderRadius: '5px',
            flexShrink: 0
          }} 
        />
        <span className="sidebar__brand-text">Medicore HMIS</span>
      </div>

      <div className="sidebar__scroll">
        {NAV_GROUPS.map((group) => {
          const visibleLinks = group.links.filter((link) => canSee(link.roles ?? group.roles));
          if (visibleLinks.length === 0) return null;

          return (
            <div className="sidebar__group" key={group.label}>
              <div className="sidebar__group-label">{group.label}</div>
              <nav className="sidebar__nav">
                {visibleLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === "/"}
                    className={({ isActive }) => `sidebar__link${isActive ? " is-active" : ""}`}
                    onClick={onNavigate}
                  >
                    <span className="sidebar__link-icon">
                      <i className={`bi ${link.icon}`} aria-hidden="true" />
                    </span>
                    <span className="sidebar__link-text">{link.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          );
        })}
      </div>

      <div className="sidebar__footer">HMIS v1.0 &middot; City General Hospital</div>
    </aside>
  );
}