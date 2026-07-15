"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import AdminModal from "@/components/admin/AdminModal";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "primary" | "danger" | "success";
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "primary",
}: ConfirmDialogProps) {

  const colors = {
    primary: {
      bg: "bg-jcc-accent/[0.04]",
      border: "border-jcc-border-bright",
      icon: "text-jcc-accent",
      button: "btn-vibrant-blue",
    },
    danger: {
      bg: "bg-jcc-danger/[0.04]",
      border: "border-jcc-danger/15",
      icon: "text-jcc-danger",
      button: "admin-btn-destructive",
    },
    success: {
      bg: "bg-jcc-accent/[0.04]",
      border: "border-jcc-border-bright",
      icon: "text-jcc-accent",
      button: "px-6 py-4 rounded-2xl font-black uppercase tracking-wide bg-jcc-accent hover:bg-jcc-accent-highlight shadow-jcc-accent/20 text-jcc-navy-deep",
    },
  };

  const style = colors[variant];

  return (
    <AdminModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className={`p-8 ${style.bg} border-b ${style.border} shrink-0`}>
        <div className="flex justify-between items-start mb-6">
          <div className={`w-14 h-14 rounded-2xl bg-jcc-navy-light border ${style.border} flex items-center justify-center shadow-inner`}>
            {variant === "danger" ? (
              <AlertCircle className={`w-8 h-8 ${style.icon}`} strokeWidth={1.5} />
            ) : (
              <CheckCircle2 className={`w-8 h-8 ${style.icon}`} strokeWidth={1.5} />
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-jcc-accent/10 transition-colors">
            <X className="w-5 h-5 text-jcc-text-muted" strokeWidth={1.5} />
          </button>
        </div>
        <h3 className="text-xl font-black text-jcc-blue uppercase tracking-tight mb-2">{title}</h3>
        <p className="text-[14px] text-jcc-text-muted font-medium leading-relaxed">{description}</p>
      </div>

      <div className="p-6 flex gap-3">
        <button onClick={onClose} className="admin-btn-secondary flex-1">
          {cancelText}
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`flex-1 text-sm ${style.button}`}
        >
          {confirmText}
        </button>
      </div>
    </AdminModal>
  );
}
