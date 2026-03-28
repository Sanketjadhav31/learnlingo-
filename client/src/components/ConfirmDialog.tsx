import { useEffect } from "react";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: "warning" | "danger";
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  type = "warning",
}: ConfirmDialogProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const colorClasses = type === "danger"
    ? {
        border: "border-rose-400/50",
        bg: "bg-rose-500/10",
        icon: "🗑️",
        iconBg: "bg-rose-500/20",
        iconText: "text-rose-200",
        confirmBg: "bg-rose-500 hover:bg-rose-600",
        confirmBorder: "border-rose-400",
      }
    : {
        border: "border-amber-400/50",
        bg: "bg-amber-500/10",
        icon: "⚠️",
        iconBg: "bg-amber-500/20",
        iconText: "text-amber-200",
        confirmBg: "bg-amber-500 hover:bg-amber-600",
        confirmBorder: "border-amber-400",
      };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-md animate-in zoom-in-95 duration-200">
        <div className={`rounded-2xl border ${colorClasses.border} ${colorClasses.bg} backdrop-blur-xl shadow-2xl`}>
          {/* Header */}
          <div className="flex items-center gap-3 p-6 pb-4">
            <div className={`flex-shrink-0 w-12 h-12 rounded-full ${colorClasses.iconBg} flex items-center justify-center`}>
              <span className="text-2xl">{colorClasses.icon}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white">{title}</h3>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <div className="text-sm text-white/80 leading-relaxed whitespace-pre-line">
              {message}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 p-6 pt-0">
            <button
              onClick={onCancel}
              className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-all duration-200"
              type="button"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 rounded-xl border ${colorClasses.confirmBorder} ${colorClasses.confirmBg} px-4 py-3 text-sm font-bold text-white transition-all duration-200 shadow-lg`}
              type="button"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
