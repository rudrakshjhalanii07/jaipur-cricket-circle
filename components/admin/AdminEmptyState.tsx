import { LucideIcon } from "lucide-react";

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

/**
 * Shared empty-state treatment for admin lists/tables — a gold-tinted
 * icon chip on ivory, replacing the bespoke one-off empty states that
 * were duplicated per component.
 */
export default function AdminEmptyState({ icon: Icon, title, description }: AdminEmptyStateProps) {
  return (
    <div className="py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-center justify-center mx-auto mb-6 shadow-inner">
        <Icon className="w-7 h-7 text-jcc-accent-dark" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-black text-jcc-blue uppercase tracking-widest mb-2">{title}</p>
      {description && (
        <p className="text-[13px] text-jcc-text-muted font-medium max-w-xs mx-auto leading-relaxed">{description}</p>
      )}
    </div>
  );
}
