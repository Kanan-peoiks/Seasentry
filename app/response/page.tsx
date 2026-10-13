"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle2, Droplets, Eye, RefreshCw, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import DataState from "@/components/ui/DataState";
import IncidentDetailsPanel from "@/components/incidents/IncidentDetailsPanel";
import { useIncidentStore } from "@/lib/incident-store";
import { formatAreaM2 } from "@/lib/mock-data";
import { decisionStage, type DecisionStage } from "@/lib/incident-metrics";
import { formatWorkspaceTime, setWorkspaceQuery } from "@/lib/workspace-url";
import { useLanguage } from "@/lib/useLanguage";
import type { Incident } from "@/lib/types";

type Column = "review" | "confirmed" | "cleaning" | "resolved";
const COLUMNS: { id: Column; stages: DecisionStage[]; icon: React.ReactNode }[] = [
  { id: "review", stages: ["pending", "escalated"], icon: <Eye size={18} aria-hidden="true" /> },
  { id: "confirmed", stages: ["confirmed"], icon: <ShieldCheck size={18} aria-hidden="true" /> },
  { id: "cleaning", stages: ["cleaning"], icon: <Droplets size={18} aria-hidden="true" /> },
  { id: "resolved", stages: ["resolved"], icon: <CheckCircle2 size={18} aria-hidden="true" /> },
];
const RISK_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;

export default function ResponsePage() {
  return (
    <AppShell active="response">
      <Suspense fallback={<DataState loading />}>
        <ResponseContent />
      </Suspense>
    </AppShell>
  );
}

function ResponseContent() {
  const { t, lang } = useLanguage();
  const w = t.response;
  const params = useSearchParams();
  const { incidents, loading, error, refreshing, reloadIncidents, getIncidentById } = useIncidentStore();
  const open = params.get("open");
  const selected = open ? getIncidentById(open) ?? null : null;

  const grouped = Object.fromEntries(COLUMNS.map((col) => [
    col.id,
    incidents
      .filter((i) => col.stages.includes(decisionStage(i)))
      .sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || Date.parse(b.timestamp) - Date.parse(a.timestamp)),
  ])) as Record<Column, Incident[]>;
  const rejected = incidents.filter((i) => i.status === "rejected").length;

  const openIncident = (e: React.MouseEvent<HTMLAnchorElement>, incident: Incident) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setWorkspaceQuery({ open: incident.id }, true);
  };

  return (
    <>
      <div className="dashboard-scroll">
        <PageHeader title={w.title} subtitle={w.subtitle} actions={<Button onClick={() => void reloadIncidents()} busy={refreshing}><RefreshCw size={16} aria-hidden="true" />{t.common.refresh}</Button>} />
        {error && incidents.length > 0 && <Notice tone="error" action={<Button onClick={() => void reloadIncidents()}>{t.session.retry}</Button>}>{t.dashboard.refreshFailed}</Notice>}

        <nav className="stage-summary" aria-label={w.workflowTitle}>
          <ol>
            {COLUMNS.map((col, index) => (
              <li key={col.id}>
                <a href={`#stage-${col.id}`}>
                  <span className="stage-index">{index + 1}</span>
                  <span className="stage-copy"><strong>{w.stages[col.id]}</strong><span>{w.stageHints[col.id]}</span></span>
                  <span className="stage-count">{loading ? "—" : grouped[col.id].length}</span>
                </a>
              </li>
            ))}
          </ol>
          {rejected > 0 && <p className="stage-note">{w.rejectedNote(rejected)}</p>}
        </nav>

        <DataState loading={loading} error={incidents.length ? null : error} onRetry={() => void reloadIncidents()}>
          <div className="response-board">
            {COLUMNS.map((col) => (
              <section key={col.id} id={`stage-${col.id}`} className={`response-column response-column--${col.id}`} aria-labelledby={`stage-title-${col.id}`}>
                <header className="response-column-head">
                  {col.icon}
                  <h2 id={`stage-title-${col.id}`}>{w.stages[col.id]}</h2>
                  <span className="count-badge">{grouped[col.id].length}</span>
                </header>
                {grouped[col.id].length === 0 ? (
                  <p className="rail-empty">{w.noIncidentsInStage}</p>
                ) : (
                  <ul className="response-list">
                    {grouped[col.id].map((incident) => (
                      <li key={incident.id}>
                        <Link className="response-card" href={`/response?open=${encodeURIComponent(incident.id)}`} onClick={(e) => openIncident(e, incident)}>
                          <span className="response-card-top"><strong>{incident.displayId}</strong><RiskBadge risk={incident.risk} /></span>
                          <span className="response-card-title">{incident.title || incident.location}</span>
                          <span className="response-card-meta">{incident.location} · {formatAreaM2(incident.areaM2)}</span>
                          <span className="response-card-meta">{w.lastChange(formatWorkspaceTime(incident.humanDecisionAt || incident.timestamp, lang))}</span>
                          <span className="response-card-next"><StatusBadge status={incident.status} /><span>{w.next[decisionStage(incident)]}</span><ArrowRight size={15} aria-hidden="true" /></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </DataState>
      </div>

      <IncidentDetailsPanel incident={selected} onClose={() => setWorkspaceQuery({ open: null })} />
    </>
  );
}
