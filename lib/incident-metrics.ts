import type { Incident } from "./types";

/** Open incidents that still need a specialist's review decision
 * (new, or under review without a confirmation — escalations included). */
export function needsDecision(incident: Incident) {
  return incident.status === "detected" || (incident.status === "under_review" && incident.humanDecision !== "confirmed_spill");
}

/** A real Sentinel-1 scan with stored imagery — the only incidents whose
 * detector scores were actually measured. */
export function isMeasuredScan(incident: Incident) {
  return incident.id !== "inc-live" && incident.detectionSource === "Sentinel-1 SAR" && Boolean(incident.sarImageBase64);
}

/** Average detector score over measured scans only. Manual reports (score 0)
 * and demo records never dilute it; null when there is nothing measured. */
export function scanConfidence(incidents: Incident[]): number | null {
  const scans = incidents.filter((incident) => isMeasuredScan(incident) && Number.isFinite(incident.aiProbability));
  return scans.length ? scans.reduce((total, incident) => total + incident.aiProbability, 0) / scans.length : null;
}

/** Current review state of measured SAR detections — not a model accuracy metric. */
export function sarReviewOutcomes(incidents: Incident[]) {
  const scans = incidents.filter(isMeasuredScan);
  return {
    total: scans.length,
    pending: scans.filter(needsDecision).length,
    confirmed: scans.filter((i) => i.status === "under_review" && i.humanDecision === "confirmed_spill").length,
    cleaning: scans.filter((i) => i.status === "cleaning").length,
    resolved: scans.filter((i) => i.status === "resolved").length,
    rejected: scans.filter((i) => i.status === "rejected").length,
  };
}

export function incidentProvenance(incident: Incident, lang: "en" | "az") {
  if (incident.id === "inc-live") return lang === "az" ? "Demo ssenarisi" : "Demo scenario";
  if (incident.detectionSource === "Manual report") return lang === "az" ? "Əl ilə bildiriş" : "Manual report";
  if (isMeasuredScan(incident)) return lang === "az" ? "SAR ölçməsi" : "SAR scan";
  return lang === "az" ? "Demo / təsvir yoxdur" : "Demo / no imagery";
}

export type DecisionAction = "confirm" | "reject" | "escalate" | "mark_cleaning" | "resolve";
export type DecisionStage = "pending" | "escalated" | "confirmed" | "cleaning" | "resolved" | "rejected";

export function decisionStage(incident: Incident): DecisionStage {
  if (incident.status === "rejected") return "rejected";
  if (incident.status === "resolved") return "resolved";
  if (incident.status === "cleaning") return "cleaning";
  if (incident.status === "under_review" && incident.humanDecision === "confirmed_spill") return "confirmed";
  if (incident.humanDecision === "escalated") return "escalated";
  return "pending";
}

/** The one decision rule the UI follows. Payload action names are the
 * backend's own and must not change. */
export function decisionActions(incident: Incident): DecisionAction[] {
  switch (decisionStage(incident)) {
    case "pending": return ["confirm", "reject", "escalate"];
    case "escalated": return ["confirm", "reject"];
    case "confirmed": return ["mark_cleaning"];
    case "cleaning": return ["resolve"];
    default: return [];
  }
}
