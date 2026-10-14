"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, History, LogIn, MessageSquare, Reply, Send, ShieldCheck, Trash2, Undo2, UserCog, Users } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import DataState from "@/components/ui/DataState";
import Dialog from "@/components/ui/Dialog";
import FilterBar from "@/components/ui/FilterBar";
import { isAdmin, type UserRole } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/useLanguage";
import { formatWorkspaceTime } from "@/lib/workspace-url";

type AdminUser = { id: string; name: string; email: string; role: UserRole; isDemo: boolean; createdAt: string };
type Stats = { totalUsers: number; totalOperators: number; totalAdmins: number; loginsToday: number; loginsLast7Days?: { date: string; count: number }[] };
type FeedbackItem = { id: string; kind: "feedback" | "suggestion" | "question"; message: string; userName: string; userEmail: string; createdAt: string; resolved: boolean; adminReply?: string | null; repliedAt?: string | null };
type AuditLogEntry = { id: string; actorName: string; actorEmail: string; action: string; targetUserId?: string | null; targetEmail?: string | null; detail?: string | null; createdAt: string };
type Section<T> = { status: "loading" } | { status: "error" } | { status: "ok"; data: T };

async function readError(res: Response, fallback: string) {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

/** Each admin section loads independently, so one failing endpoint never
 * blanks the whole page. */
function useSection<T>(url: string, enabled: boolean) {
  const [state, setState] = useState<Section<T>>({ status: "loading" });
  const load = useCallback(() => {
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        setState({ status: "ok", data: (await res.json()) as T });
      })
      .catch(() => setState({ status: "error" }));
  }, [url]);
  useEffect(() => { if (enabled) load(); }, [enabled, load]);
  const retry = () => {
    setState({ status: "loading" });
    load();
  };
  return [state, setState, retry] as const;
}

export default function AdminPage() {
  return (
    <AppShell active="admin">
      <AdminContent />
    </AppShell>
  );
}

