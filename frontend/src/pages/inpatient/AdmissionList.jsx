import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAdmissions } from "../../services/api";

export default function AdmissionList() {
  const [admissions, setAdmissions] = useState([]);
  const [statusFilter, setStatusFilter] = useState("ADMITTED");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAdmissions();
  }, [statusFilter]);

  const loadAdmissions = async () => {
    setLoading(true);
    setError("");
    try {
      const params = { search };
      if (statusFilter) params.status = statusFilter;
      const data = await getAdmissions(params);
      setAdmissions(data.results ?? data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadAdmissions();
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      "ADMITTED": "badge-primary",
      "DISCHARGED": "badge-success",
      "TRANSFERRED_OUT": "badge-info",
      "DECEASED": "badge-danger",
      "ABSCONDED": "badge-warning"
    };
    return statusMap[status] || "badge-neutral";
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <span className="loading-screen__label">Loading admissions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
        <div className="text-danger font-semibold">Error loading admissions</div>
        <p className="text-sm text-muted" style={{ marginTop: "var(--space-2)" }}>{error}</p>
        <button className="btn btn-primary mt-4" onClick={loadAdmissions}>
          <i className="bi bi-arrow-clockwise"></i> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inpatient Management</div>
          <h1 className="page-title">Admissions</h1>
          <p className="page-subtitle">Manage all patient admissions</p>
        </div>
        <div className="page-header__actions">
          <Link to="/inpatient/admit" className="btn btn-primary">
            <i className="bi bi-person-plus me-2"></i>
            Admit Patient
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="card-body">
          <form onSubmit={handleSearchSubmit}>
            <div className="field-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="search">Search</label>
                <input
                  id="search"
                  type="text"
                  className="input"
                  placeholder="Patient name / hospital number"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" htmlFor="status">Status</label>
                <select
                  id="status"
                  className="select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="ADMITTED">Admitted</option>
                  <option value="DISCHARGED">Discharged</option>
                  <option value="TRANSFERRED_OUT">Transferred Out</option>
                  <option value="DECEASED">Deceased</option>
                  <option value="ABSCONDED">Absconded</option>
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, display: "flex", alignItems: "flex-end" }}>
                <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
                  <i className="bi bi-search me-2"></i> Search
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-tertiary text-sm">
              {admissions.length} admission{admissions.length !== 1 ? "s" : ""} found
            </span>
            {statusFilter && (
              <span className="badge badge-primary">
                <span className="badge-dot"></span>
                {statusFilter.replace("_", " ")}
              </span>
            )}
          </div>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={loadAdmissions}>
              <i className="bi bi-arrow-clockwise me-1"></i> Refresh
            </button>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Admission #</th>
                  <th>Patient</th>
                  <th>Hospital #</th>
                  <th>Ward / Bed</th>
                  <th>Doctor</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Admitted</th>
                  <th className="cell-numeric">LOS (days)</th>
                  <th className="cell-actions"></th>
                </tr>
              </thead>
              <tbody>
                {admissions.map((a) => (
                  <tr key={a.id}>
                    <td className="cell-primary">{a.admission_number}</td>
                    <td>{a.patient_name}</td>
                    <td className="cell-mono">{a.hospital_number}</td>
                    <td>{a.ward_name} / {a.bed_number}</td>
                    <td>{a.attending_doctor_name || "—"}</td>
                    <td>
                      <span className="tag">{a.admission_type}</span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(a.status)}`}>
                        <span className="badge-dot"></span>
                        {a.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>{new Date(a.admission_date).toLocaleDateString()}</td>
                    <td className="cell-numeric">{a.length_of_stay_days || "—"}</td>
                    <td className="cell-actions">
                      <Link
                        to={`/inpatient/admissions/${a.id}`}
                        className="btn btn-secondary btn-sm"
                      >
                        <i className="bi bi-eye me-1"></i> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && admissions.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">
                <i className="bi bi-hospital"></i>
              </div>
              <h3 className="empty-state__title">No admissions found</h3>
              <p className="empty-state__desc">
                {search || statusFilter 
                  ? "No admissions match your search criteria." 
                  : "Start by admitting a patient to the ward."}
              </p>
              {search || statusFilter ? (
                <button className="btn btn-secondary" onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                }}>
                  <i className="bi bi-x-circle me-1"></i> Clear filters
                </button>
              ) : (
                <Link to="/inpatient/admit">
                  <button className="btn btn-primary">
                    <i className="bi bi-person-plus me-2"></i> Admit Patient
                  </button>
                </Link>
              )}
            </div>
          )}
        </div>

        {admissions.length > 0 && (
          <div className="card-footer">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-tertiary text-sm">
                Showing {admissions.length} admission{admissions.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="badge badge-primary">
                <span className="badge-dot"></span> Admitted
              </span>
              <span className="badge badge-success">
                <span className="badge-dot"></span> Discharged
              </span>
              <span className="badge badge-danger">
                <span className="badge-dot"></span> Deceased
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}