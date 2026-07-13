import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <div className="empty-state">
        <div className="empty-state__icon">
          <i className="bi bi-exclamation-triangle fs-2"></i>
        </div>
        <h2 className="empty-state__title">Page Not Found</h2>
        <p className="empty-state__desc">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard" className="btn btn-primary">
          <i className="bi bi-house me-2"></i>
          Go Home
        </Link>
      </div>
    </div>
  );
}