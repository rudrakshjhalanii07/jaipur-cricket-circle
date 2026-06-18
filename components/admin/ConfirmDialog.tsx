"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

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
      bg: "bg-jcc-blue/[0.04]",
      border: "border-jcc-blue/10",
      icon: "text-jcc-blue",
      button: "bg-jcc-blue-deep hover:bg-jcc-blue shadow-jcc-blue/20",
    },
    danger: {
      bg: "bg-jcc-red/[0.04]",
      border: "border-jcc-red/10",
      icon: "text-jcc-red",
      button: "bg-jcc-red hover:bg-jcc-red/80 shadow-jcc-red/20",
    },
    success: {
      bg: "bg-jcc-turf/[0.04]",
      border: "border-jcc-turf/10",
      icon: "text-jcc-turf",
      button: "bg-jcc-turf hover:bg-jcc-turf-dim shadow-jcc-turf/20 text-jcc-navy",
    },
  };

  const style = colors[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999]"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[1000] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="theme-static-light bg-white rounded-[32px] border border-jcc-border shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
            >
              <div className={`p-8 ${style.bg} border-b ${style.border}`}>
                <div className="flex justify-between items-start mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-white border ${style.border} flex items-center justify-center shadow-sm`}>
                    {variant === "danger" ? (
                      <AlertCircle className={`w-8 h-8 ${style.icon}`} />
                    ) : (
                      <CheckCircle2 className={`w-8 h-8 ${style.icon}`} />
                    )}
                  </div>
                  <button 
                    onClick={onClose}
                    className="p-2 rounded-xl hover:bg-white transition-colors"
                  >
                    <X className="w-5 h-5 text-jcc-muted" />
                  </button>
                </div>
                <h3 className="text-xl font-bold text-jcc-navy mb-2">{title}</h3>
                <p className="text-[14px] text-jcc-muted font-medium leading-relaxed">
                  {description}
                </p>
              </div>

              <div className="p-6 bg-white flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-6 py-3.5 rounded-2xl bg-jcc-bg border border-jcc-border text-jcc-muted font-bold text-sm hover:text-jcc-navy transition-all"
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 px-6 py-3.5 rounded-2xl text-white font-bold text-sm shadow-xl transition-all ${style.button}`}
                >
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
