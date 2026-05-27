export default function StatCard({ label, value, tone = "blue" }) {
  const tones = {
    blue: "border-l-4 border-l-[#7c4dff]",
    red: "border-l-4 border-l-rose-600",
    green: "border-l-4 border-l-emerald-600",
    amber: "border-l-4 border-l-amber-500"
  };

  return (
    <div className={`panel ${tones[tone]} p-5`}>
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-extrabold text-slate-900">{value}</p>
    </div>
  );
}
