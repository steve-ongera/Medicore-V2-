import { useEffect, useState, useMemo, useCallback } from "react";
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
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getReports } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatCurrency, formatDate } from "../../utils/formatters";

const COLORS = ["#4f46e5", "#16a34a", "#0891b2", "#d97706", "#dc2626", "#64748b"];

const OVERVIEW_TYPES = [
  "daily_revenue",
  "department_revenue",
  "doctor_revenue",
  "medicine_sales",
  "patient_statistics",
];

const KEY_LABELS = {
  paid_at__date: "Date",
  total: "Total (KES)",
  visit__doctor__first_name: "Doctor First Name",
  visit__doctor__last_name: "Doctor Last Name",
  visit__department__name: "Department",
  prescription__medicine__name: "Medicine",
  total_qty: "Quantity Sold",
  total_patients: "Total Patients",
  new_patients_in_range: "New Patients",
  total_visits_in_range: "Total Visits",
};

const humanizeKey = (key) =>
  KEY_LABELS[key] ||
  key
    .replace(/__/g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{formatDate(label, { day: "numeric", month: "short" })}</div>
      <div className="chart-tooltip__value">{formatCurrency(payload[0].value)}</div>
    </div>
  );
}

function NamedValueTooltip({ active, payload, valueFormatter }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip__label">{item.payload.name}</div>
      <div className="chart-tooltip__value">
        {valueFormatter ? valueFormatter(item.value) : item.value}
      </div>
    </div>
  );
}

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [reportType, setReportType] = useState("daily_revenue");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [overview, setOverview] = useState({});
  const [overviewLoading, setOverviewLoading] = useState(true);

  const reportTypes = [
    { value: "daily_revenue", label: "Daily Revenue" },
    { value: "doctor_revenue", label: "Doctor Revenue" },
    { value: "department_revenue", label: "Department Revenue" },
    { value: "patient_statistics", label: "Patient Statistics" },
    { value: "medicine_sales", label: "Medicine Sales" },
    { value: "lab_revenue", label: "Lab Revenue" },
    { value: "radiology_revenue", label: "Radiology Revenue" },
    { value: "consultation_revenue", label: "Consultation Revenue" },
  ];

  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    setDateFrom(thirtyDaysAgo.toISOString().split("T")[0]);
    setDateTo(today.toISOString().split("T")[0]);
  }, []);

  // -------------------------------------------------------------------
  // Detail report (dropdown-driven table + export)
  // -------------------------------------------------------------------
  const loadReport = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    try {
      const data = await getReports(reportType, { date_from: dateFrom, date_to: dateTo });
      setReportData(data);
    } catch (err) {
      toast.error(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [reportType, dateFrom, dateTo]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // -------------------------------------------------------------------
  // Overview charts (several report types fetched together)
  // -------------------------------------------------------------------
  const loadOverview = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setOverviewLoading(true);
    try {
      const results = await Promise.all(
        OVERVIEW_TYPES.map((type) => getReports(type, { date_from: dateFrom, date_to: dateTo }))
      );
      const next = {};
      OVERVIEW_TYPES.forEach((type, i) => {
        next[type] = results[i]?.data;
      });
      setOverview(next);
    } catch (err) {
      toast.error(err.message || "Failed to load report overview");
    } finally {
      setOverviewLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const revenueTrend = useMemo(
    () =>
      (overview.daily_revenue || []).map((d) => ({
        date: d.paid_at__date,
        total: parseFloat(d.total) || 0,
      })),
    [overview.daily_revenue]
  );

  const departmentBreakdown = useMemo(
    () =>
      (overview.department_revenue || []).map((d) => ({
        name: d.visit__department__name || "Unassigned",
        value: parseFloat(d.total) || 0,
      })),
    [overview.department_revenue]
  );

  const doctorRevenue = useMemo(
    () =>
      (overview.doctor_revenue || [])
        .map((d) => ({
          name: `${d.visit__doctor__first_name || ""} ${d.visit__doctor__last_name || ""}`.trim() || "Unknown",
          total: parseFloat(d.total) || 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
    [overview.doctor_revenue]
  );

  const medicineSales = useMemo(
    () =>
      (overview.medicine_sales || [])
        .map((d) => ({
          name: d.prescription__medicine__name || "Unknown",
          qty: d.total_qty || 0,
        }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8),
    [overview.medicine_sales]
  );

  const patientStats = overview.patient_statistics || {};
  const patientBarData = [
    { name: "Total Patients", value: patientStats.total_patients || 0 },
    { name: "New Patients", value: patientStats.new_patients_in_range || 0 },
    { name: "Total Visits", value: patientStats.total_visits_in_range || 0 },
  ];

  // -------------------------------------------------------------------
  // Export helpers (operate on the currently selected detail report)
  // -------------------------------------------------------------------
  const getExportRows = () => {
    if (!reportData?.data) return [];
    const raw = Array.isArray(reportData.data) ? reportData.data : [reportData.data];
    return raw.map((row) => {
      const cleaned = {};
      Object.entries(row).forEach(([k, v]) => {
        cleaned[humanizeKey(k)] = v;
      });
      return cleaned;
    });
  };

  const handleExportExcel = () => {
    const rows = getExportRows();
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
    XLSX.writeFile(workbook, `${reportType}_${dateFrom}_to_${dateTo}.xlsx`);
  };

  const handleExportPDF = () => {
    const rows = getExportRows();
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }
    const doc = new jsPDF();
    const title = reportTypes.find((rt) => rt.value === reportType)?.label || "Report";

    doc.setFontSize(16);
    doc.text("City General Hospital", 14, 16);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(title, 14, 23);
    doc.text(`Period: ${dateFrom} to ${dateTo}`, 14, 29);

    const headers = [Object.keys(rows[0])];
    const body = rows.map((row) =>
      Object.values(row).map((v) => (typeof v === "number" ? v.toLocaleString() : v ?? "—"))
    );

    autoTable(doc, {
      startY: 34,
      head: headers,
      body,
      theme: "striped",
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 9 },
    });

    doc.save(`${reportType}_${dateFrom}_to_${dateTo}.pdf`);
  };

  // -------------------------------------------------------------------
  // Detail table renderer (unchanged logic from before)
  // -------------------------------------------------------------------
  const renderReportContent = () => {
    if (!reportData || !reportData.data) {
      return <div className="text-center text-muted py-4">No data available for this report</div>;
    }

    const { data } = reportData;

    if (reportType === "patient_statistics") {
      return (
        <div className="row">
          <div className="col-md-4">
            <div className="card">
              <div className="card-body text-center">
                <div className="text-muted text-sm">Total Patients</div>
                <div className="fs-2 fw-bold">{data.total_patients || 0}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card">
              <div className="card-body text-center">
                <div className="text-muted text-sm">New Patients (Range)</div>
                <div className="fs-2 fw-bold text-primary">{data.new_patients_in_range || 0}</div>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card">
              <div className="card-body text-center">
                <div className="text-muted text-sm">Total Visits (Range)</div>
                <div className="fs-2 fw-bold text-success">{data.total_visits_in_range || 0}</div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (Array.isArray(data)) {
      if (data.length === 0) {
        return <div className="text-center text-muted py-4">No records found</div>;
      }

      if (data[0]?.paid_at__date) {
        return (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => (
                    <tr key={index}>
                      <td>{formatDate(item.paid_at__date)}</td>
                      <td className="cell-numeric">{formatCurrency(item.total || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      if (data[0]?.visit__doctor__first_name || data[0]?.visit__department__name) {
        const nameKey = Object.keys(data[0]).find((k) => k.includes("name") || k.includes("first_name"));
        return (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => {
                    const name =
                      item[nameKey] ||
                      item.visit__doctor__first_name ||
                      item.visit__department__name ||
                      "Unknown";
                    return (
                      <tr key={index}>
                        <td>{name}</td>
                        <td className="cell-numeric">{formatCurrency(item.total || 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      if (data[0]?.prescription__medicine__name) {
        return (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th className="text-right">Quantity Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item, index) => (
                    <tr key={index}>
                      <td>{item.prescription__medicine__name || "Unknown"}</td>
                      <td className="cell-numeric">{item.total_qty || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      return (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {Object.keys(data[0]).map((key) => (
                    <th key={key}>{key.replace(/_/g, " ").toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((item, index) => (
                  <tr key={index}>
                    {Object.values(item).map((val, i) => (
                      <td key={i}>
                        {typeof val === "number" && !isNaN(val) && !String(val).includes("date")
                          ? formatCurrency(val)
                          : val || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return <div className="text-center text-muted py-4">Data format not supported</div>;
  };

  if (loading && !reportData) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Insights</div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate, visualize, and export financial and operational reports</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-secondary" onClick={() => { loadReport(); loadOverview(); }}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Date Range (drives both overview and detail) */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <div className="field">
                <label className="field-label" htmlFor="date_from">From Date</label>
                <input
                  id="date_from"
                  type="date"
                  className="input"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-3">
              <div className="field">
                <label className="field-label" htmlFor="date_to">To Date</label>
                <input
                  id="date_to"
                  type="date"
                  className="input"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Charts */}
      <div className="dashboard-grid mb-4">
        <div className="chart-card">
          <div className="chart-card__header">
            <h5 className="card-title">Revenue Trend</h5>
            <span className="text-muted small">Daily revenue in selected range</span>
          </div>
          <div style={{ height: 240 }}>
            {overviewLoading ? (
              <div className="text-center text-muted py-5">Loading…</div>
            ) : revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatDate(d, { day: "numeric" })} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} fontSize={12} tickLine={false} axisLine={false} width={40} />
                  <Tooltip content={<RevenueTooltip />} />
                  <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: "#4f46e5" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted py-4">No revenue data available</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h5 className="card-title">Revenue by Department</h5>
            <span className="text-muted small">Share of consultation revenue</span>
          </div>
          <div style={{ height: 240 }}>
            {overviewLoading ? (
              <div className="text-center text-muted py-5">Loading…</div>
            ) : departmentBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={departmentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {departmentBreakdown.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<NamedValueTooltip valueFormatter={formatCurrency} />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted py-4">No department data available</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h5 className="card-title">Top Doctors by Revenue</h5>
            <span className="text-muted small">Consultation revenue generated</span>
          </div>
          <div style={{ height: 240 }}>
            {overviewLoading ? (
              <div className="text-center text-muted py-5">Loading…</div>
            ) : doctorRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={doctorRevenue} layout="vertical" margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={12} tickLine={false} axisLine={false} width={90} />
                  <Tooltip content={<NamedValueTooltip valueFormatter={formatCurrency} />} cursor={{ fill: "rgba(79, 70, 229, 0.06)" }} />
                  <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted py-4">No doctor revenue data available</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h5 className="card-title">Top Medicines Dispensed</h5>
            <span className="text-muted small">By quantity sold</span>
          </div>
          <div style={{ height: 240 }}>
            {overviewLoading ? (
              <div className="text-center text-muted py-5">Loading…</div>
            ) : medicineSales.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={medicineSales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<NamedValueTooltip />} cursor={{ fill: "rgba(22, 163, 74, 0.08)" }} />
                  <Bar dataKey="qty" fill="#16a34a" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted py-4">No medicine sales data available</div>
            )}
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card__header">
            <h5 className="card-title">Patient Activity</h5>
            <span className="text-muted small">Totals for the selected range</span>
          </div>
          <div style={{ height: 240 }}>
            {overviewLoading ? (
              <div className="text-center text-muted py-5">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={patientBarData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<NamedValueTooltip />} cursor={{ fill: "rgba(8, 145, 178, 0.08)" }} />
                  <Bar dataKey="value" fill="#0891b2" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Detail Report + Export */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <div className="field">
                <label className="field-label" htmlFor="report_type">Detail Report</label>
                <select id="report_type" className="select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                  {reportTypes.map((rt) => (
                    <option key={rt.value} value={rt.value}>{rt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="col-md-8 d-flex gap-2 justify-content-md-end">
              <button type="button" className="btn btn-secondary" onClick={handleExportExcel}>
                <i className="bi bi-file-earmark-excel me-2"></i>
                Export Excel
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleExportPDF}>
                <i className="bi bi-file-earmark-pdf me-2"></i>
                Export PDF
              </button>
            </div>
          </div>
        </div>
      </div>

      {reportData && (
        <div className="mb-3">
          <span className="text-muted text-sm">{reportData.type?.replace(/_/g, " ").toUpperCase()}</span>
          <span className="text-muted text-sm ms-3">{reportData.date_from} — {reportData.date_to}</span>
        </div>
      )}

      <div className="card">
        <div className="card-body">{loading ? <LoadingSpinner /> : renderReportContent()}</div>
      </div>
    </>
  );
}