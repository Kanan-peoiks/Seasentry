"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Droplets, Eye, FileBarChart, FileDown, FileSpreadsheet, History, Maximize2, Percent, RefreshCw, Satellite, ShieldAlert } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import DataState from "@/components/ui/DataState";
import Dialog from "@/components/ui/Dialog";
import { useIncidentStore } from "@/lib/incident-store";
import { formatAreaM2 } from "@/lib/mock-data";
import { useLanguage } from "@/lib/useLanguage";
import { formatWorkspaceTime } from "@/lib/workspace-url";
import { downloadOverviewCsv, downloadOverviewPdf, downloadScanPdf, type SavedReport, type ScanLog } from "@/lib/reports";

type Remote<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ok"; rows: T[] };

function useRemoteList<T>(url: string, failMessage: string) {
  const [state, setState] = useState<Remote<T>>({ status: "loading" });
  const load = useCallback(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(failMessage);
        const data: unknown = await res.json();
        setState({ status: "ok", rows: Array.isArray(data) ? (data as T[]) : [] });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ status: "error", message: error instanceof Error && error.message !== "Failed to fetch" ? error.message : failMessage });
      });
    return controller;
  }, [url, failMessage]);
  useEffect(() => {
    const controller = load();
    return () => controller.abort();
  }, [load]);
  const retry = () => {
    setState({ status: "loading" });
    load();
  };
  return [state, retry] as const;
}

/** Reverse-geocodes a scan location via Nominatim; keyed by scan id so a
 * late answer for a previous scan is ignored. */
