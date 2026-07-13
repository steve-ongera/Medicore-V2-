import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  searchPatient,
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
    try {
      const data = await searchPatient(patientQuery);
      setPatientResults(data.patients || []);
    } catch (err) {
      setError(err.message);
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
    <div>
      <h1>Admit Patient</h1>

      {error && <p>Error: {error}</p>}

      <h2>1. Find Patient</h2>
      <form onSubmit={handlePatientSearch}>
        <input
          type="text"
          placeholder="Search by name / phone / hospital number / national ID"
          value={patientQuery}
          onChange={(e) => setPatientQuery(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {patientResults.length > 0 && (
        <ul>
          {patientResults.map((p) => (
            <li key={p.id}>
              {p.full_name} — {p.hospital_number} — {p.phone}{" "}
              <button type="button" onClick={() => setSelectedPatient(p)}>
                Select
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedPatient && (
        <p>
          Selected patient: <strong>{selectedPatient.full_name}</strong> ({selectedPatient.hospital_number})
        </p>
      )}

      <h2>2. Admission Details</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Ward</label>
          <select value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)} required>
            <option value="">Select ward</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Bed</label>
          <select value={form.bed} onChange={handleFormChange("bed")} required>
            <option value="">Select bed</option>
            {beds.map((b) => (
              <option key={b.id} value={b.id}>{b.bed_number} (KES {b.daily_rate}/day)</option>
            ))}
          </select>
        </div>

        <div>
          <label>Admitting Doctor</label>
          <select value={form.admitting_doctor} onChange={handleFormChange("admitting_doctor")} required>
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Attending Doctor (optional, defaults to admitting doctor)</label>
          <select value={form.attending_doctor} onChange={handleFormChange("attending_doctor")}>
            <option value="">Same as admitting doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.full_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Admission Type</label>
          <select value={form.admission_type} onChange={handleFormChange("admission_type")} required>
            <option value="EMERGENCY">Emergency</option>
            <option value="ELECTIVE">Elective</option>
            <option value="TRANSFER_IN">Transfer In</option>
            <option value="MATERNITY">Maternity</option>
          </select>
        </div>

        <div>
          <label>Admission Diagnosis</label>
          <textarea
            value={form.admission_diagnosis}
            onChange={handleFormChange("admission_diagnosis")}
          />
        </div>

        <div>
          <label>Expected Discharge Date</label>
          <input
            type="date"
            value={form.expected_discharge_date}
            onChange={handleFormChange("expected_discharge_date")}
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? "Admitting..." : "Admit Patient"}
        </button>
      </form>
    </div>
  );
}