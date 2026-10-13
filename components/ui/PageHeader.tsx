"use client";

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, actions, meta }: Props) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {meta && <div className="page-heading-meta">{meta}</div>}
      </div>
      {actions && <div className="page-heading-actions">{actions}</div>}
    </header>
  );
}
