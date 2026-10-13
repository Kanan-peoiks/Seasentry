"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  mockData,
  getDashboardKpis,
  getIncidentStats,
  getReportSummary,
  buildAiAnalyses,
  buildResponseOps,
  getEnrichedVessels,
  hydrateIncident,
} from "@/lib/mock-data";
import type {
  HumanDecision,
  Incident,
  IncidentStatus,
  ReviewStatus,
} from "@/lib/types";
import { useSession } from "@/lib/session";

/** Fixed id for the operator-triggered live incident simulation. This is a
 * client-only demo feature — it is never sent to the backend, so decisions
 * applied to it are also handled purely locally (see applyHumanAction). */
export const LIVE_INCIDENT_ID = "inc-live";

function makeLiveIncident(): Incident {
  return hydrateIncident({
    id: LIVE_INCIDENT_ID,
    displayId: "#LIVE",
    title: "Central Caspian Pipeline Leak",
    location: "Central Caspian Sea",
    lat: 40.0,
    lng: 50.4,
    // Backdated a few hours so the wind-drift source estimate has a
    // meaningful, visible distance immediately (a spill detected seconds
    // ago hasn't drifted far enough to show on the map yet).
    timestamp: new Date(Date.now() - 4 * 3_600_000).toISOString(),
    areaM2: 340,
    aiProbability: 0.88,
    risk: "HIGH",
    status: "detected",
    portId: "baku",
    spillSource: "Pipeline leak",
    aiSummary:
      "Live SAR pass detected a fresh dark-signature slick consistent with a subsea pipeline rupture in the central offshore corridor. Compact, newly formed signature — immediate specialist triage recommended.",
    humanDecision: "pending",
    responseStatus: "Newly detected — live simulation",
  });
}

/** Backend IncidentOut fields are mostly nullable for future ML-created
 * rows; the frontend's Incident type wants plain strings/arrays, so fill
 * sane fallbacks here rather than loosening the shared type. */
function normalizeIncident(raw: Record<string, unknown>): Incident {
  return {
    id: String(raw.id),
    displayId: String(raw.displayId ?? raw.id),
    title: String(raw.title ?? ""),
    location: String(raw.location ?? ""),
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    timestamp: String(raw.timestamp ?? new Date().toISOString()),
    areaM2: Number(raw.areaM2 ?? 0),
    aiProbability: Number(raw.aiProbability ?? 0),
    risk: (raw.risk as Incident["risk"]) ?? "LOW",
    status: (raw.status as Incident["status"]) ?? "detected",
    portId: String(raw.portId ?? ""),
    spillSource: (raw.spillSource as Incident["spillSource"]) ?? "Unknown / natural seep",
    detectionSource: (raw.detectionSource as Incident["detectionSource"]) ?? "Sentinel-1 SAR",
    estimatedCause: String(raw.estimatedCause ?? ""),
    aiSummary: String(raw.aiSummary ?? ""),
    sarImageBase64: (raw.sarImageBase64 as string | undefined) ?? undefined,
    sarOverlayBase64: (raw.sarOverlayBase64 as string | undefined) ?? undefined,
    texturePct: typeof raw.texturePct === "number" ? raw.texturePct : undefined,
    edgePct: typeof raw.edgePct === "number" ? raw.edgePct : undefined,
    contrastPct: typeof raw.contrastPct === "number" ? raw.contrastPct : undefined,
    fetchMs: typeof raw.fetchMs === "number" ? raw.fetchMs : undefined,
    analyzeMs: typeof raw.analyzeMs === "number" ? raw.analyzeMs : undefined,
    humanDecision: (raw.humanDecision as HumanDecision) ?? "pending",
    humanDecisionNote: (raw.humanDecisionNote as string | undefined) ?? undefined,
    humanDecisionBy: (raw.humanDecisionBy as string | undefined) ?? undefined,
    humanDecisionAt: (raw.humanDecisionAt as string | undefined) ?? undefined,
    reviewStatus: (raw.reviewStatus as ReviewStatus) ?? "PENDING",
    responseStatus: String(raw.responseStatus ?? ""),
    relatedVesselId: (raw.relatedVesselId as string | undefined) ?? undefined,
    affectedVesselIds: Array.isArray(raw.affectedVesselIds) ? (raw.affectedVesselIds as string[]) : [],
  };
}

type ApplyActionInput = {
  incidentId: string;
  action: "confirm" | "reject" | "escalate" | "mark_cleaning" | "resolve";
  note?: string;
  operatorName?: string;
};

export type ManualIncidentInput = {
  title: string;
  location: string;
  lat: number;
  lng: number;
  areaM2: number;
  risk: Incident["risk"];
  spillSource: Incident["spillSource"];
  estimatedCause: string;
  notes?: string;
};

type CreateIncidentResult = { ok: true; incident: Incident } | { ok: false; error: string };

