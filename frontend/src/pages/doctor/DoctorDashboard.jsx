import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getMyQueue, callNextInQueue, getPatients } from "../../services/api";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import StatCard from "../../components/StatCard";
import { formatTimeAgo } from "../../utils/formatters";

export default function DoctorDashboard() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadQueue();
    const interval = setInterval(loadQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const data = await getMyQueue("DOCTOR");
      setQueue(data || []);
    } catch (err) {
      toast.error(err.message || "Failed to load doctor queue");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query) => {
    setSearchTerm(query);
    if (!query || query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    try {
      const data = await getPatients({ search: query, page: 1, page_size: 10 });
      const patients = data.results || data || [];
      if (patients.length > 0) {
        setSearchResults(patients);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPatient = (patient) => {
    // Check if patient is in queue
    const existingInQueue = queue.find(q => q.patient === patient.id);
    if (existingInQueue) {
      if (existingInQueue.status === "WAITING_DOCTOR" || existingInQueue.status === "WAITING") {
        handleStartConsultation(existingInQueue.id);
      } else if (existingInQueue.status === "CONSULTING" || existingInQueue.status === "PAUSED") {
        handleContinueConsultation(existingInQueue);
      } else {
        toast.info(`Patient is ${existingInQueue.status.toLowerCase()}`);
      }
    } else {
      toast.info("Patient is not in your queue. Please register a visit first.");
    }
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  const handleStartConsultation = async (entryId) => {
    setProcessing((prev) => ({ ...prev, [entryId]: true }));
    try {
      await callNextInQueue(entryId);
      const entry = queue.find((e) => e.id === entryId);
      toast.success(`Starting consultation with ${entry?.patient_name}`);
      navigate(`/doctor/consultation/${entry?.visit}`);
    } catch (err) {
      toast.error(err.message || "Failed to start consultation");
    } finally {
      setProcessing((prev) => ({ ...prev, [entryId]: false }));
    }
  };

  const handleContinueConsultation = (entry) => {
    navigate(`/doctor/consultation/${entry.visit}`);
  };

  if (loading) return <LoadingSpinner />;

  const waitingCount = queue.filter((e) => e.status === "WAITING_DOCTOR" || e.status === "WAITING").length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Doctor Dashboard</div>
          <h1 className="page-title">My Queue</h1>
          <p className="page-subtitle">Manage your patient consultations</p>
        </div>
        <div className="page-header__actions">
          <button type="button" className="btn btn-secondary" onClick={loadQueue}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid mb-6">
        <StatCard
          label="Waiting Patients"
          value={waitingCount}
          icon="bi-hourglass-split"
          variant="warning"
        />
        <StatCard
          label="In Consultation"
          value={queue.filter((e) => e.status === "CONSULTING").length}
          icon="bi-clipboard2-pulse"
          variant="primary"
        />
        <StatCard
          label="Paused"
          value={queue.filter((e) => e.status === "PAUSED").length}
          icon="bi-pause-circle"
          variant="warning"
        />
        <StatCard
          label="Completed Today"
          value={queue.filter((e) => e.status === "COMPLETED").length}
          icon="bi-check-circle"
          variant="success"
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              <h5 className="card-title" style={{ margin: 0 }}>Patient Queue</h5>
              <span className="badge badge-primary">{queue.length} patients</span>
            </div>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 'var(--space-4)' }}>
          {/* Search Bar */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ position: 'relative' }}>
              <div className="search-bar">
                <i className="bi bi-search search-bar__icon" aria-hidden="true"></i>
                <input
                  type="text"
                  className="search-bar__input"
                  placeholder="Search patient by name, phone, or ID..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchResults(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSearchResults(false), 200);
                  }}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-bar__clear"
                    onClick={() => {
                      setSearchTerm("");
                      setSearchResults([]);
                      setShowSearchResults(false);
                    }}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
              {searching && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 'var(--space-1)',
                  padding: 'var(--space-2)',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 1000,
                  textAlign: 'center'
                }}>
                  <span className="spinner spinner-sm" style={{ display: 'inline-block', width: '16px', height: '16px' }}></span>
                  <span className="text-sm text-muted" style={{ marginLeft: 'var(--space-2)' }}>Searching...</span>
                </div>
              )}
              {showSearchResults && searchResults.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
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
                  {searchResults.map((patient) => (
                    <button
                      key={patient.id}
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
                      onMouseDown={() => handleSelectPatient(patient)}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <strong>{patient.full_name}</strong>
                        <span className="text-muted text-xs" style={{ marginLeft: 'var(--space-2)' }}>
                          #{patient.hospital_number}
                        </span>
                      </div>
                      <div className="text-xs text-tertiary">
                        {patient.phone} {patient.national_id ? `· ${patient.national_id}` : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchResults.length === 0 && searchTerm.length >= 2 && !searching && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: 'var(--space-1)',
                    padding: 'var(--space-3)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 1000,
                    textAlign: 'center',
                    color: 'var(--text-tertiary)'
                  }}
                >
                  No patients found
                </div>
              )}
            </div>
          </div>

          {/* Queue List */}
          {queue.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">
                <i className="bi bi-check-circle" style={{ fontSize: "1.5rem" }}></i>
              </div>
              <div className="empty-state__title">No patients in your queue</div>
              <div className="empty-state__desc">New patients will appear here once they're ready for consultation.</div>
            </div>
          ) : (
            <div className="divide-y">
              {queue.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 'var(--space-4) var(--space-5)',
                    borderBottom: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span className="avatar avatar-sm">
                      {entry.patient_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
                    </span>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 'var(--fw-semibold)' }}>{entry.patient_name}</span>
                        <span className="text-tertiary text-xs">
                          #{entry.hospital_number}
                        </span>
                        {entry.priority > 0 && (
                          <span className="badge badge-danger">Priority</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                        <StatusBadge status={entry.status} />
                        <span className="text-xs text-tertiary">
                          Waiting: {formatTimeAgo(entry.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {entry.status === "WAITING_DOCTOR" || entry.status === "WAITING" ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handleStartConsultation(entry.id)}
                        disabled={processing[entry.id]}
                      >
                        {processing[entry.id] ? (
                          <span className="spinner spinner-inverse" style={{ width: 16, height: 16 }} />
                        ) : (
                          <>
                            <i className="bi bi-play-circle me-1"></i>
                            Start Consultation
                          </>
                        )}
                      </button>
                    ) : entry.status === "CONSULTING" ? (
                      <button
                        type="button"
                        className="btn btn-success btn-sm"
                        onClick={() => handleContinueConsultation(entry)}
                      >
                        <i className="bi bi-clipboard2-pulse me-1"></i>
                        Continue
                      </button>
                    ) : entry.status === "PAUSED" ? (
                      <button
                        type="button"
                        className="btn btn-warning btn-sm"
                        onClick={() => handleContinueConsultation(entry)}
                      >
                        <i className="bi bi-play-circle me-1"></i>
                        Continue (Paused)
                      </button>
                    ) : (
                      <StatusBadge status={entry.status} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}