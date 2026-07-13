import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { getAuditLogs, getUsers } from "../../services/api";
import DataTable from "../../components/DataTable";
import SearchBar from "../../components/SearchBar";
import Pagination from "../../components/Pagination";
import StatusBadge from "../../components/StatusBadge";
import { formatDateTime } from "../../utils/formatters";

const ACTION_OPTIONS = [
  { value: "CREATE", label: "Create" },
  { value: "UPDATE", label: "Update" },
  { value: "DELETE", label: "Delete" },
];

const ACTION_VARIANT = {
  CREATE: "success",
  UPDATE: "warning",
  DELETE: "danger",
};

const toArray = (data) => (Array.isArray(data) ? data : data?.results ?? []);

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [userId, setUserId] = useState("");
  const [viewingLog, setViewingLog] = useState(null);

  const pageSize = 25;

  useEffect(() => {
    getUsers().then((data) => setUsers(toArray(data))).catch(() => {});
  }, []);

  useEffect(() => {
    loadLogs();
  }, [page, search, action, userId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize };
      if (search) params.search = search;
      if (action) params.action = action;
      if (userId) params.user = userId;
      const data = await getAuditLogs(params);
      setLogs(data.results || toArray(data));
      setTotal(data.count ?? toArray(data).length);
    } catch (err) {
      toast.error(err.message || "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: "timestamp",
      label: "Timestamp",
      render: (row) => formatDateTime(row.timestamp),
    },
    {
      key: "user_name",
      label: "Staff",
      render: (row) => row.user_name || "System",
    },
    {
      key: "action",
      label: "Action",
      render: (row) => <StatusBadge status={row.action} variant={ACTION_VARIANT[row.action] || "neutral"} />,
    },
    {
      key: "model_name",
      label: "Model",
      render: (row) => row.model_name,
    },
    {
      key: "object_id",
      label: "Record ID",
      render: (row) => <span className="cell-mono text-2xs">{row.object_id}</span>,
    },
    {
      key: "ip_address",
      label: "IP Address",
      render: (row) => row.ip_address || "—",
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-1 justify-end">
          <button className="btn-icon-only" onClick={() => setViewingLog(row)} title="View changes">
            <i className="bi bi-eye"></i>
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Settings</div>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Record of who changed what, and when</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-3 flex-wrap">
            <SearchBar
              placeholder="Search by record ID or model..."
              onSearch={(val) => {
                setSearch(val);
                setPage(1);
              }}
              delay={400}
            />
            <select
              className="select"
              style={{ maxWidth: 180, height: '38px' }}
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All actions</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
            <select
              className="select"
              style={{ maxWidth: 220, height: '38px' }}
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All staff</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.username}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="text-tertiary text-sm">
              {total} entr{total !== 1 ? "ies" : "y"}
            </span>
          </div>
        </div>

        <div className="card-body p-0">
          <DataTable
            columns={columns}
            data={logs}
            loading={loading}
            emptyMessage="No audit entries found."
          />
        </div>

        <div className="card-footer">
          <Pagination page={page} count={total} pageSize={pageSize} onPageChange={setPage} />
        </div>
      </div>

      {viewingLog && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setViewingLog(null); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">
                  {viewingLog.action} — {viewingLog.model_name}
                </h5>
                <p className="modal-desc">
                  {viewingLog.user_name || "System"} &middot; {formatDateTime(viewingLog.timestamp)}
                </p>
              </div>
              <button type="button" className="modal-close" onClick={() => setViewingLog(null)} aria-label="Close">
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-body">
              {Object.keys(viewingLog.changes || {}).length === 0 ? (
                <p className="text-tertiary text-sm">No field-level changes recorded.</p>
              ) : (
                <div className="table-wrap">
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Field</th>
                          <th>Before</th>
                          <th>After</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(viewingLog.changes).map(([field, value]) => (
                          <tr key={field}>
                            <td className="cell-mono text-2xs">{field}</td>
                            <td className="cell-muted text-2xs">{Array.isArray(value) ? String(value[0]) : "—"}</td>
                            <td className="text-2xs">{Array.isArray(value) ? String(value[1]) : String(value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setViewingLog(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}