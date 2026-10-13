"use client";

import { useEffect, useState } from "react";
import type { Incident } from "@/lib/types";
import { getWindContext, getSeaState, type WindContext, type SeaState, type WeatherIssue } from "@/lib/weather";
import { estimateSpillSource, type SpillSourceResult } from "@/lib/spill-physics";

type Result = {
  wind: WindContext | null;
  sea: SeaState | null;
  /** Why wind data is missing, when it is. */
  windIssue: WeatherIssue | null;
  estimate: SpillSourceResult | null;
  loading: boolean;
};

type Loaded = { key: string; wind: WindContext | null; sea: SeaState | null; windIssue: WeatherIssue | null };

/** Live wind/sea context plus the derived upwind source estimate for one
 * incident. Results are keyed by location and time, so a slow answer for a
 * previous incident can never be shown for the current one. */
export function useSpillSourceEstimate(incident: Incident | null | undefined): Result {
  const key = incident ? `${incident.id}|${incident.lat}|${incident.lng}|${incident.timestamp}` : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!incident || !key) return;
    const controller = new AbortController();
    Promise.all([
      getWindContext(incident.lat, incident.lng, incident.timestamp, controller.signal),
      getSeaState(incident.lat, incident.lng, incident.timestamp, controller.signal),
    ])
      .then(([w, s]) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, wind: w.ok ? w.data : null, sea: s.ok ? s.data : null, windIssue: w.ok ? null : w.issue });
      })
      .catch(() => { /* Aborted: a newer incident replaced this request. */ });
    return () => controller.abort();
    // `key` captures every incident field the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = loaded && loaded.key === key ? loaded : null;
  const wind = current?.wind ?? null;
  const sea = current?.sea ?? null;
  return {
    wind,
    sea,
    windIssue: current?.windIssue ?? null,
    estimate: incident ? estimateSpillSource(incident, wind, sea) : null,
    loading: Boolean(key) && !current,
  };
}
