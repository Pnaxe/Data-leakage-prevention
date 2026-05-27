import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import { inputClass } from "../components/FormSection";

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "upload", label: "Upload" },
  { value: "view", label: "View" },
  { value: "download", label: "Download" },
  { value: "edit", label: "Edit" },
  { value: "archive", label: "Archive" },
  { value: "delete", label: "Delete" },
  { value: "permission_change", label: "Permission change" }
];

const ACTION_LABELS = Object.fromEntries(
  ACTION_OPTIONS.filter((option) => option.value).map((option) => [option.value, option.label])
);

const ACTION_TONES = {
  upload: "bg-sky-100 text-sky-800",
  view: "bg-slate-100 text-slate-700",
  download: "bg-indigo-100 text-indigo-800",
  edit: "bg-amber-100 text-amber-800",
  archive: "bg-orange-100 text-orange-800",
  delete: "bg-rose-100 text-rose-800",
  permission_change: "bg-violet-100 text-violet-800"
};

export default function DocumentActivityHistory() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    api.get("/document-activity/")
      .then((response) => setHistory(response.data.results || response.data))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return history.filter((row) => {
      const actionMatches = !actionFilter || row.action === actionFilter;
      const haystack = [
        row.document_title,
        row.username,
        row.action,
        row.details
      ].filter(Boolean).join(" ").toLowerCase();

      return actionMatches && (!term || haystack.includes(term));
    });
  }, [history, search, actionFilter]);

  function resetFilters() {
    setSearch("");
    setActionFilter("");
  }

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Document Activity History</h2>
          <p className="muted">Audit trail of uploads, views, downloads, and changes.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to="/documents"
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft size={16} />
            Back to Document Repo
          </Link>
        </div>
      </div>

      <section className="panel grid shrink-0 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Search</span>
          <div className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Document, user, details..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Action</span>
          <select className={inputClass} value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={resetFilters}
          className="h-10 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Reset filters
        </button>
      </section>

      <div className="pm-table-stack">
        {loading ? (
          <p className="flex flex-1 items-center justify-center py-12 text-sm font-semibold text-slate-500">
            Loading activity history...
          </p>
        ) : (
          <>
            <DataTable
              fill
              columns={[
                { key: "created_at", label: "Time", render: (row) => new Date(row.created_at).toLocaleString() },
                { key: "document_title", label: "Document" },
                { key: "username", label: "User", render: (row) => row.username || "System" },
                {
                  key: "action",
                  label: "Action",
                  render: (row) => (
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${ACTION_TONES[row.action] || "bg-slate-100 text-slate-700"}`}>
                      {ACTION_LABELS[row.action] || row.action}
                    </span>
                  )
                },
                { key: "details", label: "Details", render: (row) => row.details || "—" }
              ]}
              rows={filteredRows}
              padRows={25}
              empty="No activity matches the current filters"
            />
            <div className="pm-footer">
              Showing {filteredRows.length} of {history.length} activities
            </div>
          </>
        )}
      </div>
    </div>
  );
}
