import { useEffect, useMemo, useState } from "react";
import { KeyRound, Search } from "lucide-react";
import api from "../api/client";
import DataTable from "./DataTable";
import { inputClass } from "./FormSection";

export default function PermissionsCatalogPanel() {
  const [permissions, setPermissions] = useState([]);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");

  useEffect(() => {
    api.get("/permissions/")
      .then((response) => setPermissions(response.data.results || response.data))
      .catch(() => setPermissions([]));
  }, []);

  const modules = useMemo(() => {
    const names = [...new Set(permissions.map((item) => item.module).filter(Boolean))];
    return names.sort();
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return permissions.filter((permission) => {
      const moduleMatches = !moduleFilter || permission.module === moduleFilter;
      const assigned = (permission.assigned_roles || []).length > 0;
      const assignedMatches = !assignedFilter
        || (assignedFilter === "assigned" && assigned)
        || (assignedFilter === "unassigned" && !assigned);
      const haystack = [
        permission.codename,
        permission.label,
        permission.module,
        ...(permission.assigned_roles || [])
      ].filter(Boolean).join(" ").toLowerCase();
      return moduleMatches && assignedMatches && (!term || haystack.includes(term));
    });
  }, [permissions, search, moduleFilter, assignedFilter]);

  function resetFilters() {
    setSearch("");
    setModuleFilter("");
    setAssignedFilter("");
  }

  return (
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
              placeholder="Permission name, codename, role..."
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Module</span>
          <select className={inputClass} value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
            <option value="">All modules</option>
            {modules.map((moduleName) => (
              <option key={moduleName} value={moduleName}>{moduleName}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">Assignment</span>
          <select className={inputClass} value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}>
            <option value="">All</option>
            <option value="assigned">Assigned to role</option>
            <option value="unassigned">Unassigned</option>
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
              key: "label",
              label: "Permission",
              render: (row) => (
                <div className="flex items-center gap-2">
                  <KeyRound size={14} className="shrink-0 text-violet-600" />
                  <span className="font-bold text-slate-800">{row.label}</span>
                </div>
              )
            },
            {
              key: "module",
              label: "Module",
              render: (row) => (
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                  {row.module}
                </span>
              )
            },
            {
              key: "codename",
              label: "Codename",
              render: (row) => (
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-700">
                  {row.codename}
                </code>
              )
            },
            {
              key: "assigned_roles",
              label: "Assigned to roles",
              render: (row) => (
                <span className="text-xs font-semibold text-slate-600">
                  {(row.assigned_roles || []).length
                    ? row.assigned_roles.join(", ")
                    : "Not assigned"}
                </span>
              )
            }
          ]}
          rows={filteredPermissions}
          empty="No permissions match the current filters"
        />
        <div className="pm-footer">
          Showing {filteredPermissions.length ? 1 : 0}-{filteredPermissions.length} of {permissions.length} permissions
        </div>
      </div>
    </>
  );
}
