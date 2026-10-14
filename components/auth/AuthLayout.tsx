"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Satellite, ShieldCheck, Waves } from "lucide-react";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/lib/useLanguage";

type Props = {
  title: string;
  lede?: ReactNode;
  back?: { href?: string; onClick?: () => void; label: string };
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared frame for login, registration, 2FA and password recovery. */
export default function AuthLayout({ title, lede, back, icon, children, footer }: Props) {
  const { lang, t } = useLanguage();
  const backContent = <><ArrowLeft size={16} aria-hidden="true" />{back?.label}</>;
  return (
    <div className="auth-page">
      <div className="auth-page-shell">
        <div className="auth-topbar">
          {back?.onClick ? (
            <button type="button" className="auth-back" onClick={back.onClick}>{backContent}</button>
          ) : (
            <Link href={back?.href ?? "/"} className="auth-back">{back ? backContent : <><ArrowLeft size={16} aria-hidden="true" />{t.auth.backToHome}</>}</Link>
          )}
          <div className="auth-toggles"><LanguageToggle /><ThemeToggle /></div>
        </div>
        <div className="auth-layout">
        <aside className="auth-story">
          <Brand variant="landing" />
          <div className="auth-story-copy">
            <h2>{lang === "az" ? "Xəzərə daha aydın baxış." : "A clearer view of the Caspian."}</h2>
            <p>{lang === "az" ? "Peyk sübutundan mütəxəssis qərarına. Dənizi qorumaq üçün vahid iş sahəsi." : "From satellite evidence to specialist decisions. One workspace to protect the sea."}</p>
          </div>
          <div className="auth-story-steps">
            <span><Satellite size={18} aria-hidden="true" />{lang === "az" ? "Peyk müşahidəsi" : "Satellite observation"}</span>
            <span><ShieldCheck size={18} aria-hidden="true" />{lang === "az" ? "İnsan qərarı" : "Human decision"}</span>
            <span><Waves size={18} aria-hidden="true" />{lang === "az" ? "Dənizin qorunması" : "Marine protection"}</span>
          </div>
        </aside>
        <main className="auth-card">
          <div className="auth-card-brand">
            <Brand tagline={t.header.tagline} />
            {icon && <span className="auth-context-icon">{icon}</span>}
          </div>
          <h1 className="auth-heading">{title}</h1>
          {lede && <p className="auth-lede">{lede}</p>}
          {children}
          {footer}
        </main>
        </div>
      </div>
    </div>
  );
}

export function AuthField({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span id={`${id}-hint`} className="ui-field-hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="ui-field-error">{error}</span>}
    </div>
  );
}
