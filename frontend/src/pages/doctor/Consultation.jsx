//src/pages/doctor/Consultation.jsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import {
  getConsultations,
  getVisit,
  startConsultation,
  saveConsultation,
  addDiagnosis,
  pauseConsultation,
  resumeConsultation,
  completeConsultation,
  getPatientSummary,
  lookupIcd10,
  searchMedicines,
  createPrescription,
  createLabOrder,
  createRadiologyOrder,
  getLabTestCatalog,
  getRadiologyTestCatalog,
} from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import Modal from "../../components/Modal";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatDateTime } from "../../utils/formatters";

const TABS = [
  { key: "notes", label: "Clinical Notes" },
  { key: "diagnoses", label: "Diagnoses" },
  { key: "prescriptions", label: "Prescriptions" },
  { key: "orders", label: "Lab & Radiology" },
];

const EMPTY_FORM = {
  chief_complaint: "",
  history_of_present_illness: "",
  physical_examination: "",
  treatment_plan: "",
  clinical_notes: "",
};

const draftKeyFor = (visitId) => `consultation_draft_${visitId}`;

export default function Consultation() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const loadedVisitRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [consultation, setConsultation] = useState(null);
  const [patientSummary, setPatientSummary] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("notes");

  const [form, setForm] = useState(EMPTY_FORM);
  // Snapshot of the form as it exists in the database — used to detect unsaved edits.
  const [savedForm, setSavedForm] = useState(EMPTY_FORM);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const [diagnosisSearch, setDiagnosisSearch] = useState("");
  const [diagnosisResults, setDiagnosisResults] = useState([]);
  const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState(null);

  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState([]);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({
    medicine: "",
    dosage: "",
    frequency: "",
    duration: "",
    quantity: "",
    instructions: "",
  });

  // Lab & Radiology catalogs — loaded from the DB so the `test` field we
  // submit is a real ForeignKey UUID, not a hardcoded string like "MALARIA".
  const [labTests, setLabTests] = useState([]);
  const [radiologyTests, setRadiologyTests] = useState([]);
  const [catalogsLoading, setCatalogsLoading] = useState(true);

  const [showLabModal, setShowLabModal] = useState(false);
  const [labForm, setLabForm] = useState({ test: "" });

  const [showRadiologyModal, setShowRadiologyModal] = useState(false);
  const [radiologyForm, setRadiologyForm] = useState({ test: "" });

  const [showPauseModal, setShowPauseModal] = useState(false);
  const [pauseForm, setPauseForm] = useState({ pause_reason: "OTHER", pause_notes: "" });

  useEffect(() => {
    // Guards against React StrictMode's double-invoke of useEffect on mount,
    // which would otherwise fire two concurrent "start consultation" requests.
    if (loadedVisitRef.current === visitId) return;
    loadedVisitRef.current = visitId;
    loadConsultation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  // Load the lab/radiology test catalogs once — both are lookup tables that
  // rarely change, so a single fetch on mount is enough.
  useEffect(() => {
    const loadCatalogs = async () => {
      setCatalogsLoading(true);
      try {
        const [labResp, radResp] = await Promise.all([
          getLabTestCatalog(),
          getRadiologyTestCatalog(),
        ]);
        // Handle both paginated ({results: [...]}) and plain-array responses.
        setLabTests(labResp?.results || labResp || []);
        setRadiologyTests(radResp?.results || radResp || []);
      } catch (err) {
        toast.error(err.message || "Failed to load test catalogs");
      } finally {
        setCatalogsLoading(false);
      }
    };
    loadCatalogs();
  }, []);

  // Warn before an actual browser reload/close if there are unsaved clinical notes.
  useEffect(() => {
    const handler = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Autosave a local draft on every keystroke so that if the page does get
  // reloaded (or the tab is closed by accident) the in-progress notes are not
  // lost — they'll be restored from this draft next time the page loads.
  useEffect(() => {
    if (!consultation) return;
    localStorage.setItem(draftKeyFor(visitId), JSON.stringify(form));
  }, [form, consultation, visitId]);

  const clearDraft = () => {
    localStorage.removeItem(draftKeyFor(visitId));
  };

  const loadConsultation = async () => {
    setLoading(true);
    try {
      const visit = await getVisit(visitId);

      // Try to get the existing consultation for this visit
      const consultationsResp = await getConsultations({ visit: visitId });
      let cons;
      if (consultationsResp.results && consultationsResp.results.length > 0) {
        cons = consultationsResp.results[0];
      } else {
        cons = await startConsultation({ visit: visitId });
      }

      setConsultation(cons);

      const serverForm = {
        chief_complaint: cons.chief_complaint || "",
        history_of_present_illness: cons.history_of_present_illness || "",
        physical_examination: cons.physical_examination || "",
        treatment_plan: cons.treatment_plan || "",
        clinical_notes: cons.clinical_notes || "",
      };
      setSavedForm(serverForm);

      // If a local draft exists and differs from what's saved in the database,
      // restore it instead of silently discarding the doctor's unsaved work.
      const draftRaw = localStorage.getItem(draftKeyFor(visitId));
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw);
          if (JSON.stringify(draft) !== JSON.stringify(serverForm)) {
            setForm(draft);
            toast.info("Restored your unsaved clinical notes from before the page reloaded.");
          } else {
            setForm(serverForm);
          }
        } catch {
          setForm(serverForm);
        }
      } else {
        setForm(serverForm);
      }

      // Patient summary needs the actual patient id, which lives on the visit
      const summary = await getPatientSummary(visit.patient);
      setPatientSummary(summary);
    } catch (err) {
      toast.error(err.message || "Failed to load consultation");
      navigate("/doctor");
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      await saveConsultation(consultation.id, form);
      setSavedForm(form);
      clearDraft();
      toast.success("Consultation saved");
      loadConsultation();
    } catch (err) {
      toast.error(err.message || "Failed to save consultation");
    } finally {
      setSubmitting(false);
    }
  };

  // Prevent tab switching while there are unsaved clinical notes, so a doctor
  // can't accidentally navigate away from edits that were never persisted.
  const handleTabChange = (tabKey) => {
    if (tabKey === activeTab) return;
    if (activeTab === "notes" && isDirty) {
      toast.warning("Please save your clinical notes before switching tabs.");
      return;
    }
    setActiveTab(tabKey);
  };

  const handleBack = () => {
    if (isDirty && !window.confirm("You have unsaved clinical notes. Leave without saving?")) {
      return;
    }
    navigate("/doctor");
  };

  const handleComplete = async () => {
    if (!window.confirm("Complete this consultation?")) return;
    setSubmitting(true);
    try {
      if (isDirty) {
        await saveConsultation(consultation.id, form);
        setSavedForm(form);
      }
      await completeConsultation(consultation.id);
      clearDraft();
      toast.success("Consultation completed!");
      navigate("/doctor");
    } catch (err) {
      toast.error(err.message || "Failed to complete consultation");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePause = async () => {
    setSubmitting(true);
    try {
      if (isDirty) {
        await saveConsultation(consultation.id, form);
        setSavedForm(form);
      }
      await pauseConsultation(consultation.id, pauseForm);
      toast.success("Consultation paused");
      setShowPauseModal(false);
      loadConsultation();
    } catch (err) {
      toast.error(err.message || "Failed to pause consultation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async () => {
    setSubmitting(true);
    try {
      await resumeConsultation(consultation.id);
      toast.success("Consultation resumed");
      loadConsultation();
    } catch (err) {
      toast.error(err.message || "Failed to resume consultation");
    } finally {
      setSubmitting(false);
    }
  };

  const searchDiagnosis = async (query) => {
    if (!query || query.length < 2) {
      setDiagnosisResults([]);
      return;
    }
    try {
      const results = await lookupIcd10(query);
      setDiagnosisResults(results || []);
    } catch (err) {
      console.error("Diagnosis search failed:", err);
    }
  };

  const addDiagnosisToConsultation = async () => {
    if (!selectedDiagnosis) return;
    try {
      await addDiagnosis(consultation.id, {
        icd10_code: selectedDiagnosis.code,
        is_primary: consultation.diagnoses?.length === 0,
      });
      toast.success("Diagnosis added");
      setShowDiagnosisModal(false);
      setSelectedDiagnosis(null);
      setDiagnosisSearch("");
      loadConsultation();
    } catch (err) {
      toast.error(err.message || "Failed to add diagnosis");
    }
  };

  const searchMedicinesForRx = async (query) => {
    if (!query || query.length < 2) {
      setMedResults([]);
      return;
    }
    try {
      const results = await searchMedicines(query);
      setMedResults(results || []);
    } catch (err) {
      console.error("Medicine search failed:", err);
    }
  };

  const createPrescriptionForPatient = async () => {
    if (!prescriptionForm.medicine || !prescriptionForm.dosage) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await createPrescription({
        consultation: consultation.id,
        ...prescriptionForm,
        quantity: parseInt(prescriptionForm.quantity) || 1,
      });
      toast.success("Prescription created");
      setShowPrescriptionModal(false);
      setPrescriptionForm({ medicine: "", dosage: "", frequency: "", duration: "", quantity: "", instructions: "" });
      loadConsultation();
    } catch (err) {
      toast.error(err.message || "Failed to create prescription");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateLabOrder = async () => {
    if (!labForm.test) {
      toast.error("Please select a test");
      return;
    }
    setSubmitting(true);
    try {
      await createLabOrder({ consultation: consultation.id, test: labForm.test });
      toast.success("Lab order created");
      setShowLabModal(false);
      setLabForm({ test: "" });
      loadConsultation();
    } catch (err) {
      toast.error(err.message || "Failed to create lab order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRadiologyOrder = async () => {
    if (!radiologyForm.test) {
      toast.error("Please select a test");
      return;
    }
    setSubmitting(true);
    try {
      await createRadiologyOrder({ consultation: consultation.id, test: radiologyForm.test });
      toast.success("Radiology order created");
      setShowRadiologyModal(false);
      setRadiologyForm({ test: "" });
      loadConsultation();
    } catch (err) {
      toast.error(err.message || "Failed to create radiology order");
    } finally {
      setSubmitting(false);
    }
  };

  // Builds a simple PDF from a lab order's typed-in result text.
  // The uploaded file itself (if any) is opened directly via its own URL —
  // this PDF is only for the free-text portion the technologist entered.
  const downloadLabResultPdf = (order) => {
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16);
    doc.text("Laboratory Result", margin, y);
    y += 10;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Patient: ${consultation?.patient_name || "—"}`, margin, y);
    y += 7;
    doc.text(`Test: ${order.test_name || "—"}`, margin, y);
    y += 7;
    doc.text(`Ordered: ${order.ordered_at ? formatDateTime(order.ordered_at) : "—"}`, margin, y);
    y += 7;
    if (order.result?.completed_at) {
      doc.text(`Completed: ${formatDateTime(order.result.completed_at)}`, margin, y);
      y += 7;
    }
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.text("Result:", margin, y);
    y += 8;

    doc.setFontSize(11);
    const lines = doc.splitTextToSize(
      order.result?.result_text || "(no text entered)",
      pageWidth - margin * 2
    );
    doc.text(lines, margin, y);

    const fileName = `${order.test_name || "lab_result"}_${consultation?.patient_name || "patient"}.pdf`.replace(
      /\s+/g,
      "_"
    );
    doc.save(fileName);
  };

  // Same idea for radiology — uses radiologist_notes instead of result_text.
  const downloadRadiologyResultPdf = (order) => {
    const doc = new jsPDF();
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    doc.setFontSize(16);
    doc.text("Radiology Report", margin, y);
    y += 10;
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    doc.setFontSize(11);
    doc.text(`Patient: ${consultation?.patient_name || "—"}`, margin, y);
    y += 7;
    doc.text(`Test: ${order.test_name || "—"}`, margin, y);
    y += 7;
    doc.text(`Ordered: ${order.ordered_at ? formatDateTime(order.ordered_at) : "—"}`, margin, y);
    y += 7;
    if (order.result?.completed_at) {
      doc.text(`Completed: ${formatDateTime(order.result.completed_at)}`, margin, y);
      y += 7;
    }
    y += 5;
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.text("Radiologist Notes:", margin, y);
    y += 8;

    doc.setFontSize(11);
    const lines = doc.splitTextToSize(
      order.result?.radiologist_notes || "(no notes entered)",
      pageWidth - margin * 2
    );
    doc.text(lines, margin, y);

    const fileName = `${order.test_name || "radiology_report"}_${consultation?.patient_name || "patient"}.pdf`.replace(
      /\s+/g,
      "_"
    );
    doc.save(fileName);
  };

  if (loading) return <LoadingSpinner />;

  const diagnosesCount = consultation?.diagnoses?.length || 0;
  const prescriptionsCount = consultation?.prescriptions?.length || 0;
  const ordersCount = (consultation?.lab_orders?.length || 0) + (consultation?.radiology_orders?.length || 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Doctor</div>
          <h1 className="page-title">Consultation</h1>
          <p className="page-subtitle">
            {consultation?.patient_name || "Patient"} · {formatDate(consultation?.started_at)}
          </p>
        </div>
        <div className="page-header__actions">
          <StatusBadge status={consultation?.status} />
          {isDirty && <span className="badge badge-warning">Unsaved changes</span>}
          {consultation?.status === "IN_PROGRESS" && (
            <>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => setShowPauseModal(true)}
                disabled={submitting}
              >
                <i className="bi bi-pause-circle me-2"></i>
                Pause
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleComplete}
                disabled={submitting}
              >
                <i className="bi bi-check2-circle me-2"></i>
                Complete
              </button>
            </>
          )}
          {consultation?.status === "PAUSED" && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleResume}
              disabled={submitting}
            >
              <i className="bi bi-play-circle me-2"></i>
              Resume
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleBack}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back
          </button>
        </div>
      </div>

      <div className="row">
        {/* Patient Info Sidebar */}
        <div className="col-lg-3">
          <div className="card mb-3">
            <div className="card-body">
              <div className="text-center mb-3">
                <span className="avatar avatar-lg">
                  {consultation?.patient_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
                </span>
                <h5 className="mt-2 mb-0">{consultation?.patient_name}</h5>
                <span className="text-muted text-sm">
                  #{patientSummary?.patient?.hospital_number}
                </span>
              </div>
              <hr />
              <div className="info-grid">
                <div>
                  <div className="info-item__label">Age</div>
                  <div className="info-item__value">{patientSummary?.patient?.age || "—"}</div>
                </div>
                <div>
                  <div className="info-item__label">Gender</div>
                  <div className="info-item__value">{patientSummary?.patient?.gender || "—"}</div>
                </div>
                <div>
                  <div className="info-item__label">Phone</div>
                  <div className="info-item__value">{patientSummary?.patient?.phone || "—"}</div>
                </div>
              </div>
            </div>
          </div>

          {patientSummary?.allergies?.length > 0 && (
            <div className="card mb-3">
              <div className="card-header">
                <h6 className="mb-0">Allergies</h6>
              </div>
              <div className="card-body">
                {patientSummary.allergies.map((a) => (
                  <div key={a.id} className="d-flex justify-content-between align-items-center mb-1">
                    <span>{a.substance}</span>
                    <StatusBadge status={a.severity} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {consultation?.vitals && (
            <div className="card">
              <div className="card-header">
                <h6 className="mb-0">Vitals</h6>
              </div>
              <div className="card-body">
                <div className="vitals-grid">
                  <div className="vital-tile">
                    <div className="vital-tile__value">{consultation.vitals.bmi || "—"}</div>
                    <div className="vital-tile__label">BMI</div>
                  </div>
                  <div className="vital-tile">
                    <div className="vital-tile__value">{consultation.vitals.temperature_c || "—"}°C</div>
                    <div className="vital-tile__label">Temp</div>
                  </div>
                  <div className="vital-tile">
                    <div className="vital-tile__value">{consultation.vitals.pulse_bpm || "—"}</div>
                    <div className="vital-tile__label">Pulse</div>
                  </div>
                  <div className="vital-tile">
                    <div className="vital-tile__value">
                      {consultation.vitals.bp_systolic || "—"}/{consultation.vitals.bp_diastolic || "—"}
                    </div>
                    <div className="vital-tile__label">BP</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Consultation Area — tabbed to keep the page short */}
        <div className="col-lg-9">
          <div className="tabs mb-3">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`tabs__item ${activeTab === tab.key ? "is-active" : ""}`}
                onClick={() => handleTabChange(tab.key)}
                title={activeTab === "notes" && isDirty && tab.key !== "notes" ? "Save your clinical notes first" : undefined}
              >
                {tab.label}
                {tab.key === "diagnoses" && diagnosesCount > 0 && (
                  <span className="pill-count ml-2">{diagnosesCount}</span>
                )}
                {tab.key === "prescriptions" && prescriptionsCount > 0 && (
                  <span className="pill-count ml-2">{prescriptionsCount}</span>
                )}
                {tab.key === "orders" && ordersCount > 0 && (
                  <span className="pill-count ml-2">{ordersCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* --- Clinical Notes tab --- */}
          {activeTab === "notes" && (
            <div className="card">
              <div className="card-header">
                <h5 className="card-title">Clinical Notes</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={handleSave}
                  disabled={submitting || !isDirty}
                >
                  {submitting ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-save me-1"></i>
                  )}
                  Save
                </button>
              </div>
              <div className="card-body">
                <div className="field">
                  <label className="field-label" htmlFor="chief_complaint">
                    Chief Complaint
                  </label>
                  <textarea
                    id="chief_complaint"
                    name="chief_complaint"
                    className="textarea"
                    rows={2}
                    placeholder="Patient's main reason for visit..."
                    value={form.chief_complaint}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="history_of_present_illness">
                    History of Present Illness
                  </label>
                  <textarea
                    id="history_of_present_illness"
                    name="history_of_present_illness"
                    className="textarea"
                    rows={3}
                    placeholder="Detailed history of the current condition..."
                    value={form.history_of_present_illness}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="physical_examination">
                    Physical Examination
                  </label>
                  <textarea
                    id="physical_examination"
                    name="physical_examination"
                    className="textarea"
                    rows={3}
                    placeholder="Physical exam findings..."
                    value={form.physical_examination}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="treatment_plan">
                    Treatment Plan
                  </label>
                  <textarea
                    id="treatment_plan"
                    name="treatment_plan"
                    className="textarea"
                    rows={3}
                    placeholder="Treatment plan and recommendations..."
                    value={form.treatment_plan}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="field mb-0">
                  <label className="field-label" htmlFor="clinical_notes">
                    Clinical Notes
                  </label>
                  <textarea
                    id="clinical_notes"
                    name="clinical_notes"
                    className="textarea"
                    rows={2}
                    placeholder="Additional clinical notes..."
                    value={form.clinical_notes}
                    onChange={handleFormChange}
                  />
                </div>
              </div>
            </div>
          )}

          {/* --- Diagnoses tab --- */}
          {activeTab === "diagnoses" && (
            <div className="card">
              <div className="card-header">
                <h5 className="card-title">Diagnoses</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowDiagnosisModal(true)}
                >
                  <i className="bi bi-plus-lg me-1"></i>
                  Add Diagnosis
                </button>
              </div>
              <div className="card-body">
                {diagnosesCount === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">
                      <i className="bi bi-clipboard2-pulse" style={{ fontSize: "1.5rem" }}></i>
                    </div>
                    <div className="empty-state__title">No diagnoses added yet</div>
                    <div className="empty-state__desc">Add an ICD-10 diagnosis once you've assessed the patient.</div>
                  </div>
                ) : (
                  <div className="d-flex flex-wrap gap-2">
                    {consultation?.diagnoses?.map((d) => (
                      <div key={d.id} className={`diagnosis-chip ${d.is_primary ? "is-primary" : ""}`}>
                        <span className="diagnosis-chip__code">{d.code}</span>
                        <span>{d.description}</span>
                        {d.is_primary && (
                          <span className="badge badge-primary">Primary</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- Prescriptions tab --- */}
          {activeTab === "prescriptions" && (
            <div className="card">
              <div className="card-header">
                <h5 className="card-title">Prescriptions</h5>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowPrescriptionModal(true)}
                >
                  <i className="bi bi-plus-lg me-1"></i>
                  Prescribe
                </button>
              </div>
              <div className="card-body">
                {prescriptionsCount === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state__icon">
                      <i className="bi bi-capsule" style={{ fontSize: "1.5rem" }}></i>
                    </div>
                    <div className="empty-state__title">No prescriptions yet</div>
                    <div className="empty-state__desc">Prescribe medication for this patient to send it to pharmacy.</div>
                  </div>
                ) : (
                  <div className="rx-list">
                    {consultation?.prescriptions?.map((rx) => (
                      <div key={rx.id} className="rx-item">
                        <div>
                          <div className="rx-item__name">{rx.medicine_name}</div>
                          <div className="rx-item__detail">
                            {rx.dosage} · {rx.frequency} · {rx.duration}
                            {rx.instructions && ` · ${rx.instructions}`}
                          </div>
                        </div>
                        <StatusBadge status={rx.is_dispensed ? "DISPENSED" : "PENDING"} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* --- Lab & Radiology tab --- */}
          {activeTab === "orders" && (
            <div className="row">
              <div className="col-md-6">
                <div className="card mb-3 mb-md-0">
                  <div className="card-header">
                    <h6 className="mb-0">Lab Orders</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setShowLabModal(true)}
                    >
                      <i className="bi bi-plus-lg me-1"></i>
                      Order Lab
                    </button>
                  </div>
                  <div className="card-body">
                    {consultation?.lab_orders?.length === 0 ? (
                      <div className="text-muted text-sm">No lab orders</div>
                    ) : (
                      consultation?.lab_orders?.map((order) => (
                        <div key={order.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <div className="text-sm font-semibold">{order.test_name}</div>
                            <StatusBadge status={order.status} />
                          </div>
                          <div className="d-flex gap-1">
                            {order.result?.result_file && (
                              <a
                                href={order.result.result_file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm"
                                title="View uploaded file"
                              >
                                <i className="bi bi-file-earmark-pdf"></i>
                              </a>
                            )}
                            {order.result?.result_text && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => downloadLabResultPdf(order)}
                                title="Download typed result as PDF"
                              >
                                <i className="bi bi-download"></i>
                              </button>
                            )}
                            {order.result && !order.result.result_file && !order.result.result_text && (
                              <span className="text-success text-sm">
                                <i className="bi bi-check-circle"></i>
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card">
                  <div className="card-header">
                    <h6 className="mb-0">Radiology Orders</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() => setShowRadiologyModal(true)}
                    >
                      <i className="bi bi-plus-lg me-1"></i>
                      Order Radiology
                    </button>
                  </div>
                  <div className="card-body">
                    {consultation?.radiology_orders?.length === 0 ? (
                      <div className="text-muted text-sm">No radiology orders</div>
                    ) : (
                      consultation?.radiology_orders?.map((order) => (
                        <div key={order.id} className="d-flex justify-content-between align-items-center py-2 border-bottom">
                          <div>
                            <div className="text-sm font-semibold">{order.test_name}</div>
                            <StatusBadge status={order.status} />
                          </div>
                          <div className="d-flex gap-1">
                            {order.result?.image_file && (
                              <a
                                href={order.result.image_file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm"
                                title="View uploaded image"
                              >
                                <i className="bi bi-image"></i>
                              </a>
                            )}
                            {order.result?.report_file && (
                              <a
                                href={order.result.report_file}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-outline btn-sm"
                                title="View uploaded report"
                              >
                                <i className="bi bi-file-earmark-pdf"></i>
                              </a>
                            )}
                            {order.result?.radiologist_notes && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => downloadRadiologyResultPdf(order)}
                                title="Download radiologist notes as PDF"
                              >
                                <i className="bi bi-download"></i>
                              </button>
                            )}
                            {order.result &&
                              !order.result.image_file &&
                              !order.result.report_file &&
                              !order.result.radiologist_notes && (
                                <span className="text-success text-sm">
                                  <i className="bi bi-check-circle"></i>
                                </span>
                              )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Diagnosis Modal */}
      <Modal
        show={showDiagnosisModal}
        onClose={() => {
          setShowDiagnosisModal(false);
          setSelectedDiagnosis(null);
          setDiagnosisSearch("");
          setDiagnosisResults([]);
        }}
        title="Add Diagnosis"
        size="modal-lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDiagnosisModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={addDiagnosisToConsultation}
              disabled={!selectedDiagnosis}
            >
              <i className="bi bi-plus-lg me-2"></i>
              Add Diagnosis
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="diagnosis_search">
            Search ICD-10 Codes
          </label>
          <input
            id="diagnosis_search"
            type="text"
            className="input"
            placeholder="Search by code or description..."
            value={diagnosisSearch}
            onChange={(e) => {
              setDiagnosisSearch(e.target.value);
              searchDiagnosis(e.target.value);
            }}
          />
        </div>
        {diagnosisResults.length > 0 && (
          <div className="list-group mt-2" style={{ maxHeight: 300, overflowY: "auto" }}>
            {diagnosisResults.map((d) => (
              <button
                key={d.code}
                type="button"
                className={`list-group-item list-group-item-action ${selectedDiagnosis?.code === d.code ? "active" : ""}`}
                onClick={() => setSelectedDiagnosis(d)}
              >
                <strong>{d.code}</strong> — {d.description}
              </button>
            ))}
          </div>
        )}
        {selectedDiagnosis && (
          <div className="mt-3 p-2 bg-primary-soft rounded">
            Selected: <strong>{selectedDiagnosis.code}</strong> — {selectedDiagnosis.description}
          </div>
        )}
      </Modal>

      {/* Prescription Modal */}
      <Modal
        show={showPrescriptionModal}
        onClose={() => {
          setShowPrescriptionModal(false);
          setPrescriptionForm({ medicine: "", dosage: "", frequency: "", duration: "", quantity: "", instructions: "" });
          setMedResults([]);
          setMedSearch("");
        }}
        title="New Prescription"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPrescriptionModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={createPrescriptionForPatient}
              disabled={submitting}
            >
              {submitting ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <>
                  <i className="bi bi-plus-lg me-2"></i>
                  Prescribe
                </>
              )}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="med_search">
            Medicine <span className="required">*</span>
          </label>
          <input
            id="med_search"
            type="text"
            className="input"
            placeholder="Search for medicine..."
            value={medSearch}
            onChange={(e) => {
              setMedSearch(e.target.value);
              searchMedicinesForRx(e.target.value);
            }}
          />
          {medResults.length > 0 && (
            <div className="list-group mt-1" style={{ maxHeight: 150, overflowY: "auto" }}>
              {medResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`list-group-item list-group-item-action ${prescriptionForm.medicine === m.id ? "active" : ""}`}
                  onClick={() => {
                    setPrescriptionForm((prev) => ({ ...prev, medicine: m.id }));
                    setMedSearch(m.name);
                    setMedResults([]);
                  }}
                >
                  {m.name} — {m.unit_price && `KES ${m.unit_price}`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="rx_dosage">
                Dosage <span className="required">*</span>
              </label>
              <input
                id="rx_dosage"
                name="dosage"
                type="text"
                className="input"
                placeholder="e.g., 500mg"
                value={prescriptionForm.dosage}
                onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, dosage: e.target.value }))}
              />
            </div>
          </div>
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="rx_frequency">
                Frequency
              </label>
              <input
                id="rx_frequency"
                name="frequency"
                type="text"
                className="input"
                placeholder="e.g., 3x daily"
                value={prescriptionForm.frequency}
                onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, frequency: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <div className="row">
          <div className="col-md-4">
            <div className="field">
              <label className="field-label" htmlFor="rx_duration">
                Duration
              </label>
              <input
                id="rx_duration"
                name="duration"
                type="text"
                className="input"
                placeholder="e.g., 5 days"
                value={prescriptionForm.duration}
                onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, duration: e.target.value }))}
              />
            </div>
          </div>
          <div className="col-md-4">
            <div className="field">
              <label className="field-label" htmlFor="rx_quantity">
                Quantity
              </label>
              <input
                id="rx_quantity"
                name="quantity"
                type="number"
                className="input"
                placeholder="e.g., 10"
                value={prescriptionForm.quantity}
                onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
          </div>
          <div className="col-md-4">
            <div className="field">
              <label className="field-label" htmlFor="rx_instructions">
                Instructions
              </label>
              <input
                id="rx_instructions"
                name="instructions"
                type="text"
                className="input"
                placeholder="e.g., After meals"
                value={prescriptionForm.instructions}
                onChange={(e) => setPrescriptionForm((prev) => ({ ...prev, instructions: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Lab Order Modal */}
      <Modal
        show={showLabModal}
        onClose={() => {
          setShowLabModal(false);
          setLabForm({ test: "" });
        }}
        title="Order Lab Test"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowLabModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateLabOrder}
              disabled={submitting || !labForm.test}
            >
              {submitting ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <>
                  <i className="bi bi-plus-lg me-2"></i>
                  Order Lab Test
                </>
              )}
            </button>
          </>
        }
      >
        <div className="field mb-0">
          <label className="field-label" htmlFor="lab_test">
            Select Lab Test
          </label>
          <select
            id="lab_test"
            className="select"
            value={labForm.test}
            onChange={(e) => setLabForm({ test: e.target.value })}
            disabled={catalogsLoading}
          >
            <option value="">
              {catalogsLoading ? "Loading tests..." : "Choose a test..."}
            </option>
            {labTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.price != null ? ` — KES ${t.price}` : ""}
              </option>
            ))}
          </select>
          {!catalogsLoading && labTests.length === 0 && (
            <div className="text-muted text-sm mt-1">
              No lab tests found in the catalog. Add some under Lab Test Catalog first.
            </div>
          )}
        </div>
      </Modal>

      {/* Radiology Order Modal */}
      <Modal
        show={showRadiologyModal}
        onClose={() => {
          setShowRadiologyModal(false);
          setRadiologyForm({ test: "" });
        }}
        title="Order Radiology Test"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowRadiologyModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateRadiologyOrder}
              disabled={submitting || !radiologyForm.test}
            >
              {submitting ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <>
                  <i className="bi bi-plus-lg me-2"></i>
                  Order Radiology
                </>
              )}
            </button>
          </>
        }
      >
        <div className="field mb-0">
          <label className="field-label" htmlFor="radiology_test">
            Select Radiology Test
          </label>
          <select
            id="radiology_test"
            className="select"
            value={radiologyForm.test}
            onChange={(e) => setRadiologyForm({ test: e.target.value })}
            disabled={catalogsLoading}
          >
            <option value="">
              {catalogsLoading ? "Loading tests..." : "Choose a test..."}
            </option>
            {radiologyTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.price != null ? ` — KES ${t.price}` : ""}
              </option>
            ))}
          </select>
          {!catalogsLoading && radiologyTests.length === 0 && (
            <div className="text-muted text-sm mt-1">
              No radiology tests found in the catalog. Add some under Radiology Test Catalog first.
            </div>
          )}
        </div>
      </Modal>

      {/* Pause Modal */}
      <Modal
        show={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        title="Pause Consultation"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowPauseModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-warning"
              onClick={handlePause}
              disabled={submitting}
            >
              {submitting ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <>
                  <i className="bi bi-pause-circle me-2"></i>
                  Pause
                </>
              )}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="pause_reason">
            Pause Reason
          </label>
          <select
            id="pause_reason"
            className="select"
            value={pauseForm.pause_reason}
            onChange={(e) => setPauseForm((prev) => ({ ...prev, pause_reason: e.target.value }))}
          >
            <option value="WAITING_LAB">Waiting for Lab Results</option>
            <option value="WAITING_RADIOLOGY">Waiting for Radiology</option>
            <option value="PATIENT_NOT_READY">Patient Not Ready</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="field mb-0">
          <label className="field-label" htmlFor="pause_notes">
            Notes
          </label>
          <input
            id="pause_notes"
            type="text"
            className="input"
            placeholder="Additional notes..."
            value={pauseForm.pause_notes}
            onChange={(e) => setPauseForm((prev) => ({ ...prev, pause_notes: e.target.value }))}
          />
        </div>
      </Modal>
    </>
  );
}