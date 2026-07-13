import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getPatientSummary, getPatientVisits } from "../../services/api";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate, formatDateTime, formatCurrency } from "../../utils/formatters";

export default function PatientVisits() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [summary, setSummary] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, visitsData] = await Promise.all([
        getPatientSummary(id),
        getPatientVisits(id),
      ]);
      setSummary(summaryData);
      setVisits(visitsData || []);
    } catch (err) {
      toast.error(err.message || "Failed to load patient");
      navigate("/patients");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!summary) return null;

  const { patient, allergies, medical_history, current_medications } = summary;

  const visitColumns = [
    {
      key: "visit_number",
      label: "Visit #",
      render: (row) => <span className="cell-mono">{row.visit_number}</span>,
    },
    {
      key: "department_name",
      label: "Department",
      render: (row) => row.department_name || "—",
    },
    {
      key: "doctor_name",
      label: "Doctor",
      render: (row) => row.doctor_name || "Unassigned",
    },
    {
      key: "consultation_type",
      label: "Type",
      render: (row) => row.consultation_type?.replace(/_/g, " ") || "—",
    },
    {
      key: "consultation_fee",
      label: "Fee",
      render: (row) => <span className="cell-numeric">{formatCurrency(row.consultation_fee || 0)}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "visit_date",
      label: "Date",
      render: (row) => formatDateTime(row.visit_date),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Reception</div>
          <h1 className="page-title">Patient Visit History</h1>
          <p className="page-subtitle">Full visit record for this patient</p>
        </div>
        <div className="page-header__actions">
          <Link to={`/patients/${id}/edit`} className="btn btn-secondary">
            <i className="bi bi-pencil me-2"></i>
            Edit Patient
          </Link>
          <Link to="/visits/register" className="btn btn-primary">
            <i className="bi bi-clipboard-plus me-2"></i>
            Register Visit
          </Link>
        </div>
      </div>

      {/* Patient Header */}
      <div className="patient-header">
        <span className="avatar avatar-lg">
          {patient.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
        </span>
        <div className="patient-header__meta">
          <div className="patient-header__name">{patient.full_name}</div>
          <div className="patient-header__sub">
            <span className="patient-header__id">{patient.hospital_number}</span>
            <span>·</span>
            <span>{patient.gender}</span>
            <span>·</span>
            <span>{patient.age ? `${patient.age} years` : "Age unknown"}</span>
            {patient.phone && (
              <>
                <span>·</span>
                <span>{patient.phone}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info grid: allergies, medical history, current medications */}
      <div className="row g-3 mb-6" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-4)" }}>
        <div className="card">
          <div className="card-header">
            <h5 className="card-title">Allergies</h5>
            <span className="badge badge-danger">{allergies?.length || 0}</span>
          </div>
          <div className="card-body">
            {allergies?.length > 0 ? (
              <div className="flex flex-col gap-2">
                {allergies.map((a) => (
                  <div key={a.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{a.substance}</span>
                    <span className={`badge ${a.severity === "SEVERE" ? "badge-danger" : a.severity === "MODERATE" ? "badge-warning" : "badge-neutral"}`}>
                      {a.severity}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-tertiary">No known allergies</span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5 className="card-title">Medical History</h5>
            <span className="badge badge-neutral">{medical_history?.length || 0}</span>
          </div>
          <div className="card-body">
            {medical_history?.length > 0 ? (
              <div className="flex flex-col gap-2">
                {medical_history.map((h) => (
                  <div key={h.id}>
                    <div className="text-sm font-medium">{h.condition}</div>
                    {h.diagnosed_date && (
                      <div className="text-2xs text-tertiary">Diagnosed {formatDate(h.diagnosed_date)}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-tertiary">No recorded history</span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h5 className="card-title">Current Medications</h5>
            <span className="badge badge-info">{current_medications?.length || 0}</span>
          </div>
          <div className="card-body">
            {current_medications?.length > 0 ? (
              <div className="flex flex-col gap-2">
                {current_medications.map((m) => (
                  <div key={m.id} className="text-sm">
                    <span className="font-medium">{m.medicine_name}</span>
                    <span className="text-tertiary"> — {m.dosage}, {m.frequency}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-tertiary">None pending dispensation</span>
            )}
          </div>
        </div>
      </div>

      {/* Visit history table */}
      <div className="card">
        <div className="card-header">
          <h5 className="card-title">All Visits</h5>
          <span className="badge badge-primary">{visits.length}</span>
        </div>
        <div className="card-body p-0">
          <DataTable
            columns={visitColumns}
            data={visits}
            loading={loading}
            emptyMessage="No visits recorded for this patient yet."
          />
        </div>
      </div>
    </>
  );
}