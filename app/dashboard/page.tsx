"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, Crosshair, Droplets, Eye, Layers, LocateFixed, MapPin, Maximize2, Minimize2, Minus, Plus, RefreshCw, RotateCcw, Satellite, ShieldAlert, X } from "lucide-react";
import AppShell from "@/components/AppShell";
import MapPanel, { DEFAULT_MAP_LAYERS, type MapHandle, type MapLayerId, type MapLayers } from "@/components/MapPanel";
import SeaWeatherWidget from "@/components/SeaWeatherWidget";
import IncidentDetailsPanel from "@/components/incidents/IncidentDetailsPanel";
import ManualIncidentForm from "@/components/incidents/ManualIncidentForm";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import DataState from "@/components/ui/DataState";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import { useIncidentStore, LIVE_INCIDENT_ID } from "@/lib/incident-store";
import { useSpillSourceEstimate } from "@/lib/useSpillSourceEstimate";
import { formatAreaM2, mockData } from "@/lib/mock-data";
import { canOperate } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/useLanguage";
import { formatWorkspaceTime, setWorkspaceQuery } from "@/lib/workspace-url";
import { needsDecision } from "@/lib/incident-metrics";
import type { Incident } from "@/lib/types";

export default function DashboardPage() {
  return (
    <AppShell active="dashboard">
      <Suspense fallback={<DataState loading />}>
        <DashboardContent />
      </Suspense>
    </AppShell>
  );
}

const RISK_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Rail and docked details need at least this much width beside the map. */
const WIDE_WORKSPACE_PX = 1040;

type Mode = "none" | "report" | "scan";
type ScanState = { state: "idle" } | { state: "running" } | { state: "done"; tone: "info" | "error" | "success"; message: string };

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function CoordinateForm({ onSubmit }: { onSubmit: (lat: number, lng: number) => void }) {
  const { t } = useLanguage();
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      className="coord-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const la = Number(lat.replace(",", "."));
        const ln = Number(lng.replace(",", "."));
        const valid = lat.trim() !== "" && lng.trim() !== "" && la >= 36 && la <= 47.5 && ln >= 46 && ln <= 55.5;
        setError(!valid);
        if (valid) onSubmit(la, ln);
      }}
    >
      <label className="ui-field">{t.mapPanel.latitude}<input className="ui-input" name="lat" inputMode="decimal" autoComplete="off" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="40.15" aria-invalid={error} aria-describedby={error ? "coord-error" : undefined} /></label>
      <label className="ui-field">{t.mapPanel.longitude}<input className="ui-input" name="lng" inputMode="decimal" autoComplete="off" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="50.05" aria-invalid={error} aria-describedby={error ? "coord-error" : undefined} /></label>
      <Button type="submit"><Crosshair size={15} aria-hidden="true" />{t.mapPanel.useCoords}</Button>
      {error && <span id="coord-error" className="ui-field-error coord-error" role="alert">{t.mapPanel.coordsInvalid}</span>}
    </form>
  );
}

