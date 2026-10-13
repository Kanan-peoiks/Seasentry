"use client";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="page-heading"
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 4,
      }}
    >
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 650,
            letterSpacing: "-0.01em",
            color: "var(--text-primary)",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "6px 0 0",
              fontSize: 14,
              color: "var(--text-secondary)",
              maxWidth: 640,
              lineHeight: 1.45,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
