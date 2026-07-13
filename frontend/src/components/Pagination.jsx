// src/components/Pagination.jsx
export default function Pagination({ page, count, pageSize = 20, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1
  );

  return (
    <nav>
      <ul className="pagination justify-content-end mb-0">
        <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
          <button className="page-link" onClick={() => onPageChange(page - 1)}>
            <i className="bi bi-chevron-left"></i>
          </button>
        </li>
        {pages.map((p, idx) => (
          <li key={p}>
            {idx > 0 && pages[idx - 1] !== p - 1 && <span className="px-2">…</span>}
            <button
              className={`page-link ${p === page ? "active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          </li>
        ))}
        <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
          <button className="page-link" onClick={() => onPageChange(page + 1)}>
            <i className="bi bi-chevron-right"></i>
          </button>
        </li>
      </ul>
    </nav>
  );
}