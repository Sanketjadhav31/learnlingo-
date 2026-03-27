import { useEffect } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastProps {
  type: ToastType;
  message: string;
  onClose: () => void;
  duration?: number;
}

export function Toast({ type, message, onClose, duration = 2000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ"
  };

  const styles = {
    success: "border-emerald-400/50 bg-emerald-500/20 text-emerald-100",
    error: "border-rose-400/50 bg-rose-500/20 text-rose-100",
    warning: "border-amber-400/50 bg-amber-500/20 text-amber-100",
    info: "border-blue-400/50 bg-blue-500/20 text-blue-100"
  };

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-full fade-in duration-300">
      <div
        className={`rounded-lg border px-4 py-3 text-sm font-medium backdrop-blur-xl shadow-2xl flex items-center gap-3 min-w-[280px] max-w-md ${styles[type]}`}
      >
        <span className="text-lg flex-shrink-0">{icons[type]}</span>
        <span className="flex-1">{message}</span>
        <button
          onClick={onClose}
          className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
