import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAdmission,
  getAdmissionBilling,
  dischargePatient,
  getAvailableBeds,
  getWards,
  transferBed,
  createWardRound,
  createNursingNote,
  saveInpatientVitals,
  getMedicines,
  createMedicationOrder,
  discontinueMedicationOrder,
  recordMedicationAdministration,
} from "../../services/api";

export default function AdmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [admission, setAdmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("patient");

  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(true);

  const [roundNotes, setRoundNotes] = useState("");
  const [roundPlan, setRoundPlan] = useState("");

  const [nnShift, setNnShift] = useState("MORNING");
  const [nnNote, setNnNote] = useState("");

  const [vitals, setVitals] = useState({
    weight_kg: "", height_cm: "", temperature_c: "", pulse_bpm: "",
    respiratory_rate: "", bp_systolic: "", bp_diastolic: "", oxygen_saturation: "", shift: "MORNING",
  });

  const [medicines, setMedicines] = useState([]);
  const [medOrder, setMedOrder] = useState({ medicine: "", dosage: "", route: "ORAL", frequency: "", quantity: 1 });

  const [wards, setWards] = useState([]);
  const [transferWard, setTransferWard] = useState("");
  const [transferBeds, setTransferBeds] = useState([]);
  const [transferBedId, setTransferBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  const [dischargeType, setDischargeType] = useState("NORMAL");
  const [dischargeSummary, setDischargeSummary] = useState("");

  useEffect(() => {
    loadAdmission();
    loadBilling();
    loadWards();
    loadMedicines();
  }, [id]);

  const loadAdmission = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getAdmission(id);
      setAdmission(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBilling = async () => {
    setBillingLoading(true);
    try {
      const data = await getAdmissionBilling(id);
      setBilling(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBillingLoading(false);
    }
  };

  const loadWards = async () => {
    try {
      const data = await getWards();
      setWards(data.results ?? data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadMedicines = async () => {
    try {
      const data = await getMedicines();
      setMedicines(data.results ?? data);
    } catch (err) {
      setError(err.message);
    }
  };

  const loadTransferBeds = async (wardId) => {
    try {
      const data = await getAvailableBeds(wardId);
      setTransferBeds(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddWardRound = async (e) => {
    e.preventDefault();
    try {
      await createWardRound({ admission: id, notes: roundNotes, plan: roundPlan });
      setRoundNotes("");
      setRoundPlan("");
      loadAdmission();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddNursingNote = async (e) => {
    e.preventDefault();
    try {
      await createNursingNote({ admission: id, shift: nnShift, note: nnNote });
      setNnNote("");
      loadAdmission();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleVitalsChange = (field) => (e) => {
    setVitals((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSaveVitals = async (e) => {
    e.preventDefault();
    try {
      await saveInpatientVitals({ admission: id, ...vitals });
      loadAdmission();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleMedOrderChange = (field) => (e) => {
    setMedOrder((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCreateMedOrder = async (e) => {
    e.preventDefault();
    try {
      await createMedicationOrder({ admission: id, ...medOrder, quantity: Number(medOrder.quantity) || 1 });
      setMedOrder({ medicine: "", dosage: "", route: "ORAL", frequency: "", quantity: 1 });
      loadAdmission();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDiscontinueMed = async (orderId) => {
    try {
      await discontinueMedicationOrder(orderId);
      loadAdmission();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdministerMed = async (orderId) => {
    try {
      await recordMedicationAdministration({ medication_order: orderId, status: "GIVEN" });
      loadAdmission();
      loadBilling();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTransferWardChange = (e) => {
    setTransferWard(e.target.value);
    setTransferBedId("");
    if (e.target.value) loadTransferBeds(e.target.value);
  };

  const handleTransferBed = async (e) => {
    e.preventDefault();
    try {
      await transferBed(id, { to_bed: transferBedId, reason: transferReason });
      setTransferWard("");
      setTransferBedId("");
      setTransferReason("");
      loadAdmission();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDischarge = async (e) => {
    e.preventDefault();
    try {
      await dischargePatient(id, { discharge_type: dischargeType, discharge_summary: dischargeSummary });
      loadAdmission();
    } catch (err) {
      setError(err.message);
    }
  };

  const goToBillingPayment = () => {
    const unpaidInvoice = billing?.invoices?.find((inv) => Number(inv.balance) > 0);
    if (unpaidInvoice) {
      navigate(`/billing/payments?invoice=${unpaidInvoice.id}`);
    } else {
      navigate("/billing/payments");
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <span className="loading-screen__label">Loading admission details...</span>
      </div>
    );
  }

  if (error && !admission) {
    return (
      <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
        <div className="text-danger font-semibold">Error loading admission</div>
        <p className="text-sm text-muted" style={{ marginTop: "var(--space-2)" }}>{error}</p>
        <button className="btn btn-primary mt-4" onClick={() => navigate("/inpatient/admissions")}>
          <i className="bi bi-arrow-left me-2"></i> Back to Admissions
        </button>
      </div>
    );
  }

  if (!admission) return null;

  const isActive = admission.status === "ADMITTED";

  const tabs = [
    { id: "patient", label: "Patient Info", icon: "bi-person" },
    { id: "billing", label: "Billing", icon: "bi-currency-dollar" },
    { id: "rounds", label: "Ward Rounds", icon: "bi-clipboard" },
    { id: "nursing", label: "Nursing Notes", icon: "bi-file-text" },
    { id: "vitals", label: "Vitals", icon: "bi-heart-pulse" },
    { id: "medications", label: "Medications", icon: "bi-capsule" },
    { id: "transfers", label: "Bed Transfers", icon: "bi-arrow-left-right" },
  ];

  if (isActive) {
    tabs.push({ id: "discharge", label: "Discharge", icon: "bi-door-open" });
    tabs.push({ id: "transfer", label: "Transfer Bed", icon: "bi-arrows-move" });
  }

  const getStatusBadge = (status) => {
    const statusMap = {
      "PAID": "badge-success",
      "PARTIAL": "badge-warning",
      "UNPAID": "badge-danger",
      "CANCELLED": "badge-neutral"
    };
    return statusMap[status] || "badge-neutral";
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inpatient Management</div>
          <h1 className="page-title">{admission.admission_number}</h1>
          <p className="page-subtitle">
            {admission.patient_name} • {admission.ward_name} / Bed {admission.bed_number}
          </p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-secondary" onClick={() => navigate("/inpatient/admissions")}>
            <i className="bi bi-arrow-left me-2"></i> Back
          </button>
          <button className="btn btn-secondary" onClick={loadAdmission}>
            <i className="bi bi-arrow-clockwise me-2"></i> Refresh
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
        <div className="card-body">
          <div className="patient-header">
            <div className="avatar avatar-lg">
              <i className="bi bi-person fs-2xl"></i>
            </div>
            <div className="patient-header__meta">
              <div className="patient-header__name">{admission.patient_name}</div>
              <div className="patient-header__sub">
                <span className="patient-header__id">
                  <i className="bi bi-hash me-1"></i> {admission.hospital_number}
                </span>
                <span>•</span>
                <span>Ward: {admission.ward_name}</span>
                <span>•</span>
                <span>Bed: {admission.bed_number}</span>
                <span>•</span>
                <span className={`badge ${isActive ? "badge-primary" : "badge-success"}`}>
                  <span className="badge-dot"></span>
                  {admission.status}
                </span>
              </div>
            </div>
            <div className="patient-header__actions">
              <span className="text-sm text-muted">
                <i className="bi bi-clock me-1"></i> LOS: {admission.length_of_stay_days} days
              </span>
            </div>
          </div>

          <div className="info-grid">
            <div className="info-item">
              <div className="info-item__label">Admitting Doctor</div>
              <div className="info-item__value">{admission.admitting_doctor_name || "—"}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Attending Doctor</div>
              <div className="info-item__value">{admission.attending_doctor_name || "—"}</div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Admission Type</div>
              <div className="info-item__value">
                <span className="tag">{admission.admission_type}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-item__label">Admission Date</div>
              <div className="info-item__value">{new Date(admission.admission_date).toLocaleString()}</div>
            </div>
          </div>

          {admission.admission_diagnosis && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <div className="text-sm text-muted">Diagnosis</div>
              <div className="diagnosis-chip">
                <span className="diagnosis-chip__code">DX</span>
                {admission.admission_diagnosis}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tabs__item ${activeTab === tab.id ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`bi ${tab.icon} me-1`}></i> {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          {/* Patient Info Tab */}
          {activeTab === "patient" && (
            <div>
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-item__label">Admission Number</div>
                  <div className="info-item__value font-mono">{admission.admission_number}</div>
                </div>
                <div className="info-item">
                  <div className="info-item__label">Status</div>
                  <div className="info-item__value">
                    <span className={`badge ${isActive ? "badge-primary" : "badge-success"}`}>
                      <span className="badge-dot"></span>
                      {admission.status}
                    </span>
                  </div>
                </div>
                {!isActive && (
                  <>
                    <div className="info-item">
                      <div className="info-item__label">Discharge Type</div>
                      <div className="info-item__value">{admission.discharge_type || "—"}</div>
                    </div>
                    <div className="info-item">
                      <div className="info-item__label">Discharge Date</div>
                      <div className="info-item__value">
                        {admission.discharge_date ? new Date(admission.discharge_date).toLocaleString() : "—"}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {admission.discharge_summary && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  <div className="text-sm text-muted">Discharge Summary</div>
                  <div className="consult-notes-field">{admission.discharge_summary}</div>
                </div>
              )}
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === "billing" && (
            <div>
              {billingLoading ? (
                <div className="loading-screen" style={{ padding: "var(--space-6)" }}>
                  <div className="spinner"></div>
                  <span className="loading-screen__label">Loading billing summary...</span>
                </div>
              ) : !billing?.has_visit ? (
                <div className="text-sm text-muted text-center" style={{ padding: "var(--space-6)" }}>
                  <i className="bi bi-info-circle me-1"></i> No billing data yet. Charges will appear once bed charges or orders are generated.
                </div>
              ) : (
                <div>
                  <div className="stat-grid" style={{ marginBottom: "var(--space-4)" }}>
                    <div className="stat-card">
                      <div className="stat-card__top">
                        <span className="stat-card__label">Grand Total</span>
                        <div className="stat-card__icon tone-info">
                          <i className="bi bi-receipt"></i>
                        </div>
                      </div>
                      <div className="stat-card__value">KES {billing.grand_total}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card__top">
                        <span className="stat-card__label">Amount Paid</span>
                        <div className="stat-card__icon tone-success">
                          <i className="bi bi-check-circle"></i>
                        </div>
                      </div>
                      <div className="stat-card__value">KES {billing.amount_paid}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-card__top">
                        <span className="stat-card__label">Balance</span>
                        <div className="stat-card__icon tone-warning">
                          <i className="bi bi-currency-dollar"></i>
                        </div>
                      </div>
                      <div className="stat-card__value">KES {billing.balance}</div>
                    </div>
                  </div>

                  <div className="table-scroll" style={{ marginBottom: "var(--space-4)" }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th className="cell-numeric">Items</th>
                          <th className="cell-numeric">Total</th>
                          <th className="cell-numeric">Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(billing.breakdown).map(([sourceType, row]) => (
                          <tr key={sourceType}>
                            <td>{sourceType}</td>
                            <td className="cell-numeric">{row.count}</td>
                            <td className="cell-numeric">KES {row.total}</td>
                            <td className="cell-numeric">KES {row.paid}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <h6 className="text-sm font-semibold" style={{ marginBottom: "var(--space-3)" }}>Invoice Detail</h6>
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Type</th>
                          <th>Description</th>
                          <th className="cell-numeric">Amount</th>
                          <th className="cell-numeric">Paid</th>
                          <th className="cell-numeric">Balance</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {billing.invoices.map((inv) => (
                          <tr key={inv.id}>
                            <td className="cell-mono">{inv.invoice_number}</td>
                            <td>{inv.source_type}</td>
                            <td>{inv.description}</td>
                            <td className="cell-numeric">KES {inv.amount}</td>
                            <td className="cell-numeric">KES {inv.amount_paid}</td>
                            <td className="cell-numeric">KES {inv.balance}</td>
                            <td>
                              <span className={`badge ${getStatusBadge(inv.status)}`}>
                                <span className="badge-dot"></span>
                                {inv.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="form-actions" style={{ marginTop: "var(--space-4)" }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={goToBillingPayment}
                      disabled={Number(billing.balance) <= 0}
                    >
                      <i className="bi bi-credit-card me-2"></i> Go to Billing / Take Payment
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Ward Rounds Tab */}
          {activeTab === "rounds" && (
            <div>
              {isActive && (
                <form onSubmit={handleAddWardRound} style={{ marginBottom: "var(--space-4)" }}>
                  <div className="field">
                    <label className="field-label">Notes</label>
                    <textarea
                      className="textarea"
                      placeholder="Enter ward round notes"
                      value={roundNotes}
                      onChange={(e) => setRoundNotes(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">Plan</label>
                    <textarea
                      className="textarea"
                      placeholder="Enter treatment plan"
                      value={roundPlan}
                      onChange={(e) => setRoundPlan(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-plus-circle me-2"></i> Add Ward Round
                  </button>
                </form>
              )}
              {(admission.ward_rounds || []).length === 0 ? (
                <div className="text-sm text-muted text-center" style={{ padding: "var(--space-6)" }}>
                  No ward rounds recorded
                </div>
              ) : (
                <div className="timeline">
                  {(admission.ward_rounds || []).map((r) => (
                    <div key={r.id} className="timeline-item">
                      <div className="timeline-item__title">{r.notes}</div>
                      <div className="timeline-item__time">
                        {r.doctor_name} • {new Date(r.round_date).toLocaleString()}
                        {r.plan && <div className="text-sm text-muted mt-1">Plan: {r.plan}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Nursing Notes Tab */}
          {activeTab === "nursing" && (
            <div>
              {isActive && (
                <form onSubmit={handleAddNursingNote} style={{ marginBottom: "var(--space-4)" }}>
                  <div className="field-row">
                    <div className="field">
                      <label className="field-label">Shift</label>
                      <select className="select" value={nnShift} onChange={(e) => setNnShift(e.target.value)}>
                        <option value="MORNING">Morning</option>
                        <option value="AFTERNOON">Afternoon</option>
                        <option value="NIGHT">Night</option>
                      </select>
                    </div>
                    <div className="field" style={{ flex: 2 }}>
                      <label className="field-label">Note</label>
                      <textarea
                        className="textarea"
                        placeholder="Enter nursing note"
                        value={nnNote}
                        onChange={(e) => setNnNote(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-plus-circle me-2"></i> Add Nursing Note
                  </button>
                </form>
              )}
              {(admission.nursing_notes || []).length === 0 ? (
                <div className="text-sm text-muted text-center" style={{ padding: "var(--space-6)" }}>
                  No nursing notes recorded
                </div>
              ) : (
                <div className="timeline">
                  {(admission.nursing_notes || []).map((n) => (
                    <div key={n.id} className="timeline-item">
                      <div className="timeline-item__title">{n.note}</div>
                      <div className="timeline-item__time">
                        {n.nurse_name} • {n.shift} shift
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Vitals Tab */}
          {activeTab === "vitals" && (
            <div>
              {isActive && (
                <form onSubmit={handleSaveVitals} style={{ marginBottom: "var(--space-4)" }}>
                  <div className="field">
                    <label className="field-label">Shift</label>
                    <select className="select" value={vitals.shift} onChange={handleVitalsChange("shift")}>
                      <option value="MORNING">Morning</option>
                      <option value="AFTERNOON">Afternoon</option>
                      <option value="NIGHT">Night</option>
                    </select>
                  </div>
                  <div className="vitals-grid">
                    <div className="field">
                      <label className="field-label">Weight (kg)</label>
                      <input type="number" className="input" placeholder="Weight" value={vitals.weight_kg} onChange={handleVitalsChange("weight_kg")} />
                    </div>
                    <div className="field">
                      <label className="field-label">Height (cm)</label>
                      <input type="number" className="input" placeholder="Height" value={vitals.height_cm} onChange={handleVitalsChange("height_cm")} />
                    </div>
                    <div className="field">
                      <label className="field-label">Temp (°C)</label>
                      <input type="number" className="input" placeholder="Temp" value={vitals.temperature_c} onChange={handleVitalsChange("temperature_c")} />
                    </div>
                    <div className="field">
                      <label className="field-label">Pulse (bpm)</label>
                      <input type="number" className="input" placeholder="Pulse" value={vitals.pulse_bpm} onChange={handleVitalsChange("pulse_bpm")} />
                    </div>
                    <div className="field">
                      <label className="field-label">Respiratory Rate</label>
                      <input type="number" className="input" placeholder="Respiratory rate" value={vitals.respiratory_rate} onChange={handleVitalsChange("respiratory_rate")} />
                    </div>
                    <div className="field">
                      <label className="field-label">BP Systolic</label>
                      <input type="number" className="input" placeholder="Systolic" value={vitals.bp_systolic} onChange={handleVitalsChange("bp_systolic")} />
                    </div>
                    <div className="field">
                      <label className="field-label">BP Diastolic</label>
                      <input type="number" className="input" placeholder="Diastolic" value={vitals.bp_diastolic} onChange={handleVitalsChange("bp_diastolic")} />
                    </div>
                    <div className="field">
                      <label className="field-label">SpO2 (%)</label>
                      <input type="number" className="input" placeholder="SpO2" value={vitals.oxygen_saturation} onChange={handleVitalsChange("oxygen_saturation")} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-floppy me-2"></i> Save Vitals
                  </button>
                </form>
              )}
              {(admission.vitals || []).length === 0 ? (
                <div className="text-sm text-muted text-center" style={{ padding: "var(--space-6)" }}>
                  No vitals recorded
                </div>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date/Time</th>
                        <th>Shift</th>
                        <th className="cell-numeric">BP</th>
                        <th className="cell-numeric">Temp</th>
                        <th className="cell-numeric">Pulse</th>
                        <th className="cell-numeric">SpO2</th>
                        <th className="cell-numeric">BMI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(admission.vitals || []).map((v) => (
                        <tr key={v.id}>
                          <td>{new Date(v.recorded_at).toLocaleString()}</td>
                          <td>{v.shift}</td>
                          <td className="cell-numeric">{v.bp_systolic}/{v.bp_diastolic}</td>
                          <td className="cell-numeric">{v.temperature_c}°C</td>
                          <td className="cell-numeric">{v.pulse_bpm}</td>
                          <td className="cell-numeric">{v.oxygen_saturation}%</td>
                          <td className="cell-numeric">{v.bmi || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Medications Tab */}
          {activeTab === "medications" && (
            <div>
              {isActive && (
                <form onSubmit={handleCreateMedOrder} style={{ marginBottom: "var(--space-4)" }}>
                  <div className="field-row">
                    <div className="field">
                      <label className="field-label">Medicine</label>
                      <select className="select" value={medOrder.medicine} onChange={handleMedOrderChange("medicine")} required>
                        <option value="">Select medicine</option>
                        {medicines.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Dosage</label>
                      <input type="text" className="input" placeholder="e.g. 500mg" value={medOrder.dosage} onChange={handleMedOrderChange("dosage")} required />
                    </div>
                    <div className="field">
                      <label className="field-label">Route</label>
                      <select className="select" value={medOrder.route} onChange={handleMedOrderChange("route")}>
                        <option value="ORAL">Oral</option>
                        <option value="IV">IV</option>
                        <option value="IM">IM</option>
                        <option value="SC">SC</option>
                        <option value="TOPICAL">Topical</option>
                      </select>
                    </div>
                    <div className="field">
                      <label className="field-label">Frequency</label>
                      <input type="text" className="input" placeholder="e.g. Every 8 hours" value={medOrder.frequency} onChange={handleMedOrderChange("frequency")} required />
                    </div>
                    <div className="field">
                      <label className="field-label">Qty per dose</label>
                      <input type="number" className="input" min="1" placeholder="Quantity" value={medOrder.quantity} onChange={handleMedOrderChange("quantity")} required />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-plus-circle me-2"></i> Add Medication Order
                  </button>
                </form>
              )}
              {(admission.medication_orders || []).length === 0 ? (
                <div className="text-sm text-muted text-center" style={{ padding: "var(--space-6)" }}>
                  No medication orders
                </div>
              ) : (
                <div className="rx-list">
                  {(admission.medication_orders || []).map((m) => (
                    <div key={m.id} className="rx-item">
                      <div>
                        <div className="rx-item__name">{m.medicine_name}</div>
                        <div className="rx-item__detail">
                          {m.dosage} • {m.route} • {m.frequency} • Qty: {m.quantity}
                        </div>
                      </div>
                      <div className="flex gap-2 align-items-center">
                        <span className={`badge ${m.is_active ? "badge-success" : "badge-neutral"}`}>
                          <span className="badge-dot"></span>
                          {m.is_active ? "Active" : "Discontinued"}
                        </span>
                        {isActive && m.is_active && (
                          <>
                            <button className="btn btn-success btn-sm" onClick={() => handleAdministerMed(m.id)}>
                              <i className="bi bi-check me-1"></i> Give
                            </button>
                            <button className="btn btn-danger-outline btn-sm" onClick={() => handleDiscontinueMed(m.id)}>
                              <i className="bi bi-x me-1"></i> DC
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Bed Transfers Tab */}
          {activeTab === "transfers" && (
            <div>
              {(admission.bed_transfers || []).length === 0 ? (
                <div className="text-sm text-muted text-center" style={{ padding: "var(--space-6)" }}>
                  No bed transfer history
                </div>
              ) : (
                <div className="timeline">
                  {(admission.bed_transfers || []).map((t) => (
                    <div key={t.id} className="timeline-item">
                      <div className="timeline-item__title">
                        <i className="bi bi-arrow-right me-1"></i> {t.from_bed_label || "N/A"} → {t.to_bed_label}
                      </div>
                      <div className="timeline-item__time">
                        {new Date(t.transferred_at).toLocaleString()}
                        {t.reason && <div className="text-sm text-muted mt-1">Reason: {t.reason}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Transfer Bed Tab */}
          {activeTab === "transfer" && isActive && (
            <div>
              <form onSubmit={handleTransferBed}>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Ward</label>
                    <select className="select" value={transferWard} onChange={handleTransferWardChange} required>
                      <option value="">Select ward</option>
                      {wards.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Bed</label>
                    <select className="select" value={transferBedId} onChange={(e) => setTransferBedId(e.target.value)} required>
                      <option value="">Select bed</option>
                      {transferBeds.map((b) => (
                        <option key={b.id} value={b.id}>{b.bed_number}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Reason</label>
                    <input type="text" className="input" placeholder="Reason for transfer" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">
                  <i className="bi bi-arrows-move me-2"></i> Transfer Bed
                </button>
              </form>
            </div>
          )}

          {/* Discharge Tab */}
          {activeTab === "discharge" && isActive && (
            <div>
              <form onSubmit={handleDischarge}>
                <div className="field">
                  <label className="field-label">Discharge Type</label>
                  <select className="select" value={dischargeType} onChange={(e) => setDischargeType(e.target.value)}>
                    <option value="NORMAL">Normal Discharge</option>
                    <option value="DAMA">Discharge Against Medical Advice</option>
                    <option value="REFERRED">Referred Out</option>
                    <option value="DECEASED">Deceased</option>
                    <option value="ABSCONDED">Absconded</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field-label">Discharge Summary</label>
                  <textarea
                    className="textarea"
                    placeholder="Enter discharge summary"
                    value={dischargeSummary}
                    onChange={(e) => setDischargeSummary(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-danger">
                  <i className="bi bi-door-open me-2"></i> Discharge Patient
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}