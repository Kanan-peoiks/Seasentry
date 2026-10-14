// ============================================================
// Map background preference — the operator's last choice of base
// map (street map, satellite mosaic or daily MODIS), persisted in
// localStorage and read through useSyncExternalStore like the theme.
// ============================================================

import type { Basemap } from "@/components/MapPanel";

const BASEMAP_STORAGE_KEY = "seasentry-basemap";
const BASEMAP_CHANGE_EVENT = "seasentry-basemap-change";

export function getStoredBasemap(): Basemap {
  try {
    const raw = localStorage.getItem(BASEMAP_STORAGE_KEY);
    return raw === "satellite" || raw === "modis" ? raw : "map";
  } catch { return "map"; }
}

export function setStoredBasemap(basemap: Basemap) {
  try { localStorage.setItem(BASEMAP_STORAGE_KEY, basemap); } catch { /* storage blocked: keep the in-memory choice only */ }
  window.dispatchEvent(new Event(BASEMAP_CHANGE_EVENT));
}

export function subscribeBasemap(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(BASEMAP_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(BASEMAP_CHANGE_EVENT, onChange);
  };
}
