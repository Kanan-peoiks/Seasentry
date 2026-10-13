// ============================================================
// Live wind / sea-state context from Open-Meteo (no API key).
// Used to enrich incident detail views with real environmental
// data at the incident's location and time. Missing measurements
// stay null — they are never shown as zero.
// ============================================================

export type WindContext = {
  windSpeedKnots: number;
  windHeading: number;
  temperatureC: number | null;
  visibilityKm: number | null;
  /** ISO time (UTC) of the hourly observation/forecast used. */
  sourceTimestamp: string;
  /** Distance between the requested time and the closest hourly value. */
  staleMinutes: number;
};

export type SeaState = {
  seaState: "Calm" | "Slight" | "Moderate" | "Rough";
  waveHeightM: number;
  wavePeriodS: number | null;
  sourceTimestamp: string;
  staleMinutes: number;
};

/** "out-of-coverage": the requested time is outside the archive/forecast
 * window Open-Meteo returned (past_days=16), so the closest value would
 * describe a different day entirely. */
export type WeatherIssue = "unavailable" | "out-of-coverage";
export type WeatherLookup<T> = { ok: true; data: T } | { ok: false; issue: WeatherIssue };

/** Values further than this from the requested time are not representative. */
export const MAX_STALE_MINUTES = 90;

function findClosestHourly(times: unknown, targetIso: string): { idx: number; staleMinutes: number } | null {
  if (!Array.isArray(times) || times.length === 0) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;

  let bestIdx = -1;
  let bestDiffMs = Infinity;
  for (let i = 0; i < times.length; i++) {
    const raw = times[i];
    if (typeof raw !== "string") continue;
    const t = new Date(raw.endsWith("Z") ? raw : `${raw}Z`).getTime();
    if (Number.isNaN(t)) continue;
    const diff = Math.abs(t - target);
    if (diff < bestDiffMs) {
      bestDiffMs = diff;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) return null;
  return { idx: bestIdx, staleMinutes: Math.round(bestDiffMs / 60000) };
}

export function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

const round = (value: number | null, digits: number) => (value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits);
const utcIso = (raw: string) => new Date(raw.endsWith("Z") ? raw : `${raw}Z`).toISOString();

export async function getWindContext(lat: number, lng: number, timestampIso: string, signal?: AbortSignal): Promise<WeatherLookup<WindContext>> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("hourly", "temperature_2m,wind_speed_10m,wind_direction_10m,visibility");
    url.searchParams.set("past_days", "16");
    url.searchParams.set("wind_speed_unit", "kn");
    url.searchParams.set("timezone", "UTC");

    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return { ok: false, issue: "unavailable" };
    const hourly = (await res.json())?.hourly;
    const match = findClosestHourly(hourly?.time, timestampIso);
    if (!match) return { ok: false, issue: "unavailable" };
    if (match.staleMinutes > MAX_STALE_MINUTES) return { ok: false, issue: "out-of-coverage" };

    const windSpeedKnots = toNumber(hourly?.wind_speed_10m?.[match.idx]);
    const windHeading = toNumber(hourly?.wind_direction_10m?.[match.idx]);
    if (windSpeedKnots === null || windHeading === null) return { ok: false, issue: "unavailable" };
    const visibilityM = toNumber(hourly?.visibility?.[match.idx]);

    return {
      ok: true,
      data: {
        windSpeedKnots: Math.round(windSpeedKnots * 10) / 10,
        windHeading: Math.round(windHeading),
        temperatureC: round(toNumber(hourly?.temperature_2m?.[match.idx]), 1),
        visibilityKm: visibilityM === null ? null : Math.round((visibilityM / 1000) * 10) / 10,
        sourceTimestamp: utcIso(hourly.time[match.idx]),
        staleMinutes: match.staleMinutes,
      },
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, issue: "unavailable" };
  }
}

export function waveHeightLabel(waveHeightM: number): SeaState["seaState"] {
  if (waveHeightM < 0.1) return "Calm";
  if (waveHeightM <= 0.3) return "Slight";
  if (waveHeightM <= 0.5) return "Moderate";
  return "Rough";
}

