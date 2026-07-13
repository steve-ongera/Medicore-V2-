import { useState, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { AuthContext } from "../../context/AuthContext";
import { changePassword, updateUser } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { ROLE_LABELS } from "../../utils/roles";

export default function Profile() {
  const { user, refreshUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateProfile = () => {
    const newErrors = {};
    if (!profileForm.first_name?.trim()) newErrors.first_name = "First name is required";
    if (!profileForm.last_name?.trim()) newErrors.last_name = "Last name is required";
    if (profileForm.email && !/\S+@\S+\.\S+/.test(profileForm.email)) {
      newErrors.email = "Invalid email address";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePassword = () => {
    const newErrors = {};
    if (!passwordForm.old_password) newErrors.old_password = "Current password is required";
    if (!passwordForm.new_password || passwordForm.new_password.length < 8) {
      newErrors.new_password = "New password must be at least 8 characters";
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      newErrors.confirm_password = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!validateProfile()) return;

    setSubmitting(true);
    try {
      await updateUser(user.id, profileForm);
      await refreshUser();
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;

    setSubmitting(true);
    try {
      await changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      toast.success("Password changed successfully!");
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
      setErrors({});
    } catch (err) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Account</div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account settings and preferences</p>
        </div>
      </div>

      <div className="row">
        {/* Profile Sidebar */}
        <div className="col-lg-3">
          <div className="card">
            <div className="card-body text-center">
              <span className="avatar avatar-xl mb-3">
                {user.first_name?.[0] || user.username?.[0] || "?"}
                {user.last_name?.[0] || ""}
              </span>
              <h5 className="mb-0">
                {user.first_name || ""} {user.last_name || ""}
              </h5>
              <p className="text-muted text-sm">@{user.username}</p>
              <div className="d-flex justify-content-center gap-2">
                <span className="badge bg-primary">{ROLE_LABELS[user.role] || user.role}</span>
                <span className={`badge ${user.is_active ? "bg-success" : "bg-secondary"}`}>
                  {user.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <hr />
              <div className="text-start">
                <div className="info-item__label">Email</div>
                <div className="info-item__value">{user.email || "—"}</div>
                <div className="info-item__label mt-2">Phone</div>
                <div className="info-item__value">{user.phone || "—"}</div>
                <div className="info-item__label mt-2">Member Since</div>
                <div className="info-item__value">
                  {new Date(user.date_joined).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-lg-9">
          {/* Tabs */}
          <div className="tabs mb-3">
            <button
              type="button"
              className={`tabs__item ${activeTab === "profile" ? "is-active" : ""}`}
              onClick={() => setActiveTab("profile")}
            >
              <i className="bi bi-person me-2"></i>
              Profile Information
            </button>
            <button
              type="button"
              className={`tabs__item ${activeTab === "password" ? "is-active" : ""}`}
              onClick={() => setActiveTab("password")}
            >
              <i className="bi bi-key me-2"></i>
              Change Password
            </button>
          </div>

          {/* Profile Form */}
          {activeTab === "profile" && (
            <div className="card">
              <div className="card-header">
                <h5 className="card-title">Edit Profile</h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleUpdateProfile}>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="field">
                        <label className="field-label" htmlFor="first_name">
                          First Name <span className="required">*</span>
                        </label>
                        <input
                          id="first_name"
                          name="first_name"
                          type="text"
                          className={`input ${errors.first_name ? "has-error" : ""}`}
                          placeholder="First name"
                          value={profileForm.first_name}
                          onChange={handleProfileChange}
                        />
                        {errors.first_name && (
                          <div className="field-error">{errors.first_name}</div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="field">
                        <label className="field-label" htmlFor="last_name">
                          Last Name <span className="required">*</span>
                        </label>
                        <input
                          id="last_name"
                          name="last_name"
                          type="text"
                          className={`input ${errors.last_name ? "has-error" : ""}`}
                          placeholder="Last name"
                          value={profileForm.last_name}
                          onChange={handleProfileChange}
                        />
                        {errors.last_name && (
                          <div className="field-error">{errors.last_name}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="row">
                    <div className="col-md-6">
                      <div className="field">
                        <label className="field-label" htmlFor="email">
                          Email
                        </label>
                        <input
                          id="email"
                          name="email"
                          type="email"
                          className={`input ${errors.email ? "has-error" : ""}`}
                          placeholder="Email address"
                          value={profileForm.email}
                          onChange={handleProfileChange}
                        />
                        {errors.email && (
                          <div className="field-error">{errors.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="field">
                        <label className="field-label" htmlFor="phone">
                          Phone
                        </label>
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          className="input"
                          placeholder="Phone number"
                          value={profileForm.phone}
                          onChange={handleProfileChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="username">
                      Username
                    </label>
                    <input
                      id="username"
                      type="text"
                      className="input"
                      value={user.username}
                      disabled
                    />
                    <div className="field-hint">Username cannot be changed</div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <>
                          <i className="bi bi-save me-2"></i>
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Change Password */}
          {activeTab === "password" && (
            <div className="card">
              <div className="card-header">
                <h5 className="card-title">Change Password</h5>
              </div>
              <div className="card-body">
                <form onSubmit={handleChangePassword}>
                  <div className="field">
                    <label className="field-label" htmlFor="old_password">
                      Current Password <span className="required">*</span>
                    </label>
                    <input
                      id="old_password"
                      name="old_password"
                      type="password"
                      className={`input ${errors.old_password ? "has-error" : ""}`}
                      placeholder="Enter current password"
                      value={passwordForm.old_password}
                      onChange={handlePasswordChange}
                    />
                    {errors.old_password && (
                      <div className="field-error">{errors.old_password}</div>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="new_password">
                      New Password <span className="required">*</span>
                    </label>
                    <input
                      id="new_password"
                      name="new_password"
                      type="password"
                      className={`input ${errors.new_password ? "has-error" : ""}`}
                      placeholder="Enter new password (min 8 characters)"
                      value={passwordForm.new_password}
                      onChange={handlePasswordChange}
                    />
                    {errors.new_password && (
                      <div className="field-error">{errors.new_password}</div>
                    )}
                  </div>

                  <div className="field">
                    <label className="field-label" htmlFor="confirm_password">
                      Confirm New Password <span className="required">*</span>
                    </label>
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type="password"
                      className={`input ${errors.confirm_password ? "has-error" : ""}`}
                      placeholder="Confirm new password"
                      value={passwordForm.confirm_password}
                      onChange={handlePasswordChange}
                    />
                    {errors.confirm_password && (
                      <div className="field-error">{errors.confirm_password}</div>
                    )}
                  </div>

                  <div className="alert alert-info">
                    <i className="bi bi-info-circle me-2"></i>
                    Password must be at least 8 characters long and contain a mix of letters, numbers, and special characters.
                  </div>

                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <>
                          <i className="bi bi-key me-2"></i>
                          Change Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}