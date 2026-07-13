//src/pages/dashboard/Dashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { getDashboard } from "../../services/api";
import StatCard from "../../components/StatCard";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatCurrency, formatDate } from "../../utils/formatters";

const DEPARTMENT_COLORS = [
  "#4f46e5", // primary
  "#16a34a", // success
  "#0891b2", // info
  "#d97706", // warning
  "#dc2626", // danger
  "#64748b", // secondary
];

const QUICK_ACTIONS = [
  {
    to: "/patients/register",
    icon: "bi-person-plus",
    title: "Register Patient",
    desc: "New patient registration",
    iconBg: "var(--primary-50)",
    iconColor: "var(--primary-600)",
  },
  {
    to: "/visits/register",
    icon: "bi-clipboard-plus",
    title: "Register Visit",
    desc: "New patient visit",
    iconBg: "var(--success-soft)",
    iconColor: "var(--success-strong)",
  },
  {
    to: "/queue",
    icon: "bi-hourglass-split",
    title: "View Queue",
    desc: "Current waiting patients",
    iconBg: "var(--warning-soft)",
    iconColor: "var(--warning-strong)",
  },
  {
    to: "/billing",
    icon: "bi-receipt",
    title: "Billing",
    desc: "Invoices & payments",
    iconBg: "var(--info-soft)",
    iconColor: "var(--info-strong)",
  },
];

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{formatDate(label, { day: "numeric", month: "short" })}</div>
      <div className="chart-tooltip__value">{formatCurrency(payload[0].value)}</div>
    </div>
  );
}

function VisitsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{formatDate(label, { day: "numeric", month: "short" })}</div>
      <div className="chart-tooltip__value">{payload[0].value} visit{payload[0].value === 1 ? "" : "s"}</div>
    </div>
  );
}

function DepartmentTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{item.name}</div>
      <div className="chart-tooltip__value">{item.value} visit{item.value === 1 ? "" : "s"}</div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await getDashboard();
      setData(result);
    } catch (err) {
      toast.error(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const { cards, charts } = data || {};

  const revenueData = (charts?.revenue || []).map((d) => ({
    date: d.date,
    revenue: parseFloat(d.revenue) || 0,
  }));
  const visitsData = (charts?.visits || []).map((d) => ({
    date: d.date,
    visits: d.visits || 0,
  }));
  const departmentData = (charts?.departments || []).map((d) => ({
    name: d.department__name || "Unassigned",
    value: d.count || 0,
  }));

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Overview</div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back! Here's what's happening today.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid mb-6">
        <StatCard label="Today's Patients" value={cards?.todays_patients || 0} icon="bi-people" variant="primary" />
        <StatCard label="Waiting Patients" value={cards?.waiting_patients || 0} icon="bi-hourglass-split" variant="warning" />
        <StatCard label="Today's Revenue" value={formatCurrency(cards?.todays_revenue || 0)} icon="bi-cash-stack" variant="success" />
        <StatCard label="Consultations Today" value={cards?.todays_consultations || 0} icon="bi-clipboard2-pulse" variant="info" />
        <StatCard label="Pending Lab" value={cards?.pending_lab || 0} icon="bi-droplet-half" variant="danger" />
      </div>

      {/* Charts Section */}
      <div className="dashboard-grid">
        <div className="chart-card">
          <div className="chart-card__header">
            <h5 className="card-title">Revenue (Last 7 Days)</h5>
            <span className="text-tertiary text-xs">Daily revenue trend</span>
          </div>
          <div style={{ height: 240 }}>
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { day: "numeric" })} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} fontSize={12} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: "#4f46e5" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-tertiary py-6">No revenue data available</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h5 className="card-title">Visits (Last 7 Days)</h5>
            <span className="text-tertiary text-xs">Daily visit count</span>
          </div>
          <div style={{ height: 240 }}>
            {visitsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visitsData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { day: "numeric" })} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<VisitsTooltip />} cursor={{ fill: "rgba(22, 163, 74, 0.08)" }} />
                  <Bar dataKey="visits" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-tertiary py-6">No visit data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Department Breakdown - Donut Chart */}
      <div className="card mt-6">
        <div className="card-header">
          <h5 className="card-title">Department Activity (Last 30 Days)</h5>
        </div>
        <div className="card-body">
          {departmentData.length > 0 ? (
            <div className="flex flex-wrap items-center gap-6">
              <div style={{ width: 220, height: 220, flexShrink: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={departmentData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={2}
                    >
                      {departmentData.map((_, index) => (
                        <Cell key={index} fill={DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<DepartmentTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="flex-1" style={{ minWidth: 200 }}>
                {departmentData.map((dept, index) => {
                  const total = departmentData.reduce((sum, d) => sum + d.value, 0);
                  const pct = total > 0 ? Math.round((dept.value / total) * 100) : 0;
                  return (
                    <div key={dept.name} className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full"
                          style={{
                            display: "inline-block",
                            width: 10,
                            height: 10,
                            backgroundColor: DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length],
                          }}
                        />
                        <span className="text-sm">{dept.name}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {dept.value} <span className="text-tertiary">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center text-tertiary py-5">No department data available</div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="stat-grid mt-6">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className="card card-interactive">
            <div className="card-body text-center">
              <div
                className="rounded-full flex items-center justify-center mb-3 mx-auto"
                style={{ width: 48, height: 48, background: action.iconBg }}
              >
                <i className={`bi ${action.icon}`} style={{ fontSize: "1.25rem", color: action.iconColor }}></i>
              </div>
              <h6>{action.title}</h6>
              <small className="text-tertiary">{action.desc}</small>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}