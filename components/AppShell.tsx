"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Sidebar, { WorkspaceNav } from "@/components/Sidebar";
import Dialog from "@/components/ui/Dialog";
import type { NavId } from "@/lib/nav";
import { isAuthenticated, logout, refreshCurrentUser, type AuthUser } from "@/lib/auth";
import { useLanguage } from "@/lib/useLanguage";

type Props = {
  active: NavId;
  children: React.ReactNode;
};

const COLLAPSE_KEY = "seasentry-nav-collapsed";

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}

export default function AppShell({ active, children }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const roleLabel: Record<AuthUser["role"], string> = { viewer: t.header.roleViewer, operator: t.header.roleOperator, admin: t.header.roleAdmin };

  useEffect(() => {
    // Restoring a per-viewer layout preference from storage after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(readCollapsed());
  }, []);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    void refreshCurrentUser().then((next) => {
      if (cancelled) return;
      if (!next) router.replace("/login");
      else setUser(next);
    });
    return () => { cancelled = true; };
  }, [router]);

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

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <div className="dashboard-shell">
      <a href="#workspace-main" className="skip-link">{t.common.skipToContent}</a>
      <Header onLogout={handleLogout} onMenuClick={toggleMenu} menuExpanded={drawerOpen || !collapsed} userName={user.name} userRole={roleLabel[user.role]} />
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