type IncidentStoreValue = {
  incidents: Incident[];
  /** True only until the first successful or failed load. */
  loading: boolean;
  /** A reload is running while earlier data stays visible. */
  refreshing: boolean;
  /** Message of the last failed load; earlier data, if any, is kept. */
  error: string | null;
  /** ISO time of the last successful load. */
  lastUpdated: string | null;
  reloadIncidents: () => Promise<boolean>;
  vessels: ReturnType<typeof getEnrichedVessels>;
  riskZones: typeof mockData.riskZones;
  activity: typeof mockData.activityLog;
  kpis: ReturnType<typeof getDashboardKpis>;
  stats: ReturnType<typeof getIncidentStats>;
  report: ReturnType<typeof getReportSummary>;
  aiAnalyses: ReturnType<typeof buildAiAnalyses>;
  responseOps: ReturnType<typeof buildResponseOps>;
  getIncidentById: (id: string) => Incident | undefined;
  /** Id of the incident whose decision request is in flight, if any. */
  pendingActionId: string | null;
  applyHumanAction: (input: ApplyActionInput) => Promise<{ ok: boolean; error?: string }>;
  createIncident: (input: ManualIncidentInput) => Promise<CreateIncidentResult>;
  /** Injects an incident the caller already created through some other
   * endpoint (e.g. POST /detect's real-imagery scan) into local state, so it
   * shows up immediately without a page reload. Replaces any copy with the
   * same id instead of duplicating it. */
  ingestIncident: (raw: Record<string, unknown>) => Incident;
  hasLiveIncident: boolean;
  simulateLiveIncident: () => void;
  resolveLiveIncident: () => void;
};

const IncidentStoreContext = createContext<IncidentStoreValue | null>(null);

function applyActionToIncident(
  incident: Incident,
  action: ApplyActionInput["action"],
  operatorName: string,
  note?: string
): Incident {
  const now = new Date().toISOString();
  const base = {
    humanDecisionBy: operatorName,
    humanDecisionAt: now,
    humanDecisionNote: note,
  };

  switch (action) {
    case "confirm":
      return {
        ...incident,
        ...base,
        status: "under_review" as IncidentStatus,
        reviewStatus: "CONFIRMED" as ReviewStatus,
        humanDecision: "confirmed_spill" as HumanDecision,
        responseStatus: "Confirmed — awaiting response assignment",
        humanDecisionNote:
          note || "Incident confirmed as oil spill by human specialist.",
      };
    case "reject":
      return {
        ...incident,
        ...base,
        status: "rejected",
        reviewStatus: "REJECTED",
        humanDecision: "false_positive",
        responseStatus: "No response — rejected by specialist",
        humanDecisionNote:
          note || "Marked as false positive / non-actionable lookalike.",
      };
    case "escalate":
      return {
        ...incident,
        ...base,
        status: "under_review",
        reviewStatus: "ESCALATED",
        humanDecision: "escalated",
        risk: incident.risk === "LOW" ? "MEDIUM" : "HIGH",
        responseStatus: "Escalated to senior duty officer",
        humanDecisionNote: note || "Escalated for senior operational review.",
      };
    case "mark_cleaning":
      return {
        ...incident,
        ...base,
        status: "cleaning",
        reviewStatus: "CLEANING",
        humanDecision: "response_approved",
        responseStatus: "Cleaning in progress — field team assigned",
        humanDecisionNote:
          note || "Response approved. Cleaning marked as started.",
      };
    case "resolve":
      return {
        ...incident,
        ...base,
        status: "resolved",
        reviewStatus: "RESOLVED",
        humanDecision: "resolved",
        responseStatus: "Resolved — cleanup complete",
        humanDecisionNote: note || "Cleanup confirmed complete by human specialist.",
      };
    default:
      return incident;
  }
}

/** Inserts or replaces by id, newest first, never duplicating a record. */
function upsert(list: Incident[], incident: Incident): Incident[] {
  return [incident, ...list.filter((i) => i.id !== incident.id)];
}

async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" ? data.error : fallback;
}

