"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { validateEmail } from "@/lib/auth";
import { useLanguage } from "@/lib/useLanguage";
import AuthLayout, { AuthField } from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";

export default function ForgotPasswordPage() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const emailKey = validateEmail(email);
    setFieldError(emailKey ? t.auth[emailKey] : null);
    if (emailKey) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        if (res.status >= 500) throw new Error(t.auth.serverUnavailable);
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t.auth.somethingWentWrong);
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={t.auth.resetYourPassword}
      lede={t.auth.enterEmailForReset}
      back={{ href: "/login", label: t.auth.backToLogin }}
      footer={<p className="auth-switch">{t.auth.rememberedIt} <Link href="/login">{t.auth.login}</Link></p>}
    >
      {sent ? (
        <Notice tone="success">{t.auth.resetLinkSentNote}</Notice>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <AuthField id="email" label={t.auth.email} error={fieldError}>
            <input id="email" name="email" className="auth-input" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.az" aria-invalid={!!fieldError} aria-describedby={fieldError ? "email-error" : undefined} />
          </AuthField>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="primary" className="auth-submit" busy={loading}>
            {t.auth.sendResetLink}<ArrowRight size={16} aria-hidden="true" />
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
