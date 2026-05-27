import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import api from "../api/client";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import PermissionsCatalogPanel from "../components/PermissionsCatalogPanel";
import RolesPermissionsPanel from "../components/RolesPermissionsPanel";
import Toast from "../components/Toast";
import { Field, inputClass } from "../components/FormSection";

const TABS = [
  { id: "users", label: "Users" },
  { id: "roles", label: "Roles" },
  { id: "permissions", label: "Permissions" }
];

const emptyForm = {
  username: "",
  email: "",
  password: "",
  role: "",
  department: "",
  job_title: "",
  is_active: true
};

function formatRole(name) {
  return (name || "").replaceAll("_", " ");
}

function roleLabel(role) {
  return role?.label || formatRole(role?.name);
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

export default function UserManagement() {
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateRoleForm, setShowCreateRoleForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);

  function loadUsers() {
    return api.get("/users/")
      .then((response) => setUsers(response.data.results || response.data))
      .catch(() => setUsers([]));
  }

  useEffect(() => {
    loadUsers();
    api.get("/roles/")
      .then((response) => setRoles(response.data.results || response.data))
      .catch(() => setRoles([]));
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const roleMatches = !selectedRole || String(user.role) === String(selectedRole);
      const statusMatches = !selectedStatus
        || (selectedStatus === "active" && user.is_active)
        || (selectedStatus === "inactive" && !user.is_active);
      const haystack = [
        user.username,
        user.email,
        user.role_name,
        user.role_label,
        user.department,
        user.job_title
      ].filter(Boolean).join(" ").toLowerCase();

      return roleMatches && statusMatches && (!term || haystack.includes(term));
    });
  }, [users, search, selectedRole, selectedStatus]);

  function resetFilters() {
    setSearch("");
    setSelectedRole("");
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

  function startEdit(user) {
    setShowCreateForm(false);
    setEditingId(user.id);
    setEditForm({
      username: user.username,
      email: user.email || "",
      password: "",
      role: user.role ? String(user.role) : "",
      department: user.department || "",
      job_title: user.job_title || "",
      is_active: user.is_active !== false
    });
  }

  function selectedRolePermissions(roleId) {
    const role = roles.find((item) => String(item.id) === String(roleId));
    return role?.permission_labels || [];
  }

  function roleField(formState, setFormState) {
    const granted = selectedRolePermissions(formState.role);
    return (
      <Field label="Role & permissions">
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              type="button"
              key={role.id}
              onClick={() => setFormState({ ...formState, role: String(role.id) })}
              className={`rounded-sm border px-3 py-2 text-xs font-extrabold ${
                String(formState.role) === String(role.id)
                  ? "border-[#7c4dff] bg-[#7c4dff] text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {roleLabel(role)}
            </button>
          ))}
        </div>
        {granted.length > 0 && (
          <div className="mt-3 rounded-sm border border-violet-100 bg-violet-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-violet-800">Permissions granted</p>
            <div className="flex flex-wrap gap-1.5">
              {granted.map((label) => (
                <span key={label} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-violet-800">
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}
        <p className="mt-2 text-xs font-medium text-slate-500">
          Assign a role to control what this user can access. Edit permissions on the Roles or Permissions tab.
        </p>
      </Field>
    );
  }

  async function createUser(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/users/", {
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role || null,
        department: form.department,
        job_title: form.job_title,
        is_active: form.is_active
      });
      closeCreateModal();
      await loadUsers();
      showToast("User created successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to create user."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        email: editForm.email,
        role: editForm.role || null,
        department: editForm.department,
        job_title: editForm.job_title,
        is_active: editForm.is_active
      };
      if (editForm.password) payload.password = editForm.password;

      await api.patch(`/users/${editingId}/`, payload);
      closeEditModal();
      await loadUsers();
      showToast("User updated successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to update user."), "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Delete user "${user.username}"?`)) return;
    try {
      await api.delete(`/users/${user.id}/`);
      await loadUsers();
      showToast("User deleted successfully.", "success");
    } catch (error) {
      showToast(apiErrorMessage(error, "Failed to delete user."), "error");
    }
  }

  return (
    <div className="page-fill">
      <div className="flex shrink-0 items-end justify-between gap-4">
        <div>
          <h2 className="page-title">Users</h2>
          <p className="muted">Manage accounts, roles, and access permissions.</p>
        </div>
        {activeTab === "users" && (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-[#7c4dff] bg-[#7c4dff] px-3 py-2 text-sm font-bold text-white hover:bg-[#6b3fe8]"
          >
            <Plus size={16} />
            Create user
          </button>
        )}
        {activeTab === "roles" && (
          <button
            type="button"
            onClick={() => setShowCreateRoleForm(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-[#7c4dff] bg-[#7c4dff] px-3 py-2 text-sm font-bold text-white hover:bg-[#6b3fe8]"
          >
            <Plus size={16} />
            Create role
          </button>
        )}
      </div>

      <nav className="page-tabs-bar" aria-label="Users sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "page-tabs__btn page-tabs__btn--active" : "page-tabs__btn"}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <Toast open={Boolean(toast)} message={toast?.message} type={toast?.type} onClose={dismissToast} />

      <div className="page-tab-body">
        {activeTab === "roles" && (
          <RolesPermissionsPanel
            embedded
            createOpen={showCreateRoleForm}
            onCreateOpenChange={setShowCreateRoleForm}
            onToast={showToast}
          />
        )}
        {activeTab === "permissions" && <PermissionsCatalogPanel />}
        {activeTab === "users" && (
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
                    placeholder="Username, email, department..."
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Role</span>
                <select className={inputClass} value={selectedRole} onChange={(event) => setSelectedRole(event.target.value)}>
                  <option value="">All roles</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{roleLabel(role)}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Status</span>
                <select className={inputClass} value={selectedStatus} onChange={(event) => setSelectedStatus(event.target.value)}>
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

            <div className="pm-table-stack">
              <DataTable
                fill
                columns={[
                  {
                    key: "username",
                    label: "Username",
                    render: (row) => <span className="font-bold text-slate-800">{row.username}</span>
                  },
                  {
                    key: "email",
                    label: "Email",
                    render: (row) => row.email || "—"
                  },
                  {
                    key: "role_name",
                    label: "Role",
                    render: (row) => (
                      <span className="inline-flex rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-800">
                        {row.role_label || formatRole(row.role_name) || "Unassigned"}
                      </span>
                    )
                  },
                  { key: "department", label: "Department", render: (row) => row.department || "—" },
                  { key: "job_title", label: "Job title", render: (row) => row.job_title || "—" },
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
                        <button type="button" title="Delete" onClick={() => deleteUser(row)}><Trash2 size={14} /></button>
                      </div>
                    )
                  }
                ]}
                rows={filteredUsers}
                empty="No users match the current filters"
              />
              <div className="pm-footer">
                Showing {filteredUsers.length ? 1 : 0}-{filteredUsers.length} of {users.length} users
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        open={showCreateForm}
        onClose={closeCreateModal}
        title="Create User"
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
              form="create-user-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Creating..." : "Create user"}
            </button>
          </>
        )}
      >
        <form id="create-user-form" onSubmit={createUser}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Username">
              <input
                className={inputClass}
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value })}
                required
              />
            </Field>
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                required
              />
            </Field>
            <Field label="Department">
              <input
                className={inputClass}
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
              />
            </Field>
            <Field label="Job title">
              <input
                className={inputClass}
                value={form.job_title}
                onChange={(event) => setForm({ ...form, job_title: event.target.value })}
              />
            </Field>
            <Field label="Account status">
              <label className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                />
                Active account
              </label>
            </Field>
            <div className="sm:col-span-2">{roleField(form, setForm)}</div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editingId)}
        onClose={closeEditModal}
        title="Edit User"
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
              form="edit-user-form"
              disabled={saving}
              className="rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </>
        )}
      >
        <form id="edit-user-form" onSubmit={saveEdit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Username">
              <input className={`${inputClass} bg-slate-50`} value={editForm.username} readOnly />
            </Field>
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
              />
            </Field>
            <Field label="New password">
              <input
                className={inputClass}
                type="password"
                value={editForm.password}
                onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
                placeholder="Leave blank to keep current"
              />
            </Field>
            <Field label="Department">
              <input
                className={inputClass}
                value={editForm.department}
                onChange={(event) => setEditForm({ ...editForm, department: event.target.value })}
              />
            </Field>
            <Field label="Job title">
              <input
                className={inputClass}
                value={editForm.job_title}
                onChange={(event) => setEditForm({ ...editForm, job_title: event.target.value })}
              />
            </Field>
            <Field label="Account status">
              <label className="flex h-10 items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(event) => setEditForm({ ...editForm, is_active: event.target.checked })}
                />
                Active account
              </label>
            </Field>
            <div className="sm:col-span-2">{roleField(editForm, setEditForm)}</div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
