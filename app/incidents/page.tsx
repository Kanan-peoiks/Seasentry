"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowDownUp, CheckCircle2, Eye, RefreshCw, ShieldAlert } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import FilterBar from "@/components/ui/FilterBar";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import DataState from "@/components/ui/DataState";
import IncidentDetailsPanel from "@/components/incidents/IncidentDetailsPanel";
import { useIncidentStore } from "@/lib/incident-store";
import { useLanguage } from "@/lib/useLanguage";
import { formatAreaM2 } from "@/lib/mock-data";
import { isMeasuredScan, incidentProvenance } from "@/lib/incident-metrics";
import { formatWorkspaceTime, matchesIncidentDate, setWorkspaceQuery } from "@/lib/workspace-url";
import type { Incident } from "@/lib/types";

type SortKey = "displayId" | "location" | "timestamp" | "areaM2" | "risk" | "status" | "aiProbability";
const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
export default function IncidentsPage() { return <AppShell active="incidents"><Suspense fallback={<DataState loading />}><IncidentRegister /></Suspense></AppShell>; }

function IncidentRegister() {
  const { lang, t } = useLanguage();
  const { incidents, stats, loading, error, reloadIncidents, refreshing, getIncidentById, lastUpdated } = useIncidentStore();
  const params = useSearchParams();
  const search = params.get("q") ?? "";
  const risk = params.get("risk") ?? "all";
  const status = params.get("status") ?? "all";
  const location = params.get("location") ?? "all";
  const date = params.get("date") ?? "all";
  const sort = (["displayId", "location", "timestamp", "areaM2", "risk", "status", "aiProbability"].includes(params.get("sort") ?? "") ? params.get("sort") : "timestamp") as SortKey;
  const dir = params.get("dir") === "asc" ? "asc" : "desc";
  const open = params.get("open");
  const selected = open ? getIncidentById(open) ?? null : null;
  const query = search.trim().toLocaleLowerCase();
  const rows = incidents.filter((i) => (risk === "all" || i.risk === risk) && (status === "all" || i.status === status) && (location === "all" || i.location === location) && matchesIncidentDate(i.timestamp, date) && (!query || `${i.displayId} ${i.location} ${i.title}`.toLocaleLowerCase().includes(query))).sort((a, b) => {
    const difference = sort === "risk" ? order[a.risk] - order[b.risk] : sort === "timestamp" ? Date.parse(a.timestamp) - Date.parse(b.timestamp) : typeof a[sort] === "number" ? Number(a[sort]) - Number(b[sort]) : String(a[sort]).localeCompare(String(b[sort]));
    return dir === "asc" ? difference : -difference;
  });
  const locations = Array.from(new Set(incidents.map((i) => i.location))).sort();
  const headers: [SortKey, string][] = [["displayId", t.incidents.colId], ["location", t.incidents.colLocation], ["timestamp", t.incidents.colDetectionTime], ["areaM2", t.incidents.colArea], ["risk", t.incidents.colRisk], ["status", t.incidents.colStatus], ["aiProbability", t.incidents.colModelConf]];
  const sortBy = (key: SortKey) => setWorkspaceQuery({ sort: key, dir: sort === key && dir === "asc" ? "desc" : "asc" });
  const select = (event: React.MouseEvent<HTMLAnchorElement>, incident: Incident) => {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && event.button === 0) { event.preventDefault(); setWorkspaceQuery({ open: incident.id, wide: null }, true); }
  };
  return <><div className="dashboard-scroll">
    <PageHeader title={t.incidents.title} subtitle={t.incidents.subtitle} actions={<Button onClick={() => void reloadIncidents()} busy={refreshing}><RefreshCw size={16} aria-hidden="true" />{t.common.refresh}</Button>} />
    <section className="workspace-stats" aria-label={lang === "az" ? "Hadisə göstəriciləri" : "Incident metrics"}>
      <StatCard label={t.incidents.activeIncidents} value={loading ? "—" : stats.active} icon={<AlertTriangle size={17} />} />
      <StatCard label={t.incidents.highRisk} value={loading ? "—" : stats.highRisk} accent="var(--color-high)" icon={<ShieldAlert size={17} />} />
      <StatCard label={t.incidents.underReview} value={loading ? "—" : stats.underReview} accent="var(--color-med)" icon={<Eye size={17} />} />
      <StatCard label={t.incidents.resolved} value={loading ? "—" : stats.resolved} accent="var(--color-low)" icon={<CheckCircle2 size={17} />} />
    </section>
    {error && incidents.length > 0 && <Notice tone="error" action={<Button onClick={() => void reloadIncidents()}>{t.session.retry}</Button>}>{lang === "az" ? "Yenilənmə alınmadı. Son uğurlu məlumat göstərilir." : "Refresh failed. Showing the last successful data."}</Notice>}
    <FilterBar search={search} onSearchChange={(q) => setWorkspaceQuery({ q })} searchPlaceholder={t.incidents.searchPlaceholder} searchLabel={t.common.search} filters={[
      { id: "risk", label: t.incidents.risk, value: risk, options: [{ value: "all", label: t.incidents.allRisks }, ...(["HIGH", "MEDIUM", "LOW"] as const).map((value) => ({ value, label: t.risk[value] }))], onChange: (value) => setWorkspaceQuery({ risk: value }) },
      { id: "status", label: t.incidents.status, value: status, options: [{ value: "all", label: t.incidents.allStatuses }, ...Object.entries(t.status).map(([value, label]) => ({ value, label }))], onChange: (value) => setWorkspaceQuery({ status: value }) },
      { id: "location", label: t.incidents.location, value: location, options: [{ value: "all", label: t.incidents.allLocations }, ...locations.map((value) => ({ value, label: value }))], onChange: (value) => setWorkspaceQuery({ location: value }) },
      { id: "date", label: t.incidents.date, value: date, options: [{ value: "all", label: t.incidents.allDates }, { value: "today", label: t.incidents.dateToday }, { value: "7d", label: t.incidents.dateLast7Days }, { value: "30d", label: t.incidents.dateLast30Days }], onChange: (value) => setWorkspaceQuery({ date: value }) },
    ]} trailing={<Button variant="ghost" onClick={() => setWorkspaceQuery({ q: null, risk: null, status: null, location: null, date: null })}>{lang === "az" ? "Filtrləri sıfırla" : "Reset filters"}</Button>} />
    {open && !loading && !selected && <Notice tone="error" action={<Button onClick={() => setWorkspaceQuery({ open: null, wide: null })}>{t.common.close}</Button>}>{lang === "az" ? "Hadisə tapılmadı." : "Incident not found."}</Notice>}
    <section className="panel panel-static"><header className="section-heading"><div><h2>{t.incidents.incidentRegister}</h2><p>{loading ? t.common.loading : t.incidents.resultCount(rows.length)}</p></div>{lastUpdated && <span className="provenance">{formatWorkspaceTime(lastUpdated, lang)}</span>}</header>
      <DataState loading={loading} error={!incidents.length ? error : null} empty={rows.length === 0} onRetry={() => void reloadIncidents()}>
        <div className="table-scroll desktop-records"><table className="data-table"><caption className="sr-only">{t.incidents.incidentRegister}</caption><thead><tr>{headers.map(([key, label]) => <th key={key} scope="col" aria-sort={sort === key ? (dir === "asc" ? "ascending" : "descending") : "none"}><button type="button" className="table-sort" onClick={() => sortBy(key)}>{label}<ArrowDownUp size={12} aria-hidden="true" /></button></th>)}<th scope="col">{t.incidents.colAction}</th></tr></thead><tbody>{rows.map((i) => <tr key={i.id}><td><Link className="table-link" href={`/incidents?open=${encodeURIComponent(i.id)}`} onClick={(e) => select(e, i)}>{i.displayId}</Link></td><td>{i.title || i.location}<span className="cell-secondary">{i.location}</span><span className="provenance">{incidentProvenance(i, lang)}</span></td><td>{formatWorkspaceTime(i.timestamp, lang)}<span className="cell-secondary">AZT</span></td><td>{formatAreaM2(i.areaM2)}</td><td><RiskBadge risk={i.risk} /></td><td><StatusBadge status={i.status} /></td><td>{isMeasuredScan(i) ? `${Math.round(i.aiProbability * 100)}%` : "—"}</td><td><Link className="table-link" href={`/incidents?open=${encodeURIComponent(i.id)}`} onClick={(e) => select(e, i)}>{t.incidents.view}<Eye size={15} style={{ marginLeft: 6 }} aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>
        <div className="mobile-records">{rows.map((i) => <Link className="record-card" key={i.id} href={`/incidents?open=${encodeURIComponent(i.id)}`} onClick={(e) => select(e, i)}><div className="record-card-header"><strong>{i.displayId}</strong><RiskBadge risk={i.risk} /></div><p>{i.title || i.location}</p><div className="record-card-meta"><StatusBadge status={i.status} /><span>{formatAreaM2(i.areaM2)}</span><span>{formatWorkspaceTime(i.timestamp, lang)}</span></div></Link>)}</div>
      </DataState>
    </section>
  </div><IncidentDetailsPanel incident={selected} expanded={params.get("wide") === "1"} onClose={() => setWorkspaceQuery({ open: null, wide: null })} context="incident" /></>;
}
