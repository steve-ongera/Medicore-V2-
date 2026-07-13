import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getAdmission,
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

  // Ward round
  const [roundNotes, setRoundNotes] = useState("");
  const [roundPlan, setRoundPlan] = useState("");

  // Nursing note
  const [nnShift, setNnShift] = useState("MORNING");
  const [nnNote, setNnNote] = useState("");

  // Vitals
  const [vitals, setVitals] = useState({
    weight_kg: "", height_cm: "", temperature_c: "", pulse_bpm: "",
    respiratory_rate: "", bp_systolic: "", bp_diastolic: "", oxygen_saturation: "", shift: "MORNING",
  });

  // Medication order
  const [medicines, setMedicines] = useState([]);
  const [medOrder, setMedOrder] = useState({ medicine: "", dosage: "", route: "ORAL", frequency: "" });

  // Bed transfer
  const [wards, setWards] = useState([]);
  const [transferWard, setTransferWard] = useState("");
  const [transferBeds, setTransferBeds] = useState([]);
  const [transferBedId, setTransferBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Discharge
  const [dischargeType, setDischargeType] = useState("NORMAL");
  const [dischargeSummary, setDischargeSummary] = useState("");

  useEffect(() => {
    loadAdmission();
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
      await createMedicationOrder({ admission: id, ...medOrder });
      setMedOrder({ medicine: "", dosage: "", route: "ORAL", frequency: "" });
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

  if (loading) return <div>Loading admission...</div>;
  if (error && !admission) return <div>Error: {error}</div>;
  if (!admission) return null;

  const isActive = admission.status === "ADMITTED";

  return (
    <div>
      <button type="button" onClick={() => navigate("/inpatient/admissions")}>
        &larr; Back to Admissions
      </button>

      <h1>{admission.admission_number}</h1>
      {error && <p>Error: {error}</p>}

      <section>
        <h2>Patient Info</h2>
        <p>Name: {admission.patient_name}</p>
        <p>Hospital #: {admission.hospital_number}</p>
        <p>Ward / Bed: {admission.ward_name} / {admission.bed_number}</p>
        <p>Admitting Doctor: {admission.admitting_doctor_name}</p>
        <p>Attending Doctor: {admission.attending_doctor_name}</p>
        <p>Type: {admission.admission_type}</p>
        <p>Diagnosis: {admission.admission_diagnosis}</p>
        <p>Status: {admission.status}</p>
        <p>Admitted: {new Date(admission.admission_date).toLocaleString()}</p>
        <p>Length of Stay: {admission.length_of_stay_days} days</p>
        {admission.status !== "ADMITTED" && (
          <>
            <p>Discharge Type: {admission.discharge_type}</p>
            <p>Discharge Summary: {admission.discharge_summary}</p>
            <p>Discharged: {admission.discharge_date && new Date(admission.discharge_date).toLocaleString()}</p>
          </>
        )}
      </section>

      {isActive && (
        <section>
          <h2>Discharge Patient</h2>
          <form onSubmit={handleDischarge}>
            <select value={dischargeType} onChange={(e) => setDischargeType(e.target.value)}>
              <option value="NORMAL">Normal Discharge</option>
              <option value="DAMA">Discharge Against Medical Advice</option>
              <option value="REFERRED">Referred Out</option>
              <option value="DECEASED">Deceased</option>
              <option value="ABSCONDED">Absconded</option>
            </select>
            <textarea
              placeholder="Discharge summary"
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              required
            />
            <button type="submit">Discharge</button>
          </form>
        </section>
      )}

      {isActive && (
        <section>
          <h2>Transfer Bed</h2>
          <form onSubmit={handleTransferBed}>
            <select value={transferWard} onChange={handleTransferWardChange} required>
              <option value="">Select ward</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <select value={transferBedId} onChange={(e) => setTransferBedId(e.target.value)} required>
              <option value="">Select bed</option>
              {transferBeds.map((b) => (
                <option key={b.id} value={b.id}>{b.bed_number}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Reason"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
            />
            <button type="submit">Transfer</button>
          </form>
        </section>
      )}

      <section>
        <h2>Ward Rounds</h2>
        {isActive && (
          <form onSubmit={handleAddWardRound}>
            <textarea
              placeholder="Notes"
              value={roundNotes}
              onChange={(e) => setRoundNotes(e.target.value)}
              required
            />
            <textarea
              placeholder="Plan"
              value={roundPlan}
              onChange={(e) => setRoundPlan(e.target.value)}
            />
            <button type="submit">Add Ward Round</button>
          </form>
        )}
        <ul>
          {(admission.ward_rounds || []).map((r) => (
            <li key={r.id}>
              [{new Date(r.round_date).toLocaleString()}] Dr. {r.doctor_name}: {r.notes} {r.plan && `— Plan: ${r.plan}`}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Nursing Notes</h2>
        {isActive && (
          <form onSubmit={handleAddNursingNote}>
            <select value={nnShift} onChange={(e) => setNnShift(e.target.value)}>
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
            <textarea
              placeholder="Note"
              value={nnNote}
              onChange={(e) => setNnNote(e.target.value)}
              required
            />
            <button type="submit">Add Nursing Note</button>
          </form>
        )}
        <ul>
          {(admission.nursing_notes || []).map((n) => (
            <li key={n.id}>
              [{n.shift}] {n.nurse_name}: {n.note}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Vitals</h2>
        {isActive && (
          <form onSubmit={handleSaveVitals}>
            <select value={vitals.shift} onChange={handleVitalsChange("shift")}>
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
            <input type="number" placeholder="Weight (kg)" value={vitals.weight_kg} onChange={handleVitalsChange("weight_kg")} />
            <input type="number" placeholder="Height (cm)" value={vitals.height_cm} onChange={handleVitalsChange("height_cm")} />
            <input type="number" placeholder="Temp (°C)" value={vitals.temperature_c} onChange={handleVitalsChange("temperature_c")} />
            <input type="number" placeholder="Pulse (bpm)" value={vitals.pulse_bpm} onChange={handleVitalsChange("pulse_bpm")} />
            <input type="number" placeholder="Resp. Rate" value={vitals.respiratory_rate} onChange={handleVitalsChange("respiratory_rate")} />
            <input type="number" placeholder="BP Systolic" value={vitals.bp_systolic} onChange={handleVitalsChange("bp_systolic")} />
            <input type="number" placeholder="BP Diastolic" value={vitals.bp_diastolic} onChange={handleVitalsChange("bp_diastolic")} />
            <input type="number" placeholder="SpO2 (%)" value={vitals.oxygen_saturation} onChange={handleVitalsChange("oxygen_saturation")} />
            <button type="submit">Save Vitals</button>
          </form>
        )}
        <ul>
          {(admission.vitals || []).map((v) => (
            <li key={v.id}>
              [{new Date(v.recorded_at).toLocaleString()}] BP: {v.bp_systolic}/{v.bp_diastolic}, Temp: {v.temperature_c}°C,
              Pulse: {v.pulse_bpm}, SpO2: {v.oxygen_saturation}%, BMI: {v.bmi}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Medication Orders (MAR)</h2>
        {isActive && (
          <form onSubmit={handleCreateMedOrder}>
            <select value={medOrder.medicine} onChange={handleMedOrderChange("medicine")} required>
              <option value="">Select medicine</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Dosage (e.g. 500mg)"
              value={medOrder.dosage}
              onChange={handleMedOrderChange("dosage")}
              required
            />
            <select value={medOrder.route} onChange={handleMedOrderChange("route")}>
              <option value="ORAL">Oral</option>
              <option value="IV">IV</option>
              <option value="IM">IM</option>
              <option value="SC">SC</option>
              <option value="TOPICAL">Topical</option>
              <option value="OTHER">Other</option>
            </select>
            <input
              type="text"
              placeholder="Frequency (e.g. Every 8 hours)"
              value={medOrder.frequency}
              onChange={handleMedOrderChange("frequency")}
              required
            />
            <button type="submit">Add Medication Order</button>
          </form>
        )}

        <ul>
          {(admission.medication_orders || []).map((m) => (
            <li key={m.id}>
              {m.medicine_name} — {m.dosage} — {m.route} — {m.frequency} — {m.is_active ? "Active" : "Discontinued"}
              {isActive && m.is_active && (
                <>
                  {" "}
                  <button type="button" onClick={() => handleAdministerMed(m.id)}>Mark Given</button>{" "}
                  <button type="button" onClick={() => handleDiscontinueMed(m.id)}>Discontinue</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Bed Transfer History</h2>
        <ul>
          {(admission.bed_transfers || []).map((t) => (
            <li key={t.id}>
              [{new Date(t.transferred_at).toLocaleString()}] {t.from_bed_label || "N/A"} &rarr; {t.to_bed_label}
              {t.reason && ` (${t.reason})`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}