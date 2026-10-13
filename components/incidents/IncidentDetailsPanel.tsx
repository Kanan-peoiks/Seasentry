"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { jsPDF } from "jspdf";
import { CheckCircle2, ChevronDown, CircleSlash, FileDown, Satellite, Ship, TriangleAlert, UserCheck, X, XCircle, Droplets, ArrowUpRight } from "lucide-react";
import { formatAreaM2, formatDateTimeAZT, HUMAN_DECISION_LABEL, getVesselById, haversineKm } from "@/lib/mock-data";
import type { Incident } from "@/lib/types";
import { deriveAiImpact, deriveResponseMaterials, deriveProjectionSeries, deriveResponseOptions, compassLabel, SORBENT_RATIO_G, type ResponseMaterials, type SpillSourceResult } from "@/lib/spill-physics";
import { useSpillSourceEstimate } from "@/lib/useSpillSourceEstimate";
import { ConfidenceGauges, SpillProjectionChart, ResponseOptionsBar } from "@/components/incidents/IncidentCharts";
import RiskBadge from "@/components/ui/RiskBadge";
import StatusBadge from "@/components/ui/StatusBadge";
import DetailPanel from "@/components/ui/DetailPanel";
import Button from "@/components/ui/Button";
import Notice from "@/components/ui/Notice";
import { useIncidentStore } from "@/lib/incident-store";
import { canOperate } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/useLanguage";
import { decisionActions, decisionStage, incidentProvenance, isMeasuredScan, type DecisionAction } from "@/lib/incident-metrics";
import { formatWorkspaceTime } from "@/lib/workspace-url";

/** The two closest other incidents by real distance — useful context when
 * several reports cluster along the same corridor. */
function findSimilarIncidents(incident: Incident, all: Incident[]) {
  return all
    .filter((i) => i.id !== incident.id)
    .map((i) => ({ displayId: i.displayId, location: i.location, distanceKm: Math.round(haversineKm(incident.lat, incident.lng, i.lat, i.lng)) }))
    .filter((i) => i.distanceKm <= 100)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 2);
}

/**
 * Report template / data-source map (kept here, next to the generator, so it
 * stays in sync as fields are wired up). Every section below is either REAL
 * (backed by an actual stored value or a formula over one) or a documented
 * SIMULATED placeholder standing in for an integration that isn't built yet.
 * This function intentionally renders the full future shape of the report —
 * including sections whose underlying data is still mock — so the template
 * doesn't need to be redesigned each time a real data source lands; only the
 * section's inputs change.
 *
 *  - Incident information       REAL      — stored incident row (title, location,
 *                                            coords, timestamp, risk, status, area).
 *  - AI analysis                SIMULATED — `aiProbability`/`aiSummary` are either
 *                                            seeded demo values (lib/mock-data.ts,
 *                                            backend/app/seed.py) or written by a
 *                                            human via the manual-report form; no
 *                                            real detection model runs yet. Once
 *                                            backend/ML_INTEGRATION.md's model is
 *                                            wired in, these two fields should be
 *                                            populated from its live inference
 *                                            output instead.
 *  - Satellite imagery          REAL, when present — incidents created via the
 *                                            "Check for New Imagery" scan
 *                                            (POST /detect) carry a real fetched
 *                                            Sentinel-1 tile + an AI-overlay
 *                                            rectangle in sarImageBase64/
 *                                            sarOverlayBase64, embedded below via
 *                                            jsPDF's doc.addImage(...). Seeded or
 *                                            manually-reported incidents have
 *                                            neither field and fall back to the
 *                                            placeholder note (see ImagePlaceholder
 *                                            in the on-screen panel above).
 *  - Confidence breakdown        REAL, when present — texture/edge/contrast sub-
 *                                            scores come straight from spill_detect.py's
 *                                            _blob_features() (see DetectionResult's
 *                                            texture_pct/edge_pct/contrast_pct) for
 *                                            incidents created via a real POST /detect
 *                                            scan. Seeded/manually-reported incidents
 *                                            predate that data existing, so they fall
 *                                            back to sub-scores jittered around the
 *                                            real aiProbability — see deriveAiDeepDive.
 *  - Processing pipeline         REAL, when present — fetch_ms/analyze_ms are actual
 *                                            wall-clock timings from routers/detect.py;
 *                                            shown only when both exist, never fabricated.
 *  - Spill source & drift       PARTIAL   — `sourceEstimate` is a real computation
 *                                            (lib/spill-physics.ts's
 *                                            estimateSpillSource), but over a
 *                                            documented simplification: wind-only
 *                                            drift (3% of wind speed), no ocean-
 *                                            current data. `leakRateBbl` is a pure
 *                                            formula over the real detected area (no
 *                                            random noise); `depthM` genuinely has no
 *                                            real data source (no bathymetric chart
 *                                            integration) and stays a seeded guess.
 *  - Human decision              REAL      — actually entered by an operator via
 *                                            the review actions (applyHumanAction
 *                                            in lib/incident-store.tsx) and
 *                                            persisted on the incident row.
 *  - Response & cleanup          REAL-ish  — `materials` is a deterministic formula
 *                                            (lib/spill-physics.ts's
 *                                            deriveResponseMaterials) over the
 *                                            incident's real area/oil-volume
 *                                            estimate: boom length from the slick's
 *                                            real perimeter, skimmer/vessel counts
 *                                            scaled from the real recovered-volume
 *                                            estimate, and the real sorbent ratio
 *                                            (1g cotton ≈ 25-30g oil) — no random
 *                                            noise left in any of these. Team
 *                                            assignment is still an illustrative
 *                                            rotation — no real dispatch system exists.
 *
 * Not yet in this report at all, for when they're built:
 *  - Real AIS-sourced vessel corroboration (aisstream.io — not integrated).
 *  - Spill source attribution (SOCAR/BP/Others) is fixed, illustrative
 *    percentages — deriveSourceAttribution — genuinely unconfirmable without
 *    real investigation/pipeline-ownership records this system doesn't have.
 */
