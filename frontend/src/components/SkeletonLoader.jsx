// src/components/SkeletonLoader.jsx
export default function SkeletonLoader({ rows = 5, columns = 4 }) {
  return (
    <div className="placeholder-glow">
      <table className="table">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: columns }).map((__, c) => (
                <td key={c}>
                  <span className="placeholder col-8"></span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}