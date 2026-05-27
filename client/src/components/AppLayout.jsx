import {
  Bell,
  LayoutDashboard,
  Database,
  FileText,
  Files,
  Lock,
  LogOut,
  Menu,
  Settings,
  Users,
  X
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { userHasPermission } from "../utils/access";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Dashboard", permission: "view_dashboard" },
  { to: "/activity-logs", label: "Activity Logs", icon: Database, group: "Monitoring", permission: "view_activity_logs" },
  { to: "/sensitive-files", label: "Sensitive Files", icon: Lock, group: "Protection", permission: "manage_sensitive_files" },
  { to: "/documents", label: "Document Repo", icon: Files, group: "Protection", permission: "manage_documents" },
  { to: "/alerts", label: "Alerts", icon: Bell, group: "Response", permission: "manage_alerts" },
  { to: "/reports", label: "Incident Reports", icon: FileText, group: "Response", permission: "manage_reports" },
  { to: "/users", label: "Users", icon: Users, group: "System", permissions: ["manage_users", "manage_roles"] },
  { to: "/settings", label: "Configurations", icon: Settings, group: "System", permission: "manage_settings" }
];

function canSeeNavLink(user, link) {
  if (link.permissions?.length) {
    return link.permissions.some((codename) => userHasPermission(user, codename));
  }
  if (link.permission) return userHasPermission(user, link.permission);
  return true;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const role = user?.role_name;
  const visibleLinks = links.filter((link) => canSeeNavLink(user, link));
  const groupedLinks = visibleLinks.reduce((groups, link) => {
    groups[link.group] = [...(groups[link.group] || []), link];
    return groups;
  }, {});
  const initials = (user?.username || "U").slice(0, 1).toUpperCase();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gray-200 text-sm xl:pl-64">
      <nav className="relative z-10 flex-shrink-0 border-b border-[#2b1b62] bg-[#2b1b62] text-white shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-3 lg:px-4">
          <div className="flex items-center gap-3 xl:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-[#7c4dff] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              aria-label="Open main menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold text-white sm:text-xl lg:text-2xl">
            Data Leakage Prevention
          </h2>

          <div className="flex items-center space-x-4">
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenuOpen((open) => !open)}
                className="flex rounded-full bg-[#7c4dff] text-sm focus:ring-4 focus:ring-violet-200"
                aria-label="Open user menu"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#7c4dff]">
                  <span className="text-sm font-bold leading-none text-white">{initials}</span>
                </span>
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 z-50 my-4 w-56 list-none divide-y divide-gray-100 bg-white text-base shadow-lg">
                  <div className="px-4 py-3">
                    <span className="block text-sm font-bold text-gray-900">{user?.username}</span>
                    <span className="block truncate text-sm capitalize text-gray-500">{role?.replaceAll("_", " ")}</span>
                  </div>
                  <ul className="py-2">
                    <li>
                      <NavLink to="/settings" className="block px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">
                        Settings
                      </NavLink>
                    </li>
                    <li>
                      <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100">
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex min-h-0 flex-1 overflow-hidden bg-gray-200 px-2 pt-2 pb-0">
        <div className="page-outlet-shell bg-gray-200 px-2 pt-2 pb-0">
          <Outlet />
        </div>
      </main>

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-black/40 bg-[#071426] transition-transform duration-300 xl:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-0 flex-1 flex-col overflow-y-auto pb-4">
          <div className="mb-6 flex h-16 flex-shrink-0 items-center justify-between px-6">
            <div className="flex h-16 w-full items-center overflow-hidden">
              <img src="/logo%206.png" alt="Insider Shield logo" className="h-20 w-40 origin-left scale-125 object-contain object-left" />
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="text-gray-200 xl:hidden" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>

          {Object.entries(groupedLinks).map(([group, items]) => (
            <div key={group}>
              <nav className="mt-5 space-y-3 px-4 first:mt-0">
                {items.map((link) => {
                  const Icon = link.icon;
                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center rounded-sm px-3 py-3 text-sm font-bold text-white ${
                          isActive ? "bg-[#7c4dff] shadow-sm hover:bg-[#7c4dff]" : "hover:bg-white/10"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon className={`mr-3 h-6 w-6 ${isActive ? "text-gray-50" : "text-gray-200 group-hover:text-gray-50"}`} />
                          {link.label}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-gray-900/50 xl:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      )}

      <footer className="flex-shrink-0 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-1.5">
          <p className="text-center text-sm font-semibold text-gray-500">
            &copy; 2026 Insider-Driven Data Leakage Detection and Prevention System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
