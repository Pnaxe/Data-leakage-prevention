import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import { inputClass } from "../components/FormSection";
import { useAuth } from "../context/AuthContext";
import { userHasPermission } from "../utils/access";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "access", label: "File access" },
  { value: "download", label: "Download" },
  { value: "upload", label: "Upload" },
  { value: "modify", label: "Modification" },
  { value: "share", label: "Share" },
  { value: "transfer", label: "Transfer" },
  { value: "failed_access", label: "Failed access" }
];

const ACTION_LABELS = Object.fromEntries(
  ACTION_OPTIONS.filter((option) => option.value).map((option) => [option.value, option.label])
);

const ACTION_TONES = {
  access: "bg-slate-100 text-slate-700",
  download: "bg-indigo-100 text-indigo-800",
  upload: "bg-sky-100 text-sky-800",
  modify: "bg-amber-100 text-amber-800",
  share: "bg-violet-100 text-violet-800",
  transfer: "bg-orange-100 text-orange-800",
  failed_access: "bg-rose-100 text-rose-800"
};

const RISK_TONES = {
  low: "bg-sky-100 text-sky-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-rose-100 text-rose-800"
};

export default function ActivityLogs() {
  const { user } = useAuth();
  const showUserFilter = userHasPermission(user, "manage_users") || user?.role_name === "security_officer";
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("");
  const [selectedUser, setSelectedUser] = useState("");

  function loadLogs() {
    const params = {};
    if (selectedAction) params.action = selectedAction;
    if (selectedRisk) params.risk_level = selectedRisk;
    if (selectedUser) params.user = selectedUser;

    return api.get("/activity-logs/", { params })
      .then((response) => setLogs(response.data.results || response.data))
      .catch(() => setLogs([]));
  }

  useEffect(() => {
    loadLogs();
  }, [selectedAction, selectedRisk, selectedUser]);

  useEffect(() => {
    if (!showUserFilter) {
      setUsers([]);
      return;
    }
    api.get("/users/")
      .then((response) => setUsers(response.data.results || response.data))
      .catch(() => setUsers([]));
  }, [showUserFilter]);

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((row) => {
      const haystack = [
        row.username,
        row.action,
        row.file_name,
        row.source_ip,
        row.destination,
        row.details,
        row.risk_level
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [logs, search]);

  function resetFilters() {
    setSearch("");
    setSelectedAction("");
    setSelectedRisk("");
    setSelectedUser("");
  }

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Activity Logs</h2>
          <p className="muted">Monitor file access, transfers, and risky behavior across the organization.</p>
        </div>
      </div>

      <section
        className={`panel grid shrink-0 gap-3 p-4 md:items-end ${
          showUserFilter
            ? "md:grid-cols-[minmax(220px,1fr)_150px_150px_150px_auto]"
            : "md:grid-cols-[minmax(220px,1fr)_150px_150px_auto]"
        }`}
      >
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Search</span>
          <div className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="User, file, IP, details..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Action</span>
          <select className={inputClass} value={selectedAction} onChange={(event) => setSelectedAction(event.target.value)}>
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Risk</span>
          <select className={inputClass} value={selectedRisk} onChange={(event) => setSelectedRisk(event.target.value)}>
            <option value="">All risks</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        {showUserFilter && (
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">User</span>
            <select className={inputClass} value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}>
              <option value="">All users</option>
              {users.map((entry) => (
                <option key={entry.id} value={entry.id}>{entry.username}</option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={resetFilters}
          className="h-10 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset filters
        </button>
      </section>

      <div className="pm-table-stack">
        <DataTable
          fill
          columns={[
            {
              key: "created_at",
              label: "Time",
              render: (row) => new Date(row.created_at).toLocaleString()
            },
            {
              key: "username",
              label: "User",
              render: (row) => row.username || "—"
            },
            {
              key: "action",
              label: "Action",
              render: (row) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${ACTION_TONES[row.action] || "bg-slate-100 text-slate-700"}`}>
                  {ACTION_LABELS[row.action] || row.action}
                </span>
              )
            },
            {
              key: "file_name",
              label: "File",
              render: (row) => row.file_name || "—"
            },
            {
              key: "risk_level",
              label: "Risk",
              render: (row) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${RISK_TONES[row.risk_level] || RISK_TONES.low}`}>
                  {row.risk_level || "low"}
                </span>
              )
            },
            {
              key: "blocked",
              label: "Status",
              render: (row) => (
                <span className={`pm-status ${row.blocked ? "pm-status-inactive" : ""}`}>
                  {row.blocked ? "Blocked" : "Allowed"}
                </span>
              )
            },
            {
              key: "details",
              label: "Details",
              render: (row) => (
                <span className="block max-w-[220px] truncate text-xs font-semibold text-slate-600" title={row.details || ""}>
                  {row.details || row.source_ip || "—"}
                </span>
              )
            }
          ]}
          rows={filteredLogs}
          empty="No activity logs match the current filters"
        />
        <div className="pm-footer">
          Showing {filteredLogs.length ? 1 : 0}-{filteredLogs.length} of {logs.length} activities
        </div>
      </div>
    </div>
  );
}
