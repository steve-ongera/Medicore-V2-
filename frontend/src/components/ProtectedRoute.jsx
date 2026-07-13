// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";
import LoadingSpinner from "./LoadingSpinner.jsx";
import { ROLES } from "../utils/roles.js";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, loading, role } = useContext(AuthContext);
  const location = useLocation();

  if (loading) return <LoadingSpinner fullscreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const isAllowed = role === ROLES.SUPER_ADMIN || !allowedRoles || allowedRoles.includes(role);

  if (!isAllowed) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}