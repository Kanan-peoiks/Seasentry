"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowUpRight, Link2, Radar, Ship } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import FilterBar from "@/components/ui/FilterBar";
import DetailPanel from "@/components/ui/DetailPanel";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import DataState from "@/components/ui/DataState";
import { useIncidentStore } from "@/lib/incident-store";
import { useLanguage } from "@/lib/useLanguage";
import { distanceToIncidentKm } from "@/lib/mock-data";
import { formatWorkspaceTime, setWorkspaceQuery } from "@/lib/workspace-url";
import type { OpsVessel } from "@/lib/types";

type LiveVessel = { mmsi: string; name?: string | null; lat: number; lng: number; speedKnots?: number | null; heading?: number | null; lastUpdate?: string | null };
export default function VesselsPage() { return <AppShell active="vessels"><Suspense fallback={<DataState loading />}><VesselWorkspace /></Suspense></AppShell>; }
function VesselWorkspace() {
  const { lang, t } = useLanguage();
  const { vessels, getIncidentById } = useIncidentStore();
  const params = useSearchParams();
  const search = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const selected = vessels.find((v) => v.id === params.get("open")) ?? null;
  const [region, setRegion] = useState<keyof typeof t.vessels.regions>("caspian");
  const [live, setLive] = useState<{ rows: LiveVessel[]; receivedAt: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const statusLabel = (value: OpsVessel["status"]) => ({ "In port": t.vessels.statusInPort, Approaching: t.vessels.statusApproaching, Transiting: t.vessels.statusTransiting, Suspicious: t.vessels.statusSuspicious, Response: t.vessels.statusResponse })[value];
  const rows = vessels.filter((v) => (status === "all" || status === v.status) && `${v.name} ${v.mmsi} ${v.type}`.toLowerCase().includes(search.toLowerCase()));
  const fetchAis = async () => {
    if (busy) return;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/vessels/live?region=${region}`, { cache: "no-store", signal: request.signal });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : t.vessels.aisFailed);
      if (!request.signal.aborted) setLive({ rows: Array.isArray(data?.vessels) ? data.vessels : [], receivedAt: new Date().toISOString() });
    } catch (failure) { if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : t.auth.serverUnavailable); }
    finally { if (!request.signal.aborted) setBusy(false); }
  };
  const related = selected?.relatedIncidentId ? getIncidentById(selected.relatedIncidentId) : undefined;
  const openVessel = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey) { e.preventDefault(); setWorkspaceQuery({ open: id }, true); } };
  return <><div className="dashboard-scroll"><PageHeader title={t.vessels.title} subtitle={t.vessels.subtitle} /><Notice>{t.vessels.registerNote}</Notice>
    <section className="workspace-stats"><StatCard label={t.vessels.totalVessels} value={vessels.length} hint={t.sidebar.demoDataNote} icon={<Ship size={17} />} /><StatCard label={t.vessels.nearbyVessels} value={vessels.filter((v) => { const incident = v.relatedIncidentId ? getIncidentById(v.relatedIncidentId) : null; return incident && distanceToIncidentKm(v, incident) < 5; }).length} hint={t.vessels.nearbyHint} icon={<Radar size={17} />} /><StatCard label={t.vessels.suspicious} value={vessels.filter((v) => v.status === "Suspicious").length} hint={t.vessels.demoScenario} accent="var(--color-med)" icon={<AlertTriangle size={17} />} /><StatCard label={t.vessels.linkedToIncidents} value={vessels.filter((v) => v.relatedIncidentId).length} icon={<Link2 size={17} />} /></section>
    <FilterBar search={search} onSearchChange={(q) => setWorkspaceQuery({ q })} searchPlaceholder={t.vessels.searchPlaceholder} searchLabel={t.common.search} filters={[{ id: "status", label: t.vessels.status, value: status, options: [{ value: "all", label: t.vessels.allStatuses }, ...(["In port", "Approaching", "Transiting", "Suspicious", "Response"] as const).map((value) => ({ value, label: statusLabel(value) }))], onChange: (value) => setWorkspaceQuery({ status: value }) }]} />
    <section className="panel panel-static"><header className="section-heading"><div><h2>{t.vessels.register}</h2><p>{t.vessels.resultCount(rows.length)}</p></div><span className="provenance">{t.sidebar.demoDataNote}</span></header><DataState empty={rows.length === 0}>
      <div className="table-scroll desktop-records"><table className="data-table"><caption className="sr-only">{t.vessels.title}</caption><thead><tr>{[t.vessels.colName, "MMSI", t.vessels.colType, t.vessels.colSpeed, t.vessels.colStatus, t.vessels.lastUpdate].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((v) => <tr key={v.id}><td><Link className="table-link" href={`/vessels?open=${v.id}`} onClick={(e) => openVessel(e, v.id)}>{v.name}</Link><span className="cell-secondary">{v.lat.toFixed(3)}°, {v.lng.toFixed(3)}°</span></td><td>{v.mmsi}</td><td>{v.type}</td><td>{v.speedKnots.toFixed(1)} kn</td><td><span className="provenance">{statusLabel(v.status)}</span></td><td>{formatWorkspaceTime(v.lastUpdate, lang)}</td></tr>)}</tbody></table></div>
      <div className="mobile-records">{rows.map((v) => <Link className="record-card" href={`/vessels?open=${v.id}`} key={v.id} onClick={(e) => openVessel(e, v.id)}><div className="record-card-header"><strong>{v.name}</strong><Ship size={17} aria-hidden="true" /></div><p>{v.type} · MMSI {v.mmsi}</p><div className="record-card-meta"><span>{statusLabel(v.status)}</span><span>{v.speedKnots.toFixed(1)} kn</span></div></Link>)}</div></DataState></section>
    <section className="panel panel-static" id="ais"><header className="section-heading"><div><h2>{t.vessels.aisTitle}</h2><p>{t.vessels.liveAisSubtitle}</p></div><div className="ais-controls"><label>{t.vessels.regionLabel}<select name="ais-region" value={region} disabled={busy} onChange={(e) => { setRegion(e.target.value as typeof region); setLive(null); setError(null); }}>{Object.entries(t.vessels.regions).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><Button variant="primary" busy={busy} onClick={() => void fetchAis()}><Radar size={16} aria-hidden="true" />{busy ? t.vessels.fetchingLive : t.vessels.fetchLive}</Button></div></header>
      <div className="ais-content"><p>{t.vessels.liveAisHint(t.vessels.regions[region])}</p>{error && <Notice tone="error" action={<Button onClick={() => void fetchAis()}>{t.session.retry}</Button>}>{error}</Notice>}{busy && <p role="status">{t.vessels.fetchingLive}</p>}{live && <p className="provenance">{t.vessels.fetchedAt(formatWorkspaceTime(live.receivedAt, lang), live.rows.length)}</p>}{live?.rows.length === 0 && <Notice>{t.vessels.liveAisEmpty}</Notice>}
      {!!live?.rows.length && <><div className="table-scroll desktop-records"><table className="data-table"><caption className="sr-only">{t.vessels.liveAisTitle}</caption><thead><tr>{[t.vessels.colName, "MMSI", t.vessels.colPosition, t.vessels.colSpeed, t.vessels.colHeading, t.vessels.lastUpdate].map((label) => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{live.rows.map((v) => <tr key={v.mmsi}><td>{v.name || t.vessels.unknownVessel}</td><td>{v.mmsi}</td><td>{v.lat.toFixed(3)}°, {v.lng.toFixed(3)}°</td><td>{v.speedKnots == null ? "—" : `${v.speedKnots.toFixed(1)} kn`}</td><td>{v.heading == null ? "—" : `${v.heading}°`}</td><td>{formatWorkspaceTime(v.lastUpdate ?? "", lang)}</td></tr>)}</tbody></table></div><div className="mobile-records">{live.rows.map((v) => <article className="record-card" key={v.mmsi}><strong>{v.name || t.vessels.unknownVessel}</strong><p>MMSI {v.mmsi}</p><div className="record-card-meta"><span>{v.lat.toFixed(3)}°, {v.lng.toFixed(3)}°</span><span>{v.speedKnots == null ? "—" : `${v.speedKnots.toFixed(1)} kn`}</span></div></article>)}</div></>}
      </div></section>
  </div><DetailPanel open={!!selected} title={selected?.name || ""} subtitle={selected ? `${selected.type} · MMSI ${selected.mmsi}` : undefined} onClose={() => setWorkspaceQuery({ open: null })}>{selected && <div className="vessel-detail"><Notice>{t.vessels.demoDataNote}</Notice><dl><dt>{t.vessels.colStatus}</dt><dd>{statusLabel(selected.status)}</dd><dt>{t.vessels.colPosition}</dt><dd>{selected.lat.toFixed(4)}°, {selected.lng.toFixed(4)}°</dd><dt>{t.vessels.colSpeed}</dt><dd>{selected.speedKnots.toFixed(1)} kn</dd><dt>{t.vessels.colHeading}</dt><dd>{selected.heading}°</dd><dt>{t.vessels.lastUpdate}</dt><dd>{formatWorkspaceTime(selected.lastUpdate, lang)}</dd></dl>{related ? <Link className="ui-button" href={`/incidents?open=${related.id}`}>{related.displayId} · {related.location}<ArrowUpRight size={15} aria-hidden="true" /></Link> : <p>{t.vessels.noNearbyAssociation}</p>}</div>}</DetailPanel></>;
}