function usePlaceName(scan: ScanLog | null) {
  const [place, setPlace] = useState<{ id: string; label: string | null } | null>(null);
  useEffect(() => {
    if (!scan) return;
    const controller = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${scan.lat}&lon=${scan.lng}&zoom=10&addressdetails=1`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const a = data?.address || {};
        const name = a.city || a.town || a.village || a.county || a.state || null;
        setPlace({ id: scan.id, label: [name, a.country].filter(Boolean).join(", ") || data?.display_name || null });
      })
      .catch(() => { if (!controller.signal.aborted) setPlace({ id: scan.id, label: null }); });
    return () => controller.abort();
  }, [scan]);
  return scan && place?.id === scan.id ? place.label : null;
}

export default function ReportsPage() {
  return (
    <AppShell active="reports">
      <ReportsContent />
    </AppShell>
  );
}

function ReportsContent() {
  const { t, lang } = useLanguage();
  const r = t.reports;
  const { report, incidents, stats, loading } = useIncidentStore();
  const [history, retryHistory] = useRemoteList<SavedReport>("/api/reports", r.historyFailed);
  const [scans, retryScans] = useRemoteList<ScanLog>("/api/detect/history", r.scansFailed);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | null>(null);
  const [exportError, setExportError] = useState(false);
  const [openScan, setOpenScan] = useState<ScanLog | null>(null);
  const [scanPdf, setScanPdf] = useState<{ id: string; state: "generating" | "ready" | "error" } | null>(null);
  const place = usePlaceName(openScan);

  const historyRows = history.status === "ok" ? history.rows : [];
  const risk = {
    HIGH: incidents.filter((i) => i.risk === "HIGH").length,
    MEDIUM: incidents.filter((i) => i.risk === "MEDIUM").length,
    LOW: incidents.filter((i) => i.risk === "LOW").length,
  };
  const score = report.averageAiConfidence === null ? t.incidentDetail.notMeasured : `${report.averageAiConfidence}%`;

  const exportPdf = async () => {
    setExporting("pdf");
    setExportError(false);
    try {
      await downloadOverviewPdf(report, risk, historyRows, t, lang);
    } catch {
      setExportError(true);
    } finally {
      setExporting(null);
    }
  };

  const generateScanPdf = async (scan: ScanLog) => {
    setScanPdf({ id: scan.id, state: "generating" });
    const linked = scan.incidentId ? incidents.find((i) => i.id === scan.incidentId)?.displayId ?? scan.incidentId : null;
    try {
      await downloadScanPdf(scan, place, linked, t, lang);
      setScanPdf({ id: scan.id, state: "ready" });
    } catch {
      setScanPdf({ id: scan.id, state: "error" });
    }
  };

  const scanPdfState = openScan && scanPdf?.id === openScan.id ? scanPdf.state : null;
  const exportButtons = (
    <>
      <Button onClick={() => downloadOverviewCsv(report, risk, historyRows, t, lang)} disabled={loading}><FileSpreadsheet size={16} aria-hidden="true" />{r.exportCsv}</Button>
      <Button variant="primary" onClick={() => void exportPdf()} busy={exporting === "pdf"} disabled={loading}><FileDown size={16} aria-hidden="true" />{r.exportPdf}</Button>
    </>
  );

  return (
    <div className="dashboard-scroll">
      <PageHeader title={r.title} subtitle={r.subtitle} actions={<><Button onClick={() => setPreviewOpen(true)} disabled={loading}><Eye size={16} aria-hidden="true" />{r.previewSummary}</Button>{exportButtons}</>} />
      {exportError && <Notice tone="error" action={<Button onClick={() => void exportPdf()}>{t.session.retry}</Button>}>{t.pdf.failed}</Notice>}

      <section className="workspace-stats workspace-stats--six" aria-label={r.title}>
        <StatCard label={r.totalIncidents} value={loading ? "—" : report.totalIncidents} icon={<FileBarChart size={17} />} />
        <StatCard label={r.totalDetectedArea} value={loading ? "—" : formatAreaM2(report.totalDetectedAreaM2)} hint={r.areaHint} icon={<Maximize2 size={17} />} />
        <StatCard label={r.totalCleanedArea} value={loading ? "—" : formatAreaM2(report.totalCleanedAreaM2)} hint={r.cleanedHint} accent="var(--color-low)" icon={<Droplets size={17} />} />
        <StatCard label={r.highRiskIncidents} value={loading ? "—" : report.highRiskCount} accent="var(--color-high)" icon={<ShieldAlert size={17} />} />
        <StatCard label={r.averageAiConfidence} value={loading ? "—" : score} hint={r.scoreHint} icon={<Percent size={17} />} />
        <StatCard label={r.resolvedIncidents} value={loading ? "—" : report.resolvedCount} accent="var(--success)" icon={<CheckCircle2 size={17} />} />
      </section>

      <div className="report-panels">
        <section className="panel panel-static" aria-labelledby="snapshot-title">
          <header className="section-heading"><div><h2 id="snapshot-title">{r.operationalSnapshot}</h2></div></header>
          <dl className="summary-list">
            <div><dt>{r.activeIncidents}</dt><dd>{stats.active}</dd></div>
            <div><dt>{r.underReview}</dt><dd>{stats.underReview}</dd></div>
            <div><dt>{r.resolved}</dt><dd>{stats.resolved}</dd></div>
            <div><dt>{r.datasetScope}</dt><dd>{r.datasetScopeValue}</dd></div>
          </dl>
        </section>
        <section className="panel panel-static" aria-labelledby="risk-title">
          <header className="section-heading"><div><h2 id="risk-title">{r.riskDistribution}</h2></div></header>
          <div className="risk-bars">
            {(["HIGH", "MEDIUM", "LOW"] as const).map((level) => {
              const pct = report.totalIncidents ? Math.round((risk[level] / report.totalIncidents) * 100) : 0;
              return (
                <div key={level} className="risk-bar">
                  <div className="risk-bar-label"><span>{t.risk[level]}</span><span>{risk[level]} ({pct}%)</span></div>
                  <div className="risk-bar-track" role="img" aria-label={`${t.risk[level]}: ${pct}%`}><div className={`risk-bar-fill risk-bar-fill--${level.toLowerCase()}`} style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="panel panel-static" aria-labelledby="history-title">
        <header className="section-heading">
          <div><h2 id="history-title"><History size={16} aria-hidden="true" /> {r.reportHistory}</h2><p>{history.status === "ok" ? r.generatedCount(history.rows.length) : r.historyHint}</p></div>
          <Button variant="ghost" onClick={retryHistory} busy={history.status === "loading"}><RefreshCw size={15} aria-hidden="true" />{t.common.refresh}</Button>
        </header>
        <DataState loading={history.status === "loading"} error={history.status === "error" ? history.message : null} empty={history.status === "ok" && history.rows.length === 0} onRetry={retryHistory}>
          <div className="table-scroll desktop-records">
            <table className="data-table">
              <caption className="sr-only">{r.reportHistory}</caption>
              <thead><tr><th scope="col">{r.colIncident}</th><th scope="col">{r.colTeam}</th><th scope="col">{r.colCost}</th><th scope="col">{r.colGeneratedBy}</th><th scope="col">{r.colGeneratedAt}</th></tr></thead>
              <tbody>
                {historyRows.map((h) => (
                  <tr key={h.id}>
                    <td><strong>{h.incidentDisplayId}</strong><span className="cell-secondary">{h.incidentTitle}</span></td>
                    <td>{h.team}</td>
                    <td>${h.estimatedCostUsd.toLocaleString("en-US")}<span className="cell-secondary">{t.incidentDetail.estimateTag}</span></td>
                    <td>{h.generatedBy}</td>
                    <td>{formatWorkspaceTime(h.generatedAt, lang)} AZT</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mobile-records">
            {historyRows.map((h) => (
              <article className="record-card" key={h.id}>
                <div className="record-card-header"><strong>{h.incidentDisplayId}</strong><span>${h.estimatedCostUsd.toLocaleString("en-US")}</span></div>
                <p>{h.incidentTitle}</p>
                <div className="record-card-meta"><span>{h.generatedBy}</span><span>{formatWorkspaceTime(h.generatedAt, lang)}</span></div>
              </article>
            ))}
          </div>
        </DataState>
      </section>

      <section className="panel panel-static" aria-labelledby="scans-title">
        <header className="section-heading">
          <div><h2 id="scans-title"><Satellite size={16} aria-hidden="true" /> {r.scanHistory}</h2><p>{r.scanHistoryHint}</p></div>
          <Button variant="ghost" onClick={retryScans} busy={scans.status === "loading"}><RefreshCw size={15} aria-hidden="true" />{t.common.refresh}</Button>
        </header>
        <DataState loading={scans.status === "loading"} error={scans.status === "error" ? scans.message : null} empty={scans.status === "ok" && scans.rows.length === 0} onRetry={retryScans}>
          <ul className="scan-grid">
            {(scans.status === "ok" ? scans.rows : []).map((s) => (
              <li key={s.id}>
                <button type="button" className="scan-tile" onClick={() => setOpenScan(s)} aria-label={`${r.scanDetails}: ${s.lat.toFixed(3)}°N, ${s.lng.toFixed(3)}°E, ${s.found ? r.scanFound(Math.round(s.aiProbability * 100)) : r.scanNotFound}`}>
                  {s.sarImageBase64 ? (
                    // eslint-disable-next-line @next/next/no-img-element -- inline base64 scan imagery
                    <img src={`data:image/png;base64,${s.sarImageBase64}`} alt="" />
                  ) : (
                    <span className="scan-tile-empty"><Satellite size={20} aria-hidden="true" /></span>
                  )}
                  <span className="scan-tile-body">
                    <span className={`scan-result${s.found ? " scan-result--found" : ""}`}>{s.found ? r.scanFound(Math.round(s.aiProbability * 100)) : r.scanNotFound}</span>
                    <span className="mono">{s.lat.toFixed(3)}°N, {s.lng.toFixed(3)}°E</span>
                    <span className="scan-tile-time">{formatWorkspaceTime(s.createdAt, lang)} AZT</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DataState>
      </section>

      <Dialog
        open={!!openScan}
        variant="center"
        width={460}
        title={r.scanDetails}
        subtitle={openScan ? `${formatWorkspaceTime(openScan.createdAt, lang)} AZT` : undefined}
        onClose={() => setOpenScan(null)}
        footer={openScan && (
          <Button variant="primary" onClick={() => void generateScanPdf(openScan)} busy={scanPdfState === "generating"}>
            <FileDown size={16} aria-hidden="true" />{scanPdfState === "ready" ? t.incidentDetail.generateAgain : t.incidentDetail.generatePdfReport}
          </Button>
        )}
      >
        {openScan && (
          <div className="scan-detail">
            {openScan.sarImageBase64 && (
              // eslint-disable-next-line @next/next/no-img-element -- inline base64 scan imagery
              <img src={`data:image/png;base64,${openScan.sarImageBase64}`} alt={t.incidentDetail.originalSar} />
            )}
            <dl className="summary-list">
              <div><dt>{r.scanCoordinates}</dt><dd>{openScan.lat.toFixed(4)}°N, {openScan.lng.toFixed(4)}°E{place ? ` (${place})` : ""}</dd></div>
              <div><dt>{r.scanSearchWindow}</dt><dd>{openScan.fromDate && openScan.toDate ? `${openScan.fromDate} → ${openScan.toDate}` : r.scanDefaultWindow}</dd></div>
              <div><dt>{r.scanResult}</dt><dd>{openScan.found ? r.scanFound(Math.round(openScan.aiProbability * 100)) : r.scanNotFound}</dd></div>
              {openScan.found && <div><dt>{r.scanArea}</dt><dd>{formatAreaM2(openScan.areaM2)}</dd></div>}
              {openScan.requestedBy && <div><dt>{r.scanRequestedBy}</dt><dd>{openScan.requestedBy}</dd></div>}
              <div><dt>{r.scanLinkedIncident}</dt><dd>{openScan.incidentId ? incidents.find((i) => i.id === openScan.incidentId)?.displayId || openScan.incidentId : r.scanNoIncident}</dd></div>
            </dl>
            <div aria-live="polite">
              {scanPdfState === "ready" && <p className="detail-hint">{t.pdf.downloaded}</p>}
              {scanPdfState === "error" && <Notice tone="error">{t.pdf.failed}</Notice>}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={previewOpen} variant="center" width={520} title={r.previewTitle} subtitle={r.previewBody} onClose={() => setPreviewOpen(false)} footer={exportButtons}>
        <dl className="summary-list">
          <div><dt>{r.totalIncidents}</dt><dd>{report.totalIncidents}</dd></div>
          <div><dt>{r.detectedArea}</dt><dd>{formatAreaM2(report.totalDetectedAreaM2)}</dd></div>
          <div><dt>{r.cleanedArea}</dt><dd>{formatAreaM2(report.totalCleanedAreaM2)}</dd></div>
          <div><dt>{r.highRiskIncidents}</dt><dd>{report.highRiskCount}</dd></div>
          <div><dt>{r.avgAiConfidence}</dt><dd>{score}</dd></div>
          <div><dt>{r.reportHistory}</dt><dd>{r.generatedCount(historyRows.length)}</dd></div>
        </dl>
      </Dialog>
    </div>
  );
}
