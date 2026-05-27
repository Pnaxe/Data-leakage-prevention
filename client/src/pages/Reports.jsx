import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { Field, inputClass } from "../components/FormSection";

const RISK_TONES = {
  low: "bg-sky-100 text-sky-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-rose-100 text-rose-800"
};

const emptyForm = {
  title: "",
  summary: "",
  risk_level: "medium",
  recommendation: "",
  alerts: []
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

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingReport, setViewingReport] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  function loadReports() {
    return api.get("/reports/")
      .then((response) => setReports(response.data.results || response.data))
      .catch(() => setReports([]));
  }

  useEffect(() => {
    loadReports();
    api.get("/alerts/")
      .then((response) => setAlerts(response.data.results || response.data))
      .catch(() => setAlerts([]));
  }, []);

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();
    return reports.filter((report) => {
      const riskMatches = !selectedRisk || report.risk_level === selectedRisk;
      const haystack = [
        report.title,
        report.summary,
        report.recommendation,
        report.created_by_username,
        report.risk_level
      ].filter(Boolean).join(" ").toLowerCase();
      return riskMatches && (!term || haystack.includes(term));
    });
  }, [reports, search, selectedRisk]);

  function resetFilters() {
    setSearch("");
    setSelectedRisk("");
  }

  function showToast(message, type) {
    setToast({ message, type });
  }

  function dismissToast() {
    setToast(null);
  }

  function toggleAlert(state, setter, alertId) {
    const id = Number(alertId);
    const ids = state.alerts.map(Number);
    const exists = ids.includes(id);
    setter({
      ...state,
      alerts: exists ? ids.filter((value) => value !== id) : [...ids, id]
    });
  }

  function closeCreateModal() {
    setShowCreateForm(false);
    setForm(emptyForm);
  }

  function closeEditModal() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  function closeViewModal() {
    setViewingReport(null);
  }

  function startEdit(report) {
    setShowCreateForm(false);
    setViewingReport(null);
    setEditingId(report.id);
    setEditForm({
      title: report.title,
      summary: report.summary,
      risk_level: report.risk_level,
      recommendation: report.recommendation || "",
      alerts: (report.alerts || []).map(Number)
    });
  }

  function openView(report) {
    setShowCreateForm(false);
    setEditingId(null);
    setViewingReport(report);
  }

  function linkedAlertsField(formState, setFormState) {
    return (
      <Field label="Linked alerts">
        <div className="max-h-40 space-y-2 overflow-y-auto rounded-sm border border-slate-300 bg-white p-3">
          {alerts.length === 0 && (
            <p className="text-sm font-medium text-slate-500">No alerts available to link.</p>
          )}
          {alerts.map((alert) => (
            <label
              key={alert.id}
              className="flex cursor-pointer items-start gap-2 rounded-sm border border-slate-100 px-2 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={formState.alerts.map(Number).includes(Number(alert.id))}
                onChange={() => toggleAlert(formState, setFormState, alert.id)}
              />
              <span>
                <span className="block font-bold text-slate-800">{alert.title}</span>
                <span className="text-xs font-medium text-slate-500">
                  {alert.username} · {alert.severity} · {alert.status}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Field>
    );
  }

  function reportFields(formState, setFormState) {
    return (
      <>
        <Field label="Title">
          <input
            className={inputClass}
            value={formState.title}
            onChange={(event) => setFormState({ ...formState, title: event.target.value })}
            required
          />
        </Field>
        <Field label="Risk level">
          <select
            className={inputClass}
            value={formState.risk_level}
            onChange={(event) => setFormState({ ...formState, risk_level: event.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Summary">
            <textarea
              className={`${inputClass} min-h-[100px] py-2`}
              value={formState.summary}
              onChange={(event) => setFormState({ ...formState, summary: event.target.value })}
              required
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Recommendation">
            <textarea
              className={`${inputClass} min-h-[80px] py-2`}
              value={formState.recommendation}
              onChange={(event) => setFormState({ ...formState, recommendation: event.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">{linkedAlertsField(formState, setFormState)}</div>
      </>
    );
  }

  async function createReport(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/reports/", form);
      closeCreateModal();
      await loadReports();
      showToast("Incident report created successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to create report."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/reports/${editingId}/`, editForm);
      closeEditModal();
      await loadReports();
      showToast("Incident report updated successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to update report."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport(report) {
    if (!window.confirm(`Delete incident report "${report.title}"?`)) return;
    try {
      await api.delete(`/reports/${report.id}/`);
      await loadReports();
      showToast("Incident report deleted successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to delete report."), "error");
    }
  }

  const linkedAlertDetails = (report) => {
    if (!report?.alerts?.length) return [];
    const ids = report.alerts.map(Number);
    return alerts.filter((alert) => ids.includes(Number(alert.id)));
  };

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Incident Reports</h2>
          <p className="muted">Generate investigation records from alerts and audit evidence.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-[#7c4dff] bg-[#7c4dff] px-3 py-2 text-sm font-bold text-white hover:bg-[#6b3fe8]"
        >
          <Plus size={16} />
          Create report
        </button>
      </div>

      <section className="panel grid shrink-0 gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_160px_auto] md:items-end">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Search</span>
          <div className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title, summary, author..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Risk level</span>
          <select className={inputClass} value={selectedRisk} onChange={(event) => setSelectedRisk(event.target.value)}>
            <option value="">All levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
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
        open={showCreateForm}
        onClose={closeCreateModal}
        title="Create Incident Report"
        maxWidth="max-w-3xl"
        footer={(
          <>
            <button
              type="button"
              onClick={closeCreateModal}
              disabled={saving}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-report-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create report"}
            </button>
          </>
        )}
      >
        <form id="create-report-form" onSubmit={createReport}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {reportFields(form, setForm)}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={closeEditModal}
        title="Edit Incident Report"
        maxWidth="max-w-3xl"
        footer={(
          <>
            <button
              type="button"
              onClick={closeEditModal}
              disabled={saving}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-report-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </>
        )}
      >
        <form id="edit-report-form" onSubmit={saveEdit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {reportFields(editForm, setEditForm)}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewingReport)}
        onClose={closeViewModal}
        title="Incident Report"
        maxWidth="max-w-2xl"
        footer={(
          <button
            type="button"
            onClick={closeViewModal}
            className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        )}
      >
        {viewingReport && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Title</p>
              <p className="mt-1 text-base font-extrabold text-slate-900">{viewingReport.title}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Risk level</p>
                <p className="mt-1">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${RISK_TONES[viewingReport.risk_level] || RISK_TONES.medium}`}>
                    {viewingReport.risk_level}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Created by</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{viewingReport.created_by_username || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Created</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {new Date(viewingReport.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Linked alerts</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{viewingReport.alerts_count ?? viewingReport.alerts?.length ?? 0}</p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Summary</p>
              <p className="mt-1 text-sm font-medium text-slate-700">{viewingReport.summary}</p>
            </div>
            {viewingReport.recommendation && (
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Recommendation</p>
                <p className="mt-1 text-sm font-medium text-slate-700">{viewingReport.recommendation}</p>
              </div>
            )}
            {linkedAlertDetails(viewingReport).length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Alerts</p>
                <ul className="space-y-2">
                  {linkedAlertDetails(viewingReport).map((alert) => (
                    <li key={alert.id} className="rounded-sm border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                      {alert.title}
                      <span className="mt-0.5 block text-xs font-medium text-slate-500">
                        {alert.username} · {alert.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <div className="pm-table-stack">
        <DataTable
          fill
          columns={[
            {
              key: "title",
              label: "Title",
              render: (row) => <span className="font-bold text-slate-800">{row.title}</span>
            },
            {
              key: "risk_level",
              label: "Risk",
              align: "right",
              render: (row) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${RISK_TONES[row.risk_level] || RISK_TONES.medium}`}>
                  {row.risk_level}
                </span>
              )
            },
            {
              key: "created_by_username",
              label: "Created by",
              render: (row) => row.created_by_username || "—"
            },
            {
              key: "created_at",
              label: "Created",
              render: (row) => new Date(row.created_at).toLocaleString()
            },
            {
              key: "alerts_count",
              label: "Alerts",
              align: "right",
              render: (row) => row.alerts_count ?? row.alerts?.length ?? 0
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="pm-row-actions">
                  <button type="button" title="View" onClick={() => openView(row)}><Eye size={14} /></button>
                  <button type="button" title="Edit" onClick={() => startEdit(row)}><Pencil size={14} /></button>
                  <button type="button" title="Delete" onClick={() => deleteReport(row)}><Trash2 size={14} /></button>
                </div>
              )
            }
          ]}
          rows={filteredReports}
          empty="No incident reports match the current filters"
        />
        <div className="pm-footer">
          Showing {filteredReports.length ? 1 : 0}-{filteredReports.length} of {reports.length} reports
        </div>
      </div>
    </div>
  );
}
