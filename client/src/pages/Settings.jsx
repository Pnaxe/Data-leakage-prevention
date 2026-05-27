import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
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

const emptyForm = {
  name: "",
  description: "",
  severity: "medium",
  threshold: 1,
  window_minutes: 60,
  is_active: true
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

export default function Settings() {
  const [rules, setRules] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  function loadRules() {
    return api.get("/detection-rules/")
      .then((response) => setRules(response.data.results || response.data))
      .catch(() => setRules([]));
  }

  useEffect(() => {
    loadRules();
  }, []);

  const filteredRules = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rules.filter((rule) => {
      const severityMatches = !selectedSeverity || rule.severity === selectedSeverity;
      const statusMatches = !selectedStatus
        || (selectedStatus === "active" && rule.is_active)
        || (selectedStatus === "inactive" && !rule.is_active);
      const haystack = [rule.name, rule.description, rule.severity].filter(Boolean).join(" ").toLowerCase();
      return severityMatches && statusMatches && (!term || haystack.includes(term));
    });
  }, [rules, search, selectedSeverity, selectedStatus]);

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

  function closeCreateModal() {
    setShowCreateForm(false);
    setForm(emptyForm);
  }

  function closeEditModal() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  function startEdit(rule) {
    setShowCreateForm(false);
    setEditingId(rule.id);
    setEditForm({
      name: rule.name,
      description: rule.description || "",
      severity: rule.severity,
      threshold: rule.threshold,
      window_minutes: rule.window_minutes,
      is_active: rule.is_active
    });
  }

  function ruleFields(formState, setFormState) {
    return (
      <>
        <Field label="Rule name">
          <input
            className={inputClass}
            value={formState.name}
            onChange={(event) => setFormState({ ...formState, name: event.target.value })}
            required
          />
        </Field>
        <Field label="Severity">
          <select
            className={inputClass}
            value={formState.severity}
            onChange={(event) => setFormState({ ...formState, severity: event.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
        <Field label="Threshold">
          <input
            className={inputClass}
            type="number"
            min="1"
            value={formState.threshold}
            onChange={(event) => setFormState({ ...formState, threshold: Number(event.target.value) })}
            required
          />
        </Field>
        <Field label="Window (minutes)">
          <input
            className={inputClass}
            type="number"
            min="1"
            value={formState.window_minutes}
            onChange={(event) => setFormState({ ...formState, window_minutes: Number(event.target.value) })}
            required
          />
        </Field>
        <Field label="Status">
          <label className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={formState.is_active}
              onChange={(event) => setFormState({ ...formState, is_active: event.target.checked })}
            />
            Rule is active
          </label>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description">
            <textarea
              className={`${inputClass} min-h-[100px] py-2`}
              value={formState.description}
              onChange={(event) => setFormState({ ...formState, description: event.target.value })}
              required
            />
          </Field>
        </div>
      </>
    );
  }

  async function createRule(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/detection-rules/", form);
      closeCreateModal();
      await loadRules();
      showToast("Detection rule created successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to create rule."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/detection-rules/${editingId}/`, editForm);
      closeEditModal();
      await loadRules();
      showToast("Detection rule updated successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to update rule."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRule(rule) {
    if (!window.confirm(`Delete detection rule "${rule.name}"?`)) return;
    try {
      await api.delete(`/detection-rules/${rule.id}/`);
      await loadRules();
      showToast("Detection rule deleted successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to delete rule."), "error");
    }
  }

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Configurations</h2>
          <p className="muted">Detection thresholds, active rules, and prevention policy settings.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-[#7c4dff] bg-[#7c4dff] px-3 py-2 text-sm font-bold text-white hover:bg-[#6b3fe8]"
        >
          <Plus size={16} />
          Add rule
        </button>
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
              placeholder="Rule name, description..."
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
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
        title="Add Detection Rule"
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
              form="create-rule-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Creating..." : "Add rule"}
            </button>
          </>
        )}
      >
        <form id="create-rule-form" onSubmit={createRule}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ruleFields(form, setForm)}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={closeEditModal}
        title="Edit Detection Rule"
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
              form="edit-rule-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </>
        )}
      >
        <form id="edit-rule-form" onSubmit={saveEdit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {ruleFields(editForm, setEditForm)}
          </div>
        </form>
      </Modal>

      <div className="pm-table-stack">
        <DataTable
          fill
          columns={[
            {
              key: "name",
              label: "Detection rule",
              render: (row) => (
                <div>
                  <span className="font-bold text-slate-800">{row.name}</span>
                  {row.description && (
                    <span className="mt-0.5 block max-w-[240px] truncate text-xs font-medium text-slate-500" title={row.description}>
                      {row.description}
                    </span>
                  )}
                </div>
              )
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
              key: "threshold",
              label: "Threshold",
              align: "right",
              render: (row) => row.threshold
            },
            {
              key: "window_minutes",
              label: "Window",
              align: "right",
              render: (row) => `${row.window_minutes} min`
            },
            {
              key: "is_active",
              label: "Status",
              render: (row) => (
                <span className={`pm-status ${row.is_active ? "" : "pm-status-inactive"}`}>
                  {row.is_active ? "Active" : "Inactive"}
                </span>
              )
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="pm-row-actions">
                  <button type="button" title="Edit" onClick={() => startEdit(row)}><Pencil size={14} /></button>
                  <button type="button" title="Delete" onClick={() => deleteRule(row)}><Trash2 size={14} /></button>
                </div>
              )
            }
          ]}
          rows={filteredRules}
          empty="No detection rules match the current filters"
        />
        <div className="pm-footer">
          Showing {filteredRules.length ? 1 : 0}-{filteredRules.length} of {rules.length} rules
        </div>
      </div>
    </div>
  );
}