function generateIncidentPdf(
  incident: Incident,
  materials: ResponseMaterials,
  sourceEstimate: SpillSourceResult | null
) {
  const doc = new jsPDF();
  let y = 20;
  const line = (text: string, size = 11, bold = false, gap = 7) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(text, 14, y);
    y += gap;
  };
  const wrapped = (text: string, size = 10, gap = 5.5) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", "normal");
    const chunks = doc.splitTextToSize(text, 182);
    chunks.forEach((chunk: string) => {
      doc.text(chunk, 14, y);
      y += gap;
    });
  };
  const ensureSpace = (needed = 12) => {
    if (y + needed > 275) {
      doc.addPage();
      y = 20;
    }
  };
  line("SeaSentry — Incident Response Report", 18, true, 10);
  doc.setDrawColor(200);
  doc.line(14, y - 4, 196, y - 4);
  y += 2;

  line(`Incident ${incident.displayId} — ${incident.title}`, 13, true, 8);
  line(`Location: ${incident.location}`);
  line(`Coordinates: ${incident.lat.toFixed(4)}°N, ${incident.lng.toFixed(4)}°E`);
  line(`Detected: ${formatDateTimeAZT(incident.timestamp)} AZT`);
  line(`Risk: ${incident.risk}    Status: ${incident.status}`);
  line(`Estimated area: ${formatAreaM2(incident.areaM2)}`);
  y += 4;

  ensureSpace(30);
  line("AI analysis", 13, true, 8);
  line(`Detection source: ${incident.detectionSource}`);
  line(`Model confidence (not-pollution probability): ${Math.round(incident.aiProbability * 100)}%`);
  wrapped(incident.aiSummary);
  y += 4;

  ensureSpace(incident.sarImageBase64 ? 68 : 24);
  line("Satellite imagery", 13, true, 8);
  if (incident.sarImageBase64) {
    const imgW = 88;
    const imgH = 60;
    try {
      doc.addImage(`data:image/png;base64,${incident.sarImageBase64}`, "PNG", 14, y, imgW, imgH);
      if (incident.sarOverlayBase64) {
        doc.addImage(`data:image/png;base64,${incident.sarOverlayBase64}`, "PNG", 14 + imgW + 6, y, imgW, imgH);
      }
      y += imgH + 3;
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.text("Original SAR (VV/VH/contrast, false-color)", 14, y);
      if (incident.sarOverlayBase64) {
        doc.text("AI overlay — detected anomaly outlined", 14 + imgW + 6, y);
      }
      y += 6;
    } catch {
      wrapped("[Satellite image failed to embed.]", 9);
    }
  } else {
    wrapped(
      "[Original SAR scene and AI-overlay tile will be embedded here once real Sentinel " +
        "Hub satellite-image fetching is implemented — see ImagePlaceholder in this file " +
        "and lib/spill-physics.ts's notes. Not available for this incident (no real scan was run).]",
      9
    );
  }
  y += 4;

  ensureSpace(36);
  line("Spill source & drift analysis", 13, true, 8);
  if (sourceEstimate?.available) {
    line(
      `Estimated source: ${sourceEstimate.lat.toFixed(4)}°N, ${sourceEstimate.lng.toFixed(4)}°E (${sourceEstimate.confidencePct}% confidence)`
    );
    line(
      `Drift: ${sourceEstimate.distanceKm} km over ${sourceEstimate.hoursElapsed} h, toward ${compassLabel(sourceEstimate.downwindBearingDeg)}`
    );
    line(`Estimated leak rate: ~${sourceEstimate.leakRateBbl} bbl/h    Estimated depth: ~${sourceEstimate.depthM} m`);
    wrapped(
      `Method: reverse-calculated from live wind data (bearing ${sourceEstimate.bearingCompass}, ${sourceEstimate.bearingDeg}°) — a wind-only simplification (no ocean-current data source available); leak rate and depth are seeded estimates, not measurements.`,
      9
    );
  } else {
    wrapped(
      "[Not available for this incident — needs live wind data, or the incident is too old for a reliable back-calculation.]",
      9
    );
  }
  y += 4;

  ensureSpace(24);
  line("Human decision", 13, true, 8);
  line(`Decision: ${HUMAN_DECISION_LABEL[incident.humanDecision] ?? incident.humanDecision}`);
  if (incident.humanDecisionBy) line(`Specialist: ${incident.humanDecisionBy}`);
  if (incident.humanDecisionAt) line(`Decided at: ${formatDateTimeAZT(incident.humanDecisionAt)} AZT`);
  if (incident.humanDecisionNote) line(`Notes: ${incident.humanDecisionNote}`);
  y += 4;

  // No response/cleanup plan for a dismissed detection — there's nothing to
  // respond to, so materials/cost figures would be meaningless here.
  if (incident.status !== "rejected") {
    ensureSpace(30);
    line("Response & cleanup", 13, true, 8);
    line(`Team assigned: ${materials.team}`);
    line(`Boom deployed: ${materials.boomMeters} m`);
    line(`Sorbent used: ${materials.sorbentKg} kg (ratio: 1g ~ ${SORBENT_RATIO_G}g oil)`);
    line(`Skimmer units: ${materials.skimmerUnits}`);
    line(`Support vessels: ${materials.vesselCount}`);
    line(`Estimated duration: ${materials.durationHours} h`);
    line(`Estimated cost: $${materials.estimatedCostUsd.toLocaleString("en-US")}`);
    y += 6;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(
    "Demo document generated by SeaSentry — an oil-spill intelligence platform. Figures are simulated.",
    14,
    290
  );

  doc.save(`seasentry-incident-${incident.displayId.replace("#", "")}-report.pdf`);
}

