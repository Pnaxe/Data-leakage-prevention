import React from "react";
import ReactDOM from "react-dom/client";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./components/AppLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import UserManagement from "./pages/UserManagement";
import ActivityLogs from "./pages/ActivityLogs";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import SensitiveFiles from "./pages/SensitiveFiles";
import Settings from "./pages/Settings";
import DocumentRepository from "./pages/DocumentRepository";
import DocumentActivityHistory from "./pages/DocumentActivityHistory";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <Dashboard /> },
      { path: "users", element: <UserManagement /> },
      { path: "activity-logs", element: <ActivityLogs /> },
      { path: "alerts", element: <Alerts /> },
      { path: "reports", element: <Reports /> },
      { path: "sensitive-files", element: <SensitiveFiles /> },
      { path: "documents", element: <DocumentRepository /> },
      { path: "documents/activity-history", element: <DocumentActivityHistory /> },
      { path: "settings", element: <Settings /> }
    ]
  }
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
