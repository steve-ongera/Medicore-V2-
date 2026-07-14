import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPatients,
  getAvailableBeds,
  getWards,
  getUsers,
  admitPatient,
} from "../../services/api";

export default function AdmitPatient() {
  const navigate = useNavigate();

  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const [wards, setWards] = useState([]);
  const [selectedWard, setSelectedWard] = useState("");
  const [beds, setBeds] = useState([]);

  const [doctors, setDoctors] = useState([]);

  const [form, setForm] = useState({
    bed: "",
    admitting_doctor: "",
    attending_doctor: "",
    admission_type: "EMERGENCY",
    admission_diagnosis: "",
    expected_discharge_date: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadWards();
    loadDoctors();
  }, []);

  useEffect(() => {
    if (selectedWard) loadBeds(selectedWard);
  }, [selectedWard]);

  const loadWards = async () => {
    try {
      const data = await getWards();
      setWards(data.results ?? data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadDoctors = async () => {
    try {
      const data = await getUsers({ role: "DOCTOR" });
      setDoctors(data.results ?? data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadBeds = async (wardId) => {
    try {
      const data = await getAvailableBeds(wardId);
      setBeds(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePatientSearch = async (e) => {
    e.preventDefault();
    if (!patientQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const data = await getPatients({ search: patientQuery });
      setPatientResults(data.results ?? data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleFormChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatient) {
      setError("Please select a patient first.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        patient: selectedPatient.id,
        bed: form.bed,
        admitting_doctor: form.admitting_doctor,
        attending_doctor: form.attending_doctor || undefined,
        admission_type: form.admission_type,
        admission_diagnosis: form.admission_diagnosis,
        expected_discharge_date: form.expected_discharge_date || undefined,
      };
      const admission = await admitPatient(payload);
      navigate(`/inpatient/admissions/${admission.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inpatient Management</div>
          <h1 className="page-title">Admit Patient</h1>
          <p className="page-subtitle">Register a new patient admission</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/inpatient/admissions")}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Admissions
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: "var(--space-4)", borderColor: "var(--danger)", background: "var(--danger-soft)" }}>
          <div className="card-body">
            <div className="text-danger">
              <i className="bi bi-exclamation-circle me-2"></i> {error}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="card-header">
          <h5 className="card-title">
            <i className="bi bi-search me-2"></i> Find Patient
          </h5>
        </div>
        <div className="card-body">
          <form onSubmit={handlePatientSearch}>
            <div className="field-row">
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label className="field-label">Search Patient</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Search by name / phone / hospital number / national ID"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                />
              </div>
              <div className="field" style={{ marginBottom: 0, display: "flex", alignItems: "flex-end" }}>
                <button type="submit" className="btn btn-primary" disabled={searching}>
                  {searching ? (
                    <>
                      <span className="spinner spinner-sm" style={{ display: "inline-block", width: "16px", height: "16px", marginRight: "var(--space-2)" }}></span>
                      Searching...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-search me-2"></i> Search
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>

          {patientResults.length > 0 && (
            <div style={{ marginTop: "var(--space-4)" }}>
              <div className="text-sm font-semibold" style={{ marginBottom: "var(--space-2)" }}>
                Search Results ({patientResults.length})
              </div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Hospital #</th>
                      <th>Phone</th>
                      <th className="cell-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientResults.map((p) => (
                      <tr key={p.id}>
                        <td className="cell-primary">{p.full_name}</td>
                        <td className="cell-mono">{p.hospital_number}</td>
                        <td>{p.phone}</td>
                        <td className="cell-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setSelectedPatient(p)}
                          >
                            <i className="bi bi-check me-1"></i> Select
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {patientResults.length === 0 && patientQuery && !searching && (
            <div className="empty-state" style={{ padding: "var(--space-6)" }}>
              <div className="empty-state__icon">
                <i className="bi bi-person"></i>
              </div>
              <h3 className="empty-state__title">No patients found</h3>
              <p className="empty-state__desc">Try adjusting your search criteria</p>
            </div>
          )}
        </div>
      </div>

      {selectedPatient && (
        <div className="card" style={{ marginBottom: "var(--space-6)", borderColor: "var(--success)" }}>
          <div className="card-body">
            <div className="flex items-center gap-3">
              <div className="avatar avatar-lg">
                <i className="bi bi-person-check fs-2xl"></i>
              </div>
              <div>
                <div className="text-sm text-success font-semibold">
                  <i className="bi bi-check-circle me-1"></i> Selected Patient
                </div>
                <div className="font-bold">{selectedPatient.full_name}</div>
                <div className="text-sm text-muted">
                  {selectedPatient.hospital_number} • {selectedPatient.phone}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm ml-auto"
                onClick={() => setSelectedPatient(null)}
              >
                <i className="bi bi-x me-1"></i> Change
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h5 className="card-title">
            <i className="bi bi-clipboard-plus me-2"></i> Admission Details
          </h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="field-row">
              <div className="field">
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

              <div className="field">
                <label className="field-label">Bed <span className="required">*</span></label>
                <select
                  className="select"
                  value={form.bed}
                  onChange={handleFormChange("bed")}
                  required
                  disabled={!selectedWard}
                >
                  <option value="">Select bed</option>
                  {beds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bed_number} (KES {b.daily_rate}/day)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Admitting Doctor <span className="required">*</span></label>
                <select
                  className="select"
                  value={form.admitting_doctor}
                  onChange={handleFormChange("admitting_doctor")}
                  required
                >
                  <option value="">Select doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field-label">Attending Doctor</label>
                <select
                  className="select"
                  value={form.attending_doctor}
                  onChange={handleFormChange("attending_doctor")}
                >
                  <option value="">Same as admitting doctor</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label">Admission Type <span className="required">*</span></label>
                <select
                  className="select"
                  value={form.admission_type}
                  onChange={handleFormChange("admission_type")}
                  required
                >
                  <option value="EMERGENCY">Emergency</option>
                  <option value="ELECTIVE">Elective</option>
                  <option value="TRANSFER_IN">Transfer In</option>
                  <option value="MATERNITY">Maternity</option>
                </select>
              </div>

              <div className="field">
                <label className="field-label">Expected Discharge Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.expected_discharge_date}
                  onChange={handleFormChange("expected_discharge_date")}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Admission Diagnosis</label>
              <textarea
                className="textarea"
                value={form.admission_diagnosis}
                onChange={handleFormChange("admission_diagnosis")}
                placeholder="Enter admission diagnosis"
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/inpatient/admissions")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !selectedPatient}
              >
                {submitting ? (
                  <>
                    <span className="spinner spinner-sm" style={{ display: "inline-block", width: "16px", height: "16px", marginRight: "var(--space-2)" }}></span>
                    Admitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-hospital me-2"></i> Admit Patient
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}