function AdminContent() {
  const { t, lang } = useLanguage();
  const ad = t.admin;
  const admin = isAdmin(useSession().user);
  const [stats, , retryStats] = useSection<Stats>("/api/admin/stats", admin);
  const [users, setUsers, retryUsers] = useSection<AdminUser[]>("/api/admin/users", admin);
  const [feedback, setFeedback, retryFeedback] = useSection<FeedbackItem[]>("/api/feedback", admin);
  const [audit, setAudit, retryAudit] = useSection<AuditLogEntry[]>("/api/admin/audit-log", admin);
  const [userSearch, setUserSearch] = useState("");
  const [feedbackFilter, setFeedbackFilter] = useState<"open" | "resolved" | "all">("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FeedbackItem | null>(null);

  const userRows = useMemo(() => {
    const rows = users.status === "ok" ? users.data : [];
    const q = userSearch.trim().toLocaleLowerCase();
    return q ? rows.filter((u) => `${u.name} ${u.email}`.toLocaleLowerCase().includes(q)) : rows;
  }, [users, userSearch]);
  const feedbackRows = feedback.status === "ok" ? feedback.data : [];
  const filteredFeedback = feedbackFilter === "all" ? feedbackRows : feedbackRows.filter((f) => (feedbackFilter === "resolved" ? f.resolved : !f.resolved));

  const refreshAudit = async () => {
    const res = await fetch("/api/admin/audit-log", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setAudit({ status: "ok", data: await res.json() });
  };

  const changeRole = async (user: AdminUser, role: UserRole) => {
    setBusyId(user.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      if (!res.ok) throw new Error(await readError(res, ad.roleUpdateFailed));
      const updated: AdminUser = await res.json();
      setUsers((prev) => (prev.status === "ok" ? { status: "ok", data: prev.data.map((u) => (u.id === user.id ? updated : u)) } : prev));
      void refreshAudit();
    } catch (err) {
      setRowError({ id: user.id, message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : ad.roleUpdateFailed });
    } finally {
      setBusyId(null);
    }
  };

  const updateFeedback = (updated: FeedbackItem) => setFeedback((prev) => (prev.status === "ok" ? { status: "ok", data: prev.data.map((f) => (f.id === updated.id ? updated : f)) } : prev));

  const toggleResolved = async (item: FeedbackItem) => {
    setBusyId(item.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/feedback/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resolved: !item.resolved }) });
      if (!res.ok) throw new Error(await readError(res, ad.updateFailed));
      updateFeedback(await res.json());
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : ad.updateFailed });
    } finally {
      setBusyId(null);
    }
  };

  /** Resolves true only when the reply was stored, so the draft survives a failure. */
  const sendReply = async (item: FeedbackItem, message: string): Promise<boolean> => {
    setBusyId(item.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/feedback/${item.id}/reply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      if (!res.ok) throw new Error(await readError(res, ad.replyFailed));
      updateFeedback(await res.json());
      return true;
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : ad.replyFailed });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const item = pendingDelete;
    if (!item) return;
    setBusyId(item.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/feedback/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, ad.deleteFailed));
      setFeedback((prev) => (prev.status === "ok" ? { status: "ok", data: prev.data.filter((f) => f.id !== item.id) } : prev));
      setPendingDelete(null);
    } catch (err) {
      setRowError({ id: item.id, message: err instanceof Error && err.message !== "Failed to fetch" ? err.message : ad.deleteFailed });
      setPendingDelete(null);
    } finally {
      setBusyId(null);
    }
  };

  if (!admin) {
    return (
      <div className="dashboard-scroll">
        <PageHeader title={ad.title} subtitle={ad.accessDenied} />
        <Notice>{ad.accessDeniedBody}</Notice>
      </div>
    );
  }

  const s = stats.status === "ok" ? stats.data : null;
  const roleSelect = (u: AdminUser) => u.isDemo ? (
    <span className="muted">{ad.fixed}</span>
  ) : (
    <label className="role-select">
      <span className="sr-only">{ad.roleFor(u.name)}</span>
      <select className="ui-select" name={`role-${u.id}`} value={u.role} disabled={busyId === u.id} onChange={(e) => void changeRole(u, e.target.value as UserRole)}>
        <option value="viewer">{t.header.roleViewer}</option>
        <option value="operator">{t.header.roleOperator}</option>
        <option value="admin">{t.header.roleAdmin}</option>
      </select>
    </label>
  );

  return (
    <div className="dashboard-scroll">
      <PageHeader title={ad.title} subtitle={ad.subtitle} />

      {stats.status === "error" && <Notice tone="error" action={<Button onClick={retryStats}>{t.session.retry}</Button>}>{ad.statsFailed}</Notice>}
      <section className="workspace-stats" aria-label={ad.title}>
        <StatCard label={ad.totalUsers} value={s?.totalUsers ?? "—"} icon={<Users size={17} />} />
        <StatCard label={ad.operators} value={s?.totalOperators ?? "—"} icon={<UserCog size={17} />} />
        <StatCard label={ad.admins} value={s?.totalAdmins ?? "—"} icon={<ShieldCheck size={17} />} />
        <StatCard label={ad.loginsToday} value={s?.loginsToday ?? "—"} icon={<LogIn size={17} />} />
      </section>
      {s?.loginsLast7Days && s.loginsLast7Days.length > 0 && (
        <section className="panel panel-static" aria-labelledby="logins-title">
          <header className="section-heading"><div><h2 id="logins-title">{ad.loginsLast7Days}</h2></div></header>
          <ol className="login-days">
            {s.loginsLast7Days.map((d) => <li key={d.date}><strong>{d.count}</strong><span>{d.date}</span></li>)}
          </ol>
        </section>
      )}

      <section className="panel panel-static" aria-labelledby="users-title">
        <header className="section-heading">
          <div><h2 id="users-title"><Users size={16} aria-hidden="true" /> {ad.users}</h2><p>{users.status === "ok" ? ad.shownOfTotal(userRows.length, users.data.length) : ad.usersHint}</p></div>
        </header>
        <div className="panel-pad panel-pad--tight"><FilterBar search={userSearch} onSearchChange={setUserSearch} searchPlaceholder={ad.searchByNameEmail} searchLabel={t.common.search} /></div>
        <DataState loading={users.status === "loading"} error={users.status === "error" ? ad.usersFailed : null} empty={users.status === "ok" && userRows.length === 0} onRetry={retryUsers}>
          <div className="table-scroll desktop-records">
            <table className="data-table">
              <caption className="sr-only">{ad.users}</caption>
              <thead><tr><th scope="col">{ad.colName}</th><th scope="col">{ad.colEmail}</th><th scope="col">{ad.colJoined}</th><th scope="col">{ad.colRole}</th></tr></thead>
              <tbody>
                {userRows.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}{u.isDemo && <span className="cell-secondary">{ad.demoAccount}</span>}</td>
                    <td>{u.email}</td>
                    <td>{formatWorkspaceTime(u.createdAt, lang)}</td>
                    <td>{roleSelect(u)}{rowError?.id === u.id && <span className="ui-field-error" role="alert">{rowError.message}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-records">
            {userRows.map((u) => (
              <article className="record-card" key={u.id}>
                <div className="record-card-header"><strong>{u.name}</strong>{roleSelect(u)}</div>
                <p>{u.email}</p>
                <div className="record-card-meta"><span>{ad.colJoined}: {formatWorkspaceTime(u.createdAt, lang)}</span></div>
                {rowError?.id === u.id && <span className="ui-field-error" role="alert">{rowError.message}</span>}
              </article>
            ))}
          </div>
        </DataState>
      </section>

      <section className="panel panel-static" aria-labelledby="feedback-title">
        <header className="section-heading">
          <div><h2 id="feedback-title"><MessageSquare size={16} aria-hidden="true" /> {ad.feedback}</h2><p>{ad.openTotal(feedbackRows.filter((f) => !f.resolved).length, feedbackRows.length)}</p></div>
          <div className="segmented" role="group" aria-label={ad.feedback}>
            {(["open", "resolved", "all"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={feedbackFilter === f} onClick={() => setFeedbackFilter(f)}>{f === "open" ? ad.filterOpen : f === "resolved" ? ad.filterResolved : ad.filterAll}</button>
            ))}
          </div>
        </header>
        <DataState loading={feedback.status === "loading"} error={feedback.status === "error" ? ad.feedbackFailed : null} empty={feedback.status === "ok" && filteredFeedback.length === 0} onRetry={retryFeedback}>
          <ul className="feedback-list">
            {filteredFeedback.map((f) => (
              <FeedbackRow key={f.id} item={f} busy={busyId === f.id} error={rowError?.id === f.id ? rowError.message : null} onToggleResolved={() => void toggleResolved(f)} onSendReply={(message) => sendReply(f, message)} onDelete={() => setPendingDelete(f)} />
            ))}
          </ul>
        </DataState>
      </section>

      <section className="panel panel-static" aria-labelledby="audit-title">
        <header className="section-heading"><div><h2 id="audit-title"><History size={16} aria-hidden="true" /> {ad.auditLog}</h2><p>{audit.status === "ok" ? ad.roleChangesRecorded(audit.data.length) : ad.auditHint}</p></div></header>
        <DataState loading={audit.status === "loading"} error={audit.status === "error" ? ad.auditFailed : null} empty={audit.status === "ok" && audit.data.length === 0} onRetry={retryAudit}>
          <div className="table-scroll">
            <table className="data-table">
              <caption className="sr-only">{ad.auditLog}</caption>
              <thead><tr><th scope="col">{ad.colWhen}</th><th scope="col">{ad.colAdmin}</th><th scope="col">{ad.colTargetUser}</th><th scope="col">{ad.colChange}</th></tr></thead>
              <tbody>
                {(audit.status === "ok" ? audit.data : []).map((e) => (
                  <tr key={e.id}>
                    <td>{formatWorkspaceTime(e.createdAt, lang)}</td>
                    <td>{e.actorName}<span className="cell-secondary">{e.actorEmail}</span></td>
                    <td>{e.targetEmail ?? "—"}</td>
                    <td>{e.detail ?? e.action.replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>

      <Dialog
        open={!!pendingDelete}
        variant="center"
        width={420}
        title={ad.deleteTitle}
        subtitle={ad.deleteConfirm}
        onClose={() => setPendingDelete(null)}
        footer={<>
          <Button onClick={() => setPendingDelete(null)}>{ad.cancel}</Button>
          <Button variant="danger" busy={!!pendingDelete && busyId === pendingDelete.id} onClick={() => void confirmDelete()}><Trash2 size={16} aria-hidden="true" />{ad.delete}</Button>
        </>}
      >
        {pendingDelete && <blockquote className="quote">{pendingDelete.message}</blockquote>}
      </Dialog>
    </div>
  );
}

function FeedbackRow({ item, busy, error, onToggleResolved, onSendReply, onDelete }: { item: FeedbackItem; busy: boolean; error: string | null; onToggleResolved: () => void; onSendReply: (message: string) => Promise<boolean>; onDelete: () => void }) {
  const { t, lang } = useLanguage();
  const ad = t.admin;
  const [draft, setDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const kindLabel = item.kind === "feedback" ? t.account.kindFeedback : item.kind === "suggestion" ? t.account.kindSuggestion : t.account.kindQuestion;

  const handleSend = async () => {
    if (!draft.trim()) return;
    if (await onSendReply(draft.trim())) {
      setDraft("");
      setReplying(false);
    }
  };

  return (
    <li className={`feedback-item${item.resolved ? " feedback-item--resolved" : ""}`}>
      <div className="feedback-meta">
        <span className="provenance">{kindLabel}</span>
        <span>{item.userName} · {item.userEmail}</span>
        <span>{formatWorkspaceTime(item.createdAt, lang)}</span>
      </div>
      <p className="feedback-message">{item.message}</p>
      {item.adminReply && (
        <div className="feedback-reply">
          <span>{ad.yourReply}{item.repliedAt ? ` · ${formatWorkspaceTime(item.repliedAt, lang)}` : ""}</span>
          <p>{item.adminReply}</p>
        </div>
      )}
      {replying && (
        <div className="feedback-compose">
          <label className="ui-field">
            {ad.replyLabel}
            <textarea className="ui-textarea" name={`reply-${item.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={ad.replyPlaceholder} autoFocus />
          </label>
          <div className="feedback-actions">
            <Button variant="primary" onClick={() => void handleSend()} busy={busy} disabled={!draft.trim()}><Send size={15} aria-hidden="true" />{ad.sendReply}</Button>
            <Button variant="ghost" onClick={() => setReplying(false)} disabled={busy}>{ad.cancel}</Button>
          </div>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {!replying && (
        <div className="feedback-actions">
          {!item.adminReply && <Button onClick={() => setReplying(true)}><Reply size={15} aria-hidden="true" />{ad.reply}</Button>}
          <Button onClick={onToggleResolved} busy={busy}>{item.resolved ? <Undo2 size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}{item.resolved ? ad.reopen : ad.markResolved}</Button>
          <Button variant="ghost" onClick={onDelete} disabled={busy}><Trash2 size={15} aria-hidden="true" />{ad.delete}</Button>
        </div>
      )}
    </li>
  );
}
