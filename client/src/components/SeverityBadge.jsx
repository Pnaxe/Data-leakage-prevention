export default function SeverityBadge({ value }) {
  const tones = {
    low: "bg-sky-100 text-sky-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-rose-100 text-rose-700"
  };
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tones[value] || tones.low}`}>{value}</span>;
}
