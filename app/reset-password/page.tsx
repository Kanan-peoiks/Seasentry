"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { validatePassword } from "@/lib/auth";
import { useLanguage } from "@/lib/useLanguage";
import AuthLayout, { AuthField } from "@/components/auth/AuthLayout";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";

function ResetPasswordForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState<string | null>(token ? null : t.auth.missingTokenError);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!token) {
      setError(t.auth.missingTokenError);
      return;
    }
    const passwordKey = validatePassword(password);
    const errors = { password: passwordKey ? t.auth[passwordKey] : undefined, confirmPassword: !passwordKey && password !== confirmPassword ? t.auth.passwordsDoNotMatch : undefined };
    setFieldErrors(errors);
    if (errors.password || errors.confirmPassword) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        if (res.status >= 500) throw new Error(t.auth.serverUnavailable);
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || t.auth.resetLinkInvalidError);
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.auth.somethingWentWrong);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t.auth.chooseNewPassword} back={{ href: "/login", label: t.auth.backToLogin }}>
      {done ? (
        <Notice tone="success">{t.auth.passwordUpdatedRedirecting}</Notice>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <AuthField id="password" label={t.auth.newPassword} error={fieldErrors.password} hint={t.auth.passwordPlaceholder}>
            <input id="password" name="password" className="auth-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? "password-error" : "password-hint"} />
          </AuthField>
          <AuthField id="confirmPassword" label={t.auth.confirmNewPassword} error={fieldErrors.confirmPassword}>
            <input id="confirmPassword" name="confirmPassword" className="auth-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={!!fieldErrors.confirmPassword} aria-describedby={fieldErrors.confirmPassword ? "confirmPassword-error" : undefined} />
          </AuthField>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="primary" className="auth-submit" busy={loading} disabled={!token}>
            {t.auth.updatePassword}<ArrowRight size={16} aria-hidden="true" />
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
