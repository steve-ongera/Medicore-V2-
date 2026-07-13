import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { createPatient, searchPatient } from "../../services/api";
import { AuthContext } from "../../context/AuthContext";
import LoadingSpinner from "../../components/LoadingSpinner";

export default function RegisterPatient() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    full_name: "",
    gender: "",
    dob: "",
    phone: "",
    address: "",
    national_id: "",
    guardian_name: "",
    guardian_phone: "",
    guardian_relationship: "",
    next_of_kin_name: "",
    next_of_kin_phone: "",
    next_of_kin_relationship: "",
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const checkDuplicates = async () => {
    const query = form.phone || form.national_id || form.full_name;
    if (!query || query.length < 3) return;

    setChecking(true);
    try {
      const result = await searchPatient(query);
      if (result.found) {
        setDuplicates(result.patients || []);
        toast.warning("Potential duplicate found. Please review below.");
      } else {
        setDuplicates([]);
      }
    } catch (err) {
      console.error("Duplicate check failed:", err);
    } finally {
      setChecking(false);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.full_name?.trim()) newErrors.full_name = "Full name is required";
    if (!form.gender) newErrors.gender = "Gender is required";
    if (!form.phone?.trim()) newErrors.phone = "Phone number is required";
    if (!form.dob) newErrors.dob = "Date of birth is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (duplicates.length > 0) {
      const proceed = window.confirm(
        `${duplicates.length} potential duplicate(s) found. Do you still want to register this patient?`
      );
      if (!proceed) return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        created_by: user?.id,
      };
      await createPatient(payload);
      toast.success("Patient registered successfully!");
      navigate("/patients");
    } catch (err) {
      toast.error(err.message || "Failed to register patient");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Reception</div>
          <h1 className="page-title">Register Patient</h1>
          <p className="page-subtitle">Create a new patient record</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/patients")}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Patients
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Personal Information */}
            <div className="page-section">
              <div className="page-section__header">
                <h5 className="text-sm font-semibold">Personal Information</h5>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="full_name">
                    Full Name <span className="required">*</span>
                  </label>
                  <input
                    id="full_name"
                    name="full_name"
                    type="text"
                    className={`input ${errors.full_name ? "has-error" : ""}`}
                    placeholder="Enter full name"
                    value={form.full_name}
                    onChange={handleChange}
                    onBlur={checkDuplicates}
                  />
                  {errors.full_name && (
                    <div className="field-error">{errors.full_name}</div>
                  )}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="gender">
                    Gender <span className="required">*</span>
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    className={`select ${errors.gender ? "has-error" : ""}`}
                    value={form.gender}
                    onChange={handleChange}
                  >
                    <option value="">Select gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                  {errors.gender && (
                    <div className="field-error">{errors.gender}</div>
                  )}
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="dob">
                    Date of Birth <span className="required">*</span>
                  </label>
                  <input
                    id="dob"
                    name="dob"
                    type="date"
                    className={`input ${errors.dob ? "has-error" : ""}`}
                    value={form.dob}
                    onChange={handleChange}
                  />
                  {errors.dob && (
                    <div className="field-error">{errors.dob}</div>
                  )}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="phone">
                    Phone <span className="required">*</span>
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className={`input ${errors.phone ? "has-error" : ""}`}
                    placeholder="Enter phone number"
                    value={form.phone}
                    onChange={handleChange}
                    onBlur={checkDuplicates}
                  />
                  {errors.phone && (
                    <div className="field-error">{errors.phone}</div>
                  )}
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="national_id">
                    National ID
                  </label>
                  <input
                    id="national_id"
                    name="national_id"
                    type="text"
                    className="input"
                    placeholder="Enter national ID"
                    value={form.national_id}
                    onChange={handleChange}
                    onBlur={checkDuplicates}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="address">
                  Address
                </label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  className="input"
                  placeholder="Enter address"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Duplicate Check Warning */}
            {duplicates.length > 0 && (
              <div className="alert alert-warning" style={{
                padding: 'var(--space-4)',
                background: 'var(--warning-soft)',
                color: 'var(--warning-strong)',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-5)'
              }}>
                <h6 className="mb-2">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  Potential Duplicate Patients Found
                </h6>
                <ul className="mb-0" style={{ paddingLeft: 'var(--space-4)' }}>
                  {duplicates.map((p) => (
                    <li key={p.id}>
                      <strong>{p.full_name}</strong> — {p.hospital_number} ({p.phone || p.national_id})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Guardian Information */}
            <div className="page-section">
              <div className="page-section__header">
                <h5 className="text-sm font-semibold">Guardian Information (For Minors)</h5>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="guardian_name">
                    Guardian Name
                  </label>
                  <input
                    id="guardian_name"
                    name="guardian_name"
                    type="text"
                    className="input"
                    placeholder="Enter guardian name"
                    value={form.guardian_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="guardian_phone">
                    Guardian Phone
                  </label>
                  <input
                    id="guardian_phone"
                    name="guardian_phone"
                    type="tel"
                    className="input"
                    placeholder="Enter guardian phone"
                    value={form.guardian_phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="guardian_relationship">
                    Relationship
                  </label>
                  <input
                    id="guardian_relationship"
                    name="guardian_relationship"
                    type="text"
                    className="input"
                    placeholder="e.g., Parent, Aunt"
                    value={form.guardian_relationship}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Next of Kin */}
            <div className="page-section" style={{ marginBottom: 0 }}>
              <div className="page-section__header">
                <h5 className="text-sm font-semibold">Next of Kin</h5>
              </div>
              <div className="field-row">
                <div className="field">
                  <label className="field-label" htmlFor="next_of_kin_name">
                    Next of Kin Name
                  </label>
                  <input
                    id="next_of_kin_name"
                    name="next_of_kin_name"
                    type="text"
                    className="input"
                    placeholder="Enter next of kin name"
                    value={form.next_of_kin_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="next_of_kin_phone">
                    Next of Kin Phone
                  </label>
                  <input
                    id="next_of_kin_phone"
                    name="next_of_kin_phone"
                    type="tel"
                    className="input"
                    placeholder="Enter next of kin phone"
                    value={form.next_of_kin_phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="next_of_kin_relationship">
                    Relationship
                  </label>
                  <input
                    id="next_of_kin_relationship"
                    name="next_of_kin_relationship"
                    type="text"
                    className="input"
                    placeholder="e.g., Spouse, Child"
                    value={form.next_of_kin_relationship}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/patients")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner spinner-sm" style={{ 
                      display: 'inline-block', 
                      width: '16px', 
                      height: '16px',
                      marginRight: 'var(--space-2)' 
                    }}></span>
                    Registering...
                  </>
                ) : (
                  <>
                    <i className="bi bi-person-plus me-2"></i>
                    Register Patient
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}