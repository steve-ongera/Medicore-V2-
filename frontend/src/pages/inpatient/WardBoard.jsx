import { useEffect, useState } from "react";
import { getWardOccupancy } from "../../services/api";

export default function WardBoard() {
  const [wards, setWards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadOccupancy();
  }, []);

  const loadOccupancy = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getWardOccupancy();
      setWards(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalCapacity = wards.reduce((sum, w) => sum + w.capacity, 0);
  const totalOccupied = wards.reduce((sum, w) => sum + w.occupied, 0);
  const totalAvailable = totalCapacity - totalOccupied;
  const occupancyRate = totalCapacity > 0 
    ? Math.round((totalOccupied / totalCapacity) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner spinner-lg"></div>
        <span className="loading-screen__label">Loading ward occupancy data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
        <div className="text-danger font-semibold">Error loading ward data</div>
        <p className="text-sm text-muted" style={{ marginTop: "var(--space-2)" }}>{error}</p>
        <button className="btn btn-primary mt-4" onClick={loadOccupancy}>
          <i className="bi bi-arrow-clockwise me-2"></i> Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Facility Management</div>
          <h1 className="page-title">Ward Board</h1>
          <p className="page-subtitle">Real-time bed occupancy by ward</p>
        </div>
        <div className="page-header__actions">
          <button className="btn btn-secondary" onClick={loadOccupancy}>
            <i className="bi bi-arrow-clockwise me-2"></i>
            Refresh
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card__top">
            <span className="stat-card__label">Total Beds</span>
            <div className="stat-card__icon tone-info">
              <i className="bi bi-hospital"></i>
            </div>
          </div>
          <div className="stat-card__value">{totalCapacity}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__top">
            <span className="stat-card__label">Occupied</span>
            <div className="stat-card__icon tone-success">
              <i className="bi bi-bed"></i>
            </div>
          </div>
          <div className="stat-card__value">{totalOccupied}</div>
          <div className="stat-card__delta is-up">
            <i className="bi bi-arrow-up me-1"></i> {occupancyRate}% occupancy
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__top">
            <span className="stat-card__label">Available</span>
            <div className="stat-card__icon tone-warning">
              <i className="bi bi-check-circle"></i>
            </div>
          </div>
          <div className="stat-card__value">{totalAvailable}</div>
          <div className="stat-card__footnote">{totalAvailable} beds free</div>
        </div>

        <div className="stat-card">
          <div className="stat-card__top">
            <span className="stat-card__label">Wards</span>
            <div className="stat-card__icon tone-primary">
              <i className="bi bi-grid"></i>
            </div>
          </div>
          <div className="stat-card__value">{wards.length}</div>
          <div className="stat-card__footnote">Active wards</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-tertiary text-sm">
              {wards.length} ward{wards.length !== 1 ? "s" : ""} configured
            </span>
          </div>
          <div>
            <span className="badge badge-neutral">
              <span className="badge-dot"></span>
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ward</th>
                  <th>Type</th>
                  <th className="cell-numeric">Capacity</th>
                  <th className="cell-numeric">Occupied</th>
                  <th className="cell-numeric">Available</th>
                  <th className="cell-numeric">Status</th>
                </tr>
              </thead>
              <tbody>
                {wards.map((w) => {
                  const occupancyPercent = w.capacity > 0 
                    ? Math.round((w.occupied / w.capacity) * 100) 
                    : 0;
                  
                  let statusBadge = "badge-success";
                  let statusLabel = "Available";
                  if (occupancyPercent >= 90) {
                    statusBadge = "badge-danger";
                    statusLabel = "Critical";
                  } else if (occupancyPercent >= 70) {
                    statusBadge = "badge-warning";
                    statusLabel = "High";
                  } else if (occupancyPercent >= 30) {
                    statusBadge = "badge-info";
                    statusLabel = "Moderate";
                  }

                  return (
                    <tr key={w.id}>
                      <td className="cell-primary">{w.name}</td>
                      <td>{w.ward_type}</td>
                      <td className="cell-numeric">{w.capacity}</td>
                      <td className="cell-numeric">{w.occupied}</td>
                      <td className="cell-numeric">{w.available}</td>
                      <td>
                        <span className={`badge ${statusBadge}`}>
                          <span className="badge-dot"></span>
                          {statusLabel} ({occupancyPercent}%)
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {wards.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">
                <i className="bi bi-building"></i>
              </div>
              <h3 className="empty-state__title">No wards configured</h3>
              <p className="empty-state__desc">
                Start by adding wards to track bed occupancy across your facility.
              </p>
              <button className="btn btn-primary">
                <i className="bi bi-plus-circle me-2"></i> Add Ward
              </button>
            </div>
          )}
        </div>

        {wards.length > 0 && (
          <div className="card-footer">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-tertiary text-sm">
                Showing {wards.length} ward{wards.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex gap-2">
              <span className="badge badge-success">
                <span className="badge-dot"></span>
                Available
              </span>
              <span className="badge badge-warning">
                <span className="badge-dot"></span>
                High occupancy
              </span>
              <span className="badge badge-danger">
                <span className="badge-dot"></span>
                Critical
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}