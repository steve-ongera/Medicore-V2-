// src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as api from "../services/api";

export const AuthContext = createContext(null);

// Keep these in sync with the backend's role choices.
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  RECEPTIONIST: "RECEPTIONIST",
  NURSE: "NURSE",
  DOCTOR: "DOCTOR",
  LAB_TECHNOLOGIST: "LAB_TECHNOLOGIST",
  RADIOLOGIST: "RADIOLOGIST",
  PHARMACIST: "PHARMACIST",
  CASHIER: "CASHIER",
  ACCOUNTANT: "ACCOUNTANT",
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      localStorage.clear();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (username, password) => {
    const data = await api.login(username, password);
    localStorage.setItem("access_token", data.access);
    localStorage.setItem("refresh_token", data.refresh);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = localStorage.getItem("refresh_token");
    try {
      if (refresh) await api.logout(refresh);
    } catch {
      // ignore network errors on logout
    } finally {
      localStorage.clear();
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me);
    return me;
  }, []);

  // Super Admin always passes, regardless of which roles are asked for.
  // hasRole() with no args just checks "is there a logged-in user".
  const hasRole = useCallback(
    (...roles) => {
      if (!user?.role) return false;
      if (user.role === ROLES.SUPER_ADMIN) return true;
      if (roles.length === 0) return true;
      return roles.includes(user.role);
    },
    [user]
  );

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
    refreshUser,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}