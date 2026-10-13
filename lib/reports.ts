// ============================================================
// Report exports: incident PDF, scan PDF, overview PDF and CSV.
// Text follows the selected UI language; every value keeps its
// provenance label (measured, reported, calculated, estimate).
// Downloading a PDF and archiving it to the report history are
// separate operations with separate results.
// ============================================================

import { createPdf } from "@/lib/pdf";
import { formatAreaM2 } from "@/lib/mock-data";
import { compassLabel, SORBENT_RATIO_G, type ResponseMaterials, type SpillSourceResult } from "@/lib/spill-physics";
import { isMeasuredScan } from "@/lib/incident-metrics";
import { formatWorkspaceTime } from "@/lib/workspace-url";
import { LIVE_INCIDENT_ID } from "@/lib/incident-store";
import type { Language, Translations } from "@/lib/i18n";
import type { Incident, ReportSummary } from "@/lib/types";

export type SavedReport = {
  id: string;
  incidentId: string;
  incidentDisplayId: string;
  incidentTitle: string;
  team: string;
  estimatedCostUsd: number;
  generatedBy: string;
  generatedAt: string;
};

export type ScanLog = {
  id: string;
  lat: number;
  lng: number;
  fromDate?: string | null;
  toDate?: string | null;
  createdAt: string;
  found: boolean;
  aiProbability: number;
  areaM2: number;
  sarImageBase64?: string | null;
  incidentId?: string | null;
  requestedBy?: string | null;
};

const stamp = () => new Date().toISOString().slice(0, 10);
const when = (iso: string, lang: Language) => `${formatWorkspaceTime(iso, lang)} AZT`;
const fullTime = (iso: string, lang: Language) =>
  `${new Intl.DateTimeFormat(lang === "az" ? "az-AZ" : "en-GB", { timeZone: "Asia/Baku", dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))} AZT`;

export async function downloadIncidentPdf(incident: Incident, materials: ResponseMaterials, estimate: SpillSourceResult | null, t: Translations, lang: Language) {
  const p = t.pdf;
  const d = t.incidentDetail;
  const pdf = await createPdf();
  pdf.title(p.incidentTitle(incident.displayId), `${incident.title || incident.location} · ${p.generated(fullTime(new Date().toISOString(), lang))}`);

  pdf.heading(p.sectionIncident);
  pdf.field(d.location, incident.location);
  pdf.field(d.coordinates, `${incident.lat.toFixed(4)}°N, ${incident.lng.toFixed(4)}°E`);
  pdf.field(d.detectionTime, fullTime(incident.timestamp, lang));
  pdf.field(d.detectionSource, incident.detectionSource);
  pdf.field(d.risk, t.risk[incident.risk]);
  pdf.field(d.status, t.status[incident.status]);
  pdf.field(d.estimatedArea, `${formatAreaM2(incident.areaM2)} (${isMeasuredScan(incident) ? d.measuredTag : d.reportedTag})`);

  pdf.heading(p.sectionDecision);
  pdf.field(d.decision, d.humanDecision[incident.humanDecision as keyof typeof d.humanDecision] ?? incident.humanDecision);
  if (incident.humanDecisionBy) pdf.field(d.specialist, incident.humanDecisionBy);
  if (incident.humanDecisionAt) pdf.field(d.decidedAt, fullTime(incident.humanDecisionAt, lang));
  if (incident.humanDecisionNote) pdf.field(d.notes, incident.humanDecisionNote);

  pdf.heading(d.evidence);
  if (isMeasuredScan(incident)) {
    pdf.field(d.detectorScore, `${Math.round(incident.aiProbability * 100)}% (${d.measuredTag})`);
    pdf.paragraph(d.detectorScoreNote, 9, true);
  } else {
    pdf.field(d.detectorScore, d.notMeasured);
  }
  if (incident.aiSummary) pdf.paragraph(incident.aiSummary);
  if (incident.sarImageBase64) pdf.image(incident.sarImageBase64, d.originalSar, 72);
  if (incident.sarOverlayBase64) pdf.image(incident.sarOverlayBase64, d.aiOverlay, 72);
  if (!incident.sarImageBase64) pdf.paragraph(incident.detectionSource === "Manual report" ? d.noImageryManual : d.noImagery, 9, true);

  pdf.heading(`${d.spillSourceDriftAnalysis} (${d.calculationTag})`);
  if (estimate?.available) {
    pdf.field(d.estimatedRuptureCoords, `${estimate.lat.toFixed(4)}°N, ${estimate.lng.toFixed(4)}°E`);
    pdf.field(d.distanceDrifted, d.distanceOverHours(estimate.distanceKm, estimate.hoursElapsed));
    pdf.field(d.driftSpeed, d.driftSpeedToward(estimate.driftSpeedKmh, compassLabel(estimate.downwindBearingDeg)));
    pdf.field(d.confidence, `${estimate.confidencePct}%`);
    pdf.paragraph(d.driftMethodNote, 9, true);
  } else {
    pdf.paragraph(estimate?.reason === "too-stale" ? d.tooStaleNote(estimate.hoursElapsed ?? 0) : d.windDataUnavailable, 9, true);
  }

  if (incident.status !== "rejected") {
    pdf.heading(`${d.requirements} (${d.estimateTag})`);
    pdf.paragraph(d.requirementsNote, 9, true);
    pdf.field(d.boomRequired, `${materials.boomMeters} m`);
    pdf.field(d.sorbentRequired, `${materials.sorbentKg} kg`);
    pdf.field(d.skimmerUnits, String(materials.skimmerUnits));
    pdf.field(d.supportVessels, String(materials.vesselCount));
    pdf.field(d.estimatedDuration, `${materials.durationHours} h`);
    pdf.field(d.costEstimate, `$${materials.estimatedCostUsd.toLocaleString("en-US")}`);
    pdf.paragraph(d.sorbentRatioNote(SORBENT_RATIO_G, materials.oilMassKg), 9, true);
  }

  pdf.save(`seasentry-incident-${incident.displayId.replace("#", "")}-${stamp()}.pdf`, p.footer);
}

