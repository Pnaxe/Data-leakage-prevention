export default function FormSection({ title, children, onSubmit, actionLabel = "Save" }) {
  return (
    <form onSubmit={onSubmit} className="panel p-5">
      <h3 className="mb-4 text-base font-extrabold text-slate-900">{title}</h3>
      <div className="grid grid-cols-2 gap-4">{children}</div>
      <button className="mt-5 rounded-sm bg-[#7c4dff] px-4 py-2 text-sm font-extrabold text-white hover:bg-[#6d28d9]">
        {actionLabel}
      </button>
    </form>
  );
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const inputClass = "w-full rounded-sm border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[#7c4dff] focus:ring-2 focus:ring-violet-100";
