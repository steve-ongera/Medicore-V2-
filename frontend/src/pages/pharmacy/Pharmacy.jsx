import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getPrescriptions,
  dispenseMedicine,
  getMedicines,
  getDispenses,
} from "../../services/api";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import Modal from "../../components/Modal";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatCard from "../../components/StatCard";
import { formatDateTime, formatCurrency } from "../../utils/formatters";

export default function Pharmacy() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [dispenses, setDispenses] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  const [dispenseForm, setDispenseForm] = useState({
    quantity_dispensed: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rxData, dispenseData, medData] = await Promise.all([
        getPrescriptions({ is_dispensed: false, page: 1, page_size: 100 }),
        getDispenses({ page: 1, page_size: 50 }),
        getMedicines({ page: 1, page_size: 100 }),
      ]);
      setPrescriptions(rxData.results || []);
      setDispenses(dispenseData.results || []);
      setMedicines(medData.results || []);
    } catch (err) {
      toast.error(err.message || "Failed to load pharmacy data");
    } finally {
      setLoading(false);
    }
  };

  const handleDispense = async (e) => {
    e.preventDefault();
    if (!dispenseForm.quantity_dispensed || parseInt(dispenseForm.quantity_dispensed) <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setSubmitting(true);
    try {
      await dispenseMedicine({
        prescription: selectedPrescription.id,
        quantity_dispensed: parseInt(dispenseForm.quantity_dispensed),
      });
      toast.success("Medicine dispensed successfully!");
      setShowDispenseModal(false);
      setDispenseForm({ quantity_dispensed: "" });
      setSelectedPrescription(null);
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to dispense medicine");
    } finally {
      setSubmitting(false);
    }
  };

  const pendingColumns = [
    {
      key: "patient_name",
      label: "Patient",
      // Backend now returns a flat `patient_name` field on PrescriptionSerializer
      // (source="consultation.visit.patient.full_name"), matching the pattern
      // used by PharmacyDispenseSerializer, VisitSerializer, etc.
      render: (row) => row.patient_name || "—",
    },
    {
      key: "medicine_name",
      label: "Medicine",
      render: (row) => row.medicine_name || "—",
    },
    {
      key: "dosage",
      label: "Dosage",
      render: (row) => row.dosage || "—",
    },
    {
      key: "frequency",
      label: "Frequency",
      render: (row) => row.frequency || "—",
    },
    {
      key: "duration",
      label: "Duration",
      render: (row) => row.duration || "—",
    },
    {
      key: "quantity",
      label: "Qty",
      render: (row) => row.quantity || 0,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <button
          type="button"
          className="btn btn-sm btn-success"
          onClick={() => {
            setSelectedPrescription(row);
            setShowDispenseModal(true);
          }}
        >
          <i className="bi bi-box-seam me-1"></i>
          Dispense
        </button>
      ),
    },
  ];

  const dispenseColumns = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row) => row.patient_name || "—",
    },
    {
      key: "medicine_name",
      label: "Medicine",
      render: (row) => row.medicine_name || "—",
    },
    {
      key: "quantity_dispensed",
      label: "Qty",
      render: (row) => row.quantity_dispensed || 0,
    },
    {
      key: "batch",
      label: "Batch #",
      render: (row) => row.batch?.batch_number || "—",
    },
    {
      key: "dispensed_at",
      label: "Dispensed",
      render: (row) => formatDateTime(row.dispensed_at),
    },
    {
      key: "dispensed_by",
      label: "By",
      render: (row) => row.dispensed_by?.username || "—",
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Pharmacy</div>
          <h1 className="page-title">Pharmacy</h1>
          <p className="page-subtitle">Manage prescriptions and dispense medications</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadData}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-4">
        <StatCard
          label="Pending Prescriptions"
          value={prescriptions.length}
          icon="bi-capsule"
          variant="warning"
        />
        <StatCard
          label="Dispensed Today"
          value={dispenses.filter((d) => {
            const today = new Date().toDateString();
            return new Date(d.dispensed_at).toDateString() === today;
          }).length}
          icon="bi-check-circle"
          variant="success"
        />
        <StatCard
          label="Total Medicines"
          value={medicines.length}
          icon="bi-box-seam"
          variant="primary"
        />
      </div>

      {/* Tabs */}
      <div className="tabs mb-3">
        <button
          type="button"
          className={`tabs__item ${activeTab === "pending" ? "is-active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Prescriptions ({prescriptions.length})
        </button>
        <button
          type="button"
          className={`tabs__item ${activeTab === "dispensed" ? "is-active" : ""}`}
          onClick={() => setActiveTab("dispensed")}
        >
          Dispensed History
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <DataTable
            columns={activeTab === "pending" ? pendingColumns : dispenseColumns}
            data={activeTab === "pending" ? prescriptions : dispenses}
            loading={loading}
            emptyMessage={activeTab === "pending" ? "No pending prescriptions" : "No dispensed medications"}
          />
        </div>
      </div>

      {/* Dispense Modal */}
      <Modal
        show={showDispenseModal}
        onClose={() => {
          setShowDispenseModal(false);
          setDispenseForm({ quantity_dispensed: "" });
          setSelectedPrescription(null);
        }}
        title="Dispense Medication"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDispenseModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleDispense}
              disabled={submitting}
            >
              {submitting ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <>
                  <i className="bi bi-box-seam me-2"></i>
                  Dispense
                </>
              )}
            </button>
          </>
        }
      >
        {selectedPrescription && (
          <div className="mb-3">
            <div className="p-3 bg-primary-soft rounded">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <div className="fw-semibold">{selectedPrescription.medicine_name}</div>
                  <div className="text-sm text-muted">
                    {selectedPrescription.dosage} · {selectedPrescription.frequency} · {selectedPrescription.duration}
                  </div>
                  <div className="text-sm text-muted">
                    Patient: {selectedPrescription.patient_name || "—"}
                  </div>
                </div>
                <div className="text-sm">
                  <span className="text-muted">Qty:</span> {selectedPrescription.quantity}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="dispense_qty">
            Quantity to Dispense <span className="required">*</span>
          </label>
          <input
            id="dispense_qty"
            type="number"
            className="input"
            placeholder="Enter quantity"
            value={dispenseForm.quantity_dispensed}
            onChange={(e) => setDispenseForm({ quantity_dispensed: e.target.value })}
            min="1"
            max={selectedPrescription?.quantity || 999}
          />
          <div className="field-hint">
            Max available: {selectedPrescription?.quantity || 0}
          </div>
        </div>
      </Modal>
    </>
  );
}