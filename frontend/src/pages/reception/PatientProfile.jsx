import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getPatientSummary,
  createAllergy,
  deleteAllergy,
  createMedicalHistoryNote,
  deleteMedicalHistoryNote,
} from "../../services/api";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate, formatDateTime } from "../../utils/formatters";

const SEVERITY_VARIANT = { MILD: "neutral", MODERATE: "warning", SEVERE: "danger" };

const EMPTY_ALLERGY = { substance: "", reaction: "", severity: "MILD" };
const EMPTY_HISTORY = { condition: "", notes: "", diagnosed_date: "" };

export default function PatientProfile() {
  const { id } = useParams();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAllergyForm, setShowAllergyForm] = useState(false);
  const [allergyForm, setAllergyForm] = useState(EMPTY_ALLERGY);
  const [savingAllergy, setSavingAllergy] = useState(false);

  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [historyForm, setHistoryForm] = useState(EMPTY_HISTORY);
  const [savingHistory, setSavingHistory] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null); // { type: "allergy"|"history", id }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getPatientSummary(id);
      setSummary(data);
    } catch (err) {
      toast.error(err.message || "Failed to load patient profile");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllergy = async (e) => {
    e.preventDefault();
    setSavingAllergy(true);
    try {
      await createAllergy({ ...allergyForm, patient: id });
      toast.success("Allergy added");
      setShowAllergyForm(false);
      setAllergyForm(EMPTY_ALLERGY);
      load();
    } catch (err) {
      toast.error(err.message || "Failed to add allergy");
    } finally {
      setSavingAllergy(false);
    }
  };

  const handleAddHistory = async (e) => {
    e.preventDefault();
    setSavingHistory(true);
    try {
      await createMedicalHistoryNote({ ...historyForm, patient: id });
      toast.success("Medical history note added");
      setShowHistoryForm(false);
      setHistoryForm(EMPTY_HISTORY);
      load();
    } catch (err) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setSavingHistory(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      if (pendingDelete.type === "allergy") {
        await deleteAllergy(pendingDelete.id);
        toast.success("Allergy removed");
      } else {
        await deleteMedicalHistoryNote(pendingDelete.id);
        toast.success("Note removed");
      }
      load();
    } catch (err) {
      toast.error(err.message || "Failed to remove");
    } finally {
      setPendingDelete(null);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!summary) return null;

  const { patient, previous_visits, allergies, medical_history, current_medications } = summary;

  const visitColumns = [
    { key: "visit_number", label: "Visit #", render: (row) => <span className="cell-mono">{row.visit_number}</span> },
    { key: "department_name", label: "Department", render: (row) => row.department_name },
    { key: "doctor_name", label: "Doctor", render: (row) => row.doctor_name || "—" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} variant="neutral" /> },
    { key: "visit_date", label: "Date", render: (row) => formatDateTime(row.visit_date) },
  ];

  const medicationColumns = [
    { key: "medicine_name", label: "Medicine", render: (row) => row.medicine_name },
    { key: "dosage", label: "Dosage", render: (row) => row.dosage },
    { key: "frequency", label: "Frequency", render: (row) => row.frequency },
    { key: "duration", label: "Duration", render: (row) => row.duration },
    {
      key: "is_dispensed",
      label: "Status",
      render: (row) => (
        <StatusBadge status={row.is_dispensed ? "Dispensed" : "Pending"} variant={row.is_dispensed ? "success" : "warning"} />
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Patient Profile</div>
          <h1 className="page-title">{patient.full_name}</h1>
          <p className="page-subtitle">
            {patient.hospital_number} &middot; {patient.gender || "—"} &middot; {patient.age ?? "—"} yrs
          </p>
        </div>
        <div className="page-header__actions">
          <Link to={`/patients/${id}/visits`} className="btn btn-outline">
            <i className="bi bi-clock-history me-2"></i>
            Visit History
          </Link>
          <Link to={`/patients/${id}/edit`} className="btn btn-primary">
            <i className="bi bi-pencil me-2"></i>
            Edit Patient
          </Link>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <span className="cell-primary">Demographics</span>
        </div>
        <div className="card-body">
          <div className="detail-grid">
            <div><span className="text-tertiary text-sm">Phone</span><div>{patient.phone || "—"}</div></div>
            <div><span className="text-tertiary text-sm">National ID</span><div>{patient.national_id || "—"}</div></div>
            <div><span className="text-tertiary text-sm">Date of Birth</span><div>{patient.dob ? formatDate(patient.dob) : "—"}</div></div>
            <div><span className="text-tertiary text-sm">Address</span><div>{patient.address || "—"}</div></div>
            <div><span className="text-tertiary text-sm">Next of Kin</span><div>{patient.next_of_kin_name || "—"} {patient.next_of_kin_phone && `(${patient.next_of_kin_phone})`}</div></div>
            <div><span className="text-tertiary text-sm">Guardian</span><div>{patient.guardian_name || "—"} {patient.guardian_phone && `(${patient.guardian_phone})`}</div></div>
          </div>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <span className="cell-primary">Allergies</span>
          <button className="btn btn-sm btn-outline" onClick={() => setShowAllergyForm((v) => !v)}>
            <i className="bi bi-plus-lg me-1"></i> Add
          </button>
        </div>
        <div className="card-body">
          {showAllergyForm && (
            <form className="inline-form" onSubmit={handleAddAllergy}>
              <input
                className="form-control"
                placeholder="Substance"
                value={allergyForm.substance}
                onChange={(e) => setAllergyForm({ ...allergyForm, substance: e.target.value })}
                required
              />
              <input
                className="form-control"
                placeholder="Reaction"
                value={allergyForm.reaction}
                onChange={(e) => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
              />
              <select
                className="form-select"
                value={allergyForm.severity}
                onChange={(e) => setAllergyForm({ ...allergyForm, severity: e.target.value })}
              >
                <option value="MILD">Mild</option>
                <option value="MODERATE">Moderate</option>
                <option value="SEVERE">Severe</option>
              </select>
              <button className="btn btn-primary btn-sm" type="submit" disabled={savingAllergy}>
                {savingAllergy ? "Saving..." : "Save"}
              </button>
            </form>
          )}

          {allergies.length === 0 ? (
            <p className="text-tertiary">No known allergies recorded.</p>
          ) : (
            <ul className="detail-list">
              {allergies.map((a) => (
                <li key={a.id}>
                  <div>
                    <span className="cell-primary">{a.substance}</span>{" "}
                    <StatusBadge status={a.severity} variant={SEVERITY_VARIANT[a.severity] || "neutral"} />
                    {a.reaction && <div className="text-2xs text-tertiary">{a.reaction}</div>}
                  </div>
                  <button
                    className="btn-icon-only"
                    style={{ color: "var(--danger-strong)" }}
                    onClick={() => setPendingDelete({ type: "allergy", id: a.id })}
                    title="Remove allergy"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <span className="cell-primary">Medical History</span>
          <button className="btn btn-sm btn-outline" onClick={() => setShowHistoryForm((v) => !v)}>
            <i className="bi bi-plus-lg me-1"></i> Add
          </button>
        </div>
        <div className="card-body">
          {showHistoryForm && (
            <form className="inline-form" onSubmit={handleAddHistory}>
              <input
                className="form-control"
                placeholder="Condition"
                value={historyForm.condition}
                onChange={(e) => setHistoryForm({ ...historyForm, condition: e.target.value })}
                required
              />
              <input
                type="date"
                className="form-control"
                value={historyForm.diagnosed_date}
                onChange={(e) => setHistoryForm({ ...historyForm, diagnosed_date: e.target.value })}
              />
              <input
                className="form-control"
                placeholder="Notes"
                value={historyForm.notes}
                onChange={(e) => setHistoryForm({ ...historyForm, notes: e.target.value })}
              />
              <button className="btn btn-primary btn-sm" type="submit" disabled={savingHistory}>
                {savingHistory ? "Saving..." : "Save"}
              </button>
            </form>
          )}

          {medical_history.length === 0 ? (
            <p className="text-tertiary">No medical history recorded.</p>
          ) : (
            <ul className="detail-list">
              {medical_history.map((h) => (
                <li key={h.id}>
                  <div>
                    <span className="cell-primary">{h.condition}</span>
                    {h.diagnosed_date && <span className="text-2xs text-tertiary"> &middot; diagnosed {formatDate(h.diagnosed_date)}</span>}
                    {h.notes && <div className="text-2xs text-tertiary">{h.notes}</div>}
                  </div>
                  <button
                    className="btn-icon-only"
                    style={{ color: "var(--danger-strong)" }}
                    onClick={() => setPendingDelete({ type: "history", id: h.id })}
                    title="Remove note"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <span className="cell-primary">Current Medications</span>
        </div>
        <div className="card-body p-0">
          <DataTable
            columns={medicationColumns}
            data={current_medications}
            loading={false}
            emptyMessage="No active prescriptions."
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="cell-primary">Recent Visits</span>
        </div>
        <div className="card-body p-0">
          <DataTable
            columns={visitColumns}
            data={previous_visits}
            loading={false}
            emptyMessage="No previous visits."
          />
        </div>
      </div>

      <ConfirmDialog
        show={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete?.type === "allergy" ? "Remove Allergy" : "Remove Medical History Note"}
        message="Are you sure you want to remove this record? This action cannot be undone."
        variant="danger"
      />
    </>
  );
}