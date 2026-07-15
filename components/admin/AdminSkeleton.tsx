interface AdminSkeletonProps {
  /** Number of shimmer rows/blocks to render. */
  rows?: number;
  /** Height of each block, in Tailwind arbitrary-value form. */
  rowHeight?: string;
  className?: string;
}

/**
 * Ivory/gold shimmer loading placeholder — replaces the repeated
 * bare `<Loader2 animate-spin>` block used identically across every
 * admin list while data loads.
 */
export default function AdminSkeleton({ rows = 3, rowHeight = "88px", className = "" }: AdminSkeletonProps) {
  return (
    <div className={`space-y-4 py-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="admin-shimmer" style={{ height: rowHeight, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}
