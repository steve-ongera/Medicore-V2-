import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getPatient, updatePatient } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";

const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

export default function EditPatient() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [hospitalNumber, setHospitalNumber] = useState("");

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

  useEffect(() => {
    loadPatient();
  }, [id]);

  const loadPatient = async () => {
    setLoading(true);
    try {
      const patient = await getPatient(id);
      setHospitalNumber(patient.hospital_number);
      setForm({
        full_name: patient.full_name || "",
        gender: patient.gender || "",
        dob: patient.dob || "",
        phone: patient.phone || "",
        address: patient.address || "",
        national_id: patient.national_id || "",
        guardian_name: patient.guardian_name || "",
        guardian_phone: patient.guardian_phone || "",
        guardian_relationship: patient.guardian_relationship || "",
        next_of_kin_name: patient.next_of_kin_name || "",
        next_of_kin_phone: patient.next_of_kin_phone || "",
        next_of_kin_relationship: patient.next_of_kin_relationship || "",
      });
    } catch (err) {
      toast.error(err.message || "Failed to load patient");
      navigate("/patients");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!form.gender) newErrors.gender = "Gender is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.dob) delete payload.dob;
      if (!payload.national_id) payload.national_id = null;

      await updatePatient(id, payload);
      toast.success("Patient updated successfully!");
      navigate(`/patients/${id}/visits`);
    } catch (err) {
      toast.error(err.message || "Failed to update patient");
      if (err.errors && typeof err.errors === "object") {
        const fieldErrors = {};
        Object.entries(err.errors).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? val[0] : val;
        });
        setErrors(fieldErrors);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Reception</div>
          <h1 className="page-title">Edit Patient</h1>
          <p className="page-subtitle">
            <span className="cell-mono">{hospitalNumber}</span>
          </p>
        </div>
        <div className="page-header__actions">
          <Link to={`/patients/${id}/visits`} className="btn btn-secondary">
            <i className="bi bi-arrow-left me-2"></i>
            Back to Visits
          </Link>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card mb-6">
          <div className="card-header">
            <h5 className="card-title">Basic Information</h5>
          </div>
          <div className="card-body">
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
                  value={form.full_name}
                  onChange={handleChange}
                />
                {errors.full_name && <div className="field-error">{errors.full_name}</div>}
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
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
                {errors.gender && <div className="field-error">{errors.gender}</div>}
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="dob">Date of Birth</label>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  className="input"
                  value={form.dob}
                  onChange={handleChange}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className="input"
                  placeholder="e.g., 0712 345 678"
                  value={form.phone}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="national_id">National ID</label>
                <input
                  id="national_id"
                  name="national_id"
                  type="text"
                  className={`input ${errors.national_id ? "has-error" : ""}`}
                  value={form.national_id}
                  onChange={handleChange}
                />
                {errors.national_id && <div className="field-error">{errors.national_id}</div>}
              </div>
              <div className="field">
                <label className="field-label" htmlFor="address">Address</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  className="input"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>
            </div>
          </div>
        </div>

        <fieldset className="card mb-6" style={{ padding: "var(--space-5)" }}>
          <legend>Guardian (for minors)</legend>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="guardian_name">Guardian Name</label>
              <input
                id="guardian_name"
                name="guardian_name"
                type="text"
                className="input"
                value={form.guardian_name}
                onChange={handleChange}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="guardian_phone">Guardian Phone</label>
              <input
                id="guardian_phone"
                name="guardian_phone"
                type="tel"
                className="input"
                value={form.guardian_phone}
                onChange={handleChange}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="guardian_relationship">Relationship</label>
              <input
                id="guardian_relationship"
                name="guardian_relationship"
                type="text"
                className="input"
                placeholder="e.g., Mother"
                value={form.guardian_relationship}
                onChange={handleChange}
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="card mb-6" style={{ padding: "var(--space-5)" }}>
          <legend>Next of Kin</legend>
          <div className="field-row">
            <div className="field">
              <label className="field-label" htmlFor="next_of_kin_name">Name</label>
              <input
                id="next_of_kin_name"
                name="next_of_kin_name"
                type="text"
                className="input"
                value={form.next_of_kin_name}
                onChange={handleChange}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="next_of_kin_phone">Phone</label>
              <input
                id="next_of_kin_phone"
                name="next_of_kin_phone"
                type="tel"
                className="input"
                value={form.next_of_kin_phone}
                onChange={handleChange}
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="next_of_kin_relationship">Relationship</label>
              <input
                id="next_of_kin_relationship"
                name="next_of_kin_relationship"
                type="text"
                className="input"
                value={form.next_of_kin_relationship}
                onChange={handleChange}
              />
            </div>
          </div>
        </fieldset>

        <div className="form-actions">
          <Link to={`/patients/${id}/visits`} className="btn btn-secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <span className="spinner spinner-inverse" style={{ width: 16, height: 16 }} />
            ) : (
              <>
                <i className="bi bi-check2-circle me-2"></i>
                Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}