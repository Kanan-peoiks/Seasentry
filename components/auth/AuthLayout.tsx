"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Waves } from "lucide-react";
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
  const { t } = useLanguage();
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
        <main className="auth-card">
          <div className="auth-card-brand">
            {icon ?? <Waves size={30} strokeWidth={1.6} aria-hidden="true" />}
            <div>
              <div className="auth-card-title" translate="no">SeaSentry</div>
              <div className="auth-card-sub">{t.header.tagline}</div>
            </div>
          </div>
          <h1 className="auth-heading">{title}</h1>
          {lede && <p className="auth-lede">{lede}</p>}
          {children}
          {footer}
        </main>
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
