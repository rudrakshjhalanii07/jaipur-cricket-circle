import { ReactNode } from "react";

interface AdminPageHeaderProps {
  title: string;
  subtitle: string;
  /** Search bar / filters / actions row, rendered beneath the heading. */
  toolbar?: ReactNode;
}

/**
 * Editorial section header shared across every /admin route: a large
 * uppercase serif heading, a small gold-tracked subtitle, and an
 * optional toolbar row (search, filters, stats, actions).
 */
export default function AdminPageHeader({ title, subtitle, toolbar }: AdminPageHeaderProps) {
  return (
    <div className="mb-10">
      <h1 className="text-4xl sm:text-5xl font-black text-jcc-blue font-[var(--font-heading)] mb-2 uppercase tracking-tighter">
        {title}
      </h1>
      <p className="text-[11px] sm:text-[13px] text-jcc-accent-dark font-black uppercase tracking-[0.3em]">
        {subtitle}
      </p>
      {toolbar && <div className="mt-8">{toolbar}</div>}
    </div>
  );
}
