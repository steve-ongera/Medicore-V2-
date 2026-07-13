import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getLabTestCatalog, createLabTest, updateLabTest, deleteLabTest,
  getRadiologyTestCatalog, createRadiologyTest, updateRadiologyTest, deleteRadiologyTest,
} from "../../services/api";
import DataTable from "../../components/DataTable";
import SearchBar from "../../components/SearchBar";
import StatusBadge from "../../components/StatusBadge";
import ConfirmDialog from "../../components/ConfirmDialog";

const EMPTY_FORM = { code: "", name: "", price: "", is_active: true };

const toArray = (data) => (Array.isArray(data) ? data : data?.results ?? []);

const TABS = {
  lab: {
    label: "Laboratory",
    get: getLabTestCatalog,
    create: createLabTest,
    update: updateLabTest,
    remove: deleteLabTest,
  },
  radiology: {
    label: "Radiology",
    get: getRadiologyTestCatalog,
    create: createRadiologyTest,
    update: updateRadiologyTest,
    remove: deleteRadiologyTest,
  },
};

export default function TestCatalog() {
  const [tab, setTab] = useState("lab");
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pendingAction, setPendingAction] = useState(null);

  const active = TABS[tab];

  useEffect(() => {
    load();
  }, [tab]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await active.get();
      setTests(toArray(data));
    } catch (err) {
      toast.error(err.message || "Failed to load test catalog");
    } finally {
      setLoading(false);
    }
  };

  const visibleTests = search
    ? tests.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.code.toLowerCase().includes(search.toLowerCase()))
    : tests;

  const switchTab = (next) => {
    setTab(next);
    setSearch("");
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setShowForm(true);
  };

  const openEditForm = (test) => {
    setEditingId(test.id);
    setForm({ code: test.code, name: test.name, price: test.price, is_active: test.is_active });
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
        await active.update(editingId, form);
        toast.success("Test updated");
      } else {
        await active.create(form);
        toast.success("Test added");
      }
      closeForm();
      load();
    } catch (err) {
      setFormError(err.message || "Failed to save test");
    } finally {
      setSaving(false);
    }
  };

  const requestToggleActive = (test) => setPendingAction({ type: "toggle", test });
  const requestDelete = (test) => setPendingAction({ type: "delete", test });

  const confirmPendingAction = async () => {
    if (!pendingAction) return;
    const { type, test } = pendingAction;
    try {
      if (type === "toggle") {
        await active.update(test.id, { is_active: !test.is_active });
        toast.success(test.is_active ? "Test deactivated" : "Test reactivated");
      } else {
        await active.remove(test.id);
        toast.success("Test deleted");
      }
      load();
    } catch (err) {
      toast.error(err.message || "Action failed");
    } finally {
      setPendingAction(null);
    }
  };

  const columns = [
    { key: "code", label: "Code", render: (row) => <span className="cell-mono">{row.code}</span> },
    { key: "name", label: "Test Name", render: (row) => <span className="cell-primary">{row.name}</span> },
    { key: "price", label: "Price", render: (row) => <span className="cell-mono">KES {Number(row.price).toLocaleString()}</span> },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <button className="btn-icon-only-labeled" onClick={() => requestToggleActive(row)} title={row.is_active ? "Deactivate" : "Reactivate"}>
          <StatusBadge status={row.is_active ? "Active" : "Inactive"} variant={row.is_active ? "success" : "secondary"} />
        </button>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-1 justify-end">
          <button className="btn-icon-only" onClick={() => openEditForm(row)} title="Edit test">
            <i className="bi bi-pencil"></i>
          </button>
          <button
            className="btn-icon-only"
            style={{ color: "var(--danger-strong)" }}
            onClick={() => requestDelete(row)}
            title="Delete test"
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
          <h1 className="page-title">Test Catalog</h1>
          <p className="page-subtitle">Manage laboratory and radiology tests and pricing</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-primary" onClick={openCreateForm}>
            <i className="bi bi-plus-lg me-2"></i>
            Add Test
          </button>
        </div>
      </div>

      <div className="tabs mb-4">
        {Object.entries(TABS).map(([key, t]) => (
          <button
            key={key}
            className={`tabs__item${tab === key ? " is-active" : ""}`}
            onClick={() => switchTab(key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar placeholder="Search by code or name..." onSearch={setSearch} delay={300} />
          </div>
          <div>
            <span className="text-tertiary text-sm">
              {visibleTests.length} test{visibleTests.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={visibleTests}
            loading={loading}
            emptyMessage={`No ${active.label.toLowerCase()} tests yet. Add one to get started.`}
          />
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
          <div className="modal modal-lg" role="dialog" aria-modal="true">
            <form onSubmit={handleSubmit}>
              <div className="modal-header">
                <div>
                  <h5 className="modal-title">{editingId ? `Edit ${active.label} Test` : `Add ${active.label} Test`}</h5>
                  <p className="modal-desc">
                    {editingId ? "Update test details" : "Create a new test"}
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
                    Test Code <span className="required">*</span>
                  </label>
                  <input
                    className="input"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g., CBC-001"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label">
                    Test Name <span className="required">*</span>
                  </label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Complete Blood Count"
                    required
                  />
                </div>

                <div className="field">
                  <label className="field-label">
                    Price (KES) <span className="required">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-addon">KES</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
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
                        Active Test
                      </div>
                      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                        Inactive tests won't appear in order forms
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
                    editingId ? 'Update Test' : 'Add Test'
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
        title={pendingAction?.type === "delete" ? "Delete Test" : "Change Test Status"}
        message={
          pendingAction?.type === "delete"
            ? `Delete "${pendingAction?.test?.name}"? Existing orders will keep their history.`
            : `Are you sure you want to ${pendingAction?.test?.is_active ? "deactivate" : "reactivate"} "${pendingAction?.test?.name}"?`
        }
        variant={pendingAction?.type === "delete" ? "danger" : "warning"}
      />
    </>
  );
}