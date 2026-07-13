import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getQueue, callNextInQueue, updateQueueEntry } from "../../services/api";
import StatusBadge from "../../components/StatusBadge";
import LoadingSpinner from "../../components/LoadingSpinner";
import { formatTimeAgo } from "../../utils/formatters";

export default function QueueBoard() {
  const [queues, setQueues] = useState({
    NURSE: [],
    DOCTOR: [],
    LAB: [],
    RADIOLOGY: [],
    PHARMACY: [],
  });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  const queueTypes = ["NURSE", "DOCTOR", "LAB", "RADIOLOGY", "PHARMACY"];
  const queueLabels = {
    NURSE: "Nurse Triage",
    DOCTOR: "Doctor Consultation",
    LAB: "Laboratory",
    RADIOLOGY: "Radiology",
    PHARMACY: "Pharmacy",
  };
  const queueColors = {
    NURSE: "primary",
    DOCTOR: "success",
    LAB: "info",
    RADIOLOGY: "warning",
    PHARMACY: "danger",
  };

  useEffect(() => {
    loadQueues();
    const interval = setInterval(loadQueues, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadQueues = async () => {
    try {
      const data = await getQueue({ status: "WAITING" });
      const grouped = { NURSE: [], DOCTOR: [], LAB: [], RADIOLOGY: [], PHARMACY: [] };
      (data.results || []).forEach((entry) => {
        if (grouped[entry.queue_type]) {
          grouped[entry.queue_type].push(entry);
        }
      });
      setQueues(grouped);
    } catch (err) {
      toast.error(err.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  };

  const handleCallNext = async (queueType, entryId) => {
    setProcessing((prev) => ({ ...prev, [entryId]: true }));
    try {
      await callNextInQueue(entryId);
      toast.success("Patient called!");
      loadQueues();
    } catch (err) {
      toast.error(err.message || "Failed to call next patient");
    } finally {
      setProcessing((prev) => ({ ...prev, [entryId]: false }));
    }
  };

  const handleUpdateStatus = async (entryId, status) => {
    try {
      await updateQueueEntry(entryId, { status });
      toast.success("Status updated");
      loadQueues();
    } catch (err) {
      toast.error(err.message || "Failed to update status");
    }
  };

  const getWaitTime = (createdAt) => {
    return formatTimeAgo(createdAt);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Queue Management</div>
          <h1 className="page-title">Queue Board</h1>
          <p className="page-subtitle">Real-time patient queue status</p>
        </div>
        <div className="page-header__actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadQueues}
          >
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>
      </div>

      <div className="queue-board">
        {queueTypes.map((type) => {
          const entries = queues[type] || [];
          const color = queueColors[type];

          return (
            <div key={type} className="queue-column">
              <div className="queue-column__header">
                <div className="queue-column__title">
                  <span className={`badge bg-${color}`}>{entries.length}</span>
                  {queueLabels[type]}
                </div>
                {entries.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm btn-primary"
                    onClick={() => handleCallNext(type, entries[0]?.id)}
                    disabled={processing[entries[0]?.id]}
                  >
                    {processing[entries[0]?.id] ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <>
                        <i className="bi bi-chevron-right me-1"></i>
                        Call Next
                      </>
                    )}
                  </button>
                )}
              </div>

              <div className="queue-column__list">
                {entries.length === 0 ? (
                  <div className="queue-column__empty">
                    <i className="bi bi-check-circle fs-3 d-block mb-2 text-success"></i>
                    No patients waiting
                  </div>
                ) : (
                  entries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`queue-card ${entry.priority > 0 ? "is-priority" : ""}`}
                    >
                      <div className="queue-card__top">
                        <span className="queue-card__name">{entry.patient_name}</span>
                        {entry.priority > 0 && (
                          <span className="badge bg-danger">Priority</span>
                        )}
                      </div>
                      <div className="queue-card__meta">
                        <span>
                          <span className="text-muted">#</span>
                          <span className="cell-mono">{entry.hospital_number}</span>
                        </span>
                        <span className="queue-card__wait">
                          {getWaitTime(entry.created_at)}
                        </span>
                      </div>
                      <div className="mt-2 d-flex gap-1 flex-wrap">
                        <StatusBadge status={entry.status} />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => handleUpdateStatus(entry.id, "COMPLETED")}
                        >
                          <i className="bi bi-check2"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}