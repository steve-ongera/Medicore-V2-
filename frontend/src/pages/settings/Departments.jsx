import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from "../../services/api";
import DataTable from "../../components/DataTable";
import SearchBar from "../../components/SearchBar";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";

const EMPTY_FORM = { name: "", consultation_fee: "", description: "", is_active: true };

const toArray = (data) => (Array.isArray(data) ? data : data?.results ?? []);

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getDepartments();
      setDepartments(toArray(data));
    } catch (err) {
      toast.error(err.message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  const visibleDepartments = search
    ? departments.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
    : departments;

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (dept) => {
    setEditingId(dept.id);
    setForm({
      name: dept.name,
      consultation_fee: dept.consultation_fee,
      description: dept.description || "",
      is_active: dept.is_active,
    });
    setFormError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      if (editingId) {
        await updateDepartment(editingId, form);
        toast.success("Department updated");
      } else {
        await createDepartment(form);
        toast.success("Department added");
      }
      closeForm();
      load();
    } catch (err) {
      setFormError(err.message || "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  const requestToggleActive = (dept) => setPendingAction({ type: "toggle", dept });
  const requestDelete = (dept) => setPendingAction({ type: "delete", dept });

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const { type, dept } = pendingAction;
    try {
      if (type === "toggle") {
        await updateDepartment(dept.id, { is_active: !dept.is_active });
        toast.success(dept.is_active ? "Department marked inactive" : "Department marked active");
      } else {
        await deleteDepartment(dept.id);
        toast.success("Department deleted");
      }
      load();
    } catch (err) {
      toast.error(err.message || "Action failed");
    } finally {
      setPendingAction(null);
    }
  };

  const columns = [
    {
      key: "name",
      label: "Department",
      render: (row) => (
        <div>
          <div className="cell-primary">{row.name}</div>
          <div className="text-2xs text-tertiary">{row.description || "—"}</div>
        </div>
      ),
    },
    {
      key: "consultation_fee",
      label: "Consultation Fee",
      render: (row) => <span className="cell-mono">KES {Number(row.consultation_fee).toLocaleString()}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <button
          className="btn-icon-only-labeled"
          onClick={() => requestToggleActive(row)}
          title={row.is_active ? "Mark inactive" : "Mark active"}
        >
          <StatusBadge status={row.is_active ? "Active" : "Inactive"} variant={row.is_active ? "success" : "secondary"} />
        </button>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-1 justify-end">
          <button className="btn-icon-only" onClick={() => openEditForm(row)} title="Edit department">
            <i className="bi bi-pencil"></i>
          </button>
          <button
            className="btn-icon-only"
            style={{ color: "var(--danger-strong)" }}
            onClick={() => requestDelete(row)}
            title="Delete department"
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
          <div className="page-eyebrow">Settings</div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Manage departments and consultation fees</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-primary" onClick={openCreateForm}>
            <i className="bi bi-building-add me-2"></i>
            Add Department
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar placeholder="Search departments..." onSearch={setSearch} delay={300} />
          </div>
          <div>
            <span className="text-tertiary text-sm">
              {visibleDepartments.length} department{visibleDepartments.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={visibleDepartments}
            loading={loading}
            emptyMessage="No departments yet. Add one to get started."
          />
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal modal-lg" role="dialog" aria-modal="true">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{editingId ? "Edit Department" : "Add Department"}</h5>
                  <p className="modal-desc">
                    {editingId ? "Update department details" : "Create a new department"}
                  </p>
                </div>
                <button type="button" className="modal-close" onClick={closeForm} aria-label="Close">
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>

              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger" style={{ 
                    padding: 'var(--space-3) var(--space-4)', 
                    background: 'var(--danger-soft)', 
                    color: 'var(--danger-strong)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: 'var(--space-4)',
                    fontSize: 'var(--fs-sm)'
                  }}>
                    {formError}
                  </div>
                )}

                <div className="field">
                  <label className="field-label">
                    Department Name <span className="required">*</span>
                  </label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Cardiology"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label">
                    Consultation Fee (KES) <span className="required">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-addon">KES</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={form.consultation_fee}
                      onChange={(e) => setForm({ ...form, consultation_fee: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Description</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of the department..."
                  />
                  <span className="field-hint">Optional: Add any relevant details</span>
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <div className="switch-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      />
                      <span className="switch-track"></span>
                    </label>
                    <div>
                      <div style={{ fontWeight: 'var(--fw-medium)', fontSize: 'var(--fs-sm)' }}>
                        Active Department
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                        Inactive departments won't appear in dropdowns
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <span className="spinner spinner-sm" style={{ 
                        display: 'inline-block', 
                        width: '16px', 
                        height: '16px',
                        marginRight: 'var(--space-2)' 
                      }}></span>
                      Saving...
                    </>
                  ) : (
                    editingId ? 'Update Department' : 'Add Department'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        show={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={confirmPendingAction}
        title={pendingAction?.type === "delete" ? "Delete Department" : "Change Department Status"}
        message={
          pendingAction?.type === "delete"
            ? `Delete "${pendingAction?.dept?.name}"? Visits already linked to it will keep their history.`
            : `Are you sure you want to mark "${pendingAction?.dept?.name}" as ${pendingAction?.dept?.is_active ? "inactive" : "active"}?`
        }
        variant={pendingAction?.type === "delete" ? "danger" : "warning"}
      />
    </>
  );
}