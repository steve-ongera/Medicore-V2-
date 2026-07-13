import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import jsPDF from "jspdf";
import {
  getLabOrders,
  getPendingLabOrders,
  collectLabOrder,
  uploadLabResults,
  getLabTestCatalog,
} from "../../services/api";
import DataTable from "../../components/DataTable";
import StatusBadge from "../../components/StatusBadge";
import Modal from "../../components/Modal";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatCard from "../../components/StatCard";
import { formatDateTime, formatCurrency } from "../../utils/formatters";

export default function Laboratory() {
  const [orders, setOrders] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("pending");

  const [resultForm, setResultForm] = useState({
    result_text: "",
    result_file: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allOrders, pending] = await Promise.all([
        getLabOrders({ page: 1, page_size: 100 }),
        getPendingLabOrders(),
      ]);
      setOrders(allOrders.results || []);
      setPendingOrders(pending || []);
    } catch (err) {
      toast.error(err.message || "Failed to load lab orders");
    } finally {
      setLoading(false);
    }
  };

  const handleCollect = async (orderId) => {
    try {
      await collectLabOrder(orderId);
      toast.success("Sample collected");
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to collect sample");
    }
  };

  const handleUploadResult = async (e) => {
    e.preventDefault();
    if (!resultForm.result_text && !resultForm.result_file) {
      toast.error("Please enter result text or upload a file");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        lab_order: selectedOrder.id,
        ...resultForm,
      };
      await uploadLabResults(payload);
      toast.success("Lab results uploaded successfully!");
      setShowResultModal(false);
      setResultForm({ result_text: "", result_file: null });
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to upload results");
    } finally {
      setSubmitting(false);
    }
  };

  // Builds a simple PDF on the fly from the typed-in result text
  // (the uploaded file, if any, is viewed/downloaded directly via its own URL).
  const downloadResultAsPdf = (row) => {
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
    doc.text(`Patient: ${row.patient_name || "—"}`, margin, y);
    y += 7;
    doc.text(`Test: ${row.test_name || "—"}`, margin, y);
    y += 7;
    doc.text(`Ordered: ${row.ordered_at ? formatDateTime(row.ordered_at) : "—"}`, margin, y);
    y += 7;
    if (row.result?.completed_at) {
      doc.text(`Completed: ${formatDateTime(row.result.completed_at)}`, margin, y);
      y += 7;
    }
    y += 5;

    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.text("Result:", margin, y);
    y += 8;

    doc.setFontSize(11);
    const lines = doc.splitTextToSize(
      row.result?.result_text || "(no text entered)",
      pageWidth - margin * 2
    );
    doc.text(lines, margin, y);

    const fileName = `${row.test_name || "lab_result"}_${row.patient_name || "patient"}.pdf`.replace(
      /\s+/g,
      "_"
    );
    doc.save(fileName);
  };

  const pendingColumns = [
    {
      key: "test_name",
      label: "Test",
      render: (row) => (
        <div>
          <div className="font-semibold">{row.test_name}</div>
          <div className="text-2xs text-tertiary">{row.test_code}</div>
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
        <div className="flex gap-1 justify-end">
          {row.status === "ORDERED" && row.is_paid && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => handleCollect(row.id)}
            >
              <i className="bi bi-box-seam me-1"></i>
              Collect
            </button>
          )}
          {(row.status === "COLLECTED" || row.status === "PROCESSING") && row.is_paid && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={() => {
                setSelectedOrder(row);
                setShowResultModal(true);
              }}
            >
              <i className="bi bi-upload me-1"></i>
              Results
            </button>
          )}
          {!row.is_paid && (
            <span className="text-warning text-xs">Awaiting Payment</span>
          )}
        </div>
      ),
    },
  ];

  const allColumns = [
    ...pendingColumns,
    {
      key: "result",
      label: "Result",
      render: (row) => {
        if (!row.result) {
          return <span className="text-tertiary">—</span>;
        }
        return (
          <div className="flex gap-1 items-center">
            {row.result.result_file && (
              <a
                href={row.result.result_file}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline btn-sm"
                title="View uploaded file"
              >
                <i className="bi bi-file-earmark-pdf"></i>
              </a>
            )}
            {row.result.result_text && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => downloadResultAsPdf(row)}
                title="Download typed result as PDF"
              >
                <i className="bi bi-download"></i>
              </button>
            )}
            {!row.result.result_file && !row.result.result_text && (
              <span className="flex items-center gap-1 text-success">
                <i className="bi bi-check-circle"></i>
                Completed
              </span>
            )}
          </div>
        );
      },
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Diagnostics</div>
          <h1 className="page-title">Laboratory</h1>
          <p className="page-subtitle">Manage lab orders and results</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-secondary" onClick={loadData}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-6">
        <StatCard
          label="Pending Orders"
          value={pendingOrders.filter((o) => o.status === "ORDERED").length}
          icon="bi-hourglass-split"
          variant="warning"
        />
        <StatCard
          label="Collected Samples"
          value={pendingOrders.filter((o) => o.status === "COLLECTED").length}
          icon="bi-box-seam"
          variant="info"
        />
        <StatCard
          label="Processing"
          value={pendingOrders.filter((o) => o.status === "PROCESSING").length}
          icon="bi-gear"
          variant="primary"
        />
        <StatCard
          label="Completed Today"
          value={orders.filter((o) => o.status === "COMPLETED").length}
          icon="bi-check-circle"
          variant="success"
        />
      </div>

      {/* Tabs */}
      <div className="tabs mb-3">
        <button
          type="button"
          className={`tabs__item ${activeTab === "pending" ? "is-active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Orders ({pendingOrders.length})
        </button>
        <button
          type="button"
          className={`tabs__item ${activeTab === "all" ? "is-active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Orders
        </button>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <DataTable
            columns={activeTab === "pending" ? pendingColumns : allColumns}
            data={activeTab === "pending" ? pendingOrders : orders}
            loading={loading}
            emptyMessage="No lab orders found"
          />
        </div>
      </div>

      {/* Upload Results Modal */}
      <Modal
        show={showResultModal}
        onClose={() => {
          setShowResultModal(false);
          setResultForm({ result_text: "", result_file: null });
          setSelectedOrder(null);
        }}
        title="Upload Lab Results"
        size="modal-lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowResultModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUploadResult}
              disabled={submitting}
            >
              {submitting ? (
                <span className="spinner spinner-inverse" style={{ width: 16, height: 16 }} />
              ) : (
                <>
                  <i className="bi bi-upload me-2"></i>
                  Upload Results
                </>
              )}
            </button>
          </>
        }
      >
        {selectedOrder && (
          <div className="mb-4">
            <div className="flex justify-between items-center p-2 bg-primary-soft rounded-md">
              <div>
                <strong>{selectedOrder.test_name}</strong>
                <span className="text-tertiary ml-2 text-sm">
                  {selectedOrder.patient_name}
                </span>
              </div>
              <StatusBadge status={selectedOrder.status} />
            </div>
          </div>
        )}

        <div className="field">
          <label className="field-label" htmlFor="result_text">
            Result Text
          </label>
          <textarea
            id="result_text"
            className="textarea"
            rows={5}
            placeholder="Enter lab results..."
            value={resultForm.result_text}
            onChange={(e) => setResultForm((prev) => ({ ...prev, result_text: e.target.value }))}
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="result_file">
            Result File (PDF, Image, etc.)
          </label>
          <input
            id="result_file"
            type="file"
            className="input"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setResultForm((prev) => ({ ...prev, result_file: file }));
              }
            }}
          />
          <div className="field-hint">Upload PDF, image, or document file</div>
        </div>
      </Modal>
    </>
  );
}