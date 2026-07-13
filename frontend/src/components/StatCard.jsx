// src/components/StatCard.jsx
export default function StatCard({ label, value, icon, variant = "primary" }) {
  const tone = variant === "primary" ? "" : `tone-${variant}`;

  return (
    <div className="stat-card">
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        <span className={`stat-card__icon ${tone}`}>
          <i className={`bi ${icon}`}></i>
        </span>
      </div>
      <div className="stat-card__value">{value}</div>
    </div>
  );
}