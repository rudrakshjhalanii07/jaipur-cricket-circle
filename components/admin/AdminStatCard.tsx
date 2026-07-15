import { LucideIcon, TrendingUp } from "lucide-react";

interface AdminStatCardProps {
  label: string;
  value: number | string | null;
  sub?: string;
  icon?: LucideIcon;
  /** Only render when there is real, computed data behind it — never a fabricated figure. */
  trend?: string;
}

/**
 * Executive metric card: label, big serif number, subtext, and an
 * optional gold trend chip. Used on the dashboard and to replace
 * ad-hoc stat pills in section toolbars.
 */
export default function AdminStatCard({ label, value, sub, icon: Icon, trend }: AdminStatCardProps) {
  const display = value === null || value === undefined ? "—" : typeof value === "number" ? String(value).padStart(2, "0") : value;

  return (
    <div className="admin-stat-card premium-card p-7 group hover:scale-[1.02] transition-all duration-500">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[10px] font-black text-jcc-text-muted uppercase tracking-[0.25em] group-hover:text-jcc-blue/60 transition-colors">
          {label}
        </p>
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-jcc-accent/10 border border-jcc-accent/20 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-jcc-accent-dark" strokeWidth={1.5} />
          </div>
        )}
      </div>
      <h3 className="text-4xl font-black text-jcc-accent-dark mb-2 font-[var(--font-heading)] tracking-tighter">
        {display}
      </h3>
      <div className="flex items-center gap-2">
        {sub && <p className="text-[11px] text-jcc-text-muted font-black uppercase tracking-widest">{sub}</p>}
        {trend && (
          <span className="admin-stat-trend">
            <TrendingUp className="w-3 h-3" strokeWidth={2} />
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
