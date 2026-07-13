import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="auth-card text-center">
      <div className="py-4">
        <div
          className="bg-danger bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-4"
          style={{ width: 72, height: 72 }}
        >
          <i className="bi bi-shield-lock text-danger fs-1"></i>
        </div>
        <h2 className="mb-2">Access Denied</h2>
        <p className="text-muted mb-4">
          You don't have permission to access this page.
          <br />
          Please contact your administrator if you believe this is an error.
        </p>
        <Link to="/dashboard" className="btn btn-primary">
          <i className="bi bi-arrow-left me-2"></i>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}