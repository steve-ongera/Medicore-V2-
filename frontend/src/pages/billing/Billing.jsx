import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getInvoices } from "../../services/api";
import DataTable from "../../components/DataTable";
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import StatCard from "../../components/StatCard";
import { formatCurrency, formatDate } from "../../utils/formatters";

export default function Billing() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const pageSize = 20;

  useEffect(() => {
    loadInvoices();
  }, [page, search, statusFilter]);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await getInvoices(params);
      setInvoices(data.results || []);
      setTotal(data.count || 0);
    } catch (err) {
      toast.error(err.message || "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: "invoice_number",
      label: "Invoice #",
      render: (row) => (
        <span className="cell-mono">{row.invoice_number}</span>
      ),
    },
    {
      key: "patient_name",
      label: "Patient",
      render: (row) => row.patient_name || "—",
    },
    {
      key: "source_type",
      label: "Type",
      render: (row) => (
        <span className="tag">{row.source_type}</span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (row) => formatCurrency(row.amount),
    },
    {
      key: "amount_paid",
      label: "Paid",
      render: (row) => formatCurrency(row.amount_paid || 0),
    },
    {
      key: "balance",
      label: "Balance",
      render: (row) => (
        <span className={row.balance > 0 ? "text-danger fw-semibold" : "text-success"}>
          {formatCurrency(row.balance)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      label: "Date",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          <Link
            to={`/billing/payments?invoice=${row.id}`}
            className="btn btn-sm btn-primary"
          >
            <i className="bi bi-cash"></i> Pay
          </Link>
        </div>
      ),
    },
  ];

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "UNPAID", label: "Unpaid" },
    { value: "PARTIAL", label: "Partially Paid" },
    { value: "PAID", label: "Paid" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  const totalBalance = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Billing</div>
          <h1 className="page-title">Invoices</h1>
          <p className="page-subtitle">Manage patient invoices and payments</p>
        </div>
        <div className="page-header__actions">
          <Link to="/billing/payments" className="btn btn-success">
            <i className="bi bi-cash-stack me-2"></i>
            Process Payment
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-4">
        <StatCard
          label="Total Invoices"
          value={total}
          icon="bi-receipt"
          variant="primary"
        />
        <StatCard
          label="Total Outstanding"
          value={formatCurrency(totalBalance)}
          icon="bi-credit-card"
          variant="danger"
        />
        <StatCard
          label="Unpaid Invoices"
          value={invoices.filter((i) => i.status === "UNPAID").length}
          icon="bi-exclamation-circle"
          variant="warning"
        />
        <StatCard
          label="Fully Paid"
          value={invoices.filter((i) => i.status === "PAID").length}
          icon="bi-check-circle"
          variant="success"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <SearchBar
              placeholder="Search invoices..."
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              delay={400}
            />
            <select
              className="select"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-muted text-sm">
              {total} invoice{total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={invoices}
            loading={loading}
            emptyMessage="No invoices found."
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
    </>
  );
}