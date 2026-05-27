import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Shield, Trash2 } from "lucide-react";
import api from "../api/client";
import DataTable from "./DataTable";
import Modal from "./Modal";
import { Field, inputClass } from "./FormSection";

const emptyRoleForm = {
  name: "",
  label: "",
  description: "",
  permission_ids: []
};

function formatRoleName(name) {
  return (name || "").replaceAll("_", " ");
}

function roleTitle(role) {
  return role?.label || formatRoleName(role?.name);
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

export default function RolesPermissionsPanel({
  onToast,
  embedded = false,
  createOpen = false,
  onCreateOpenChange
}) {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedUsers, setSelectedUsers] = useState("");
  const [internalCreateOpen, setInternalCreateOpen] = useState(false);
  const showCreateForm = embedded ? createOpen : internalCreateOpen;
  const setShowCreateForm = embedded ? onCreateOpenChange : setInternalCreateOpen;
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyRoleForm);
  const [editForm, setEditForm] = useState(emptyRoleForm);
  const [saving, setSaving] = useState(false);

  function loadRoles() {
    return api.get("/roles/")
      .then((response) => setRoles(response.data.results || response.data))
      .catch(() => setRoles([]));
  }

  useEffect(() => {
    loadRoles();
    api.get("/permissions/")
      .then((response) => setPermissions(response.data.results || response.data))
      .catch(() => setPermissions([]));
  }, []);

  const permissionsByModule = useMemo(() => {
    return permissions.reduce((groups, permission) => {
      const moduleName = permission.module || "Other";
      groups[moduleName] = [...(groups[moduleName] || []), permission];
      return groups;
    }, {});
  }, [permissions]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roles.filter((role) => {
      const typeMatches = !selectedType
        || (selectedType === "system" && role.is_system)
        || (selectedType === "custom" && !role.is_system);
      const userCount = role.user_count ?? 0;
      const usersMatches = !selectedUsers
        || (selectedUsers === "assigned" && userCount > 0)
        || (selectedUsers === "unassigned" && userCount === 0);
      const haystack = [
        role.name,
        role.label,
        role.description,
        ...(role.permission_labels || [])
      ].filter(Boolean).join(" ").toLowerCase();
      return typeMatches && usersMatches && (!term || haystack.includes(term));
    });
  }, [roles, search, selectedType, selectedUsers]);

  function resetFilters() {
    setSearch("");
    setSelectedType("");
    setSelectedUsers("");
  }

  function closeCreateModal() {
    setShowCreateForm?.(false);
    setForm(emptyRoleForm);
  }

  function closeEditModal() {
    setEditingId(null);
    setEditForm(emptyRoleForm);
  }

  function startEdit(role) {
    setShowCreateForm(false);
    setEditingId(role.id);
    setEditForm({
      name: role.name,
      label: role.label || "",
      description: role.description || "",
      permission_ids: (role.permission_ids || []).map(Number),
      is_system: role.is_system
    });
  }

  function togglePermission(formState, setFormState, permissionId) {
    const id = Number(permissionId);
    const ids = formState.permission_ids.map(Number);
    const exists = ids.includes(id);
    setFormState({
      ...formState,
      permission_ids: exists
        ? ids.filter((value) => value !== id)
        : [...ids, id]
    });
  }

  function permissionFields(formState, setFormState) {
    return (
      <Field label="Permissions">
        <div className="space-y-4">
          {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
            <div key={moduleName}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{moduleName}</p>
              <div className="flex flex-wrap gap-2">
                {modulePermissions.map((permission) => (
                  <button
                    type="button"
                    key={permission.id}
                    onClick={() => togglePermission(formState, setFormState, permission.id)}
                    className={`rounded-sm border px-3 py-2 text-xs font-extrabold ${
                      formState.permission_ids.map(Number).includes(Number(permission.id))
                        ? "border-[#7c4dff] bg-[#7c4dff] text-white"
                        : "border-slate-300 bg-white text-slate-700"
                    }`}
                  >
                    {permission.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs font-medium text-slate-500">
          Select what users with this role can access across the application.
        </p>
      </Field>
    );
  }

  async function createRole(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/roles/", form);
      closeCreateModal();
      await loadRoles();
      onToast?.("Role created successfully.", "success");
    } catch (error) {
      onToast?.(apiErrorMessage(error, "Failed to create role."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        label: editForm.label,
        description: editForm.description,
        permission_ids: editForm.permission_ids
      };
      if (!editForm.is_system) payload.name = editForm.name;
      await api.patch(`/roles/${editingId}/`, payload);
      closeEditModal();
      await loadRoles();
      onToast?.("Role updated successfully.", "success");
    } catch (error) {
      onToast?.(apiErrorMessage(error, "Failed to update role."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role) {
    if (!window.confirm(`Delete role "${roleTitle(role)}"?`)) return;
    try {
      await api.delete(`/roles/${role.id}/`);
      await loadRoles();
      onToast?.("Role deleted successfully.", "success");
    } catch (error) {
      onToast?.(apiErrorMessage(error, "Failed to delete role."), "error");
    }
  }


  const body = (
    <>
      <section className="panel grid shrink-0 gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_160px_160px_auto] md:items-end">
        <label className="block min-w-0">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Search</span>
          <div className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3">
            <Search size={16} className="shrink-0 text-slate-400" />
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Role name, permission..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Type</span>
          <select className={inputClass} value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
            <option value="">All types</option>
            <option value="system">System</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Users</span>
          <select className={inputClass} value={selectedUsers} onChange={(event) => setSelectedUsers(event.target.value)}>
            <option value="">All roles</option>
            <option value="assigned">Has users</option>
            <option value="unassigned">No users</option>
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

      <Modal
        open={showCreateForm}
        onClose={closeCreateModal}
        title="Create Role"
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
              form="create-role-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create role"}
            </button>
          </>
        )}
      >
        <form id="create-role-form" onSubmit={createRole}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role key">
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="e.g. auditor"
                required
              />
            </Field>
            <Field label="Display name">
              <input
                className={inputClass}
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
                placeholder="e.g. Auditor"
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  className={`${inputClass} min-h-[80px] py-2`}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">{permissionFields(form, setForm)}</div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={closeEditModal}
        title="Edit Role"
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
              form="edit-role-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </>
        )}
      >
        <form id="edit-role-form" onSubmit={saveEdit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Role key">
              <input
                className={`${inputClass} ${editForm.is_system ? "bg-slate-50" : ""}`}
                value={editForm.name}
                onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                readOnly={editForm.is_system}
              />
            </Field>
            <Field label="Display name">
              <input
                className={inputClass}
                value={editForm.label}
                onChange={(event) => setEditForm({ ...editForm, label: event.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  className={`${inputClass} min-h-[80px] py-2`}
                  value={editForm.description}
                  onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">{permissionFields(editForm, setEditForm)}</div>
          </div>
        </form>
      </Modal>

      <div className="pm-table-stack">
        <DataTable
          fill
          columns={[
            {
              key: "name",
              label: "Role",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-violet-600" />
                  <span className="font-bold text-slate-800">{roleTitle(row)}</span>
                  {row.is_system && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                      System
                    </span>
                  )}
                </div>
              )
            },
            { key: "description", label: "Description", render: (row) => row.description || "—" },
            {
              key: "permission_labels",
              label: "Permissions",
              render: (row) => (
                <span className="text-xs font-semibold text-slate-600">
                  {(row.permission_labels || []).length
                    ? row.permission_labels.join(", ")
                    : "None assigned"}
                </span>
              )
            },
            {
              key: "user_count",
              label: "Users",
              align: "right",
              render: (row) => row.user_count ?? 0
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="pm-row-actions">
                  <button type="button" title="Edit" onClick={() => startEdit(row)}><Pencil size={14} /></button>
                  {!row.is_system && (
                    <button type="button" title="Delete" onClick={() => deleteRole(row)}><Trash2 size={14} /></button>
                  )}
                </div>
              )
            }
          ]}
          rows={filteredRoles}
          empty="No roles match the current filters"
        />
        <div className="pm-footer">
          Showing {filteredRoles.length ? 1 : 0}-{filteredRoles.length} of {roles.length} roles
        </div>
      </div>
    </>
  );

  if (embedded) {
    return body;
  }

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Roles &amp; permissions</h2>
          <p className="muted">Define roles and control what each role can access in the system.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-[#7c4dff] bg-[#7c4dff] px-3 py-2 text-sm font-bold text-white hover:bg-[#6b3fe8]"
        >
          <Plus size={16} />
          Create role
        </button>
      </div>
      {body}
    </div>
  );
}
