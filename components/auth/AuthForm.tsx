"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";
import { login, register, verifyTwoFactor, validateEmail, validatePassword, type AuthFailure, type LoginResult } from "@/lib/auth";
import { useSession } from "@/lib/session";
import TurnstileWidget from "@/components/ui/TurnstileWidget";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import AuthLayout, { AuthField } from "@/components/auth/AuthLayout";
import { useLanguage } from "@/lib/useLanguage";

type Mode = "login" | "register";
type Field = "fullName" | "email" | "password" | "confirmPassword" | "code";
type FieldErrors = Partial<Record<Field, string>>;
type FormError = { message: string; retryable: boolean } | null;
type Captcha = { state: "loading" } | { state: "ready"; token: string } | { state: "expired" } | { state: "error" };

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { acceptUser } = useSession();
  const { t } = useLanguage();
  const nextPath = searchParams.get("next") || "/dashboard";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<FormError>(null);
  const [pending, setPending] = useState(false);
  const [captcha, setCaptcha] = useState<Captcha>({ state: "loading" });
  const [captchaKey, setCaptchaKey] = useState(0);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const resetCaptcha = () => {
    setCaptcha({ state: "loading" });
    setCaptchaKey((key) => key + 1);
  };

  const describeFailure = (failure: AuthFailure, fallback: string): FormError => {
    if (failure.kind === "network") return { message: t.auth.serverUnavailable, retryable: true };
    if (mode === "login" && !challengeId && (failure.status === 400 || failure.status === 401)) return { message: t.auth.invalidCredentials, retryable: false };
    return { message: failure.message || fallback, retryable: false };
  };

  const finish = (result: LoginResult, fallback: string) => {
    if (result.status === "success") {
      acceptUser(result.user);
      const safeNext = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard";
      router.replace(safeNext);
      return;
    }
    setPending(false);
    if (result.status === "twoFactorRequired") {
      setChallengeId(result.challengeId);
      return;
    }
    setFormError(describeFailure(result.failure, fallback));
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (mode === "register" && !fullName.trim()) errors.fullName = t.auth.fullNameRequired;
    const emailKey = validateEmail(email);
    if (emailKey) errors.email = t.auth[emailKey];
    const passwordKey = mode === "login" ? (password ? null : "passwordRequired" as const) : validatePassword(password);
    if (passwordKey) errors.password = t.auth[passwordKey];
    if (mode === "register" && !errors.password && password !== confirmPassword) errors.confirmPassword = t.auth.passwordsDoNotMatch;
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setFormError(null);
    const errors = validate();
    setFieldErrors(errors);
    const firstInvalid = (Object.keys(errors) as Field[])[0];
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`#${firstInvalid}`)?.focus();
      return;
    }
    if (mode === "register" && captcha.state !== "ready") {
      setFormError({ message: captcha.state === "error" ? t.auth.captchaUnavailable : t.auth.completeCaptcha, retryable: false });
      return;
    }

    setPending(true);
    if (mode === "login") {
      finish(await login(email, password, remember), t.auth.invalidCredentials);
      return;
    }
    const result = await register(fullName, email, password, captcha.state === "ready" ? captcha.token : "");
    // A Turnstile token is single-use; any failed attempt needs a fresh one.
    if (result.status === "error") resetCaptcha();
    finish(result, t.auth.createAccountFailed);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challengeId || pending) return;
    if (!/^\d{6}$/.test(code)) {
      setFieldErrors({ code: t.auth.invalidCode });
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setPending(true);
    finish(await verifyTwoFactor(challengeId, code, remember), t.auth.invalidCode);
  };

  const errorNotice = formError && (
    <Notice tone="error" action={formError.retryable ? <Button type="submit" variant="secondary"><RotateCcw size={15} aria-hidden="true" />{t.session.retry}</Button> : undefined}>
      {formError.message}
    </Notice>
  );

  const describedBy = (field: Field) => (fieldErrors[field] ? `${field}-error` : undefined);

  if (challengeId) {
    return (
      <AuthLayout
        title={t.auth.enterCode}
        lede={t.auth.codeSentTo(email)}
        icon={<ShieldCheck size={30} aria-hidden="true" />}
        back={{ label: t.auth.back, onClick: () => { setChallengeId(null); setCode(""); setFormError(null); setFieldErrors({}); } }}
      >
        <form onSubmit={handleVerifyCode} className="auth-form" noValidate>
          <AuthField id="code" label={t.auth.loginCode} error={fieldErrors.code}>
            <input id="code" name="code" className="auth-input auth-input--code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-invalid={!!fieldErrors.code} aria-describedby={describedBy("code")} autoFocus />
          </AuthField>
          {errorNotice}
          <Button type="submit" variant="primary" className="auth-submit" busy={pending}>
            {pending ? t.auth.verifying : <>{t.auth.verify}<ArrowRight size={16} aria-hidden="true" /></>}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={mode === "login" ? t.auth.signIn : t.auth.createAccount}
      lede={mode === "login" ? t.auth.signInSub : t.auth.registerSub}
      footer={<>
        <p className="auth-switch">
          {mode === "login" ? <>{t.auth.noAccount} <Link href="/register">{t.auth.register}</Link></> : <>{t.auth.haveAccount} <Link href="/login">{t.auth.login}</Link></>}
        </p>
        <p className="auth-disclaimer">{t.auth.disclaimer}</p>
      </>}
    >
      <form ref={formRef} onSubmit={handleSubmit} className="auth-form" noValidate>
        {mode === "register" && (
          <AuthField id="fullName" label={t.auth.fullName} error={fieldErrors.fullName}>
            <input id="fullName" name="name" className="auth-input" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.auth.fullNamePlaceholder} aria-invalid={!!fieldErrors.fullName} aria-describedby={describedBy("fullName")} />
          </AuthField>
        )}
        <AuthField id="email" label={t.auth.email} error={fieldErrors.email}>
          <input id="email" name="email" className="auth-input" type="email" autoComplete="email" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@organization.az" aria-invalid={!!fieldErrors.email} aria-describedby={describedBy("email")} />
        </AuthField>
        <AuthField id="password" label={t.auth.password} error={fieldErrors.password} hint={mode === "register" ? t.auth.passwordPlaceholder : undefined}>
          <input id="password" name="password" className="auth-input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!fieldErrors.password} aria-describedby={describedBy("password") ?? (mode === "register" ? "password-hint" : undefined)} />
        </AuthField>
        {mode === "register" && (
          <AuthField id="confirmPassword" label={t.auth.confirmPassword} error={fieldErrors.confirmPassword}>
            <input id="confirmPassword" name="confirmPassword" className="auth-input" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={!!fieldErrors.confirmPassword} aria-describedby={describedBy("confirmPassword")} />
          </AuthField>
        )}

        {mode === "login" && (
          <div className="auth-row">
            <label className="auth-remember"><input type="checkbox" name="remember" checked={remember} onChange={(e) => setRemember(e.target.checked)} />{t.auth.rememberMe}</label>
            <Link href="/forgot-password" className="auth-link">{t.auth.forgotPassword}</Link>
          </div>
        )}

        {mode === "register" && (
          <div className="auth-captcha">
            <TurnstileWidget
              key={captchaKey}
              action="register"
              onVerify={(token) => setCaptcha({ state: "ready", token })}
              onExpire={() => setCaptcha({ state: "expired" })}
              onError={() => setCaptcha({ state: "error" })}
            />
            {captcha.state === "expired" && <p className="ui-field-hint" role="status">{t.auth.completeCaptcha}</p>}
            {captcha.state === "error" && (
              <Notice tone="error" action={<Button onClick={resetCaptcha}><RotateCcw size={15} aria-hidden="true" />{t.auth.captchaRetry}</Button>}>{t.auth.captchaUnavailable}</Notice>
            )}
          </div>
        )}

        {errorNotice}

        <Button type="submit" variant="primary" className="auth-submit" busy={pending} disabled={mode === "register" && captcha.state !== "ready"}>
          {pending ? (mode === "login" ? t.auth.signingIn : t.auth.registering) : <>{mode === "login" ? t.auth.login : t.auth.register}<ArrowRight size={16} aria-hidden="true" /></>}
        </Button>
      </form>
    </AuthLayout>
  );
}
