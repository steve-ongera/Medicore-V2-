import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getPatients, deletePatient } from "../../services/api";
import DataTable from "../../components/DataTable";
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatDate, formatDateTime } from "../../utils/formatters";

export default function PatientList() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();

  const pageSize = 20;

  useEffect(() => {
    loadPatients();
  }, [page, search]);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      const data = await getPatients(params);
      setPatients(data.results || []);
      setTotal(data.count || 0);
    } catch (err) {
      toast.error(err.message || "Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePatient(deleteId);
      toast.success("Patient deleted successfully");
      loadPatients();
    } catch (err) {
      toast.error(err.message || "Failed to delete patient");
    } finally {
      setShowConfirm(false);
      setDeleteId(null);
    }
  };

  const columns = [
    {
      key: "hospital_number",
      label: "Hospital #",
      render: (row) => <span className="cell-mono">{row.hospital_number}</span>,
    },
    {
      key: "full_name",
      label: "Patient Name",
      render: (row) => (
        <Link to={`/patients/${row.id}`} className="table-row-avatar table-row-avatar--link">
          <span className="avatar avatar-sm">
            {row.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
          </span>
          <div>
            <div className="cell-primary">{row.full_name}</div>
            <div className="text-2xs text-tertiary">{row.gender || "—"}</div>
          </div>
        </Link>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (row) => row.phone || "—",
    },
    {
      key: "national_id",
      label: "National ID",
      render: (row) => row.national_id || "—",
    },
    {
      key: "age",
      label: "Age",
      render: (row) => row.age || "—",
    },
    {
      key: "created_at",
      label: "Registered",
      render: (row) => formatDate(row.created_at),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-1 justify-end">
          <Link
            to={`/patients/${row.id}`}
            className="btn-icon-only"
            title="View profile"
          >
            <i className="bi bi-person-vcard"></i>
          </Link>
          <Link
            to={`/patients/${row.id}/visits`}
            className="btn-icon-only"
            title="View visits"
          >
            <i className="bi bi-eye"></i>
          </Link>
          <Link
            to={`/patients/${row.id}/edit`}
            className="btn-icon-only"
            title="Edit patient"
          >
            <i className="bi bi-pencil"></i>
          </Link>
          <button
            className="btn-icon-only"
            style={{ color: "var(--danger-strong)" }}
            onClick={() => handleDelete(row.id)}
            title="Delete patient"
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
          <div className="page-eyebrow">Reception</div>
          <h1 className="page-title">Patient Records</h1>
          <p className="page-subtitle">Manage all patient registrations</p>
        </div>
        <div className="page-header__actions">
          <Link to="/patients/register" className="btn btn-primary">
            <i className="bi bi-person-plus me-2"></i>
            Register Patient
          </Link>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar
              placeholder="Search by name, phone, or hospital #..."
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              delay={400}
            />
          </div>
          <div>
            <span className="text-tertiary text-sm">
              {total} patient{total !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={patients}
            loading={loading}
            emptyMessage="No patients found. Register a new patient to get started."
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
        title="Delete Patient"
        message="Are you sure you want to delete this patient? This action cannot be undone."
        variant="danger"
      />
    </>
  );
}