"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Send } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import type { AuthUser } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/useLanguage";

export default function AccountPage() {
  return (
    <AppShell active="account">
      <AccountContent />
    </AppShell>
  );
}

function AccountContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const a = t.account;
  const { user, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutFailed, setSignOutFailed] = useState(false);
  const roleLabel: Record<AuthUser["role"], string> = { viewer: a.roleViewer, operator: a.roleOperator, admin: a.roleAdmin };

  const handleLogout = async () => {
    setSigningOut(true);
    setSignOutFailed(false);
    if (await signOut()) {
      router.replace("/");
      return;
    }
    setSigningOut(false);
    setSignOutFailed(true);
  };

  if (!user) return null;
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toLocaleUpperCase()).join("");

  return (
    <div className="dashboard-scroll">
      <PageHeader title={a.title} subtitle={a.subtitle} />
      <div className="account-grid">
        <section className="panel panel-static" aria-labelledby="profile-title">
          <header className="section-heading"><div><h2 id="profile-title">{a.profile}</h2></div></header>
          <div className="profile-head">
            <span className="profile-avatar" aria-hidden="true">{initials || "?"}</span>
            <div>
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
          </div>
          <dl className="summary-list">
            <div><dt>{a.role}</dt><dd>{roleLabel[user.role]}{user.isDemo ? ` · ${a.demoAccount}` : ""}</dd></div>
            <div><dt>{a.organisation}</dt><dd>{a.organisationValue}</dd></div>
            <div><dt>{a.monitoringTheatre}</dt><dd>{a.monitoringTheatreValue}</dd></div>
            <div><dt>{a.authMode}</dt><dd>{a.authModeValue}</dd></div>
          </dl>
        </section>

        <section className="panel panel-static" aria-labelledby="session-title">
          <header className="section-heading"><div><h2 id="session-title">{a.session}</h2></div></header>
          <div className="panel-pad">
            <Notice>{a.sessionNote}</Notice>
            <Button variant="danger" onClick={() => void handleLogout()} busy={signingOut}><LogOut size={16} aria-hidden="true" />{a.logout}</Button>
            {signOutFailed && <Notice tone="error">{t.session.signOutError}</Notice>}
          </div>
        </section>
      </div>

      {user.isDemo ? <Notice>{a.demoFeedbackNote}</Notice> : <FeedbackPanel />}
    </div>
  );
}

function FeedbackPanel() {
  const { t } = useLanguage();
  const a = t.account;
  const [kind, setKind] = useState<"feedback" | "suggestion" | "question">("suggestion");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    if (!message.trim()) {
      setFieldError(true);
      return;
    }
    setFieldError(false);
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message: message.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(typeof data?.error === "string" ? data.error : a.sendFailed);
      }
      setMessage("");
      setStatus("sent");
    } catch (err) {
      // The draft stays in the field so it can be sent again.
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : a.sendFailed);
      setStatus("idle");
    }
  };

  return (
    <section className="panel panel-static" aria-labelledby="feedback-title">
      <header className="section-heading"><div><h2 id="feedback-title">{a.feedbackTitle}</h2><p>{a.feedbackHint}</p></div></header>
      <form onSubmit={handleSubmit} className="panel-pad feedback-form" noValidate>
        <label className="ui-field">
          {a.kind}
          <select className="ui-select" name="kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="feedback">{a.kindFeedback}</option>
            <option value="suggestion">{a.kindSuggestion}</option>
            <option value="question">{a.kindQuestion}</option>
          </select>
        </label>
        <label className="ui-field">
          {a.message}
          <textarea className="ui-textarea" name="message" value={message} onChange={(e) => { setMessage(e.target.value); if (status === "sent") setStatus("idle"); }} placeholder={a.messagePlaceholder} aria-invalid={fieldError} aria-describedby={fieldError ? "feedback-error" : undefined} />
          {fieldError && <span id="feedback-error" className="ui-field-error">{a.messageRequired}</span>}
        </label>
        {error && <Notice tone="error" action={<Button type="submit">{t.session.retry}</Button>}>{error}</Notice>}
        {status === "sent" && <Notice tone="success">{a.sentThankYou}</Notice>}
        <div><Button type="submit" variant="primary" busy={status === "sending"}><Send size={16} aria-hidden="true" />{a.send}</Button></div>
      </form>
    </section>
  );
}
