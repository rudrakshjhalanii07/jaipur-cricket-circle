"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PlayerAvatar from "@/components/PlayerAvatar";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}

/**
 * Canonical admin modal shell: blurred navy-tinted backdrop, gold-accent
 * premium-card panel, scale+fade entrance. Reconciles the two modal
 * patterns previously duplicated across ConfirmDialog / PastVenuesModal
 * / MemberControl's edit modal into one.
 */
export default function AdminModal({ isOpen, onClose, children, maxWidth = "max-w-lg" }: AdminModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-jcc-blue-deep/60 backdrop-blur-md z-[999]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[1000] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className={`premium-card ${maxWidth} w-full overflow-hidden pointer-events-auto max-h-[88vh] flex flex-col`}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

interface AdminModalHeaderProps {
  title: string;
  description?: string;
  onClose: () => void;
  tint?: "accent" | "danger";
}

/** Standard header zone: icon-free title/description + close button, gold-tinted top strip. */
export function AdminModalHeader({ title, description, onClose, tint = "accent" }: AdminModalHeaderProps) {
  const tintBg = tint === "danger" ? "bg-jcc-danger/[0.04]" : "bg-jcc-accent/[0.04]";
  const tintBorder = tint === "danger" ? "border-jcc-danger/15" : "border-jcc-border-bright";
  return (
    <div className={`p-8 ${tintBg} border-b ${tintBorder} shrink-0`}>
      <div className="flex justify-between items-start gap-4">
        <div>
          <h3 className="text-xl font-black text-jcc-blue uppercase tracking-tight">{title}</h3>
          {description && (
            <p className="text-[13px] text-jcc-text-muted font-medium leading-relaxed mt-2">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-jcc-accent/10 transition-colors shrink-0"
        >
          <X className="w-5 h-5 text-jcc-text-muted" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

interface AdminModalDossierProps {
  name: string;
  photoUrl?: string | null;
  team?: string | null;
  badges?: ReactNode;
  onClose: () => void;
}

/** Dossier header for record-editing modals — portrait, name, badges, gold divider. */
export function AdminModalDossier({ name, photoUrl, team, badges, onClose }: AdminModalDossierProps) {
  return (
    <div className="p-8 pb-0 shrink-0">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-jcc-accent/10 transition-colors -mt-2 -mr-2"
        >
          <X className="w-5 h-5 text-jcc-text-muted" strokeWidth={1.5} />
        </button>
      </div>
      <div className="admin-modal-dossier">
        <PlayerAvatar
          src={photoUrl}
          name={name}
          team={team}
          className="admin-modal-dossier-portrait"
          displaySize={64}
        />
        <div className="min-w-0">
          <h3 className="text-xl font-black text-jcc-blue uppercase tracking-tight truncate font-[var(--font-heading)]">
            {name}
          </h3>
          {badges && <div className="flex flex-wrap gap-2 mt-2">{badges}</div>}
        </div>
      </div>
    </div>
  );
}
