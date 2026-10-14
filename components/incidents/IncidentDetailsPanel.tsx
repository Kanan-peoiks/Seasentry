"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, CircleSlash, FileDown, Satellite, Ship, TriangleAlert, UserCheck, X, XCircle, Droplets, ArrowUpRight } from "lucide-react";
import { formatAreaM2, HUMAN_DECISION_LABEL, getVesselById, haversineKm } from "@/lib/mock-data";
import { archiveIncidentReport, downloadIncidentPdf } from "@/lib/reports";
import type { Incident } from "@/lib/types";
import { deriveAiImpact, deriveResponseMaterials, deriveProjectionSeries, deriveResponseOptions, compassLabel, SORBENT_RATIO_G, type ResponseMaterials } from "@/lib/spill-physics";
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
type SarCompareProps = { original: string; overlay: string; originalLabel: string; overlayLabel: string; originalAlt: string; overlayAlt: string; label: string; hint: string };

/** Original SAR tile and the detector's overlay of the same tile, compared with a draggable divider. */
function SarCompare({ original, overlay, originalLabel, overlayLabel, originalAlt, overlayAlt, label, hint }: SarCompareProps) {
  const [position, setPosition] = useState(50);
  return (
    <figure className="sar-compare">
      <div className="sar-compare-frame" style={{ ["--pos" as string]: `${position}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- inline base64 scan imagery */}
        <img src={`data:image/png;base64,${original}`} alt={originalAlt} />
        {/* eslint-disable-next-line @next/next/no-img-element -- inline base64 scan imagery */}
        <img className="sar-compare-top" src={`data:image/png;base64,${overlay}`} alt={overlayAlt} />
        <span className="sar-compare-line" aria-hidden="true"><i /></span>
        <span className="sar-compare-tag sar-compare-tag--start" aria-hidden="true">{originalLabel}</span>
        <span className="sar-compare-tag sar-compare-tag--end" aria-hidden="true">{overlayLabel}</span>
        <input type="range" min={0} max={100} step={1} value={position} onChange={(e) => setPosition(Number(e.target.value))} aria-label={label} aria-valuetext={`${position}% ${originalLabel}`} />
      </div>
      <figcaption>{hint}</figcaption>
    </figure>
  );
}

function findSimilarIncidents(incident: Incident, all: Incident[]) {
  return all
    .filter((i) => i.id !== incident.id)
    .map((i) => ({ displayId: i.displayId, location: i.location, distanceKm: Math.round(haversineKm(incident.lat, incident.lng, i.lat, i.lng)) }))
    .filter((i) => i.distanceKm <= 100)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 2);
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
  const [report, setReport] = useState<{ id: string; pdf: "generating" | "ready" | "error"; archive: "idle" | "saving" | "saved" | "failed" | "skipped" } | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  const saving = Boolean(live && pendingActionId === live.id);
  const busy = pendingActionId !== null;

  const run = async (action: DecisionAction) => {
    if (!live || busy) return;
    setActionError(null);
    const result = await applyHumanAction({ incidentId: live.id, action, operatorName: user?.name || "Operator" });
    if (!result.ok) setActionError({ id: live.id, message: result.error || d.decisionFailed });
  };

  const archive = async (target: Incident, materials: ResponseMaterials) => {
    setReport((prev) => (prev && prev.id === target.id ? { ...prev, archive: "saving" } : prev));
    const result = await archiveIncidentReport(target, materials);
    const next = result.ok ? "saved" : result.error === "simulation" ? "skipped" : "failed";
    setReport((prev) => (prev && prev.id === target.id ? { ...prev, archive: next } : prev));
  };

  // Download and archive are separate steps: a failed archive never hides a
  // successful download, and "generate again" always produces a new file.
  const generatePdf = async (materials: ResponseMaterials) => {
    if (!live || (report?.id === live.id && report.pdf === "generating")) return;
    const target = live;
    setReport({ id: target.id, pdf: "generating", archive: "idle" });
    try {
      await downloadIncidentPdf(target, materials, sourceEstimate, t, lang);
    } catch {
      setReport({ id: target.id, pdf: "error", archive: "idle" });
      return;
    }
    setReport({ id: target.id, pdf: "ready", archive: "idle" });
    await archive(target, materials);
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
    const rep = report?.id === live.id ? report : null;
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
          {live.sarImageBase64 && live.sarOverlayBase64 ? (
            <SarCompare
              original={live.sarImageBase64}
              overlay={live.sarOverlayBase64}
              originalLabel={d.originalSar}
              overlayLabel={d.aiOverlay}
              originalAlt={d.originalSarAlt(live.displayId)}
              overlayAlt={d.overlayAlt(live.displayId)}
              label={d.compareSar}
              hint={d.compareHint}
            />
          ) : live.sarImageBase64 ? (
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
            <div className="report-actions">
              <Button onClick={() => void generatePdf(materials)} busy={rep?.pdf === "generating"}>
                <FileDown size={16} aria-hidden="true" />{rep?.pdf === "ready" ? d.generateAgain : d.generatePdfReport}
              </Button>
            </div>
            <div className="report-status" aria-live="polite">
              {rep?.pdf === "error" && <Notice tone="error">{t.pdf.failed}</Notice>}
              {rep?.pdf === "ready" && <p className="detail-hint">{t.pdf.downloaded}</p>}
              {rep?.archive === "saving" && <p className="detail-hint">{t.pdf.archiving}</p>}
              {rep?.archive === "saved" && <Notice tone="success">{t.pdf.archived}</Notice>}
              {rep?.archive === "skipped" && <p className="detail-hint">{t.pdf.simulationNotArchived}</p>}
              {rep?.archive === "failed" && <Notice tone="warning" action={<Button onClick={() => void archive(live, materials)}>{t.pdf.archiveRetry}</Button>}>{t.pdf.archiveFailed}</Notice>}
            </div>
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
