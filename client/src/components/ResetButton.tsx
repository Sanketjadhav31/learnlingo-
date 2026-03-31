import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

export function ResetButton({ 
  onReset, 
  label = "Reset All",
  className = ""
}: { 
  onReset: () => Promise<void> | void;
  label?: string;
  className?: string;
}) {
  const [showDialog, setShowDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleConfirm = async () => {
    setIsResetting(true);
    try {
      await onReset();
      setShowDialog(false);
    } catch (error) {
      console.error("Reset failed:", error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        disabled={isResetting}
        className={`rounded-lg border border-red-400/50 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        type="button"
      >
        {isResetting ? "Resetting..." : label}
      </button>

      <ConfirmDialog
        isOpen={showDialog}
        title="Reset Work?"
        message="This will clear all your work for this day. This action cannot be undone. Are you sure?"
        confirmText="Yes, Reset"
        cancelText="Cancel"
        onConfirm={handleConfirm}
        onCancel={() => setShowDialog(false)}
        type="danger"
      />
    </>
  );
}