/** Records the generated report in the backend history. The demo scenario
 * exists only in this browser and is never archived. */
export async function archiveIncidentReport(incident: Incident, materials: ResponseMaterials): Promise<{ ok: true } | { ok: false; error: string }> {
  if (incident.id === LIVE_INCIDENT_ID) return { ok: false, error: "simulation" };
  try {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        incidentId: incident.id,
        incidentDisplayId: incident.displayId,
        incidentTitle: incident.title,
        team: materials.team,
        boomMeters: materials.boomMeters,
        sorbentKg: materials.sorbentKg,
        oilMassKg: materials.oilMassKg,
        skimmerUnits: materials.skimmerUnits,
        vesselCount: materials.vesselCount,
        durationHours: materials.durationHours,
        estimatedCostUsd: materials.estimatedCostUsd,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      return { ok: false, error: typeof data?.error === "string" ? data.error : `HTTP ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "network" };
  }
}

export async function downloadScanPdf(scan: ScanLog, place: string | null, linkedIncident: string | null, t: Translations, lang: Language) {
  const r = t.reports;
  const pdf = await createPdf();
  pdf.title(t.pdf.scanTitle, t.pdf.generated(fullTime(new Date().toISOString(), lang)));
  pdf.heading(t.pdf.sectionScan);
  pdf.field(r.scanCoordinates, `${scan.lat.toFixed(4)}°N, ${scan.lng.toFixed(4)}°E${place ? ` (${place})` : ""}`);
  pdf.field(r.scanWhen, fullTime(scan.createdAt, lang));
  pdf.field(r.scanSearchWindow, scan.fromDate && scan.toDate ? `${scan.fromDate} → ${scan.toDate}` : r.scanDefaultWindow);
  pdf.field(r.scanRequestedBy, scan.requestedBy || "—");
  pdf.heading(r.scanResult);
  pdf.field(r.scanResult, scan.found ? r.scanFound(Math.round(scan.aiProbability * 100)) : r.scanNotFound);
  if (scan.found) pdf.field(r.scanArea, formatAreaM2(scan.areaM2));
  pdf.field(r.scanLinkedIncident, linkedIncident ?? r.scanNoIncident);
  if (scan.sarImageBase64) pdf.image(scan.sarImageBase64, t.incidentDetail.originalSar, 120);
  pdf.save(`seasentry-scan-${scan.id.slice(0, 8)}-${stamp()}.pdf`, t.pdf.footer);
}

type RiskCounts = Record<"HIGH" | "MEDIUM" | "LOW", number>;

export async function downloadOverviewPdf(report: ReportSummary, risk: RiskCounts, history: SavedReport[], t: Translations, lang: Language) {
  const r = t.reports;
  const pdf = await createPdf();
  pdf.title(t.pdf.overviewTitle, t.pdf.generated(fullTime(new Date().toISOString(), lang)));
  pdf.heading(t.pdf.sectionSummary);
  pdf.field(r.totalIncidents, String(report.totalIncidents));
  pdf.field(r.totalDetectedArea, formatAreaM2(report.totalDetectedAreaM2));
  pdf.field(r.totalCleanedArea, formatAreaM2(report.totalCleanedAreaM2));
  pdf.field(r.highRiskIncidents, String(report.highRiskCount));
  pdf.field(r.averageAiConfidence, report.averageAiConfidence === null ? t.incidentDetail.notMeasured : `${report.averageAiConfidence}%`);
  pdf.field(r.resolvedIncidents, String(report.resolvedCount));
  pdf.heading(r.riskDistribution);
  (["HIGH", "MEDIUM", "LOW"] as const).forEach((level) => {
    const pct = report.totalIncidents ? Math.round((risk[level] / report.totalIncidents) * 100) : 0;
    pdf.field(t.risk[level], `${risk[level]} (${pct}%)`);
  });
  pdf.heading(r.reportHistory);
  if (!history.length) pdf.paragraph(r.noReportsYet, 9, true);
  history.forEach((h) => pdf.field(`${h.incidentDisplayId}`, `${h.incidentTitle} · $${h.estimatedCostUsd.toLocaleString("en-US")} (${t.incidentDetail.estimateTag}) · ${h.generatedBy} · ${when(h.generatedAt, lang)}`));
  pdf.save(`seasentry-overview-${stamp()}.pdf`, t.pdf.footer);
}

export function downloadOverviewCsv(report: ReportSummary, risk: RiskCounts, history: SavedReport[], t: Translations, lang: Language) {
  const r = t.reports;
  const esc = (value: string | number) => {
    const s = String(value);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: (string | number)[][] = [
    [t.pdf.overviewTitle, fullTime(new Date().toISOString(), lang)],
    [],
    [t.pdf.csvMetric, t.pdf.csvValue],
    [r.totalIncidents, report.totalIncidents],
    [`${r.totalDetectedArea} (m²)`, report.totalDetectedAreaM2],
    [`${r.totalCleanedArea} (m²)`, report.totalCleanedAreaM2],
    [r.highRiskIncidents, report.highRiskCount],
    [`${r.averageAiConfidence} (%)`, report.averageAiConfidence ?? t.incidentDetail.notMeasured],
    [r.resolvedIncidents, report.resolvedCount],
    [],
    [t.incidentDetail.risk, t.pdf.csvCount],
    ...(["HIGH", "MEDIUM", "LOW"] as const).map((level) => [t.risk[level], risk[level]]),
    [],
    [r.colIncident, r.colTeam, `${r.colCost} (USD, ${t.incidentDetail.estimateTag})`, r.colGeneratedBy, r.colGeneratedAt],
    ...history.map((h) => [`${h.incidentDisplayId} - ${h.incidentTitle}`, h.team, h.estimatedCostUsd, h.generatedBy, when(h.generatedAt, lang)]),
  ];
  // BOM so spreadsheet apps read the Azerbaijani letters as UTF-8.
  const blob = new Blob(["﻿" + rows.map((row) => row.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `seasentry-overview-${stamp()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

