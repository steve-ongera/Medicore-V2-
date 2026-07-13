// src/components/StatusBadge.jsx
import { humanize, statusBadgeVariant } from "../utils/formatters.js";

export default function StatusBadge({ status }) {
  if (!status) return null;
  return <span className={`badge bg-${statusBadgeVariant(status)}`}>{humanize(status)}</span>;
}