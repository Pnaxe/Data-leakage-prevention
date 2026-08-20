import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import Toast from "../components/Toast";
import { Field, inputClass } from "../components/FormSection";

const SENSITIVITY_TONES = {
  low: "bg-sky-100 text-sky-800",
  medium: "bg-amber-100 text-amber-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-rose-100 text-rose-800"
};

const SENSITIVITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "Confidential",
  critical: "Critical"
};

const emptyForm = {
  name: "",
  path: "",
  owner_department: "",
  sensitivity: "medium",
  requires_approval: false,
  allowed_roles: []
};

function roleLabel(role) {
  return role?.label || (role?.name || "").replaceAll("_", " ");
}

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

export default function SensitiveFiles() {
  const [files, setFiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedSensitivity, setSelectedSensitivity] = useState("");
  const [selectedApproval, setSelectedApproval] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [accessRequests, setAccessRequests] = useState([]);

  function loadFiles() {
    return api.get("/sensitive-files/")
      .then((response) => setFiles(response.data.results || response.data))
      .catch(() => setFiles([]));
  }

  function loadAccessRequests() {
    return api.get("/document-access-requests/")
      .then((response) => setAccessRequests(response.data.results || response.data))
      .catch(() => setAccessRequests([]));
  }

  useEffect(() => {
    loadFiles();
    loadAccessRequests();
    api.get("/roles/")
      .then((response) => setRoles(response.data.results || response.data))
      .catch(() => setRoles([]));
  }, []);

  const filteredFiles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return files.filter((file) => {
      const sensitivityMatches = !selectedSensitivity || file.sensitivity === selectedSensitivity;
      const approvalMatches = !selectedApproval
        || (selectedApproval === "required" && file.requires_approval)
        || (selectedApproval === "none" && !file.requires_approval);
      const haystack = [
        file.name,
        file.path,
        file.owner_department,
        file.sensitivity,
        ...(file.allowed_role_names || [])
      ].filter(Boolean).join(" ").toLowerCase();

      return sensitivityMatches && approvalMatches && (!term || haystack.includes(term));
    });
  }, [files, search, selectedSensitivity, selectedApproval]);

  function resetFilters() {
    setSearch("");
    setSelectedSensitivity("");
    setSelectedApproval("");
  }

  function showToast(message, type) {
    setToast({ message, type });
  }

  function dismissToast() {
    setToast(null);
  }

  function toggleRole(state, setter, roleId) {
    const id = Number(roleId);
    const ids = state.allowed_roles.map(Number);
    const exists = ids.includes(id);
    setter({
      ...state,
      allowed_roles: exists ? ids.filter((value) => value !== id) : [...ids, id]
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

  function startEdit(file) {
    setShowCreateForm(false);
    setEditingId(file.id);
    setEditForm({
      name: file.name,
      path: file.path,
      owner_department: file.owner_department,
      sensitivity: file.sensitivity,
      requires_approval: file.requires_approval,
      allowed_roles: (file.allowed_roles || []).map(Number)
    });
  }

  function fileFields(formState, setFormState) {
    return (
      <>
        <Field label="File name">
          <input
            className={inputClass}
            value={formState.name}
            onChange={(event) => setFormState({ ...formState, name: event.target.value })}
            required
          />
        </Field>
        <Field label="Path">
          <input
            className={inputClass}
            value={formState.path}
            onChange={(event) => setFormState({ ...formState, path: event.target.value })}
            placeholder="\\server\share\file.docx"
            required
          />
        </Field>
        <Field label="Owner department">
          <input
            className={inputClass}
            value={formState.owner_department}
            onChange={(event) => setFormState({ ...formState, owner_department: event.target.value })}
            required
          />
        </Field>
        <Field label="Sensitivity">
          <select
            className={inputClass}
            value={formState.sensitivity}
            onChange={(event) => setFormState({ ...formState, sensitivity: event.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">Confidential</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
        <Field label="Approval">
          <label className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={formState.requires_approval}
              onChange={(event) => setFormState({ ...formState, requires_approval: event.target.checked })}
            />
            Require admin approval
          </label>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Access permissions">
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <button
                  type="button"
                  key={role.id}
                  onClick={() => toggleRole(formState, setFormState, role.id)}
                  className={`rounded-sm border px-3 py-2 text-xs font-extrabold ${
                    formState.allowed_roles.map(Number).includes(Number(role.id))
                      ? "border-[#7c4dff] bg-[#7c4dff] text-white"
                      : "border-slate-300 bg-white text-slate-700"
                  }`}
                >
                  {roleLabel(role)}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </>
    );
  }

  async function createFile(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/sensitive-files/", form);
      closeCreateModal();
      await loadFiles();
      showToast("Sensitive file registered successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to register file."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/sensitive-files/${editingId}/`, editForm);
      closeEditModal();
      await loadFiles();
      showToast("Sensitive file updated successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to update file."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteFile(file) {
    if (!window.confirm(`Delete sensitive file "${file.name}"?`)) return;
    try {
      await api.delete(`/sensitive-files/${file.id}/`);
      await loadFiles();
      showToast("Sensitive file deleted successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to delete file."), "error");
    }
  }

  async function reviewRequest(request, decision) {
    try {
      await api.post(`/document-access-requests/${request.id}/${decision}/`);
      await loadAccessRequests();
      showToast(`Request ${decision}d successfully.`, "success");
    } catch (error) {
      showToast(apiErrorMessage(error, `Failed to ${decision} request.`), "error");
    }
  }

  const pendingRequests = accessRequests.filter((item) => item.status === "pending");

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Sensitive Files</h2>
          <p className="muted">
            Monitoring register for confidential/critical Document Repository uploads (plus optional legacy path entries).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-[#7c4dff] bg-[#7c4dff] px-3 py-2 text-sm font-bold text-white hover:bg-[#6b3fe8]"
        >
          <Plus size={16} />
          Register legacy path
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
              placeholder="Name, path, department..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Sensitivity</span>
          <select
            className={inputClass}
            value={selectedSensitivity}
            onChange={(event) => setSelectedSensitivity(event.target.value)}
          >
            <option value="">All levels</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">Confidential</option>
            <option value="critical">Critical</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Approval</span>
          <select
            className={inputClass}
            value={selectedApproval}
            onChange={(event) => setSelectedApproval(event.target.value)}
          >
            <option value="">All</option>
            <option value="required">Approval required</option>
            <option value="none">No approval</option>
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

      {pendingRequests.length > 0 && (
        <section className="panel shrink-0 p-4">
          <h3 className="mb-3 text-sm font-extrabold text-slate-900">Pending critical download approvals</h3>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-2">
                <div className="text-sm">
                  <span className="font-bold text-slate-800">{request.username}</span>
                  {" requested download of "}
                  <span className="font-bold text-slate-800">{request.document_title}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => reviewRequest(request, "approve")}
                    className="rounded-sm bg-[#7c4dff] px-3 py-1.5 text-xs font-extrabold text-white hover:bg-[#6d28d9]"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewRequest(request, "deny")}
                    className="rounded-sm border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Deny
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        open={showCreateForm}
        onClose={closeCreateModal}
        title="Register Legacy Sensitive Path"
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
              form="register-sensitive-file-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Register file"}
            </button>
          </>
        )}
      >
        <form id="register-sensitive-file-form" onSubmit={createFile}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fileFields(form, setForm)}
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={closeEditModal}
        title="Edit Sensitive File"
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
              form="edit-sensitive-file-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </>
        )}
      >
        <form id="edit-sensitive-file-form" onSubmit={saveEdit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fileFields(editForm, setEditForm)}
          </div>
        </form>
      </Modal>

      <div className="pm-table-stack">
        <DataTable
          fill
          columns={[
            { key: "name", label: "Name" },
            {
              key: "source",
              label: "Source",
              render: (row) => (
                <span className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {row.source === "document_repository" ? "Document Repo" : "Legacy path"}
                </span>
              )
            },
            {
              key: "document_title",
              label: "Linked document",
              render: (row) => row.document_title || "—"
            },
            { key: "path", label: "Path", render: (row) => (
              <span className="block max-w-[200px] truncate font-semibold text-slate-700" title={row.path}>
                {row.path}
              </span>
            ) },
            { key: "owner_department", label: "Department", render: (row) => row.owner_department || "—" },
            {
              key: "sensitivity",
              label: "Sensitivity",
              align: "right",
              render: (row) => (
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${SENSITIVITY_TONES[row.sensitivity] || SENSITIVITY_TONES.medium}`}>
                  {SENSITIVITY_LABELS[row.sensitivity] || row.sensitivity || "Medium"}
                </span>
              )
            },
            {
              key: "allowed_role_names",
              label: "Access",
              render: (row) => row.allowed_role_names?.join(", ") || "Restricted"
            },
            {
              key: "requires_approval",
              label: "Approval",
              render: (row) => (
                <span className={`pm-status ${row.requires_approval ? "pm-status-archived" : ""}`}>
                  {row.requires_approval ? "Required" : "Not required"}
                </span>
              )
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="pm-row-actions">
                  {row.source !== "document_repository" && (
                    <button type="button" title="Edit" onClick={() => startEdit(row)}><Pencil size={14} /></button>
                  )}
                  <button type="button" title="Delete" onClick={() => deleteFile(row)}><Trash2 size={14} /></button>
                </div>
              )
            }
          ]}
          rows={filteredFiles}
          empty="No sensitive files match the current filters"
        />
        <div className="pm-footer">
          Showing {filteredFiles.length ? 1 : 0}-{filteredFiles.length} of {files.length} files
        </div>
      </div>
    </div>
  );
}