export function IncidentStoreProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus } = useSession();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loadState, setLoadState] = useState<{ loaded: boolean; refreshing: boolean; error: string | null; lastUpdated: string | null }>({ loaded: false, refreshing: false, error: null, lastUpdated: null });
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const pendingActionRef = useRef<string | null>(null);

  const reloadIncidents = useCallback(async (): Promise<boolean> => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadState((s) => ({ ...s, refreshing: true }));
    try {
      const res = await fetch("/api/incidents", { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(await readError(res, `Failed to load incidents (${res.status})`));
      const data: unknown = await res.json();
      if (controller.signal.aborted) return false;
      const loaded = Array.isArray(data) ? data.map((raw) => normalizeIncident(raw as Record<string, unknown>)) : [];
      // The demo scenario only exists locally; keep it across reloads.
      setIncidents((prev) => {
        const live = prev.find((i) => i.id === LIVE_INCIDENT_ID);
        return live ? [live, ...loaded.filter((i) => i.id !== LIVE_INCIDENT_ID)] : loaded;
      });
      setLoadState({ loaded: true, refreshing: false, error: null, lastUpdated: new Date().toISOString() });
      return true;
    } catch (err) {
      if (controller.signal.aborted) return false;
      setLoadState((s) => ({ ...s, loaded: true, refreshing: false, error: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Could not reach the server." }));
      return false;
    }
  }, []);

  // Incidents load only for a verified session, so public pages (landing,
  // auth) never wait on or trigger the incident API.
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      void reloadIncidents();
      return () => requestRef.current?.abort();
    }
    if (sessionStatus === "unauthenticated") {
      requestRef.current?.abort();
      // Clearing another user's records after sign-out is a sync with the session.
      setIncidents([]);
      setLoadState({ loaded: false, refreshing: false, error: null, lastUpdated: null });
    }
  }, [sessionStatus, reloadIncidents]);

  const applyHumanAction = useCallback(async (input: ApplyActionInput) => {
    // One decision at a time: a double click must not send two requests.
    if (pendingActionRef.current) return { ok: false, error: "A decision is already being saved." };
    pendingActionRef.current = input.incidentId;
    setPendingActionId(input.incidentId);
    try {
      // The live-simulation incident only ever exists in local state.
      if (input.incidentId === LIVE_INCIDENT_ID) {
        setIncidents((prev) => prev.map((inc) => (inc.id === input.incidentId ? applyActionToIncident(inc, input.action, input.operatorName || "Operator", input.note) : inc)));
        return { ok: true };
      }
      const res = await fetch(`/api/incidents/${encodeURIComponent(input.incidentId)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: input.action, note: input.note }),
      });
      if (!res.ok) throw new Error(await readError(res, `Decision failed (${res.status})`));
      const updated = normalizeIncident(await res.json());
      setIncidents((prev) => prev.map((inc) => (inc.id === updated.id ? updated : inc)));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Could not reach the server." };
    } finally {
      pendingActionRef.current = null;
      setPendingActionId(null);
    }
  }, []);

  const getIncidentById = useCallback(
    (id: string) => incidents.find((i) => i.id === id || i.displayId === id),
    [incidents]
  );

  const createIncident = useCallback(async (input: ManualIncidentInput): Promise<CreateIncidentResult> => {
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          location: input.location,
          lat: input.lat,
          lng: input.lng,
          areaM2: input.areaM2,
          aiProbability: 0,
          risk: input.risk,
          spillSource: input.spillSource,
          detectionSource: "Manual report",
          estimatedCause: input.estimatedCause,
          aiSummary: input.notes || "Manually reported by a duty operator from the dashboard map.",
        }),
      });
      if (!res.ok) return { ok: false, error: await readError(res, `Failed to create incident (${res.status})`) };
      const created = normalizeIncident(await res.json());
      setIncidents((prev) => upsert(prev, created));
      return { ok: true, incident: created };
    } catch {
      return { ok: false, error: "Could not reach the server." };
    }
  }, []);

  const ingestIncident = useCallback((raw: Record<string, unknown>): Incident => {
    const normalized = normalizeIncident(raw);
    setIncidents((prev) => upsert(prev, normalized));
    return normalized;
  }, []);

  const simulateLiveIncident = useCallback(() => {
    setIncidents((prev) => (prev.some((i) => i.id === LIVE_INCIDENT_ID) ? prev : [makeLiveIncident(), ...prev]));
  }, []);

  const resolveLiveIncident = useCallback(() => {
    setIncidents((prev) => prev.filter((i) => i.id !== LIVE_INCIDENT_ID));
  }, []);

  const hasLiveIncident = incidents.some((i) => i.id === LIVE_INCIDENT_ID);

  const derived = useMemo(() => ({
    vessels: getEnrichedVessels(incidents),
    kpis: getDashboardKpis(incidents),
    stats: getIncidentStats(incidents),
    report: getReportSummary(incidents),
    aiAnalyses: buildAiAnalyses(incidents),
    responseOps: buildResponseOps(incidents),
  }), [incidents]);

  const value = useMemo<IncidentStoreValue>(() => ({
    incidents,
    loading: !loadState.loaded,
    refreshing: loadState.refreshing && loadState.loaded,
    error: loadState.error,
    lastUpdated: loadState.lastUpdated,
    reloadIncidents,
    ...derived,
    riskZones: mockData.riskZones,
    activity: mockData.activityLog,
    getIncidentById,
    pendingActionId,
    applyHumanAction,
    createIncident,
    ingestIncident,
    hasLiveIncident,
    simulateLiveIncident,
    resolveLiveIncident,
  }), [incidents, loadState, reloadIncidents, derived, getIncidentById, pendingActionId, applyHumanAction, createIncident, ingestIncident, hasLiveIncident, simulateLiveIncident, resolveLiveIncident]);

  return (
    <IncidentStoreContext.Provider value={value}>
      {children}
    </IncidentStoreContext.Provider>
  );
}

export function useIncidentStore() {
  const ctx = useContext(IncidentStoreContext);
  if (!ctx) {
    throw new Error("useIncidentStore must be used within IncidentStoreProvider");
  }
  return ctx;
}
