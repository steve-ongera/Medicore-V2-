import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { getPayments, createPayment, getInvoices } from "../../services/api";
import DataTable from "../../components/DataTable";
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import Modal from "../../components/Modal";
import ReceiptModal from "../../components/ReceiptModal";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatCurrency, formatDateTime } from "../../utils/formatters";

export default function Payments() {
  const [searchParams] = useSearchParams();
  const invoiceIdParam = searchParams.get("invoice");

  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Receipt modal state
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);

  const [form, setForm] = useState({
    invoice: invoiceIdParam || "",
    amount: "",
    method: "CASH",
    reference_number: "",
  });

  const [errors, setErrors] = useState({});

  const pageSize = 20;

  useEffect(() => {
    loadPayments();
    loadInvoices();
    if (invoiceIdParam) setShowModal(true);
  }, [page, search, invoiceIdParam]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      const data = await getPayments(params);
      setPayments(data.results || []);
      setTotal(data.count || 0);
    } catch (err) {
      toast.error(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await getInvoices({ page: 1, page_size: 100, status: "UNPAID" });
      setInvoices(data.results || []);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.invoice) newErrors.invoice = "Please select an invoice";
    if (!form.amount || parseFloat(form.amount) <= 0) {
      newErrors.amount = "Amount must be greater than 0";
    }
    if (!form.method) newErrors.method = "Payment method is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payment = await createPayment({
        invoice: form.invoice,
        amount: parseFloat(form.amount),
        method: form.method,
        reference_number: form.reference_number || "",
      });
      toast.success(`Payment of ${formatCurrency(form.amount)} processed successfully!`);
      setShowModal(false);
      setForm({ invoice: "", amount: "", method: "CASH", reference_number: "" });
      loadPayments();
      loadInvoices();

      // Immediately surface the printable/downloadable receipt for the new payment
      setSelectedReceiptId(payment.id);
      setShowReceiptModal(true);
    } catch (err) {
      toast.error(err.message || "Failed to process payment");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: "receipt_number",
      label: "Receipt #",
      render: (row) => (
        <span className="cell-mono">{row.receipt_number}</span>
      ),
    },
    {
      key: "invoice_number",
      label: "Invoice #",
      render: (row) => row.invoice_number || "—",
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (row) => row.patient_name || "—",
    },
    {
      key: "amount",
      label: "Amount",
      render: (row) => (
        <span className="fw-semibold">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: "method",
      label: "Method",
      render: (row) => (
        <span className="tag">{row.method}</span>
      ),
    },
    {
      key: "reference_number",
      label: "Reference",
      render: (row) => row.reference_number || "—",
    },
    {
      key: "cashier_name",
      label: "Cashier",
      render: (row) => row.cashier_name || "—",
    },
    {
      key: "paid_at",
      label: "Paid At",
      render: (row) => formatDateTime(row.paid_at),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => {
              setSelectedReceiptId(row.id);
              setShowReceiptModal(true);
            }}
          >
            <i className="bi bi-receipt me-1"></i>
            Receipt
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Billing</div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">Process and manage payments</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowModal(true)}
          >
            <i className="bi bi-cash-stack me-2"></i>
            New Payment
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <SearchBar
            placeholder="Search receipts, invoices, or patients..."
            onSearch={(val) => {
              setSearch(val);
              setPage(1);
            }}
            delay={400}
          />
          <div>
            <span className="text-muted text-sm">
              {total} payment{total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={payments}
            loading={loading}
            emptyMessage="No payments found."
          />
        </div>

        <div className="card-footer">
          <Pagination
            page={page}
            count={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* New Payment Modal */}
      <Modal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setForm({ invoice: "", amount: "", method: "CASH", reference_number: "" });
          setErrors({});
        }}
        title="Process Payment"
        size="modal-md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Processing...
                </>
              ) : (
                <>
                  <i className="bi bi-check-lg me-2"></i>
                  Process Payment
                </>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label" htmlFor="payment_invoice">
              Invoice <span className="required">*</span>
            </label>
            <select
              id="payment_invoice"
              name="invoice"
              className={`select ${errors.invoice ? "has-error" : ""}`}
              value={form.invoice}
              onChange={handleChange}
            >
              <option value="">Select an invoice</option>
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoice_number} - {inv.patient_name} (Balance: {formatCurrency(inv.balance)})
                </option>
              ))}
            </select>
            {errors.invoice && (
              <div className="field-error">{errors.invoice}</div>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="payment_amount">
              Amount <span className="required">*</span>
            </label>
            <div className="input-group">
              <span className="input-addon">KES</span>
              <input
                id="payment_amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                className={`input ${errors.amount ? "has-error" : ""}`}
                placeholder="0.00"
                value={form.amount}
                onChange={handleChange}
              />
            </div>
            {errors.amount && (
              <div className="field-error">{errors.amount}</div>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="payment_method">
              Payment Method <span className="required">*</span>
            </label>
            <select
              id="payment_method"
              name="method"
              className={`select ${errors.method ? "has-error" : ""}`}
              value={form.method}
              onChange={handleChange}
            >
              <option value="CASH">Cash</option>
              <option value="MPESA">M-Pesa</option>
              <option value="CARD">Card</option>
              <option value="INSURANCE">Insurance</option>
            </select>
            {errors.method && (
              <div className="field-error">{errors.method}</div>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="payment_reference">
              Reference Number
            </label>
            <input
              id="payment_reference"
              name="reference_number"
              type="text"
              className="input"
              placeholder="M-Pesa code, card auth, or claim number"
              value={form.reference_number}
              onChange={handleChange}
            />
            <div className="field-hint">Optional reference for tracking</div>
          </div>
        </form>
      </Modal>

      {/* Receipt Modal — print / download PDF with QR code */}
      <ReceiptModal
        paymentId={selectedReceiptId}
        show={showReceiptModal}
        onClose={() => {
          setShowReceiptModal(false);
          setSelectedReceiptId(null);
        }}
      />
    </>
  );
}