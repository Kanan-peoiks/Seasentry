"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, AlertTriangle, Ship, Brain, Siren, FileBarChart, UserCircle, ShieldCheck } from "lucide-react";
import { NAV_ROUTES, type NavId } from "@/lib/nav";
import { useLanguage } from "@/lib/useLanguage";
import type { Translations } from "@/lib/i18n";

type NavItem = { id: NavId; labelKey: keyof Translations["sidebar"]; icon: React.ElementType };

const NAV: NavItem[] = [
  { id: "dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { id: "incidents", labelKey: "incidents", icon: AlertTriangle },
  { id: "vessels", labelKey: "vessels", icon: Ship },
  { id: "ai", labelKey: "ai", icon: Brain },
  { id: "response", labelKey: "response", icon: Siren },
  { id: "reports", labelKey: "reports", icon: FileBarChart },
  { id: "account", labelKey: "account", icon: UserCircle },
  { id: "admin", labelKey: "admin", icon: ShieldCheck },
];

type Props = {
  active?: NavId;
  /** Desktop rail collapsed to icons only. Ignored inside the mobile drawer. */
  collapsed?: boolean;
  showAdmin?: boolean;
  onNavigate?: () => void;
  id?: string;
};

export function WorkspaceNav({ active, collapsed = false, showAdmin = false, onNavigate, id }: Props) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav id={id} className={`workspace-nav${collapsed ? " workspace-nav--collapsed" : ""}`} aria-label={t.sidebar.navigation}>
      <ul>
        {NAV.filter((item) => item.id !== "admin" || showAdmin).map((item) => {
          const href = NAV_ROUTES[item.id];
          const isActive = active === item.id || pathname === href || pathname.startsWith(`${href}/`);
          const label = t.sidebar[item.labelKey];
          const Icon = item.icon;
          return (
            <li key={item.id}>
              <Link href={href} className="workspace-nav-link" aria-current={isActive ? "page" : undefined} title={collapsed ? label : undefined} onClick={onNavigate}>
                <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
                <span className={collapsed ? "sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!collapsed && (
        <div className="workspace-nav-note">
          <strong>{t.sidebar.monitoring}</strong>
          <span>{t.sidebar.monitoringDesc}</span>
        </div>
      )}
    </nav>
  );
}

export default function Sidebar(props: Props) {
  return (
    <aside className={`workspace-sidebar${props.collapsed ? " workspace-sidebar--collapsed" : ""}`}>
      <WorkspaceNav {...props} id="workspace-nav" />
    </aside>
  );
}
