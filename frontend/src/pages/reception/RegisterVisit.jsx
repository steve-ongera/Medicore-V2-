import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { registerVisit, getPatients, getDepartments } from "../../services/api";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatCurrency } from "../../utils/formatters";

export default function RegisterVisit() {
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    patient: "",
    department: "",
    doctor: "",
    consultation_type: "GENERAL",
  });

  const [errors, setErrors] = useState({});
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    loadDepartments();
    loadPatients();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await getDepartments({ is_active: true });
      setDepartments(data.results || data || []);
    } catch (err) {
      toast.error("Failed to load departments");
    }
  };

  const loadPatients = async () => {
    try {
      const data = await getPatients({ page: 1, page_size: 100 });
      setPatients(data.results || []);
    } catch (err) {
      toast.error("Failed to load patients");
    }
  };

  const searchPatients = async (query) => {
    if (!query || query.length < 2) {
      setPatients([]);
      return;
    }
    try {
      const data = await getPatients({ search: query, page: 1, page_size: 20 });
      setPatients(data.results || []);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
    setForm({ ...form, patient: patient.id });
    setShowPatientSearch(false);
    setSearchTerm(patient.full_name);
  };

  const validate = () => {
    const newErrors = {};
    if (!form.patient) newErrors.patient = "Please select a patient";
    if (!form.department) newErrors.department = "Department is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await registerVisit(form);
      toast.success("Visit registered successfully!");
      navigate("/queue");
    } catch (err) {
      toast.error(err.message || "Failed to register visit");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Reception</div>
          <h1 className="page-title">Register Visit</h1>
          <p className="page-subtitle">Create a new patient visit</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/queue")}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Queue
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {/* Patient Selection */}
            <div className="field">
              <label className="field-label" htmlFor="patient_search">
                Patient <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="patient_search"
                  type="text"
                  className={`input ${errors.patient ? "has-error" : ""}`}
                  placeholder="Search patient by name, phone, or hospital #..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    searchPatients(e.target.value);
                    setShowPatientSearch(true);
                  }}
                  onFocus={() => {
                    if (searchTerm.length > 1) setShowPatientSearch(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowPatientSearch(false), 200);
                  }}
                />
                {showPatientSearch && patients.length > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      marginTop: 'var(--space-1)',
                      background: 'var(--surface)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 1000,
                      maxHeight: 300,
                      overflowY: 'auto'
                    }}
                  >
                    {patients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: 'var(--space-2) var(--space-3)',
                          border: 'none',
                          background: 'transparent',
                          transition: 'background var(--duration-fast) var(--ease-standard)'
                        }}
                        onMouseDown={() => handlePatientSelect(p)}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div>
                          <strong>{p.full_name}</strong>
                          <span className="text-muted text-xs" style={{ marginLeft: 'var(--space-2)' }}>
                            {p.hospital_number}
                          </span>
                        </div>
                        <div className="text-xs text-tertiary">
                          {p.phone} {p.national_id ? `· ${p.national_id}` : ""}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errors.patient && (
                <div className="field-error">{errors.patient}</div>
              )}
              {selectedPatient && (
                <div style={{
                  marginTop: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--primary-soft)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  <i className="bi bi-check-circle" style={{ color: 'var(--success-strong)' }}></i>
                  <span>
                    <strong>{selectedPatient.full_name}</strong>
                    <span className="text-muted text-xs" style={{ marginLeft: 'var(--space-2)' }}>
                      {selectedPatient.hospital_number} · {selectedPatient.age || "N/A"} years
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Department and Consultation Type */}
            <div className="field-row">
              <div className="field">
                <label className="field-label" htmlFor="department">
                  Department <span className="required">*</span>
                </label>
                <select
                  id="department"
                  name="department"
                  className={`select ${errors.department ? "has-error" : ""}`}
                  value={form.department}
                  onChange={handleChange}
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name} ({formatCurrency(dept.consultation_fee)})
                    </option>
                  ))}
                </select>
                {errors.department && (
                  <div className="field-error">{errors.department}</div>
                )}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="consultation_type">
                  Consultation Type
                </label>
                <select
                  id="consultation_type"
                  name="consultation_type"
                  className="select"
                  value={form.consultation_type}
                  onChange={handleChange}
                >
                  <option value="GENERAL">General Consultation</option>
                  <option value="GYNECOLOGY">Gynecologist</option>
                  <option value="DENTAL">Dentist</option>
                  <option value="PEDIATRIC">Pediatrician</option>
                  <option value="OTHER">Other Specialist</option>
                </select>
              </div>
            </div>

            {/* Doctor */}
            <div className="field">
              <label className="field-label" htmlFor="doctor">
                Doctor (Optional)
              </label>
              <select
                id="doctor"
                name="doctor"
                className="select"
                value={form.doctor}
                onChange={handleChange}
              >
                <option value="">Assign later</option>
                {/* Doctors will be loaded via API if needed */}
              </select>
              <span className="field-hint">Leave empty to assign a doctor from the queue</span>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/queue")}
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
                    <i className="bi bi-clipboard-plus me-2"></i>
                    Register Visit
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