"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Brain, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Notice from "@/components/ui/Notice";
import DataState from "@/components/ui/DataState";
import Button from "@/components/ui/Button";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import IncidentDetailsPanel from "@/components/incidents/IncidentDetailsPanel";
import { useIncidentStore } from "@/lib/incident-store";
import { useLanguage } from "@/lib/useLanguage";
import { incidentProvenance, isMeasuredScan, sarReviewOutcomes, scanConfidence } from "@/lib/incident-metrics";
import { formatWorkspaceTime, setWorkspaceQuery } from "@/lib/workspace-url";
import { formatAreaM2 } from "@/lib/mock-data";

export default function AiAnalysisPage() { return <AppShell active="ai"><Suspense fallback={<DataState loading />}><AnalysisWorkspace /></Suspense></AppShell>; }
function AnalysisWorkspace() {
  const { lang, t } = useLanguage();
  const { incidents, loading, error, refreshing, reloadIncidents, getIncidentById } = useIncidentStore();
  const params = useSearchParams();
  const selected = params.get("open") ? getIncidentById(params.get("open")!) ?? null : null;
  const confidence = scanConfidence(incidents);
  const outcomes = sarReviewOutcomes(incidents);
  const pending = incidents.filter((i) => i.status === "detected" || (i.status === "under_review" && i.humanDecision !== "confirmed_spill"));
  const queue = [...incidents].sort((a, b) => Number(pending.includes(b)) - Number(pending.includes(a)) || Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const labels = lang === "az" ? { outcomes: "SAR baxış nəticələri", scope: "Təsviri olan peyk aşkarlamalarının hazırkı statusu. Model dəqiqliyi ölçüsü deyil.", confidence: "Orta skan göstəricisi", scans: "Təsvirli SAR skanları", awaiting: "Qərar gözləyir", confirmed: "Təsdiqlənib", cleaning: "Təmizlənir", resolved: "Həll edilib", rejected: "Rədd edilib", recorded: "Qeydə alınıb", inspect: "Sübutlara bax", notMeasured: "Ölçülməyib", signals: "Detektor siqnalları", empty: "Hələ ölçülmüş SAR skanı yoxdur." } : { outcomes: "SAR review outcomes", scope: "Current review status of satellite detections with imagery. This is not a model accuracy metric.", confidence: "Average scan score", scans: "SAR scans with imagery", awaiting: "Awaiting decision", confirmed: "Confirmed", cleaning: "Cleaning", resolved: "Resolved", rejected: "Rejected", recorded: "Incident recorded", inspect: "Inspect evidence", notMeasured: "Not measured", signals: "Detector feature signals", empty: "No measured SAR scans yet." };
  return <><div className="dashboard-scroll"><PageHeader title={t.aiAnalysis.title} subtitle={t.aiAnalysis.subtitle} actions={<Button busy={refreshing} onClick={() => void reloadIncidents()}><RefreshCw size={16} aria-hidden="true" />{t.common.refresh}</Button>} /><Notice><strong>{t.aiAnalysis.humanReviewRequired}</strong> {t.aiAnalysis.humanReviewBody}</Notice><section className="workspace-stats"><StatCard label={labels.scans} value={loading ? "—" : outcomes.total} icon={<Brain size={17} />} /><StatCard label={labels.confidence} value={confidence === null ? "—" : `${Math.round(confidence * 100)}%`} hint={lang === "az" ? "Yalnız təsvirli SAR skanları" : "Only SAR scans with imagery"} /><StatCard label={labels.awaiting} value={loading ? "—" : pending.length} accent="var(--color-med)" icon={<Clock size={17} />} /><StatCard label={labels.resolved} value={loading ? "—" : outcomes.resolved} icon={<ShieldCheck size={17} />} /></section>
    <section className="panel panel-static"><header className="section-heading"><div><h2>{labels.outcomes}</h2><p>{labels.scope}</p></div></header><div className="analysis-outcomes">{outcomes.total ? (["pending", "confirmed", "cleaning", "resolved", "rejected"] as const).map((key) => <div key={key}><strong>{outcomes[key]}</strong><span>{key === "pending" ? labels.awaiting : labels[key]}</span></div>) : <p>{labels.empty}</p>}</div></section>
    <section className="panel panel-static"><header className="section-heading"><div><h2>{t.aiAnalysis.queueTitle}</h2><p>{lang === "az" ? "Qərar gözləyən hadisələr əvvəl göstərilir." : "Incidents awaiting a decision are shown first."}</p></div></header><DataState loading={loading} error={!incidents.length ? error : null} empty={queue.length === 0} onRetry={() => void reloadIncidents()}><div className="analysis-queue">{queue.map((i) => <article key={i.id} className="analysis-card"><div className="record-card-header"><div><span className="provenance">{incidentProvenance(i, lang)}</span><h3>{i.displayId} · {i.title || i.location}</h3></div><div className="analysis-badges"><RiskBadge risk={i.risk} /><StatusBadge status={i.status} /></div></div><div className="analysis-measurements"><div><span>{t.incidentDetail.detectorScore}</span><strong>{isMeasuredScan(i) ? `${Math.round(i.aiProbability * 100)}%` : labels.notMeasured}</strong></div><div><span>{t.aiAnalysis.estimatedArea}</span><strong>{formatAreaM2(i.areaM2)}</strong></div><div><span>{labels.recorded}</span><strong>{formatWorkspaceTime(i.timestamp, lang)}</strong></div></div>{i.aiSummary && <p>{i.aiSummary}</p>}<Link className="ui-button" href={`/ai-analysis?open=${encodeURIComponent(i.id)}`} onClick={(e) => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); setWorkspaceQuery({ open: i.id }, true); } }}>{labels.inspect}<ArrowRight size={15} aria-hidden="true" /></Link></article>)}</div></DataState></section>
  </div><IncidentDetailsPanel incident={selected} expanded={params.get("wide") === "1"} context="ai" onClose={() => setWorkspaceQuery({ open: null, wide: null })} /></>;
}
