//src/pages/doctor/ConsultationList.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getConsultations, deleteConsultation } from "../../services/api";
import DataTable from "../../components/DataTable";
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import { formatDate } from "../../utils/formatters";

const STATUS_FILTERS = [
  { value: "", label: "All Statuses" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "PAUSED", label: "Paused" },
  { value: "COMPLETED", label: "Completed" },
];

export default function ConsultationList() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [deleteName, setDeleteName] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const pageSize = 20;

  useEffect(() => {
    loadConsultations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const loadConsultations = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const data = await getConsultations(params);
      setConsultations(data.results || []);
      setTotal(data.count || 0);
    } catch (err) {
      toast.error(err.message || "Failed to load consultations");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id, patientName) => {
    setDeleteId(id);
    setDeleteName(patientName);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteConsultation(deleteId);
      toast.success("Consultation deleted successfully");
      loadConsultations();
    } catch (err) {
      toast.error(err.message || "Failed to delete consultation");
    } finally {
      setShowConfirm(false);
      setDeleteId(null);
      setDeleteName("");
    }
  };

  const columns = [
    {
      key: "patient_name",
      label: "Patient",
      render: (row) => (
        <div className="table-row-avatar">
          <span className="avatar avatar-sm">
            {row.patient_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
          </span>
          <div>
            <div className="cell-primary">{row.patient_name}</div>
            <div className="text-2xs text-tertiary">{row.doctor_name || "—"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "started_at",
      label: "Started",
      render: (row) => formatDate(row.started_at),
    },
    {
      key: "completed_at",
      label: "Completed",
      render: (row) => (row.completed_at ? formatDate(row.completed_at) : "—"),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-1 justify-end">
          <button
            className="btn-icon-only"
            onClick={() => navigate(`/doctor/consultations/${row.id}`)}
            title="View consultation"
          >
            <i className="bi bi-eye"></i>
          </button>
          <button
            className="btn-icon-only"
            onClick={() => navigate(`/doctor/consultations/${row.id}?edit=1`)}
            title="Edit consultation"
          >
            <i className="bi bi-pencil"></i>
          </button>
          <button
            className="btn-icon-only"
            style={{ color: "var(--danger-strong)" }}
            onClick={() => handleDelete(row.id, row.patient_name)}
            title="Delete consultation"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Doctor</div>
          <h1 className="page-title">Consultations</h1>
          <p className="page-subtitle">Browse, review, and manage past and ongoing consultations</p>
        </div>
        <div className="page-header__actions">
          <Link to="/doctor" className="btn btn-secondary">
            <i className="bi bi-clipboard2-pulse me-2"></i>
            My Queue
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar
              placeholder="Search by patient or visit number..."
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              delay={400}
            />
            <select
              className="select"
              style={{ maxWidth: 200 }}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-tertiary text-sm">
              {total} consultation{total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={consultations}
            loading={loading}
            emptyMessage="No consultations found. Try adjusting your search or filters."
          />
        </div>

        <div className="card-footer">
          <Pagination page={page} count={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      </div>

      <ConfirmDialog
        show={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Consultation"
        message={`Are you sure you want to delete the consultation record for ${deleteName}? This action cannot be undone.`}
        variant="danger"
      />
    </>
  );
}