import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getRadiologyOrders,
  getPendingRadiologyOrders,
  uploadRadiologyReport,
} from "../../services/api";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import Modal from "../../components/Modal";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatCard from "../../components/StatCard";
import { formatDateTime } from "../../utils/formatters";

export default function Radiology() {
  const [orders, setOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  const [reportForm, setReportForm] = useState({
    radiologist_notes: "",
    image_file: null,
    report_file: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allOrders, pending] = await Promise.all([
        getRadiologyOrders({ page: 1, page_size: 100 }),
        getPendingRadiologyOrders(),
      ]);
      setOrders(allOrders.results || []);
      setPendingOrders(pending || []);
    } catch (err) {
      toast.error(err.message || "Failed to load radiology orders");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!reportForm.radiologist_notes && !reportForm.report_file && !reportForm.image_file) {
      toast.error("Please add notes or upload a file");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        radiology_order: selectedOrder.id,
        ...reportForm,
      };
      await uploadRadiologyReport(payload);
      toast.success("Radiology report uploaded successfully!");
      setShowReportModal(false);
      setReportForm({ radiologist_notes: "", image_file: null, report_file: null });
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to upload report");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: "test_name",
      label: "Test",
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.test_name}</div>
          <div className="text-xs text-muted">{row.test_code}</div>
        </div>
      ),
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (row) => row.patient_name || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "ordered_at",
      label: "Ordered",
      render: (row) => formatDateTime(row.ordered_at),
    },
    {
      key: "is_paid",
      label: "Payment",
      render: (row) => (
        <StatusBadge status={row.is_paid ? "PAID" : "UNPAID"} />
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          {row.is_paid && row.status !== "REPORTED" && (
            <button
              type="button"
              className="btn btn-sm btn-success"
              onClick={() => {
                setSelectedOrder(row);
                setShowReportModal(true);
              }}
            >
              <i className="bi bi-upload me-1"></i>
              Report
            </button>
          )}
          {!row.is_paid && (
            <span className="text-warning text-sm">Awaiting Payment</span>
          )}
          {row.status === "REPORTED" && (
            <span className="text-success text-sm">
              <i className="bi bi-check-circle me-1"></i>
              Reported
            </span>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Diagnostics</div>
          <h1 className="page-title">Radiology</h1>
          <p className="page-subtitle">Manage radiology orders and reports</p>
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
          label="Pending Orders"
          value={pendingOrders.filter((o) => o.status === "PENDING").length}
          icon="bi-hourglass-split"
          variant="warning"
        />
        <StatCard
          label="Paid & Ready"
          value={pendingOrders.filter((o) => o.is_paid && o.status === "PENDING").length}
          icon="bi-check-circle"
          variant="info"
        />
        <StatCard
          label="Reported Today"
          value={orders.filter((o) => o.status === "REPORTED").length}
          icon="bi-file-earmark-text"
          variant="success"
        />
      </div>

      <div className="card">
        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={activeTab === "pending" ? pendingOrders : orders}
            loading={loading}
            emptyMessage="No radiology orders found"
          />
        </div>
      </div>

      {/* Upload Report Modal */}
      <Modal
        show={showReportModal}
        onClose={() => {
          setShowReportModal(false);
          setReportForm({ radiologist_notes: "", image_file: null, report_file: null });
          setSelectedOrder(null);
        }}
        title="Upload Radiology Report"
        size="modal-lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowReportModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUploadReport}
              disabled={submitting}
            >
              {submitting ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <>
                  <i className="bi bi-upload me-2"></i>
                  Upload Report
                </>
              )}
            </button>
          </>
        }
      >
        {selectedOrder && (
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center p-2 bg-primary-soft rounded">
              <div>
                <strong>{selectedOrder.test_name}</strong>
                <span className="text-muted ms-2 text-sm">
                  {selectedOrder.patient_name}
                </span>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="radiologist_notes">
            Radiologist Notes
          </label>
          <textarea
            id="radiologist_notes"
            className="textarea"
            rows={4}
            placeholder="Enter radiology findings and interpretation..."
            value={reportForm.radiologist_notes}
            onChange={(e) => setReportForm((prev) => ({ ...prev, radiologist_notes: e.target.value }))}
          />
        </div>

        <div className="row">
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="image_file">
                Image File
              </label>
              <input
                id="image_file"
                type="file"
                className="input"
                accept=".png,.jpg,.jpeg,.dicom,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setReportForm((prev) => ({ ...prev, image_file: file }));
                  }
                }}
              />
              <div className="field-hint">Upload X-ray, CT, MRI, or ultrasound image</div>
            </div>
          </div>
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="report_file">
                Report File
              </label>
              <input
                id="report_file"
                type="file"
                className="input"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setReportForm((prev) => ({ ...prev, report_file: file }));
                  }
                }}
              />
              <div className="field-hint">Upload detailed report (PDF preferred)</div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}