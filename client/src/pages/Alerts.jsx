import { useEffect, useMemo, useState } from "react";
import { Eye, Search } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { Field, inputClass } from "../components/FormSection";

const SEVERITY_TONES = {
  low: "bg-sky-100 text-sky-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-rose-100 text-rose-800"
};

const STATUS_CLASS = {
  open: "",
  investigating: "pm-status-archived",
  resolved: "pm-status-inactive"
};

const STATUS_LABEL = {
  open: "Open",
  investigating: "Investigating",
  resolved: "Resolved"
};

function apiErrorMessage(error, fallback) {
  const data = error?.response?.data;
  if (typeof data === "string") return data;
  if (data?.detail) return typeof data.detail === "string" ? data.detail : fallback;
  if (data && typeof data === "object") {
    const first = Object.values(data).flat()[0];
    if (typeof first === "string") return first;
  }
  return fallback;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [statusDraft, setStatusDraft] = useState("open");
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  function loadAlerts() {
    const params = {};
    if (selectedSeverity) params.severity = selectedSeverity;
    if (selectedStatus) params.status = selectedStatus;

    return api.get("/alerts/", { params })
      .then((response) => setAlerts(response.data.results || response.data))
      .catch(() => setAlerts([]));
  }

  useEffect(() => {
    loadAlerts();
  }, [selectedSeverity, selectedStatus]);

  const filteredAlerts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return alerts;
    return alerts.filter((alert) => {
      const haystack = [
        alert.title,
        alert.message,
        alert.username,
        alert.rule_name,
        alert.severity,
        alert.status
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [alerts, search]);

  function resetFilters() {
    setSearch("");
    setSelectedSeverity("");
    setSelectedStatus("");
  }

  function showToast(message, type) {
    setToast({ message, type });
  }

  function dismissToast() {
    setToast(null);
  }

  function openAlert(alert) {
    setSelectedAlert(alert);
    setStatusDraft(alert.status);
  }

  function closeAlertModal() {
    setSelectedAlert(null);
    setStatusDraft("open");
  }

  async function saveStatusFromModal(event) {
    event.preventDefault();
    if (!selectedAlert) return;
    setSaving(true);
    try {
      await api.patch(`/alerts/${selectedAlert.id}/`, { status: statusDraft });
      closeAlertModal();
      await loadAlerts();
      showToast("Alert updated successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to update alert."), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Alerts</h2>
          <p className="muted">Monitor suspicious insider behavior by severity and status.</p>
        </div>
      </div>

      <section className="panel grid shrink-0 gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_160px_160px_auto] md:items-end">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Search</span>
          <div className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Alert, user, rule..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Severity</span>
          <select
            className={inputClass}
            value={selectedSeverity}
            onChange={(event) => setSelectedSeverity(event.target.value)}
          >
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
          <select
            className={inputClass}
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
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

      <Toast open={Boolean(toast)} message={toast?.message} type={toast?.type} onClose={dismissToast} />

      <Modal
        open={Boolean(selectedAlert)}
        onClose={closeAlertModal}
        title="Alert details"
        maxWidth="max-w-2xl"
        footer={(
          <>
            <button
              type="button"
              onClick={closeAlertModal}
              disabled={saving}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Close
            </button>
            <button
              type="submit"
              form="alert-status-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save status"}
            </button>
          </>
        )}
      >
        {selectedAlert && (
          <form id="alert-status-form" onSubmit={saveStatusFromModal} className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Alert</p>
              <p className="mt-1 text-base font-extrabold text-slate-900">{selectedAlert.title}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Message</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{selectedAlert.message}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">User</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{selectedAlert.username || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Rule</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{selectedAlert.rule_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Time</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {new Date(selectedAlert.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Severity</p>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${SEVERITY_TONES[selectedAlert.severity] || SEVERITY_TONES.medium}`}>
                    {selectedAlert.severity}
                  </span>
                </p>
              </div>
            </div>
            <Field label="Status">
              <select
                className={inputClass}
                value={statusDraft}
                onChange={(event) => setStatusDraft(event.target.value)}
              >
                <option value="open">Open</option>
                <option value="investigating">Investigating</option>
                <option value="resolved">Resolved</option>
              </select>
            </Field>
          </form>
        )}
      </Modal>

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
              key: "title",
              label: "Alert",
              render: (row) => (
                <span className="font-bold text-slate-800">{row.title}</span>
              )
            },
            {
              key: "username",
              label: "User",
              render: (row) => row.username || "—"
            },
            {
              key: "rule_name",
              label: "Rule",
              render: (row) => row.rule_name || "—"
            },
            {
              key: "severity",
              label: "Severity",
              align: "right",
              render: (row) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${SEVERITY_TONES[row.severity] || SEVERITY_TONES.medium}`}>
                  {row.severity}
                </span>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <span className={`pm-status ${STATUS_CLASS[row.status] || ""}`}>
                  {STATUS_LABEL[row.status] || row.status}
                </span>
              )
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="pm-row-actions">
                  <button type="button" title="View & update" onClick={() => openAlert(row)}><Eye size={14} /></button>
                </div>
              )
            }
          ]}
          rows={filteredAlerts}
          empty="No alerts match the current filters"
        />
        <div className="pm-footer">
          Showing {filteredAlerts.length ? 1 : 0}-{filteredAlerts.length} of {alerts.length} alerts
        </div>
      </div>
    </div>
  );
}
