// src/layouts/AuthLayout.jsx
import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="auth-layout-simple">
      <div className="auth-layout-simple__panel">
        <Outlet />
      </div>
    </div>
  );
}