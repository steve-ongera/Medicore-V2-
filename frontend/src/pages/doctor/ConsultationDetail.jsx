//src/pages/doctor/ConsultationDetail.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getConsultation, saveConsultation, deleteConsultation } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import { formatDate } from "../../utils/formatters";

const HOSPITAL_NAME = "City General Hospital";
const HOSPITAL_ADDRESS = "P.O. Box 00100, Nairobi, Kenya  ·  Tel: +254 700 000 000";
const BRAND_COLOR = [30, 64, 175]; // matches the app's primary blue

const EDITABLE_FIELDS = [
  ["chief_complaint", "Chief Complaint", 2],
  ["history_of_present_illness", "History of Present Illness", 3],
  ["physical_examination", "Physical Examination", 3],
  ["treatment_plan", "Treatment Plan", 3],
  ["clinical_notes", "Clinical Notes", 2],
];

const fieldsFrom = (cons) =>
  EDITABLE_FIELDS.reduce((acc, [key]) => {
    acc[key] = cons?.[key] || "";
    return acc;
  }, {});

const humanize = (value) => (value ? value.replace(/_/g, " ") : "—");

export default function ConsultationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "1");
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadConsultation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadConsultation = async () => {
    setLoading(true);
    try {
      const data = await getConsultation(id);
      setConsultation(data);
      setForm(fieldsFrom(data));
    } catch (err) {
      toast.error(err.message || "Failed to load consultation");
      navigate("/doctor/consultations");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const setEditMode = (value) => {
    setIsEditing(value);
    if (value) {
      searchParams.set("edit", "1");
    } else {
      searchParams.delete("edit");
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await saveConsultation(id, form);
      setConsultation(updated);
      setForm(fieldsFrom(updated));
      setEditMode(false);
      toast.success("Consultation updated successfully");
    } catch (err) {
      toast.error(err.message || "Failed to update consultation");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setForm(fieldsFrom(consultation));
    setEditMode(false);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteConsultation(id);
      toast.success("Consultation deleted successfully");
      navigate("/doctor/consultations");
    } catch (err) {
      toast.error(err.message || "Failed to delete consultation");
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  // Builds a well-formatted, letterhead-style PDF of the full consultation
  // record — patient/visit summary, clinical notes, diagnoses, prescriptions,
  // and lab/radiology orders — and triggers a browser download.
  const handleDownloadPdf = () => {
    if (!consultation) return;
    setDownloading(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 40;
      let y = margin;

      const ensureSpace = (needed) => {
        if (y + needed > pageHeight - 50) {
          doc.addPage();
          y = margin;
        }
      };

      // --- Letterhead ---
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND_COLOR);
      doc.text(HOSPITAL_NAME, margin, y);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(HOSPITAL_ADDRESS, margin, y + 14);
      doc.setDrawColor(...BRAND_COLOR);
      doc.setLineWidth(1.2);
      doc.line(margin, y + 24, pageWidth - margin, y + 24);
      y += 48;

      // --- Title ---
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("Consultation Report", margin, y);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - margin, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 20;

      // --- Patient / visit summary ---
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        theme: "plain",
        styles: { fontSize: 9.5, cellPadding: 3 },
        body: [
          ["Patient", consultation.patient_name || "—", "Status", humanize(consultation.status)],
          ["Attending Doctor", consultation.doctor_name || "—", "Started", consultation.started_at ? formatDate(consultation.started_at) : "—"],
          ["Visit Reference", consultation.visit || "—", "Completed", consultation.completed_at ? formatDate(consultation.completed_at) : "—"],
        ],
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 110, textColor: [90, 90, 90] },
          1: { cellWidth: 155 },
          2: { fontStyle: "bold", cellWidth: 110, textColor: [90, 90, 90] },
          3: { cellWidth: 110 },
        },
      });
      y = doc.lastAutoTable.finalY + 16;

      // --- Narrative clinical sections ---
      const addSection = (title, content) => {
        ensureSpace(30);
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND_COLOR);
        doc.text(title, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 13;

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        const text = content && content.trim() ? content : "None recorded";
        const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
        ensureSpace(lines.length * 12 + 10);
        doc.text(lines, margin, y);
        y += lines.length * 12 + 14;
      };

      addSection("Chief Complaint", consultation.chief_complaint);
      addSection("History of Present Illness", consultation.history_of_present_illness);
      addSection("Physical Examination", consultation.physical_examination);
      addSection("Treatment Plan", consultation.treatment_plan);
      addSection("Clinical Notes", consultation.clinical_notes);

      // --- Diagnoses ---
      if (consultation.diagnoses?.length) {
        ensureSpace(40);
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND_COLOR);
        doc.text("Diagnoses", margin, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Code", "Description", "Primary"]],
          body: consultation.diagnoses.map((d) => [d.code, d.description, d.is_primary ? "Yes" : ""]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
        });
        y = doc.lastAutoTable.finalY + 18;
      }

      // --- Prescriptions ---
      if (consultation.prescriptions?.length) {
        ensureSpace(40);
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND_COLOR);
        doc.text("Prescriptions", margin, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Medicine", "Dosage", "Frequency", "Duration", "Qty", "Instructions", "Dispensed"]],
          body: consultation.prescriptions.map((rx) => [
            rx.medicine_name,
            rx.dosage,
            rx.frequency || "—",
            rx.duration || "—",
            rx.quantity,
            rx.instructions || "—",
            rx.is_dispensed ? "Yes" : "No",
          ]),
          styles: { fontSize: 8.5 },
          headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
        });
        y = doc.lastAutoTable.finalY + 18;
      }

      // --- Lab orders ---
      if (consultation.lab_orders?.length) {
        ensureSpace(40);
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND_COLOR);
        doc.text("Lab Orders", margin, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Test", "Status", "Paid"]],
          body: consultation.lab_orders.map((o) => [o.test_name, humanize(o.status), o.is_paid ? "Yes" : "No"]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
        });
        y = doc.lastAutoTable.finalY + 18;
      }

      // --- Radiology orders ---
      if (consultation.radiology_orders?.length) {
        ensureSpace(40);
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...BRAND_COLOR);
        doc.text("Radiology Orders", margin, y);
        doc.setTextColor(0, 0, 0);
        y += 8;
        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [["Test", "Status", "Paid"]],
          body: consultation.radiology_orders.map((o) => [o.test_name, humanize(o.status), o.is_paid ? "Yes" : "No"]),
          styles: { fontSize: 9 },
          headStyles: { fillColor: BRAND_COLOR, textColor: 255 },
        });
        y = doc.lastAutoTable.finalY + 18;
      }

      // --- Footer on every page ---
      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `${HOSPITAL_NAME} — Confidential Medical Record — Page ${i} of ${pageCount}`,
          pageWidth / 2,
          pageHeight - 20,
          { align: "center" }
        );
      }

      const safeName = (consultation.patient_name || "patient").replace(/[^a-z0-9]+/gi, "_");
      const dateStr = new Date().toISOString().slice(0, 10);
      doc.save(`consultation_${safeName}_${dateStr}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!consultation) return null;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Doctor</div>
          <h1 className="page-title">{consultation.patient_name}</h1>
          <p className="page-subtitle">Consultation on {formatDate(consultation.started_at)}</p>
        </div>
        <div className="page-header__actions">
          <StatusBadge status={consultation.status} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDownloadPdf}
            disabled={downloading}
            title="Download a formatted PDF of this consultation"
          >
            {downloading ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <>
                <i className="bi bi-file-earmark-pdf me-2"></i>
                Download PDF
              </>
            )}
          </button>
          {!isEditing ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => setEditMode(true)}>
                <i className="bi bi-pencil me-2"></i>
                Edit
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setShowConfirm(true)}
                disabled={deleting}
              >
                <i className="bi bi-trash me-2"></i>
                Delete
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="btn btn-success" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <>
                    <i className="bi bi-save me-2"></i>
                    Save Changes
                  </>
                )}
              </button>
            </>
          )}
          <Link to="/doctor/consultations" className="btn btn-secondary">
            <i className="bi bi-arrow-left me-2"></i>
            Back to List
          </Link>
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header">
          <div className="table-row-avatar">
            <span className="avatar avatar-sm">
              {consultation.patient_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
            </span>
            <div>
              <div className="cell-primary">{consultation.patient_name}</div>
              <div className="text-2xs text-tertiary">{consultation.doctor_name || "—"}</div>
            </div>
          </div>
        </div>
        <div className="card-body">
          {EDITABLE_FIELDS.map(([key, label, rows]) => (
            <div className="field" key={key}>
              <label className="field-label">{label}</label>
              {isEditing ? (
                <textarea
                  name={key}
                  className="textarea"
                  rows={rows}
                  value={form[key]}
                  onChange={handleChange}
                />
              ) : (
                <p className="mb-0">
                  {consultation[key] || <span className="text-tertiary">— none recorded —</span>}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header">
              <h6 className="mb-0">Diagnoses</h6>
              <span className="badge badge-primary">{consultation.diagnoses?.length || 0}</span>
            </div>
            <div className="card-body">
              {consultation.diagnoses?.length ? (
                <div className="d-flex flex-wrap gap-2">
                  {consultation.diagnoses.map((d) => (
                    <div key={d.id} className={`diagnosis-chip ${d.is_primary ? "is-primary" : ""}`}>
                      <span className="diagnosis-chip__code">{d.code}</span>
                      <span>{d.description}</span>
                      {d.is_primary && <span className="badge badge-primary">Primary</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-tertiary text-sm">No diagnoses recorded</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Prescriptions</h6>
              <span className="badge badge-primary">{consultation.prescriptions?.length || 0}</span>
            </div>
            <div className="card-body">
              {consultation.prescriptions?.length ? (
                consultation.prescriptions.map((rx) => (
                  <div key={rx.id} className="d-flex justify-content-between align-items-center py-1">
                    <span className="text-sm">
                      {rx.medicine_name} — {rx.dosage}
                    </span>
                    <StatusBadge status={rx.is_dispensed ? "DISPENSED" : "PENDING"} />
                  </div>
                ))
              ) : (
                <div className="text-tertiary text-sm">No prescriptions</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card mb-3">
            <div className="card-header">
              <h6 className="mb-0">Lab Orders</h6>
              <span className="badge badge-primary">{consultation.lab_orders?.length || 0}</span>
            </div>
            <div className="card-body">
              {consultation.lab_orders?.length ? (
                consultation.lab_orders.map((o) => (
                  <div key={o.id} className="d-flex justify-content-between align-items-center py-1">
                    <span className="text-sm">{o.test_name}</span>
                    <StatusBadge status={o.status} />
                  </div>
                ))
              ) : (
                <div className="text-tertiary text-sm">No lab orders</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">Radiology Orders</h6>
              <span className="badge badge-primary">{consultation.radiology_orders?.length || 0}</span>
            </div>
            <div className="card-body">
              {consultation.radiology_orders?.length ? (
                consultation.radiology_orders.map((o) => (
                  <div key={o.id} className="d-flex justify-content-between align-items-center py-1">
                    <span className="text-sm">{o.test_name}</span>
                    <StatusBadge status={o.status} />
                  </div>
                ))
              ) : (
                <div className="text-tertiary text-sm">No radiology orders</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        show={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Consultation"
        message={`Are you sure you want to delete the consultation record for ${consultation.patient_name}? This action cannot be undone.`}
        variant="danger"
      />
    </>
  );
}