import { useEffect, useMemo, useState } from "react";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import api from "../api/client";
import DataTable from "../components/DataTable";
import SeverityBadge from "../components/SeverityBadge";
import StatCard from "../components/StatCard";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: "#334155", boxWidth: 14, font: { weight: 700 } }
    }
  },
  scales: {
    x: { ticks: { color: "#475569" }, grid: { color: "#e2e8f0" } },
    y: { beginAtZero: true, ticks: { color: "#475569", precision: 0 }, grid: { color: "#e2e8f0" } }
  }
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "bottom",
      labels: { color: "#334155", boxWidth: 14, font: { weight: 700 } }
    }
  },
  cutout: "62%"
};

function labelize(value = "") {
  return value.replaceAll("_", " ");
}

export default function Dashboard() {
  const [logs, setLogs] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get("/activity-logs/").then((r) => setLogs(r.data.results || r.data)).catch(() => setLogs([]));
    api.get("/alerts/").then((r) => setAlerts(r.data.results || r.data)).catch(() => setAlerts([]));
    api.get("/users/").then((r) => setUsers(r.data.results || r.data)).catch(() => setUsers([]));
  }, []);

  const severityData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    alerts.forEach((alert) => counts[alert.severity] += 1);
    return {
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [{ data: Object.values(counts), backgroundColor: ["#38bdf8", "#f59e0b", "#f97316", "#e11d48"] }]
    };
  }, [alerts]);

  const alertStatusData = useMemo(() => {
    const counts = { open: 0, investigating: 0, resolved: 0 };
    alerts.forEach((alert) => counts[alert.status] += 1);
    return {
      labels: ["Open", "Investigating", "Resolved"],
      datasets: [{ data: Object.values(counts), backgroundColor: ["#e11d48", "#f59e0b", "#10b981"] }]
    };
  }, [alerts]);

  const activityData = useMemo(() => {
    const counts = {};
    logs.forEach((log) => counts[log.action] = (counts[log.action] || 0) + 1);
    return {
      labels: Object.keys(counts).map(labelize),
      datasets: [{ label: "Activity count", data: Object.values(counts), backgroundColor: "#38bdf8" }]
    };
  }, [logs]);

  const blockedData = useMemo(() => {
    const blocked = logs.filter((log) => log.blocked).length;
    const allowed = Math.max(logs.length - blocked, 0);
    return {
      labels: ["Allowed", "Blocked"],
      datasets: [{ data: [allowed, blocked], backgroundColor: ["#10b981", "#e11d48"] }]
    };
  }, [logs]);

  const riskLevelData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    logs.forEach((log) => counts[log.risk_level] += 1);
    return {
      labels: ["Low", "Medium", "High", "Critical"],
      datasets: [{ label: "Activity risk", data: Object.values(counts), backgroundColor: ["#38bdf8", "#f59e0b", "#f97316", "#e11d48"] }]
    };
  }, [logs]);

  const userRiskData = useMemo(() => {
    const ranked = [...users].sort((a, b) => b.risk_score - a.risk_score).slice(0, 6);
    return {
      labels: ranked.map((user) => user.username),
      datasets: [{ label: "Risk score", data: ranked.map((user) => user.risk_score), backgroundColor: "#7c4dff" }]
    };
  }, [users]);

  const recentLogs = logs.slice(0, 6);

  return (
    <div className="space-y-7">
      <div className="rounded-sm bg-gradient-to-r from-[#2b1b62] via-[#7c4dff] to-[#2b1b62] text-white">
        <div className="px-6 py-8">
          <h1 className="text-3xl font-extrabold tracking-tight">Main Dashboard</h1>
          <p className="mt-2 font-semibold text-violet-100">Monitor insider risk, alerts, prevention decisions, and audit evidence.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Activity logs" value={logs.length} />
        <StatCard label="Open alerts" value={alerts.filter((a) => a.status === "open").length} tone="red" />
        <StatCard label="Critical incidents" value={alerts.filter((a) => a.severity === "critical").length} tone="amber" />
        <StatCard label="High-risk users" value={users.filter((u) => u.is_high_risk).length} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="panel p-5">
          <h3 className="mb-4 font-extrabold text-slate-900">Alert Severity</h3>
          <div className="h-72"><Doughnut data={severityData} options={doughnutOptions} /></div>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-extrabold text-slate-900">Alert Status</h3>
          <div className="h-72"><Doughnut data={alertStatusData} options={doughnutOptions} /></div>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-extrabold text-slate-900">Blocked Activity</h3>
          <div className="h-72"><Doughnut data={blockedData} options={doughnutOptions} /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="panel p-5">
          <h3 className="mb-4 font-extrabold text-slate-900">Activity by Action</h3>
          <div className="h-80"><Bar data={activityData} options={chartOptions} /></div>
        </div>
        <div className="panel p-5">
          <h3 className="mb-4 font-extrabold text-slate-900">Activity by Risk Level</h3>
          <div className="h-80"><Bar data={riskLevelData} options={chartOptions} /></div>
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="mb-4 font-extrabold text-slate-900">Top User Risk Scores</h3>
        <div className="h-80"><Bar data={userRiskData} options={chartOptions} /></div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div>
          <DataTable
            columns={[
              { key: "title", label: "Latest Alert" },
              { key: "username", label: "User" },
              { key: "severity", label: "Severity", render: (row) => <SeverityBadge value={row.severity} /> },
              { key: "status", label: "Status" }
            ]}
            rows={alerts.slice(0, 5)}
            empty="No alerts recorded"
          />
        </div>
        <div>
          <DataTable
            columns={[
              { key: "created_at", label: "Time", render: (row) => new Date(row.created_at).toLocaleString() },
              { key: "username", label: "User" },
              { key: "action", label: "Action", render: (row) => labelize(row.action) },
              { key: "risk_level", label: "Risk", render: (row) => <SeverityBadge value={row.risk_level} /> }
            ]}
            rows={recentLogs}
            empty="No activity recorded"
          />
        </div>
      </div>
    </div>
  );
}
