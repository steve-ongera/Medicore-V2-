// src/components/DataTable.jsx
import SkeletonLoader from "./SkeletonLoader.jsx";

export default function DataTable({ columns, data, loading, emptyMessage = "No records found." }) {
  if (loading) return <SkeletonLoader columns={columns.length} />;

  if (!data || data.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state__icon">
          <i className="bi bi-inbox" style={{ fontSize: 22 }} aria-hidden="true" />
        </div>
        <div className="empty-state__desc">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.id}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}