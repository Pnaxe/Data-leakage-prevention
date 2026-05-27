import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const tones = {
  success: "border-emerald-200 bg-emerald-600 text-white",
  error: "border-rose-200 bg-rose-600 text-white"
};

export default function Toast({ open, message, type = "success", onClose, duration = 4500 }) {
  useEffect(() => {
    if (!open) return undefined;

    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [open, onClose, duration]);

  if (!open || !message) return null;

  return createPortal(
    <div
      className={`fixed right-4 top-4 z-[110] flex max-w-sm items-start gap-3 rounded-sm border px-4 py-3 shadow-lg ${tones[type] || tones.success}`}
      role="status"
      aria-live="polite"
    >
      <p className="flex-1 text-sm font-semibold leading-snug">{message}</p>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-white/90 hover:bg-white/20"
        aria-label="Dismiss notification"
      >
        <X size={16} />
      </button>
    </div>,
    document.body
  );
}
