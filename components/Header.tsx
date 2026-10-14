"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { FlaskConical, LogOut, Menu, X } from "lucide-react";
import Brand from "@/components/Brand";
import { useIncidentStore } from "@/lib/incident-store";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageToggle from "@/components/ui/LanguageToggle";
import { useLanguage } from "@/lib/useLanguage";

type Props = {
  onLogout?: () => void;
  onMenuClick?: () => void;
  menuExpanded?: boolean;
  signingOut?: boolean;
  userName?: string;
  userRole?: string;
};

const bakuTime = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
function subscribeClock(onChange: () => void) {
  const id = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(id);
}

function LiveClock() {
  const time = useSyncExternalStore(subscribeClock, bakuTime, () => null);
  return <span className="workspace-clock" aria-label={time ? `${time} AZT` : undefined}>{time ?? "--:--"} AZT</span>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase()).join("") || "?";
}

/** The demo scenario is a client-only simulation. It is labelled as such and
 * never presented as a service-health indicator. */
function DemoScenarioControl() {
  const { hasLiveIncident, simulateLiveIncident, resolveLiveIncident } = useIncidentStore();
  const { t } = useLanguage();
  if (hasLiveIncident) {
    return (
      <div className="demo-control demo-control--active" role="group" aria-label={t.header.demoScenario}>
        <span className="demo-control-status"><span className="demo-control-dot" aria-hidden="true" />{t.header.demoActive}</span>
        <button type="button" className="demo-control-clear" onClick={resolveLiveIncident} title={t.header.markResolvedTitle}>
          <X size={14} aria-hidden="true" />{t.header.clearDemo}
        </button>
      </div>
    );
  }
  return (
    <button type="button" className="demo-control" onClick={simulateLiveIncident} title={t.header.simulateLiveIncident}>
      <FlaskConical size={15} aria-hidden="true" /><span>{t.header.demoScenario}</span>
    </button>
  );
}

export default function Header({ onLogout, onMenuClick, menuExpanded, signingOut, userName = "", userRole = "" }: Props) {
  const { t } = useLanguage();

  return (
    <header className="workspace-header">
      <div className="workspace-header-start">
        {onMenuClick && (
          <button type="button" className="ui-icon-button" aria-label={t.header.toggleNav} aria-expanded={menuExpanded} aria-controls="workspace-nav" onClick={onMenuClick}>
            <Menu size={19} aria-hidden="true" />
          </button>
        )}
        <Link href="/dashboard" className="workspace-brand" aria-label="SeaSentry">
          <Brand tagline={t.header.tagline} />
        </Link>
      </div>

      <div className="workspace-header-actions">
        <LiveClock />
        <DemoScenarioControl />
        <LanguageToggle />
        <ThemeToggle />
        {userName && (
          <div className="workspace-user">
            <span className="workspace-avatar" aria-hidden="true">{initials(userName)}</span>
            <span className="workspace-user-copy"><strong>{userName}</strong><span>{userRole}</span></span>
          </div>
        )}
        {onLogout && (
          <button type="button" className="ui-icon-button" onClick={onLogout} disabled={signingOut} aria-busy={signingOut || undefined} title={t.header.signOut} aria-label={t.header.signOut}>
            <LogOut size={17} aria-hidden="true" />
          </button>
        )}
      </div>
    </header>
  );
}
