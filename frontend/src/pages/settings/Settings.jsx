import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../../services/api";
import DataTable from "../../components/DataTable";
import Modal from "../../components/Modal";
import ConfirmDialog from "../../components/ConfirmDialog";
import LoadingSpinner from "../../components/LoadingSpinner";
import { ROLES, ROLE_LABELS } from "../../utils/roles";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editingDept, setEditingDept] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    role: "",
    phone: "",
    password: "",
  });

  const [deptForm, setDeptForm] = useState({
    name: "",
    consultation_fee: "",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, deptData] = await Promise.all([
        getUsers({ page: 1, page_size: 100 }),
        getDepartments({ page: 1, page_size: 50 }),
      ]);
      setUsers(userData.results || []);
      setDepartments(deptData.results || []);
    } catch (err) {
      toast.error(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password || !userForm.role) {
      toast.error("Username, password, and role are required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        const { password, ...updateData } = userForm;
        await updateUser(editingUser.id, updateData);
        toast.success("User updated successfully");
      } else {
        await createUser(userForm);
        toast.success("User created successfully");
      }
      setShowUserModal(false);
      setUserForm({ username: "", email: "", first_name: "", last_name: "", role: "", phone: "", password: "" });
      setEditingUser(null);
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to save user");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateDepartment = async (e) => {
    e.preventDefault();
    if (!deptForm.name || !deptForm.consultation_fee) {
      toast.error("Name and consultation fee are required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, deptForm);
        toast.success("Department updated successfully");
      } else {
        await createDepartment(deptForm);
        toast.success("Department created successfully");
      }
      setShowDeptModal(false);
      setDeptForm({ name: "", consultation_fee: "", description: "", is_active: true });
      setEditingDept(null);
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to save department");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "user") {
        await deleteUser(deleteTarget.id);
        toast.success("User deleted");
      } else {
        await deleteDepartment(deleteTarget.id);
        toast.success("Department deleted");
      }
      loadData();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setShowConfirm(false);
      setDeleteTarget(null);
    }
  };

  const openUserModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        username: user.username,
        email: user.email || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        role: user.role,
        phone: user.phone || "",
        password: "",
      });
    } else {
      setEditingUser(null);
      setUserForm({ username: "", email: "", first_name: "", last_name: "", role: "", phone: "", password: "" });
    }
    setShowUserModal(true);
  };

  const openDeptModal = (dept = null) => {
    if (dept) {
      setEditingDept(dept);
      setDeptForm({
        name: dept.name,
        consultation_fee: dept.consultation_fee,
        description: dept.description || "",
        is_active: dept.is_active,
      });
    } else {
      setEditingDept(null);
      setDeptForm({ name: "", consultation_fee: "", description: "", is_active: true });
    }
    setShowDeptModal(true);
  };

  const userColumns = [
    {
      key: "username",
      label: "Username",
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.username}</div>
          <div className="text-xs text-muted">{row.email}</div>
        </div>
      ),
    },
    {
      key: "first_name",
      label: "Name",
      render: (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() || "—",
    },
    {
      key: "role",
      label: "Role",
      render: (row) => ROLE_LABELS[row.role] || row.role,
    },
    {
      key: "phone",
      label: "Phone",
      render: (row) => row.phone || "—",
    },
    {
      key: "is_active",
      label: "Status",
      render: (row) => (
        <span className={`badge ${row.is_active ? "bg-success" : "bg-secondary"}`}>
          {row.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => openUserModal(row)}
          >
            <i className="bi bi-pencil"></i>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => {
              setDeleteTarget({ id: row.id, type: "user" });
              setShowConfirm(true);
            }}
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      ),
    },
  ];

  const deptColumns = [
    {
      key: "name",
      label: "Department",
      render: (row) => (
        <div>
          <div className="fw-semibold">{row.name}</div>
          <div className="text-xs text-muted">{row.description}</div>
        </div>
      ),
    },
    {
      key: "consultation_fee",
      label: "Consultation Fee",
      render: (row) => `KES ${row.consultation_fee}`,
    },
    {
      key: "is_active",
      label: "Status",
      render: (row) => (
        <span className={`badge ${row.is_active ? "bg-success" : "bg-secondary"}`}>
          {row.is_active ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="d-flex gap-1 justify-content-end">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => openDeptModal(row)}
          >
            <i className="bi bi-pencil"></i>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => {
              setDeleteTarget({ id: row.id, type: "department" });
              setShowConfirm(true);
            }}
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Administration</div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage users, departments, and system configuration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs mb-3">
        <button
          type="button"
          className={`tabs__item ${activeTab === "users" ? "is-active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users ({users.length})
        </button>
        <button
          type="button"
          className={`tabs__item ${activeTab === "departments" ? "is-active" : ""}`}
          onClick={() => setActiveTab("departments")}
        >
          Departments ({departments.length})
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title">
            {activeTab === "users" ? "User Management" : "Department Management"}
          </h5>
          {activeTab === "users" ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => openUserModal()}
            >
              <i className="bi bi-person-plus me-1"></i>
              Add User
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => openDeptModal()}
            >
              <i className="bi bi-building-add me-1"></i>
              Add Department
            </button>
          )}
        </div>
        <div className="card-body p-0">
          <DataTable
            columns={activeTab === "users" ? userColumns : deptColumns}
            data={activeTab === "users" ? users : departments}
            loading={loading}
            emptyMessage={`No ${activeTab} found`}
          />
        </div>
      </div>

      {/* User Modal */}
      <Modal
        show={showUserModal}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
          setUserForm({ username: "", email: "", first_name: "", last_name: "", role: "", phone: "", password: "" });
        }}
        title={editingUser ? "Edit User" : "Add User"}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowUserModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateUser}
              disabled={submitting}
            >
              {submitting ? <span className="spinner-border spinner-border-sm" /> : editingUser ? "Update" : "Create"}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="user_username">
            Username <span className="required">*</span>
          </label>
          <input
            id="user_username"
            type="text"
            className="input"
            placeholder="Username"
            value={userForm.username}
            onChange={(e) => setUserForm((prev) => ({ ...prev, username: e.target.value }))}
          />
        </div>
        <div className="row">
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="user_first_name">
                First Name
              </label>
              <input
                id="user_first_name"
                type="text"
                className="input"
                placeholder="First name"
                value={userForm.first_name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, first_name: e.target.value }))}
              />
            </div>
          </div>
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="user_last_name">
                Last Name
              </label>
              <input
                id="user_last_name"
                type="text"
                className="input"
                placeholder="Last name"
                value={userForm.last_name}
                onChange={(e) => setUserForm((prev) => ({ ...prev, last_name: e.target.value }))}
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="user_email">
            Email
          </label>
          <input
            id="user_email"
            type="email"
            className="input"
            placeholder="Email address"
            value={userForm.email}
            onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
          />
        </div>
        <div className="row">
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="user_role">
                Role <span className="required">*</span>
              </label>
              <select
                id="user_role"
                className="select"
                value={userForm.role}
                onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
              >
                <option value="">Select role</option>
                {Object.entries(ROLE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="col-md-6">
            <div className="field">
              <label className="field-label" htmlFor="user_phone">
                Phone
              </label>
              <input
                id="user_phone"
                type="tel"
                className="input"
                placeholder="Phone number"
                value={userForm.phone}
                onChange={(e) => setUserForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>
        </div>
        {!editingUser && (
          <div className="field">
            <label className="field-label" htmlFor="user_password">
              Password <span className="required">*</span>
            </label>
            <input
              id="user_password"
              type="password"
              className="input"
              placeholder="Password"
              value={userForm.password}
              onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
            />
          </div>
        )}
      </Modal>

      {/* Department Modal */}
      <Modal
        show={showDeptModal}
        onClose={() => {
          setShowDeptModal(false);
          setEditingDept(null);
          setDeptForm({ name: "", consultation_fee: "", description: "", is_active: true });
        }}
        title={editingDept ? "Edit Department" : "Add Department"}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDeptModal(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCreateDepartment}
              disabled={submitting}
            >
              {submitting ? <span className="spinner-border spinner-border-sm" /> : editingDept ? "Update" : "Create"}
            </button>
          </>
        }
      >
        <div className="field">
          <label className="field-label" htmlFor="dept_name">
            Department Name <span className="required">*</span>
          </label>
          <input
            id="dept_name"
            type="text"
            className="input"
            placeholder="Department name"
            value={deptForm.name}
            onChange={(e) => setDeptForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="dept_fee">
            Consultation Fee (KES) <span className="required">*</span>
          </label>
          <input
            id="dept_fee"
            type="number"
            step="0.01"
            className="input"
            placeholder="0.00"
            value={deptForm.consultation_fee}
            onChange={(e) => setDeptForm((prev) => ({ ...prev, consultation_fee: e.target.value }))}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="dept_description">
            Description
          </label>
          <textarea
            id="dept_description"
            className="textarea"
            rows={3}
            placeholder="Department description"
            value={deptForm.description}
            onChange={(e) => setDeptForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
        <div className="checkbox-row">
          <input
            id="dept_active"
            type="checkbox"
            className="checkbox"
            checked={deptForm.is_active}
            onChange={(e) => setDeptForm((prev) => ({ ...prev, is_active: e.target.checked }))}
          />
          <label className="checkbox-label" htmlFor="dept_active">
            Active
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        show={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title={`Delete ${deleteTarget?.type === "user" ? "User" : "Department"}`}
        message={`Are you sure you want to delete this ${deleteTarget?.type}? This action cannot be undone.`}
        variant="danger"
      />
    </>
  );
}