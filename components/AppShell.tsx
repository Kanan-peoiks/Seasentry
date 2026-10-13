"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw, ServerCrash } from "lucide-react";
import Header from "@/components/Header";
import Sidebar, { WorkspaceNav } from "@/components/Sidebar";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import type { NavId } from "@/lib/nav";
import type { AuthUser } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/useLanguage";

type Props = {
  active: NavId;
  children: React.ReactNode;
};

const COLLAPSE_KEY = "seasentry-nav-collapsed";

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}

function SessionGate({ status, onRetry }: { status: "checking" | "unavailable"; onRetry: () => void }) {
  const { t } = useLanguage();
  const checking = status === "checking";
  return (
    <div className="session-gate" role={checking ? "status" : "alert"} aria-busy={checking || undefined}>
      {checking ? <LoaderCircle size={28} className="spinner" aria-hidden="true" /> : <ServerCrash size={28} aria-hidden="true" />}
      <h1>{checking ? t.session.checkingTitle : t.session.unavailableTitle}</h1>
      <p>{checking ? t.session.checkingBody : t.session.unavailableBody}</p>
      {!checking && <Button variant="primary" onClick={onRetry}><RotateCcw size={16} aria-hidden="true" />{t.session.retry}</Button>}
    </div>
  );
}

/** Workspace frame. Access is decided by the server-verified session
 * (lib/session.tsx); proxy.ts only checks that a cookie exists. A service
 * outage shows a retry screen and never clears the session. */
export default function AppShell({ active, children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const { status, user, refresh, signOut } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);

  const roleLabel: Record<AuthUser["role"], string> = { viewer: t.header.roleViewer, operator: t.header.roleOperator, admin: t.header.roleAdmin };

  useEffect(() => {
    // Restoring a per-viewer layout preference from storage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    if (status === "unauthenticated" && !signingOut) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, signingOut, router, pathname]);

  const toggleMenu = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setDrawerOpen(true);
      return;
    }
    setCollapsed((value) => {
      try { localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1"); } catch { /* Preference only. */ }
      return !value;
    });
  };

  const handleLogout = async () => {
    setSigningOut(true);
    setSignOutError(false);
    // Redirect only after the cookie is cleared, so /login cannot bounce back.
    if (await signOut()) {
      router.replace("/login");
      return;
    }
    setSigningOut(false);
    setSignOutError(true);
  };

  if (status !== "authenticated" || !user) {
    return <div className="dashboard-shell"><SessionGate status={status === "unavailable" ? "unavailable" : "checking"} onRetry={() => void refresh()} /></div>;
  }

  return (
    <div className="dashboard-shell">
      <a href="#workspace-main" className="skip-link">{t.common.skipToContent}</a>
      <Header onLogout={handleLogout} signingOut={signingOut} onMenuClick={toggleMenu} menuExpanded={drawerOpen || !collapsed} userName={user.name} userRole={roleLabel[user.role]} />
      {signOutError && <div className="session-banner"><Notice tone="error" action={<Button onClick={handleLogout}>{t.session.retry}</Button>}>{t.session.signOutError}</Notice></div>}
      <div className="dashboard-body">
        <Sidebar active={active} collapsed={collapsed} showAdmin={user.role === "admin"} />
        <main id="workspace-main" className="dashboard-main" tabIndex={-1}>{children}</main>
      </div>
      <Dialog open={drawerOpen} onClose={() => setDrawerOpen(false)} title="SeaSentry" label={t.sidebar.navigation} variant="drawer">
        <WorkspaceNav active={active} showAdmin={user.role === "admin"} onNavigate={() => setDrawerOpen(false)} />
      </Dialog>
    </div>
  );
}
