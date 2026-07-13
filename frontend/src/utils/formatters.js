export function formatCurrency(amount, currency = "KES") {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateString, options = {}) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeAgo(dateString) {
  if (!dateString) return "—";
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  const intervals = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [label, secondsInUnit] of intervals) {
    const count = Math.floor(seconds / secondsInUnit);
    if (count >= 1) return `${count} ${label}${count > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

// Converts SNAKE_CASE / UPPER_CASE status/enum values into readable labels
export function humanize(value) {
  if (!value) return "";
  return value
    .toString()
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Bootstrap badge color per common status value across the app
export function statusBadgeVariant(status) {
  const map = {
    PAID: "success",
    COMPLETED: "success",
    DONE: "success",
    REPORTED: "success",
    ACTIVE: "success",

    UNPAID: "danger",
    CANCELLED: "danger",
    OUT_OF_STOCK: "danger",

    PARTIAL: "warning",
    PENDING: "warning",
    WAITING: "warning",
    PAUSED: "warning",
    ORDERED: "warning",

    PROCESSING: "info",
    COLLECTED: "info",
    IN_QUEUE: "info",
    CONSULTING: "info",
    IN_CONSULTATION: "info",
    IN_PROGRESS: "info",

    REGISTERED: "secondary",
    AWAITING_PAYMENT: "secondary",
  };
  return map[status] || "secondary";
}

export function initials(fullName = "") {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
}