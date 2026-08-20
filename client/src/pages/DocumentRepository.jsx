import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Download, Eye, List, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import FormSection, { Field, inputClass } from "../components/FormSection";
import Modal from "../components/Modal";
import Toast from "../components/Toast";

const emptyForm = {
  title: "",
  description: "",
  category: "",
  sensitivity: "medium",
  version: "",
  allowed_roles: [],
  requires_approval: false,
  file: null
};

const SENSITIVITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "Confidential",
  critical: "Critical"
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

export default function DocumentRepository() {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [reauthTarget, setReauthTarget] = useState(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthBusy, setReauthBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  function loadDocuments() {
    api.get("/documents/")
      .then((response) => setDocuments(response.data.results || response.data))
      .catch(() => setDocuments([]));
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    api.get("/document-categories/")
      .then((response) => setCategories(response.data.results || response.data))
      .catch(() => setCategories([]));
    api.get("/roles/")
      .then((response) => setRoles(response.data.results || response.data))
      .catch(() => setRoles([]));
  }, []);

  const filteredDocuments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return documents.filter((document) => {
      const categoryMatches = !selectedCategory || String(document.category) === String(selectedCategory);
      const statusMatches = !selectedStatus || document.status === selectedStatus;
      const haystack = [
        document.title,
        document.file_name,
        document.category_name,
        document.version,
        document.status
      ].filter(Boolean).join(" ").toLowerCase();

      return categoryMatches && statusMatches && (!term || haystack.includes(term));
    });
  }, [documents, search, selectedCategory, selectedStatus]);

  function resetFilters() {
    setSearch("");
    setSelectedCategory("");
    setSelectedStatus("");
  }

  function toggleRole(state, setter, roleId) {
    const exists = state.allowed_roles.includes(roleId);
    setter({
      ...state,
      allowed_roles: exists ? state.allowed_roles.filter((id) => id !== roleId) : [...state.allowed_roles, roleId]
    });
  }

  function asFormData(values, includeFile = true) {
    const payload = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (key === "file" && (!includeFile || !value)) return;
      if (key === "allowed_roles") {
        value.forEach((roleId) => payload.append("allowed_roles", roleId));
        return;
      }
      if (key === "requires_approval") {
        payload.append(key, value ? "true" : "false");
        return;
      }
      payload.append(key, value ?? "");
    });
    return payload;
  }

  function showToast(message, type) {
    setToast({ message, type });
  }

  function dismissToast() {
    setToast(null);
  }

  function updateSensitivity(state, setter, value) {
    setter({
      ...state,
      sensitivity: value,
      requires_approval: value === "critical" ? true : state.requires_approval
    });
  }

  async function uploadDocument(event) {
    event.preventDefault();
    setUploading(true);
    try {
      await api.post("/documents/", asFormData(form));
      setForm(emptyForm);
      setShowUploadForm(false);
      event.target.reset();
      loadDocuments();
      const synced = ["high", "critical"].includes(form.sensitivity);
      showToast(
        synced
          ? "Document uploaded and registered in Sensitive Files."
          : "Document uploaded successfully.",
        "success"
      );
    } catch (error) {
      showToast(apiErrorMessage(error, "Upload failed. Please try again."), "error");
    } finally {
      setUploading(false);
    }
  }

  function startEdit(document) {
    setEditingId(document.id);
    setShowUploadForm(false);
    setEditForm({
      title: document.title,
      description: document.description || "",
      category: document.category,
      sensitivity: document.sensitivity,
      version: document.version || "",
      allowed_roles: document.allowed_roles || [],
      requires_approval: Boolean(document.requires_approval),
      file: null
    });
  }

  async function saveEdit(event) {
    event.preventDefault();
    try {
      await api.patch(`/documents/${editingId}/`, asFormData(editForm, false));
      setEditingId(null);
      setEditForm(emptyForm);
      loadDocuments();
      showToast("Document updated successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to update document."), "error");
    }
  }

  async function archiveDocument(document) {
    try {
      await api.post(`/documents/${document.id}/archive/`);
      loadDocuments();
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to archive document."), "error");
    }
  }

  async function deleteDocument(document) {
    try {
      await api.delete(`/documents/${document.id}/`);
      loadDocuments();
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to delete document."), "error");
    }
  }

  async function requestApproval(document) {
    try {
      await api.post(`/documents/${document.id}/request-download-approval/`);
      loadDocuments();
      showToast("Download approval requested. An admin must approve before download.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to request approval."), "error");
    }
  }

  function openReauth(document, action) {
    setReauthTarget(document);
    setPendingAction(action);
    setReauthPassword("");
  }

  async function completeProtectedAction(document, action, reauthToken) {
    const headers = reauthToken ? { "X-Document-Reauth": reauthToken } : {};
    if (action === "view") {
      const response = await api.get(`/documents/${document.id}/`, { headers });
      setSelectedDocument(response.data);
      return;
    }
    const response = await api.get(`/documents/${document.id}/download/`, {
      responseType: "blob",
      headers
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = window.document.createElement("a");
    link.href = url;
    link.setAttribute("download", document.file_name || `${document.title}.download`);
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    showToast("Download started.", "success");
  }

  async function handleDocumentAction(document, action) {
    try {
      if (
        action === "download"
        && document.requires_approval
        && document.sensitivity === "critical"
        && document.download_approval_status !== "approved"
        && document.download_approval_status !== "not_required"
      ) {
        if (document.download_approval_status === "pending") {
          showToast("Download approval is still pending admin review.", "error");
          return;
        }
        await requestApproval(document);
        return;
      }

      if (document.requires_reauth || document.sensitivity === "critical") {
        openReauth(document, action);
        return;
      }

      await completeProtectedAction(document, action);
    } catch (error) {
      const code = error?.response?.data?.code;
      if (code === "reauth_required") {
        openReauth(document, action);
        return;
      }
      if (code === "approval_required") {
        await requestApproval(document);
        return;
      }
      showToast(apiErrorMessage(error, "Action failed."), "error");
    }
  }

  async function submitReauth(event) {
    event.preventDefault();
    if (!reauthTarget || !pendingAction) return;
    setReauthBusy(true);
    try {
      const response = await api.post(`/documents/${reauthTarget.id}/reauthenticate/`, {
        password: reauthPassword
      });
      const token = response.data.reauth_token;
      setReauthTarget(null);
      setReauthPassword("");
      await completeProtectedAction(reauthTarget, pendingAction, token);
      setPendingAction(null);
    } catch (error) {
      showToast(apiErrorMessage(error, "Re-authentication failed."), "error");
    } finally {
      setReauthBusy(false);
    }
  }

  function closeUploadModal() {
    setShowUploadForm(false);
    setForm(emptyForm);
  }

  function closePanels() {
    closeUploadModal();
    setEditingId(null);
    setSelectedDocument(null);
  }

  function accessLabel(row) {
    if (row.allowed_role_names?.length) return row.allowed_role_names.join(", ");
    return "Restricted (admin only)";
  }

  function approvalLabel(row) {
    if (row.download_approval_status === "not_required") return "—";
    if (row.download_approval_status === "approved") return "Approved";
    if (row.download_approval_status === "pending") return "Pending approval";
    if (row.download_approval_status === "denied") return "Denied";
    if (row.requires_approval && row.sensitivity === "critical") return "Approval required";
    return "—";
  }

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Document Repository</h2>
          <p className="muted">Role-based document access with monitoring for confidential and critical files.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            to="/documents/activity-history"
            className="inline-flex items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <List size={16} />
            Activity history
          </Link>
          <button
            type="button"
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center gap-2 rounded-sm border border-[#7c4dff] bg-[#7c4dff] px-3 py-2 text-sm font-bold text-white hover:bg-[#6b3fe8]"
          >
            <Plus size={16} />
            Upload document
          </button>
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
              placeholder="Title, file name, version..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Category</span>
          <select className={inputClass} value={selectedCategory} onChange={(event) => setSelectedCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
          <select className={inputClass} value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
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
        open={showUploadForm}
        onClose={closeUploadModal}
        title="Upload Document"
        maxWidth="max-w-3xl"
        footer={(
          <>
            <button
              type="button"
              onClick={closeUploadModal}
              disabled={uploading}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="upload-document-form"
              disabled={uploading}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {uploading ? "Uploading..." : "Upload document"}
            </button>
          </>
        )}
      >
        <form id="upload-document-form" onSubmit={uploadDocument}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input className={inputClass} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required>
                <option value="">Select category</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Sensitivity">
              <select className={inputClass} value={form.sensitivity} onChange={(event) => updateSensitivity(form, setForm, event.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">Confidential</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Version">
              <input className={inputClass} value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} placeholder="v1.0" />
            </Field>
            <Field label="Document File">
              <input className={inputClass} type="file" onChange={(event) => setForm({ ...form, file: event.target.files[0] })} required />
            </Field>
            <Field label="Critical download approval">
              <label className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.requires_approval}
                  onChange={(event) => setForm({ ...form, requires_approval: event.target.checked })}
                />
                Require admin approval to download
              </label>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea className={inputClass} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Authorized roles (leave empty for admin-only / restricted)">
                <div className="flex flex-wrap gap-2">
                  {roles.map((role) => (
                    <button type="button" key={role.id} onClick={() => toggleRole(form, setForm, role.id)} className={`rounded-sm border px-3 py-2 text-xs font-extrabold ${form.allowed_roles.includes(role.id) ? "border-[#7c4dff] bg-[#7c4dff] text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                      {(role.label || role.name).replaceAll("_", " ")}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">Confidential or Critical uploads are automatically added to Sensitive Files.</p>
              </Field>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(reauthTarget)}
        onClose={() => { setReauthTarget(null); setPendingAction(null); setReauthPassword(""); }}
        title="Re-authenticate"
        maxWidth="max-w-md"
        footer={(
          <>
            <button
              type="button"
              onClick={() => { setReauthTarget(null); setPendingAction(null); setReauthPassword(""); }}
              className="rounded-sm border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="document-reauth-form"
              disabled={reauthBusy}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {reauthBusy ? "Verifying..." : "Confirm"}
            </button>
          </>
        )}
      >
        <form id="document-reauth-form" onSubmit={submitReauth} className="space-y-3">
          <p className="text-sm text-slate-600">
            <strong>{reauthTarget?.title}</strong> is critical. Enter your password again to continue.
          </p>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              value={reauthPassword}
              onChange={(event) => setReauthPassword(event.target.value)}
              required
              autoFocus
            />
          </Field>
        </form>
      </Modal>

      {editingId && (
        <div className="max-h-[35vh] shrink-0 overflow-y-auto">
          <FormSection title="Edit Document Details" onSubmit={saveEdit} actionLabel="Save changes">
            <Field label="Title">
              <input className={inputClass} value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} required />
            </Field>
            <Field label="Category">
              <select className={inputClass} value={editForm.category} onChange={(event) => setEditForm({ ...editForm, category: event.target.value })} required>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Sensitivity">
              <select className={inputClass} value={editForm.sensitivity} onChange={(event) => updateSensitivity(editForm, setEditForm, event.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">Confidential</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Version">
              <input className={inputClass} value={editForm.version} onChange={(event) => setEditForm({ ...editForm, version: event.target.value })} />
            </Field>
            <Field label="Critical download approval">
              <label className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.requires_approval}
                  onChange={(event) => setEditForm({ ...editForm, requires_approval: event.target.checked })}
                />
                Require admin approval to download
              </label>
            </Field>
            <Field label="Description">
              <textarea className={inputClass} value={editForm.description} onChange={(event) => setEditForm({ ...editForm, description: event.target.value })} />
            </Field>
            <Field label="Authorized roles">
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => (
                  <button type="button" key={role.id} onClick={() => toggleRole(editForm, setEditForm, role.id)} className={`rounded-sm border px-3 py-2 text-xs font-extrabold ${editForm.allowed_roles.includes(role.id) ? "border-[#7c4dff] bg-[#7c4dff] text-white" : "border-slate-300 bg-white text-slate-700"}`}>
                    {(role.label || role.name).replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </Field>
          </FormSection>
        </div>
      )}

      {selectedDocument && (
        <section className="panel shrink-0 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{selectedDocument.title}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">{selectedDocument.category_name} - {selectedDocument.file_name}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {SENSITIVITY_LABELS[selectedDocument.sensitivity] || selectedDocument.sensitivity}
              </p>
              <p className="mt-3 text-sm text-slate-700">{selectedDocument.description || "No description provided."}</p>
            </div>
            <button onClick={() => setSelectedDocument(null)} className="rounded-sm border border-slate-300 px-3 py-1 text-xs font-extrabold text-slate-700">
              Close
            </button>
          </div>
        </section>
      )}

      <div className="pm-table-stack">
        <DataTable
          columns={[
            { key: "title", label: "Title" },
            { key: "category_name", label: "Category", render: (row) => row.category_name || "Uncategorized" },
            {
              key: "sensitivity",
              label: "Sensitivity",
              render: (row) => SENSITIVITY_LABELS[row.sensitivity] || row.sensitivity || "Medium"
            },
            { key: "version", label: "Version", render: (row) => row.version || row.file_name || `DOC${row.id}` },
            { key: "allowed_role_names", label: "Access", render: (row) => accessLabel(row) },
            { key: "download_approval_status", label: "Download gate", render: (row) => approvalLabel(row) },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <span className={`pm-status ${row.status === "archived" ? "pm-status-archived" : ""}`}>
                  {row.status === "archived" ? "Archived" : "Active"}
                </span>
              )
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="pm-row-actions">
                  <button type="button" title="View" onClick={() => handleDocumentAction(row, "view")}><Eye size={14} /></button>
                  <button type="button" title="Edit" onClick={() => startEdit(row)}><Pencil size={14} /></button>
                  <button type="button" title="Download" onClick={() => handleDocumentAction(row, "download")}><Download size={14} /></button>
                  <button type="button" title="Archive" onClick={() => archiveDocument(row)}><Archive size={14} /></button>
                  <button type="button" title="Delete" onClick={() => deleteDocument(row)}><Trash2 size={14} /></button>
                </div>
              )
            }
          ]}
          rows={filteredDocuments}
          fill
          empty="No authorized documents match the current filters"
        />

        <div className="pm-footer">
          Showing {filteredDocuments.length ? 1 : 0}-{filteredDocuments.length} of {documents.length}
        </div>
      </div>

      {(editingId || selectedDocument) && (
        <button type="button" onClick={closePanels} className="fixed bottom-5 right-5 hidden rounded-full bg-slate-900 p-3 text-white shadow-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7c4dff] xl:inline-flex" title="Close open panels">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
