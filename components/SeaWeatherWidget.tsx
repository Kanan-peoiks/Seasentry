"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Waves, Wind, Navigation2, TriangleAlert } from "lucide-react";
import { getCurrentConditions, type CurrentConditions } from "@/lib/weather";
import { formatWorkspaceTime } from "@/lib/workspace-url";
import { useLanguage } from "@/lib/useLanguage";
import Button from "@/components/ui/Button";

const GUST_WARN_KT = 25;
const GUST_CRIT_KT = 35;
const WAVE_WARN_M = 2.0;
const WAVE_CRIT_M = 3.5;
const REFRESH_MS = 10 * 60 * 1000;
/** An hourly value older than this is flagged as stale. */
const STALE_MS = 2 * 60 * 60 * 1000;

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function hazard(value: number | null, warnAt: number, critAt: number): "crit" | "warn" | undefined {
  if (value === null) return undefined;
  if (value >= critAt) return "crit";
  if (value >= warnAt) return "warn";
  return undefined;
}

type Loaded = { key: string; data: CurrentConditions | null; failed: boolean };

type Props = { lat: number; lng: number; label: string };

/** Current wind, waves and surface current at one point. Results are keyed
 * by location: a response for a previous location is discarded, a failed
 * refresh keeps the last values for the same location. */
export default function SeaWeatherWidget({ lat, lng, label }: Props) {
  const { t, lang } = useLanguage();
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return getCurrentConditions(lat, lng, controller.signal).then(
      (data) => {
        if (controller.signal.aborted) return;
        setLoaded({ key, data, failed: false });
        setRefreshing(false);
      },
      () => {
        if (controller.signal.aborted) return;
        setLoaded((prev) => ({ key, data: prev?.key === key ? prev.data : null, failed: true }));
        setRefreshing(false);
      }
    );
  }, [key, lat, lng]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => {
      window.clearInterval(id);
      controllerRef.current?.abort();
    };
  }, [load]);

  const current = loaded?.key === key ? loaded : null;
  const data = current?.data ?? null;
  const loading = !current;
  const failed = current?.failed ?? false;
  const stale = data?.observedAt ? data.fetchedAt - Date.parse(data.observedAt) > STALE_MS : false;
  const missing = data ? [data.windSpeedKt, data.waveHeightM, data.currentKt].some((v) => v === null) : false;
  const none = t.seaWeather.noData;

  const refresh = () => {
    setRefreshing(true);
    void load();
  };

  const metrics = data && [
    {
      id: "wind", icon: <Wind size={20} aria-hidden="true" />, label: t.seaWeather.wind,
      value: data.windSpeedKt === null ? none : `${data.windSpeedKt.toFixed(1)} kt`, dir: data.windDir,
      detail: data.windDir === null ? none : `${data.windDir}° ${degToCompass(data.windDir)}${data.windGustKt === null ? "" : ` · ${t.seaWeather.gustLabel} ${data.windGustKt.toFixed(0)} kt`}`,
      level: hazard(data.windGustKt, GUST_WARN_KT, GUST_CRIT_KT),
    },
    {
      id: "waves", icon: <Waves size={20} aria-hidden="true" />, label: t.seaWeather.waves,
      value: data.waveHeightM === null ? none : `${data.waveHeightM.toFixed(1)} m`, dir: data.waveDir,
      detail: data.waveDir === null ? none : `${data.waveDir}° ${degToCompass(data.waveDir)}${data.wavePeriodS === null ? "" : ` · ${data.wavePeriodS.toFixed(0)} s`}`,
      level: hazard(data.waveHeightM, WAVE_WARN_M, WAVE_CRIT_M),
    },
    {
      id: "current", icon: <Navigation2 size={20} aria-hidden="true" />, label: t.seaWeather.current,
      value: data.currentKt === null ? none : `${data.currentKt.toFixed(2)} kt`, dir: data.currentDir,
      detail: data.currentDir === null ? none : `${data.currentDir}° ${degToCompass(data.currentDir)}`,
      level: undefined,
    },
  ];

  return (
    <div className="weather" aria-busy={loading || refreshing || undefined}>
      <div className="weather-head">
        <div className="weather-place">
          <strong>{label}</strong>
          <span>{lat.toFixed(2)}°N, {lng.toFixed(2)}°E</span>
        </div>
        <button type="button" className="ui-icon-button" onClick={refresh} disabled={loading || refreshing} aria-label={t.seaWeather.refreshNow} title={t.seaWeather.refreshNow}>
          <RefreshCw size={16} className={loading || refreshing ? "spinner" : undefined} aria-hidden="true" />
        </button>
      </div>

      {loading && (
        <div className="weather-grid" role="status" aria-label={t.common.loading}>
          {[0, 1, 2].map((i) => <div key={i} className="weather-metric weather-metric--skeleton" />)}
        </div>
      )}

      {!loading && !data && (
        <div className="weather-error" role="alert">
          <TriangleAlert size={20} aria-hidden="true" />
          <span>{t.seaWeather.unavailable}</span>
          <Button onClick={refresh} busy={refreshing}>{t.seaWeather.retry}</Button>
        </div>
      )}

      {metrics && (
        <>
          <div className="weather-grid">
            {metrics.map((m) => (
              <div key={m.id} id={`sea-weather-${m.id}`} className={`weather-metric${m.level ? ` weather-metric--${m.level}` : ""}`}>
                <span className="weather-metric-label">{m.icon}{m.label}</span>
                <span className="weather-metric-value">
                  {m.value}
                  {m.level && <TriangleAlert size={14} aria-label={m.level === "crit" ? "High" : "Elevated"} />}
                </span>
                <span className="weather-metric-detail">
                  {m.dir !== null && <svg width="14" height="14" viewBox="0 0 24 24" style={{ transform: `rotate(${m.dir}deg)` }} aria-hidden="true"><path d="M12 3L6 18l6-4 6 4L12 3Z" fill="currentColor" /></svg>}
                  {m.detail}
                </span>
              </div>
            ))}
          </div>
          <div className="weather-foot">
            <span>{t.seaWeather.sourceTime}: {data.observedAt ? `${formatWorkspaceTime(data.observedAt, lang)} AZT` : none}</span>
            <span className="provenance">Open-Meteo</span>
          </div>
          {stale && <p className="weather-note weather-note--warn">{t.seaWeather.staleWarning}</p>}
          {missing && <p className="weather-note">{t.seaWeather.partialUnavailable}</p>}
          {failed && <p className="weather-note weather-note--warn" role="status">{t.seaWeather.refreshFailed}</p>}
        </>
      )}
    </div>
  );
}
