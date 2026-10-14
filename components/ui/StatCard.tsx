"use client";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  /** Any CSS color; tints the icon chip through color-mix. */
  accent?: string;
  icon?: React.ReactNode;
};

export default function StatCard({ label, value, hint, accent = "var(--accent)", icon }: Props) {
  return (
    <div className="stat-card" style={{ "--stat-accent": accent } as React.CSSProperties}>
      <div className="stat-card-top">
        <span className="stat-card-label">{label}</span>
        {icon && <span className="stat-card-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="stat-card-value">{value}</div>
      {hint && <div className="stat-card-hint">{hint}</div>}
    </div>
  );
}