export async function getSeaState(lat: number, lng: number, timestampIso: string, signal?: AbortSignal): Promise<WeatherLookup<SeaState>> {
  try {
    const url = new URL("https://marine-api.open-meteo.com/v1/marine");
    url.searchParams.set("latitude", String(lat));
    url.searchParams.set("longitude", String(lng));
    url.searchParams.set("hourly", "wave_height,wave_direction,wave_period");
    url.searchParams.set("models", "best_match");
    url.searchParams.set("past_days", "16");
    url.searchParams.set("forecast_days", "7");
    url.searchParams.set("timezone", "UTC");

    const res = await fetch(url.toString(), { signal });
    if (!res.ok) return { ok: false, issue: "unavailable" };
    const hourly = (await res.json())?.hourly;
    const match = findClosestHourly(hourly?.time, timestampIso);
    if (!match) return { ok: false, issue: "unavailable" };
    if (match.staleMinutes > MAX_STALE_MINUTES) return { ok: false, issue: "out-of-coverage" };

    const waveHeightM = toNumber(hourly?.wave_height?.[match.idx]);
    if (waveHeightM === null) return { ok: false, issue: "unavailable" };

    return {
      ok: true,
      data: {
        seaState: waveHeightLabel(waveHeightM),
        waveHeightM: Math.round(waveHeightM * 100) / 100,
        wavePeriodS: round(toNumber(hourly?.wave_period?.[match.idx]), 1),
        sourceTimestamp: utcIso(hourly.time[match.idx]),
        staleMinutes: match.staleMinutes,
      },
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, issue: "unavailable" };
  }
}

// ── Current conditions at a fixed point (dashboard weather panel) ──

export type CurrentConditions = {
  windSpeedKt: number | null;
  windGustKt: number | null;
  windDir: number | null;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDir: number | null;
  currentKt: number | null;
  currentDir: number | null;
  /** ISO time (UTC) of the hourly value shown. */
  observedAt: string | null;
  fetchedAt: number;
};

const MS_TO_KT = 1.94384;

function nearestNow(times: unknown): number {
  if (!Array.isArray(times)) return -1;
  return findClosestHourly(times, new Date().toISOString())?.idx ?? -1;
}

/** Wind and marine values for the hour closest to now. Either API may fail
 * independently; whatever is missing stays null. Throws only when both fail
 * or the request was aborted. */
export async function getCurrentConditions(lat: number, lng: number, signal?: AbortSignal): Promise<CurrentConditions> {
  const marineUrl = new URL("https://marine-api.open-meteo.com/v1/marine");
  marineUrl.searchParams.set("latitude", String(lat));
  marineUrl.searchParams.set("longitude", String(lng));
  marineUrl.searchParams.set("hourly", "wave_height,wave_direction,wave_period,ocean_current_velocity,ocean_current_direction");
  marineUrl.searchParams.set("forecast_days", "1");
  marineUrl.searchParams.set("past_days", "1");
  marineUrl.searchParams.set("timezone", "UTC");

  const windUrl = new URL("https://api.open-meteo.com/v1/forecast");
  windUrl.searchParams.set("latitude", String(lat));
  windUrl.searchParams.set("longitude", String(lng));
  windUrl.searchParams.set("hourly", "wind_speed_10m,wind_direction_10m,wind_gusts_10m");
  windUrl.searchParams.set("forecast_days", "1");
  windUrl.searchParams.set("past_days", "1");
  windUrl.searchParams.set("timezone", "UTC");
  windUrl.searchParams.set("wind_speed_unit", "ms");

  const getJson = async (url: URL) => {
    const res = await fetch(url.toString(), { signal });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  const [marine, wind] = await Promise.allSettled([getJson(marineUrl), getJson(windUrl)]);
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (marine.status === "rejected" && wind.status === "rejected") throw new Error("Weather services unavailable");

  const mh = marine.status === "fulfilled" ? marine.value?.hourly : null;
  const wh = wind.status === "fulfilled" ? wind.value?.hourly : null;
  const mi = nearestNow(mh?.time);
  const wi = nearestNow(wh?.time);
  const at = (series: unknown, i: number) => (i < 0 || !Array.isArray(series) ? null : toNumber(series[i]));
  const kt = (ms: number | null, digits = 1) => round(ms === null ? null : ms * MS_TO_KT, digits);
  const observedRaw = wi >= 0 ? wh.time[wi] : mi >= 0 ? mh.time[mi] : null;

  return {
    windSpeedKt: kt(at(wh?.wind_speed_10m, wi)),
    windGustKt: kt(at(wh?.wind_gusts_10m, wi)),
    windDir: round(at(wh?.wind_direction_10m, wi), 0),
    waveHeightM: round(at(mh?.wave_height, mi), 2),
    wavePeriodS: round(at(mh?.wave_period, mi), 1),
    waveDir: round(at(mh?.wave_direction, mi), 0),
    // Open-Meteo reports ocean_current_velocity in km/h.
    currentKt: round(at(mh?.ocean_current_velocity, mi) === null ? null : (at(mh?.ocean_current_velocity, mi) as number) / 1.852, 2),
    currentDir: round(at(mh?.ocean_current_direction, mi), 0),
    observedAt: typeof observedRaw === "string" ? utcIso(observedRaw) : null,
    fetchedAt: Date.now(),
  };
}