/** Best-effort: record that this report was generated so it shows up in the
 * report history later. Never blocks or surfaces errors to the PDF flow —
 * the download already succeeded regardless of whether this save works. */
function saveReportSnapshot(incident: Incident, materials: ResponseMaterials) {
  fetch("/api/reports", {
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
  }).catch((err) => console.error("saveReportSnapshot failed:", err));
}

type Props = {
  incident: Incident | null;
  onClose: () => void;
  /** Opens as a full-page view instead of a side panel. */
  expanded?: boolean;
  /** "ai" also shows the modelled projections; "incident" (default) links to them. */
  context?: "incident" | "ai";
  /** "dialog" (default) opens a modal; "docked" renders inline, e.g. in the dashboard rail. */
  presentation?: "dialog" | "docked";
};

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`fact${wide ? " fact--wide" : ""}`}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Tag({ kind, children }: { kind: "measured" | "estimate" | "calculation" | "demo"; children: ReactNode }) {
  return <span className={`data-tag data-tag--${kind}`}>{children}</span>;
}

/** Secondary analysis, collapsed by default. */
function Disclosure({ title, tag, children, defaultOpen = false }: { title: string; tag?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary><span>{title}</span>{tag}<ChevronDown size={16} className="disclosure-chevron" aria-hidden="true" /></summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

const ACTION_ICON: Record<DecisionAction, ReactNode> = {
  confirm: <CheckCircle2 size={16} aria-hidden="true" />,
  reject: <XCircle size={16} aria-hidden="true" />,
  escalate: <TriangleAlert size={16} aria-hidden="true" />,
  mark_cleaning: <Droplets size={16} aria-hidden="true" />,
  resolve: <CheckCircle2 size={16} aria-hidden="true" />,
};

export default function IncidentDetailsPanel({ incident, onClose, expanded, context = "incident", presentation = "dialog" }: Props) {
  const { t, lang } = useLanguage();
  const d = t.incidentDetail;
  const { incidents: allIncidents, applyHumanAction, getIncidentById, pendingActionId } = useIncidentStore();
  const { user } = useSession();
  // Always render the store's current copy so map, list and URL selections stay in sync.
  const live = incident ? getIncidentById(incident.id) || incident : null;
  const vessel = getVesselById(live?.relatedVesselId);
  const canAct = canOperate(user);
  const { wind, sea, windIssue, estimate: sourceEstimate, loading: weatherLoading } = useSpillSourceEstimate(live);
  const [pdfState, setPdfState] = useState<{ id: string; state: "generating" | "ready" } | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const saving = Boolean(live && pendingActionId === live.id);
  const busy = pendingActionId !== null;

  const run = async (action: DecisionAction) => {
    if (!live || busy) return;
    setActionError(null);
    const result = await applyHumanAction({ incidentId: live.id, action, operatorName: user?.name || "Operator" });
    if (!result.ok) setActionError({ id: live.id, message: result.error || d.decisionFailed });
  };

  const generatePdf = (materials: ResponseMaterials) => {
    if (!live || pdfState?.state === "generating") return;
    setPdfState({ id: live.id, state: "generating" });
    setTimeout(() => {
      generateIncidentPdf(live, materials, sourceEstimate);
      setPdfState({ id: live.id, state: "ready" });
      saveReportSnapshot(live, materials);
    }, 300);
  };

  const title = live ? d.incidentNumber(live.displayId) : "";
  const body = live && (() => {
    const stage = decisionStage(live);
    const actions = decisionActions(live);
    const measured = isMeasuredScan(live);
    const impact = deriveAiImpact(live, wind);
    const materials = deriveResponseMaterials(live, impact.volumeBbl);
    const similar = findSimilarIncidents(live, allIncidents);
    const hasFeatures = live.texturePct != null && live.edgePct != null && live.contrastPct != null;
    const error = actionError?.id === live.id ? actionError.message : null;
    const pdf = pdfState?.id === live.id ? pdfState.state : "idle";
    const closed = stage === "resolved" || stage === "rejected";

    return (
      <div className="incident-detail">
        <div className="incident-identity">
          <div className="incident-badges">
            <RiskBadge risk={live.risk} />
            <StatusBadge status={live.status} />
            <span className="provenance">{incidentProvenance(live, lang)}</span>
          </div>
          <dl className="fact-grid">
            <Field label={d.location}>{live.location || "—"}</Field>
            <Field label={d.detectionTime}>{formatWorkspaceTime(live.timestamp, lang)} AZT</Field>
            <Field label={d.detectionSource}>{live.detectionSource}</Field>
            <Field label={d.coordinates}><span className="mono">{live.lat.toFixed(4)}°N, {live.lng.toFixed(4)}°E</span></Field>
          </dl>
        </div>

        <section className={`decision-card decision-card--${stage}`} aria-labelledby={`decision-${live.id}`}>
          <div className="decision-head">
            <UserCheck size={20} aria-hidden="true" />
            <div>
              <h3 id={`decision-${live.id}`}>{d.nextDecision}</h3>
              <p>{d.stage[stage]}</p>
            </div>
          </div>
          {canAct && actions.length > 0 && (
            <div className="decision-actions" role="group" aria-label={d.nextDecision} aria-busy={saving || undefined}>
              {actions.map((action) => (
                <Button key={action} variant={action === "reject" ? "danger" : action === "escalate" ? "secondary" : "primary"} disabled={busy} onClick={() => void run(action)}>
                  {ACTION_ICON[action]}{d.actions[action]}
                </Button>
              ))}
            </div>
          )}
          {saving && <p className="decision-status" role="status">{d.savingDecision}</p>}
          {error && <Notice tone="error">{error}</Notice>}
          {!canAct && !closed && <p className="decision-note">{d.viewOnlyAccess}</p>}
          {closed && <p className="decision-note"><CircleSlash size={14} aria-hidden="true" />{d.noFurtherAction}</p>}
          {live.humanDecision !== "pending" && (
            <dl className="fact-grid decision-record">
              <Field label={d.decision}>{d.humanDecision[live.humanDecision as keyof typeof d.humanDecision] ?? HUMAN_DECISION_LABEL[live.humanDecision] ?? live.humanDecision}</Field>
              {live.humanDecisionBy && <Field label={d.specialist}>{live.humanDecisionBy}</Field>}
              {live.humanDecisionAt && <Field label={d.decidedAt}>{formatWorkspaceTime(live.humanDecisionAt, lang)} AZT</Field>}
              {live.humanDecisionNote && <Field label={d.notes} wide>{live.humanDecisionNote}</Field>}
            </dl>
          )}
        </section>

        <section className="detail-section" aria-labelledby={`evidence-${live.id}`}>
          <h3 id={`evidence-${live.id}`} className="detail-title"><Satellite size={16} aria-hidden="true" />{d.evidence}</h3>
          {live.sarImageBase64 ? (
            <div className="evidence-grid">
              <figure>
                {/* eslint-disable-next-line @next/next/no-img-element -- inline base64 scan imagery */}
                <img src={`data:image/png;base64,${live.sarImageBase64}`} alt={d.originalSarAlt(live.displayId)} />
                <figcaption>{d.originalSar}</figcaption>
              </figure>
              {live.sarOverlayBase64 && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- inline base64 scan imagery */}
                  <img src={`data:image/png;base64,${live.sarOverlayBase64}`} alt={d.overlayAlt(live.displayId)} />
                  <figcaption>{d.aiOverlay}</figcaption>
                </figure>
              )}
            </div>
          ) : (
            <p className="detail-empty">{live.detectionSource === "Manual report" ? d.noImageryManual : d.noImagery}</p>
          )}
          <dl className="fact-grid">
            <Field label={d.estimatedArea}>{formatAreaM2(live.areaM2)} <Tag kind={measured ? "measured" : "estimate"}>{measured ? d.measuredTag : d.reportedTag}</Tag></Field>
            <Field label={d.detectorScore}>
              {measured ? <>{Math.round(live.aiProbability * 100)}% <Tag kind="measured">{d.measuredTag}</Tag></> : <span className="muted">{d.notMeasured}</span>}
            </Field>
          </dl>
          {measured && <p className="detail-hint">{d.detectorScoreNote}</p>}
        </section>

        {live.aiSummary && (
          <section className="detail-section">
            <h3 className="detail-title">{d.summary}</h3>
            <p className="detail-text">{live.aiSummary}</p>
            <dl className="fact-grid">
              <Field label={d.estimatedCause}>{live.estimatedCause || "—"}</Field>
              <Field label={d.unconfirmedSourceHypothesis}>{t.spillSource[live.spillSource] ?? live.spillSource}</Field>
            </dl>
          </section>
        )}

        <div className="disclosures">
          {(hasFeatures || (live.fetchMs != null && live.analyzeMs != null) || similar.length > 0) && (
            <Disclosure title={d.analysisDetails} defaultOpen={context === "ai"}>
              {hasFeatures && (
                <>
                  <h4 className="detail-subtitle">{d.featureSignals} <Tag kind="measured">{d.measuredTag}</Tag></h4>
                  <ConfidenceGauges texture={live.texturePct!} edge={live.edgePct!} contrast={live.contrastPct!} composite={Math.round(live.aiProbability * 100)} />
                </>
              )}
              {live.fetchMs != null && live.analyzeMs != null && (
                <dl className="fact-grid">
                  <Field label={d.pipelineSatelliteFetch}>{(live.fetchMs / 1000).toFixed(1)} s</Field>
                  <Field label={d.pipelineAnalysis}>{(live.analyzeMs / 1000).toFixed(1)} s</Field>
                </dl>
              )}
              {similar.length > 0 && (
                <>
                  <h4 className="detail-subtitle">{d.similarHistoricalIncidents}</h4>
                  <ul className="plain-list">
                    {similar.map((s) => <li key={s.displayId}><span>{s.displayId} · {s.location}</span><span>{d.nearbyKm(s.distanceKm)}</span></li>)}
                  </ul>
                </>
              )}
            </Disclosure>
          )}

          <Disclosure title={d.environmentalContext} tag={<Tag kind="measured">Open-Meteo</Tag>}>
            {weatherLoading ? (
              <p className="detail-empty" role="status">{d.loadingLiveWeather}</p>
            ) : wind || sea ? (
              <>
                <dl className="fact-grid">
                  <Field label={d.wind}>{wind ? `${wind.windSpeedKnots} kn · ${wind.windHeading}° ${compassLabel(wind.windHeading)}` : t.seaWeather.noData}</Field>
                  <Field label={d.seaState}>{sea ? `${d.seaStates[sea.seaState]} · ${sea.waveHeightM} m` : t.seaWeather.noData}</Field>
                  <Field label={d.visibility}>{wind?.visibilityKm != null ? `${wind.visibilityKm} km` : t.seaWeather.noData}</Field>
                  <Field label={d.temperature}>{wind?.temperatureC != null ? `${wind.temperatureC}°C` : t.seaWeather.noData}</Field>
                </dl>
                <p className="detail-hint">{d.observedAt(formatWorkspaceTime((wind ?? sea)!.sourceTimestamp, lang), (wind ?? sea)!.staleMinutes)}</p>
              </>
            ) : (
              <p className="detail-empty">{windIssue === "out-of-coverage" ? d.outOfCoverage : d.liveWeatherUnavailable}</p>
            )}
          </Disclosure>

          <Disclosure title={d.spillSourceDriftAnalysis} tag={<Tag kind="calculation">{d.calculationTag}</Tag>}>
            {weatherLoading ? (
              <p className="detail-empty" role="status">{d.reconstructingDrift}</p>
            ) : sourceEstimate?.available ? (
              <>
                <dl className="fact-grid">
                  <Field label={d.estimatedRuptureCoords}><span className="mono">{sourceEstimate.lat.toFixed(4)}°N, {sourceEstimate.lng.toFixed(4)}°E</span></Field>
                  <Field label={d.confidence}>{sourceEstimate.confidencePct}%</Field>
                  <Field label={d.distanceDrifted}>{d.distanceOverHours(sourceEstimate.distanceKm, sourceEstimate.hoursElapsed)}</Field>
                  <Field label={d.driftSpeed}>{d.driftSpeedToward(sourceEstimate.driftSpeedKmh, compassLabel(sourceEstimate.downwindBearingDeg))}</Field>
                </dl>
                <p className="detail-hint">{d.driftMethodNote}</p>
              </>
            ) : sourceEstimate?.reason === "too-stale" ? (
              <p className="detail-empty">{d.tooStaleNote(sourceEstimate.hoursElapsed ?? 0)}</p>
            ) : (
              <p className="detail-empty">{windIssue === "out-of-coverage" ? d.outOfCoverage : d.windDataUnavailable}</p>
            )}
          </Disclosure>

          {context === "ai" ? (
            <Disclosure title={d.modelledOutlook} tag={<Tag kind="estimate">{d.estimateTag}</Tag>}>
              <h4 className="detail-subtitle">{d.spillGrowthProjection}</h4>
              <SpillProjectionChart series={deriveProjectionSeries(live)} />
              <p className="detail-hint">{d.modeledFromGrowthRate}</p>
              {!closed && (
                <>
                  <h4 className="detail-subtitle">{d.aiRecommendedOptions}</h4>
                  <ResponseOptionsBar data={deriveResponseOptions(live, materials, t)} />
                </>
              )}
            </Disclosure>
          ) : (
            <Link className="detail-link" href={`/ai-analysis?open=${encodeURIComponent(live.id)}`}>{d.openFullAnalysis}<ArrowUpRight size={15} aria-hidden="true" /></Link>
          )}

          {stage !== "rejected" && (
            <Disclosure title={d.requirements} tag={<Tag kind="estimate">{d.estimateTag}</Tag>}>
              <p className="detail-hint">{d.requirementsNote}</p>
              <dl className="fact-grid">
                <Field label={d.boomRequired}>{materials.boomMeters} m</Field>
                <Field label={d.sorbentRequired}>{materials.sorbentKg} kg</Field>
                <Field label={d.skimmerUnits}>{materials.skimmerUnits}</Field>
                <Field label={d.supportVessels}>{materials.vesselCount}</Field>
                <Field label={d.estimatedDuration}>{materials.durationHours} h</Field>
                <Field label={d.costEstimate}>${materials.estimatedCostUsd.toLocaleString("en-US")}</Field>
              </dl>
              <p className="detail-hint">{d.sorbentRatioNote(SORBENT_RATIO_G, materials.oilMassKg)}</p>
            </Disclosure>
          )}

          {vessel && (
            <Disclosure title={d.relatedVessel} tag={<Tag kind="demo">{t.mapPanel.demoLabel}</Tag>}>
              <dl className="fact-grid">
                <Field label={d.name}><Ship size={14} aria-hidden="true" /> {vessel.name}</Field>
                <Field label={d.type}>{vessel.type}</Field>
                <Field label={d.speed}>{vessel.speedKnots.toFixed(1)} kn</Field>
              </dl>
            </Disclosure>
          )}
        </div>

        {canAct && stage !== "pending" && stage !== "escalated" && (
          <section className="detail-section">
            <h3 className="detail-title"><FileDown size={16} aria-hidden="true" />{stage === "rejected" ? d.dismissalReport : d.responseReport}</h3>
            <Button onClick={() => generatePdf(materials)} busy={pdf === "generating"}>
              <FileDown size={16} aria-hidden="true" />{pdf === "ready" ? d.generateAgain : d.generatePdfReport}
            </Button>
            {pdf === "ready" && <p className="detail-hint" role="status">{d.pdfSavedNote}</p>}
          </section>
        )}
      </div>
    );
  })();

  if (presentation === "docked") {
    if (!live) return null;
    return (
      <section className="incident-dock" aria-labelledby="incident-dock-title">
        <header className="incident-dock-header">
          <div className="incident-dock-heading">
            <h2 id="incident-dock-title">{title}</h2>
            <p>{live.title || live.location}</p>
          </div>
          <button type="button" className="ui-icon-button" onClick={onClose} aria-label={t.common.close}><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="incident-dock-body">{body}</div>
      </section>
    );
  }

  return (
    <DetailPanel open={!!live} title={title} subtitle={live?.title || live?.location} onClose={onClose} width={expanded ? "min(1100px, 96vw)" : 480} variant={expanded ? "full" : "side"}>
      {body}
    </DetailPanel>
  );
}
