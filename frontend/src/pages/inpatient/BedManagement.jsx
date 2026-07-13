import { useEffect, useState } from "react";
import { getWards, getBeds, createBed, updateBed } from "../../services/api";

export default function BedManagement() {
  const [wards, setWards] = useState([]);
  const [beds, setBeds] = useState([]);
  const [selectedWard, setSelectedWard] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [newBedNumber, setNewBedNumber] = useState("");
  const [newBedRate, setNewBedRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadWards();
  }, []);

  useEffect(() => {
    loadBeds();
  }, [selectedWard]);

  const loadWards = async () => {
    try {
      const data = await getWards();
      setWards(data.results ?? data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadBeds = async () => {
    setLoading(true);
    setError("");
    try {
      const params = selectedWard ? { ward: selectedWard } : {};
      const data = await getBeds(params);
      setBeds(data.results ?? data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBed = async (e) => {
    e.preventDefault();
    if (!selectedWard || !newBedNumber) return;
    setSubmitting(true);
    setError("");
    try {
      await createBed({
        ward: selectedWard,
        bed_number: newBedNumber,
        daily_rate_override: newBedRate || null,
      });
      setNewBedNumber("");
      setNewBedRate("");
      loadBeds();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (bedId, status) => {
    try {
      await updateBed(bedId, { status });
      loadBeds();
    } catch (err) {
      setError(err.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      "AVAILABLE": "badge-success",
      "OCCUPIED": "badge-primary",
      "MAINTENANCE": "badge-warning",
      "RESERVED": "badge-info"
    };
    return statusMap[status] || "badge-neutral";
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <span className="loading-screen__label">Loading beds...</span>
      </div>
    );
  }

  return (
    <div className="app-content">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Facility Management</div>
          <h1 className="page-title">Bed Management</h1>
          <p className="page-subtitle">Manage beds across all wards</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-secondary" onClick={loadBeds}>
            <i className="bi bi-arrow-clockwise"></i> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: "var(--space-4)", borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
          <div className="card-body">
            <div className="text-danger">
              <i className="bi bi-exclamation-circle"></i> {error}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="card-header">
          <h5 className="card-title">
            <i className="bi bi-plus-circle"></i> Add New Bed
          </h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleAddBed}>
            <div className="field-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Ward <span className="required">*</span></label>
                <select
                  className="select"
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  required
                >
                  <option value="">Select ward</option>
                  {wards.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Bed Number <span className="required">*</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., B-101"
                  value={newBedNumber}
                  onChange={(e) => setNewBedNumber(e.target.value)}
                  required
                />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label">Daily Rate Override</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Leave empty for ward default"
                  value={newBedRate}
                  onChange={(e) => setNewBedRate(e.target.value)}
                />
              </div>

              <div className="field" style={{ marginBottom: 0, display: "flex", alignItems: "flex-end" }}>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? (
                    <>
                      <span className="spinner spinner-sm" style={{ display: "inline-block", width: "16px", height: "16px", marginRight: "var(--space-2)" }}></span>
                      Adding...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-plus-circle"></i> Add Bed
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title">
            <i className="bi bi-grid"></i> Beds
          </h5>
          <div>
            <span className="text-sm text-muted">
              {beds.length} bed{beds.length !== 1 ? "s" : ""} found
            </span>
          </div>
        </div>
        <div className="card-body">
          <div className="field" style={{ marginBottom: "var(--space-4)" }}>
            <label className="field-label">Filter by ward</label>
            <select
              className="select"
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              style={{ maxWidth: "300px" }}
            >
              <option value="">All Wards</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ward</th>
                  <th>Bed #</th>
                  <th>Status</th>
                  <th className="cell-numeric">Daily Rate</th>
                  <th>Current Patient</th>
                  <th className="cell-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {beds.map((b) => (
                  <tr key={b.id}>
                    <td className="cell-primary">{b.ward_name}</td>
                    <td className="cell-mono">{b.bed_number}</td>
                    <td>
                      <span className={`badge ${getStatusBadge(b.status)}`}>
                        <span className="badge-dot"></span>
                        {b.status}
                      </span>
                    </td>
                    <td className="cell-numeric">KES {b.daily_rate}</td>
                    <td>
                      {b.current_patient ? (
                        <span className="font-medium">{b.current_patient.patient_name}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="cell-actions">
                      <select
                        className="select"
                        value={b.status}
                        onChange={(e) => handleStatusChange(b.id, e.target.value)}
                        style={{ width: "auto", minWidth: "140px" }}
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="OCCUPIED">Occupied</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="RESERVED">Reserved</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && beds.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">
                <i className="bi bi-bed"></i>
              </div>
              <h3 className="empty-state__title">No beds found</h3>
              <p className="empty-state__desc">
                {selectedWard 
                  ? "This ward has no beds configured yet." 
                  : "Start by adding beds to your wards."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}