function LayerMenu({ layers, onChange }: { layers: MapLayers; onChange: (next: MapLayers) => void }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  const items: [MapLayerId, string, string?][] = [
    ["active", t.mapPanel.layerActive],
    ["history", t.mapPanel.layerHistory],
    ["vessels", t.mapPanel.layerVessels],
    ["zones", t.mapPanel.layerZones],
    ["drift", t.mapPanel.layerDrift, t.mapPanel.layerDriftHint],
  ];
  return (
    <div className="layer-menu" ref={wrapRef}>
      <Button aria-expanded={open} aria-controls="map-layer-menu" onClick={() => setOpen((v) => !v)}><Layers size={16} aria-hidden="true" />{t.mapPanel.layers}</Button>
      {open && (
        <fieldset id="map-layer-menu" className="layer-menu-panel">
          <legend className="sr-only">{t.mapPanel.layers}</legend>
          {items.map(([id, label, hint]) => (
            <label key={id} className="layer-option">
              <input type="checkbox" checked={layers[id]} onChange={(e) => onChange({ ...layers, [id]: e.target.checked })} />
              <span>{label}{hint && <small>{hint}</small>}</span>
            </label>
          ))}
          <div className="layer-legend" aria-label={t.mapPanel.legend}>
            <strong>{t.mapPanel.legendRisk}</strong>
            <span><i className="legend-dot" style={{ background: "#C0392B" }} />{t.risk.HIGH}</span>
            <span><i className="legend-dot" style={{ background: "#B7791F" }} />{t.risk.MEDIUM}</span>
            <span><i className="legend-dot" style={{ background: "#1F7A99" }} />{t.risk.LOW}</span>
            <strong>{t.mapPanel.legendStatus}</strong>
            <span><i className="legend-ring" />{t.mapPanel.legendNew}</span>
            <span><i className="legend-ring legend-ring--solid" />{t.mapPanel.legendReview}</span>
            <span><i className="legend-ring legend-ring--dashed" />{t.mapPanel.legendCleaning}</span>
            <span><i className="legend-ring legend-ring--hollow" />{t.mapPanel.legendClosed}</span>
          </div>
        </fieldset>
      )}
    </div>
  );
}

