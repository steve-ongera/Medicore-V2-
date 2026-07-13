// src/context/SidebarContext.jsx
import { createContext, useState } from "react";

export const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => setCollapsed((prev) => !prev);
  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  const value = { collapsed, toggleCollapsed, mobileOpen, toggleMobile, closeMobile };

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}