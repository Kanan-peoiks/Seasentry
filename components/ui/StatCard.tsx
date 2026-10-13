"use client";

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  icon?: React.ReactNode;
};

export default function StatCard({
  label,
  value,
  hint,
  accent = "var(--accent)",
  icon,
}: Props) {
  return (
    <div className="stat-card"
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--glass-border)",
        borderRadius: 10,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "0",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
        {icon && (
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: `color-mix(in srgb, ${accent} 12%, transparent)`,
              color: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          color: "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{hint}</div>
      )}
    </div>
  );
}