function ReviewQueue({ incidents, onSelect }: { incidents: Incident[]; onSelect: (incident: Incident) => void }) {
  const { t, lang } = useLanguage();
  const queue = incidents.filter(needsDecision).sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return (
    <section className="rail-section" aria-labelledby="review-queue-title">
      <header className="rail-heading">
        <div>
          <h2 id="review-queue-title">{t.dashboard.needsReview} <span className="count-badge">{queue.length}</span></h2>
          <p>{t.dashboard.needsReviewHint}</p>
        </div>
      </header>
      {queue.length === 0 ? (
        <p className="rail-empty">{t.dashboard.noneNeedReview}</p>
      ) : (
        <ul className="queue-list">
          {queue.map((incident) => (
            <li key={incident.id}>
              <button type="button" className="queue-item" onClick={() => onSelect(incident)}>
                <span className={`queue-risk queue-risk--${incident.risk.toLowerCase()}`} aria-hidden="true" />
                <span className="queue-copy">
                  <span className="queue-title"><strong>{incident.displayId}</strong> {incident.title || incident.location}</span>
                  <span className="queue-meta">{formatWorkspaceTime(incident.timestamp, lang)} · {formatAreaM2(incident.areaM2)}</span>
                  <span className="queue-badges"><RiskBadge risk={incident.risk} /><StatusBadge status={incident.status} /></span>
                </span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link href="/incidents" className="rail-link">{t.dashboard.viewAll}<ArrowRight size={15} aria-hidden="true" /></Link>
    </section>
  );
}

function DashboardContent() {
  const { t, lang } = useLanguage();
  const params = useSearchParams();
  const { user } = useSession();
  const canAct = canOperate(user);
  const { incidents, vessels, riskZones, stats, loading, refreshing, error, lastUpdated, reloadIncidents, hasLiveIncident, ingestIncident, getIncidentById } = useIncidentStore();
  const mapRef = useRef<MapHandle>(null);
  const [rootRef, width] = useElementWidth<HTMLDivElement>();
  const wide = width >= WIDE_WORKSPACE_PX;

  const selectedId = params.get("incident");
  const selected = selectedId ? getIncidentById(selectedId) ?? null : null;
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_MAP_LAYERS);
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<Mode>("none");
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scan, setScan] = useState<ScanState>({ state: "idle" });
  const [scanTo, setScanTo] = useState(() => isoDay(Date.now()));
  const [scanFrom, setScanFrom] = useState(() => isoDay(Date.now() - 30 * DAY_MS));
  const [weatherPortId, setWeatherPortId] = useState(mockData.ports[0].id);
  const weatherPort = mockData.ports.find((p) => p.id === weatherPortId) ?? mockData.ports[0];

  const select = (incident: Incident | null) => {
    setWorkspaceQuery({ incident: incident?.id ?? null }, true);
    if (incident) mapRef.current?.focusIncident(incident);
  };

  // Drift estimates for the calculated layer: the selected incident and the demo scenario.
  const liveIncident = hasLiveIncident ? incidents.find((i) => i.id === LIVE_INCIDENT_ID) ?? null : null;
  const { estimate: liveEstimate } = useSpillSourceEstimate(layers.drift ? liveIncident : null);
  const { estimate: selectedEstimate } = useSpillSourceEstimate(layers.drift ? selected : null);
  const sourceEstimates = useMemo(() => {
    const out: Record<string, typeof liveEstimate> = {};
    if (liveIncident) out[liveIncident.id] = liveEstimate;
    if (selected) out[selected.id] = selectedEstimate;
    return out;
  }, [liveIncident, liveEstimate, selected, selectedEstimate]);

  const mapVessels = useMemo(() => vessels.map((v) => ({ id: v.id, name: v.name, portId: v.portId, lat: v.lat, lng: v.lng, distanceKm: 0, speedKnots: v.speedKnots, heading: v.heading, status: (v.status === "Suspicious" || v.status === "Response" ? "Transiting" : v.status) as "In port" | "Approaching" | "Transiting", type: v.type })), [vessels]);

  const runScan = async (lat: number, lng: number) => {
    setScan({ state: "running" });
    try {
      const res = await fetch("/api/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, fromDate: scanFrom, toDate: scanTo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setScan({ state: "done", tone: "error", message: t.dashboard.scanError(data?.error || `HTTP ${res.status}`) });
        return;
      }
      if (data?.created && data.incident) {
        const incident = ingestIncident(data.incident);
        setScan({ state: "done", tone: "success", message: t.dashboard.scanCreated });
        select(incident);
        return;
      }
      setScan({ state: "done", tone: "info", message: t.dashboard.scanNoneFound(Math.round((data?.aiProbability ?? 0) * 100)) });
    } catch {
      setScan({ state: "done", tone: "error", message: t.dashboard.scanError(t.auth.serverUnavailable) });
    }
  };

  const pick = (lat: number, lng: number) => {
    const current = mode;
    setMode("none");
    if (current === "scan") void runScan(lat, lng);
    else if (current === "report") setPendingCoords({ lat, lng });
  };

  const toggleMode = (next: Mode) => setMode((m) => (m === next ? "none" : next));
  const docked = wide && !expanded;

  const details = selected && (
    <IncidentDetailsPanel incident={selected} onClose={() => select(null)} presentation={docked ? "docked" : "dialog"} />
  );

  return (
    <div ref={rootRef} className={`dashboard${expanded ? " dashboard--expanded" : ""}${docked ? " dashboard--wide" : ""}${docked && selected ? " dashboard--detail" : ""}`}>
      {!expanded && (
        <header className="dash-heading page-heading">
          <div className="page-heading-copy">
            <h1>{t.dashboard.title}</h1>
            <p>{lang === "az" ? "Xəzərdəki hadisələri izləyin, peyk görüntülərini yoxlayın və qərar verin." : "Monitor Caspian incidents, inspect satellite imagery and coordinate decisions."}</p>
          </div>
          <div className="dash-heading-meta">
            {lastUpdated && <span>{t.dashboard.updatedAt(formatWorkspaceTime(lastUpdated, lang))}</span>}
            <Button onClick={() => void reloadIncidents()} busy={refreshing} aria-label={t.common.refresh}><RefreshCw size={16} aria-hidden="true" />{t.common.refresh}</Button>
          </div>
        </header>
      )}
      {!expanded && (
        <section className="dash-kpis" aria-label={t.dashboard.title}>
          <div className="dash-kpi"><span className="dash-kpi-label"><AlertTriangle size={15} aria-hidden="true" />{t.dashboard.kpiOpen}</span><strong>{loading ? "—" : stats.active}</strong></div>
          <div className="dash-kpi dash-kpi--high"><span className="dash-kpi-label"><ShieldAlert size={15} aria-hidden="true" />{t.dashboard.kpiHighRisk}</span><strong>{loading ? "—" : stats.highRisk}</strong></div>
          <div className="dash-kpi dash-kpi--med"><span className="dash-kpi-label"><Eye size={15} aria-hidden="true" />{t.dashboard.kpiAwaiting}</span><strong>{loading ? "—" : stats.underReview}</strong></div>
          <div className="dash-kpi"><span className="dash-kpi-label"><Droplets size={15} aria-hidden="true" />{t.dashboard.kpiCleaning}</span><strong>{loading ? "—" : incidents.filter((i) => i.status === "cleaning").length}</strong></div>
        </section>
      )}

      {error && incidents.length > 0 && <Notice tone="error" action={<Button onClick={() => void reloadIncidents()}>{t.session.retry}</Button>}>{t.dashboard.refreshFailed}</Notice>}
      {error && incidents.length === 0 && !loading && <Notice tone="error" action={<Button onClick={() => void reloadIncidents()} busy={refreshing}>{t.session.retry}</Button>}>{error}</Notice>}
      {selectedId && !loading && !selected && <Notice tone="warning" action={<Button onClick={() => select(null)}>{t.common.close}</Button>}>{t.dashboard.incidentNotFound}</Notice>}

      <div className="dash-main">
        <section className="map-card" aria-labelledby="map-title">
          <div className="map-toolbar" role="toolbar" aria-label={t.dashboard.title}>
            {expanded ? <h1 id="map-title" className="map-toolbar-title">{t.mapPanel.title}</h1> : <h2 id="map-title" className="map-toolbar-title">{t.mapPanel.title}</h2>}
            <div className="map-toolbar-group">
              {canAct && (
                <>
                  <Button variant={mode === "scan" ? "primary" : "secondary"} aria-pressed={mode === "scan"} onClick={() => toggleMode("scan")} disabled={scan.state === "running"}>
                    <Satellite size={16} aria-hidden="true" />{t.dashboard.checkImagery}
                  </Button>
                  <Button variant={mode === "report" ? "primary" : "secondary"} aria-pressed={mode === "report"} onClick={() => toggleMode("report")}>
                    <MapPin size={16} aria-hidden="true" />{t.dashboard.reportSpill}
                  </Button>
                </>
              )}
              <LayerMenu layers={layers} onChange={setLayers} />
            </div>
            <div className="map-toolbar-group map-toolbar-view" role="group" aria-label={t.mapPanel.resetView}>
              <button type="button" className="ui-icon-button" onClick={() => mapRef.current?.zoomIn()} aria-label={t.mapPanel.zoomIn} title={t.mapPanel.zoomIn}><Plus size={17} aria-hidden="true" /></button>
              <button type="button" className="ui-icon-button" onClick={() => mapRef.current?.zoomOut()} aria-label={t.mapPanel.zoomOut} title={t.mapPanel.zoomOut}><Minus size={17} aria-hidden="true" /></button>
              <button type="button" className="ui-icon-button" onClick={() => mapRef.current?.resetView()} aria-label={t.mapPanel.resetView} title={t.mapPanel.resetView}><RotateCcw size={16} aria-hidden="true" /></button>
              <button type="button" className="ui-icon-button" onClick={() => mapRef.current?.fitActive()} aria-label={t.mapPanel.showActive} title={t.mapPanel.showActive}><LocateFixed size={16} aria-hidden="true" /></button>
              <button type="button" className="ui-icon-button" onClick={() => setExpanded((v) => !v)} aria-pressed={expanded} aria-label={expanded ? t.mapPanel.collapse : t.mapPanel.expand} title={expanded ? t.mapPanel.collapse : t.mapPanel.expand}>{expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}</button>
            </div>
          </div>

          {(mode !== "none" || scan.state !== "idle" || !canAct) && (
            <div className="map-context" aria-live="polite">
              {mode !== "none" && (
                <div className="map-context-row">
                  <p className="map-context-hint"><Crosshair size={16} aria-hidden="true" />{mode === "scan" ? t.dashboard.placingScan : t.dashboard.placingReport} <span className="hide-sm">{t.mapPanel.escToCancel}</span></p>
                  {mode === "scan" && (
                    <div className="scan-window">
                      <label className="ui-field">{t.dashboard.scanFrom}<input className="ui-input" type="date" name="scan-from" value={scanFrom} max={scanTo} onChange={(e) => setScanFrom(e.target.value)} /></label>
                      <label className="ui-field">{t.dashboard.scanTo}<input className="ui-input" type="date" name="scan-to" value={scanTo} min={scanFrom} onChange={(e) => setScanTo(e.target.value)} /></label>
                    </div>
                  )}
                  <CoordinateForm onSubmit={pick} />
                  <Button variant="ghost" onClick={() => setMode("none")}><X size={16} aria-hidden="true" />{t.dashboard.cancel}</Button>
                </div>
              )}
              {scan.state === "running" && <Notice>{t.dashboard.scanRunning}</Notice>}
              {scan.state === "done" && <Notice tone={scan.tone} action={<Button variant="ghost" onClick={() => setScan({ state: "idle" })}>{t.common.close}</Button>}>{scan.message}</Notice>}
              {!canAct && mode === "none" && scan.state === "idle" && <p className="map-context-note">{t.dashboard.viewerNote}</p>}
            </div>
          )}

          <div className="map-frame">
            <MapPanel
              ref={mapRef}
              label={t.mapPanel.title}
              incidents={incidents}
              vessels={mapVessels}
              riskZones={riskZones}
              layers={layers}
              selectedId={selected?.id ?? null}
              liveIncidentId={hasLiveIncident ? LIVE_INCIDENT_ID : null}
              sourceEstimates={sourceEstimates}
              onIncidentSelect={select}
              placementMode={mode !== "none"}
              placementHint={mode === "scan" ? t.mapPanel.clickToScan : mode === "report" ? t.mapPanel.clickToPlaceIncident : undefined}
              onMapClick={pick}
              onPlacementCancel={() => setMode("none")}
            />
          </div>
        </section>

        {!expanded && (
          <aside className="dash-rail" aria-label={t.dashboard.needsReview}>
            {docked && selected ? (
              <>
                <button type="button" className="rail-back" onClick={() => select(null)}><ArrowLeft size={16} aria-hidden="true" />{t.dashboard.back}</button>
                {details}
              </>
            ) : (
              <>
                <DataState loading={loading} error={incidents.length ? null : error} onRetry={() => void reloadIncidents()}>
                  <ReviewQueue incidents={incidents} onSelect={select} />
                </DataState>
                <section className="rail-section" aria-labelledby="conditions-title">
                  <header className="rail-heading rail-heading--inline">
                    <h2 id="conditions-title">{t.dashboard.conditions}</h2>
                    <label className="rail-select">
                      <span className="sr-only">{t.dashboard.location}</span>
                      <select className="ui-select" name="weather-location" value={weatherPortId} onChange={(e) => setWeatherPortId(e.target.value)}>
                        {mockData.ports.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </label>
                  </header>
                  <SeaWeatherWidget lat={weatherPort.lat} lng={weatherPort.lng} label={weatherPort.name} />
                </section>
              </>
            )}
          </aside>
        )}
      </div>

      {!docked && details}

      {pendingCoords && (
        <ManualIncidentForm
          lat={pendingCoords.lat}
          lng={pendingCoords.lng}
          onClose={() => setPendingCoords(null)}
          onCreated={(incident) => {
            setPendingCoords(null);
            select(incident);
          }}
        />
      )}
    </div>
  );
}
