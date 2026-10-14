"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import type L from "leaflet";
import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import { CASPIAN_OVERVIEW, formatAreaM2, type RiskZone, type Vessel } from "@/lib/mock-data";
import type { Incident } from "@/lib/types";
import type { SpillSourceResult } from "@/lib/spill-physics";
import { useLanguage } from "@/lib/useLanguage";
import type { Translations } from "@/lib/i18n";

export type MapLayerId = "active" | "history" | "vessels" | "zones" | "drift";
export type MapLayers = Record<MapLayerId, boolean>;
export const DEFAULT_MAP_LAYERS: MapLayers = { active: true, history: false, vessels: true, zones: true, drift: false };

export type Basemap = "map" | "satellite" | "modis";

/** Most recent complete MODIS day: yesterday in UTC (today is still being acquired). */
export function modisDate(now = Date.now()) {
  return new Date(now - 86_400_000).toISOString().slice(0, 10);
}

function basemapSpec(basemap: Basemap): { url: string; options: L.TileLayerOptions & { time?: string } } {
  if (basemap === "satellite") {
    return {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      options: { maxZoom: 19, maxNativeZoom: 18, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics" },
    };
  }
  if (basemap === "modis") {
    const time = modisDate();
    return {
      url: "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
      options: { time, maxZoom: 19, maxNativeZoom: 9, attribution: `NASA EOSDIS GIBS · Terra MODIS ${time}` },
    };
  }
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  };
}

export type MapHandle = {
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  /** Fits the view to every open (not resolved/rejected) incident. */
  fitActive: () => void;
  focusIncident: (incident: Incident) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
};

type Props = {
  incidents: Incident[];
  vessels: Vessel[];
  riskZones: RiskZone[];
  layers: MapLayers;
  /** Background tiles: street map, satellite mosaic or the latest daily MODIS pass. */
  basemap?: Basemap;
  selectedId?: string | null;
  liveIncidentId?: string | null;
  /** Upwind source estimates keyed by incident id (drift layer only). */
  sourceEstimates?: Record<string, SpillSourceResult | null>;
  onIncidentSelect?: (incident: Incident) => void;
  /** While true, the next map click reports coordinates via onMapClick. */
  placementMode?: boolean;
  placementHint?: string;
  onMapClick?: (lat: number, lng: number) => void;
  onPlacementCancel?: () => void;
  label: string;
  ref?: Ref<MapHandle>;
};

const isClosed = (incident: Incident) => incident.status === "resolved" || incident.status === "rejected";

// Fixed colours, independent of the app theme: they must read on the light street map
// as well as on the darker satellite and MODIS basemaps (markers also get a white outline).
const RISK_COLOR: Record<Incident["risk"], string> = { HIGH: "#C0392B", MEDIUM: "#B7791F", LOW: "#1F7A99" };
const CLOSED_COLOR = "#6B7C88";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

/** Marker colour carries risk; ring style carries status (detected: pulse,
 * under review: solid ring, cleaning: dashed ring, closed: hollow grey). */
function incidentIcon(Leaflet: typeof L, incident: Incident, selected: boolean, live: boolean) {
  const closed = isClosed(incident);
  const color = closed ? CLOSED_COLOR : RISK_COLOR[incident.risk];
  const size = selected ? 22 : closed ? 14 : 18;
  const cls = ["map-marker", `map-marker--${incident.status}`, selected ? "map-marker--selected" : "", live ? "map-marker--live" : ""].join(" ");
  const html = `<span class="${cls}" style="--marker-color:${color};width:${size}px;height:${size}px"><span class="map-marker-dot"></span></span>`;
  return Leaflet.divIcon({ html, className: "map-marker-wrap", iconSize: [size + 16, size + 16], iconAnchor: [(size + 16) / 2, (size + 16) / 2] });
}

function vesselIcon(Leaflet: typeof L, heading: number) {
  return Leaflet.divIcon({
    html: `<span class="map-vessel" style="transform:rotate(${heading}deg)"></span>`,
    className: "map-marker-wrap",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function incidentLabel(incident: Incident, t: Translations) {
  return `${incident.displayId} · ${incident.title || incident.location} · ${t.risk[incident.risk]} · ${t.status[incident.status]}`;
}

function incidentTooltip(incident: Incident, t: Translations) {
  return `<strong>${escapeHtml(incident.displayId)}</strong> ${escapeHtml(incident.title || incident.location)}<br/>${escapeHtml(t.risk[incident.risk])} · ${escapeHtml(t.status[incident.status])} · ${escapeHtml(formatAreaM2(incident.areaM2))}`;
}

const signature = (incident: Incident, selected: boolean, live: boolean, lang: string) =>
  [incident.lat, incident.lng, incident.risk, incident.status, incident.areaM2, incident.title, selected, live, lang].join("|");

export default function MapPanel({ incidents, vessels, riskZones, layers, basemap = "map", selectedId, liveIncidentId, sourceEstimates, onIncidentSelect, placementMode = false, placementHint, onMapClick, onPlacementCancel, label, ref }: Props) {
  const { t, lang } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<typeof L | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const groupsRef = useRef<Record<"active" | "history" | "vessels" | "zones" | "drift" | "selection", L.LayerGroup> | null>(null);
  const markersRef = useRef(new Map<string, { marker: L.Marker; sig: string; closed: boolean }>());
  const callbacks = useRef({ onIncidentSelect, onMapClick, onPlacementCancel });
  const incidentsRef = useRef(incidents);
  const [ready, setReady] = useState(false);
  const [tileState, setTileState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    callbacks.current = { onIncidentSelect, onMapClick, onPlacementCancel };
    incidentsRef.current = incidents;
  });

  // Create the map once; tear down every listener, observer and layer on unmount.
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let map: L.Map | null = null;
    const markers = markersRef.current;

    import("leaflet").then(({ default: Leaflet }) => {
      if (disposed || !containerRef.current) return;
      leafletRef.current = Leaflet;
      map = Leaflet.map(containerRef.current, {
        center: [CASPIAN_OVERVIEW.lat, CASPIAN_OVERVIEW.lng],
        zoom: CASPIAN_OVERVIEW.zoom,
        zoomSnap: 0.25,
        zoomControl: false,
        attributionControl: true,
        keyboard: true,
      });
      map.attributionControl.setPrefix(false);
      mapRef.current = map;

      groupsRef.current = {
        zones: Leaflet.layerGroup(),
        history: Leaflet.layerGroup(),
        active: Leaflet.layerGroup(),
        vessels: Leaflet.layerGroup(),
        drift: Leaflet.layerGroup(),
        selection: Leaflet.layerGroup().addTo(map),
      };

      observer = new ResizeObserver(() => map?.invalidateSize({ pan: false }));
      observer.observe(containerRef.current);
      setReady(true);
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      markers.clear();
      map?.off();
      map?.remove();
      mapRef.current = null;
      groupsRef.current = null;
      tilesRef.current = null;
    };
  }, []);

  // Basemap tiles, swapped in place when the operator picks another background.
  useEffect(() => {
    const map = mapRef.current;
    const Leaflet = leafletRef.current;
    if (!ready || !map || !Leaflet) return;
    const spec = basemapSpec(basemap);
    let errors = 0;
    const tiles = Leaflet.tileLayer(spec.url, spec.options);
    tiles.on("tileerror", () => { errors += 1; if (errors >= 4) setTileState("error"); });
    tiles.on("load", () => { errors = 0; setTileState("ok"); });
    tiles.addTo(map);
    tiles.bringToBack();
    tilesRef.current = tiles;
    return () => {
      // On unmount the map is torn down first (map.remove() drops every layer); only swap on a live map.
      // Remove before off(): Leaflet clears the layer's attribution from a one-off "remove" listener.
      if (mapRef.current === map) map.removeLayer(tiles);
      tiles.off();
      if (tilesRef.current === tiles) tilesRef.current = null;
    };
  }, [ready, basemap]);

  // Layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    const groups = groupsRef.current;
    if (!ready || !map || !groups) return;
    (Object.keys(layers) as MapLayerId[]).forEach((id) => {
      if (layers[id] && !map.hasLayer(groups[id])) groups[id].addTo(map);
      if (!layers[id] && map.hasLayer(groups[id])) map.removeLayer(groups[id]);
    });
  }, [ready, layers]);

  // Risk zones (static demo context).
  useEffect(() => {
    const Leaflet = leafletRef.current;
    const group = groupsRef.current?.zones;
    if (!ready || !Leaflet || !group) return;
    group.clearLayers();
    riskZones.forEach((zone) => {
      const color = zone.level === "high" ? "#B7791F" : "#C9A048";
      Leaflet.circle([zone.lat, zone.lng], { radius: zone.radiusM, color, fillColor: color, fillOpacity: zone.level === "high" ? 0.12 : 0.08, weight: 1.25, opacity: 0.7, interactive: true })
        .bindTooltip(`${escapeHtml(zone.name)} · ${escapeHtml(t.mapPanel.demoLabel)}`, { direction: "top", opacity: 0.95 })
        .addTo(group);
    });
  }, [ready, riskZones, t]);

  // Vessels (demo register).
  useEffect(() => {
    const Leaflet = leafletRef.current;
    const group = groupsRef.current?.vessels;
    if (!ready || !Leaflet || !group) return;
    group.clearLayers();
    vessels.forEach((v) => {
      Leaflet.marker([v.lat, v.lng], { icon: vesselIcon(Leaflet, v.heading), keyboard: false, zIndexOffset: 200 })
        .bindTooltip(`<strong>${escapeHtml(v.name)}</strong><br/>${escapeHtml(v.type)} · ${escapeHtml(t.mapPanel.demoLabel)}`, { direction: "top" })
        .addTo(group);
    });
  }, [ready, vessels, t]);

  // Incident markers: diffed by id, so only changed markers are touched.
  useEffect(() => {
    const Leaflet = leafletRef.current;
    const groups = groupsRef.current;
    if (!ready || !Leaflet || !groups) return;
    const markers = markersRef.current;
    const seen = new Set<string>();

    incidents.forEach((incident) => {
      seen.add(incident.id);
      const selected = incident.id === selectedId;
      const live = incident.id === liveIncidentId;
      const closed = isClosed(incident);
      const sig = signature(incident, selected, live, lang);
      const existing = markers.get(incident.id);
      if (existing && existing.sig === sig) return;

      if (existing) {
        existing.marker.setLatLng([incident.lat, incident.lng]);
        existing.marker.setIcon(incidentIcon(Leaflet, incident, selected, live));
        existing.marker.setTooltipContent(incidentTooltip(incident, t));
        existing.marker.setZIndexOffset(selected ? 1000 : closed ? 300 : 600);
        if (existing.closed !== closed) {
          (existing.closed ? groups.history : groups.active).removeLayer(existing.marker);
          existing.marker.addTo(closed ? groups.history : groups.active);
        }
      } else {
        const marker = Leaflet.marker([incident.lat, incident.lng], {
          icon: incidentIcon(Leaflet, incident, selected, live),
          keyboard: true,
          title: incidentLabel(incident, t),
          alt: incidentLabel(incident, t),
          riseOnHover: true,
          zIndexOffset: selected ? 1000 : closed ? 300 : 600,
        });
        marker.bindTooltip(incidentTooltip(incident, t), { direction: "top", offset: [0, -10] });
        const select = () => {
          const current = incidentsRef.current.find((i) => i.id === incident.id);
          if (current) callbacks.current.onIncidentSelect?.(current);
        };
        marker.on("click", select);
        marker.on("keypress", (e: L.LeafletKeyboardEvent) => {
          if (e.originalEvent.key === "Enter" || e.originalEvent.key === " ") {
            e.originalEvent.preventDefault();
            select();
          }
        });
        marker.addTo(closed ? groups.history : groups.active);
        markers.set(incident.id, { marker, sig, closed });
        return;
      }
      const label = incidentLabel(incident, t);
      const el = existing.marker.getElement();
      if (el) { el.title = label; el.setAttribute("aria-label", label); }
      markers.set(incident.id, { marker: existing.marker, sig, closed });
    });

    markers.forEach((entry, id) => {
      if (seen.has(id)) return;
      entry.marker.remove();
      markers.delete(id);
    });
  }, [ready, incidents, selectedId, liveIncidentId, lang, t]);

  // Selected incident: an honest area illustration (true-scale circle), not a slick outline.
  useEffect(() => {
    const Leaflet = leafletRef.current;
    const group = groupsRef.current?.selection;
    if (!ready || !Leaflet || !group) return;
    group.clearLayers();
    const incident = incidents.find((i) => i.id === selectedId);
    if (!incident || incident.areaM2 <= 0) return;
    const radius = Math.sqrt(incident.areaM2 / Math.PI);
    Leaflet.circle([incident.lat, incident.lng], { radius, color: "#0C2133", weight: 1.5, dashArray: "4 4", fillColor: RISK_COLOR[incident.risk], fillOpacity: 0.18, interactive: true })
      .bindTooltip(`${escapeHtml(formatAreaM2(incident.areaM2))} · ${escapeHtml(t.mapPanel.areaIllustration)}`, { direction: "top", sticky: true })
      .addTo(group);
  }, [ready, incidents, selectedId, t]);

  // Calculated drift and probable source (opt-in layer, dashed).
  useEffect(() => {
    const Leaflet = leafletRef.current;
    const group = groupsRef.current?.drift;
    if (!ready || !Leaflet || !group) return;
    group.clearLayers();
    Object.entries(sourceEstimates ?? {}).forEach(([id, estimate]) => {
      const incident = incidents.find((i) => i.id === id);
      if (!incident || !estimate?.available) return;
      Leaflet.polyline([[estimate.lat, estimate.lng], [incident.lat, incident.lng]], { color: "#7A3E9D", weight: 2, dashArray: "6 6", opacity: 0.85 })
        .bindTooltip(escapeHtml(t.mapPanel.driftTooltip(estimate.distanceKm, estimate.hoursElapsed)), { sticky: true })
        .addTo(group);
      Leaflet.marker([estimate.lat, estimate.lng], {
        icon: Leaflet.divIcon({ html: '<span class="map-source"></span>', className: "map-marker-wrap", iconSize: [18, 18], iconAnchor: [9, 9] }),
        keyboard: false,
        zIndexOffset: 700,
      })
        .bindTooltip(`<strong>${escapeHtml(t.mapPanel.probableSource)}</strong><br/>${escapeHtml(t.mapPanel.calculatedNote(estimate.confidencePct))}`, { direction: "top" })
        .addTo(group);
    });
  }, [ready, incidents, sourceEstimates, t]);

  // Placement mode: crosshair, click to pick, Escape to cancel.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !placementMode) return;
    const container = map.getContainer();
    container.classList.add("map-placing");
    const handleClick = (e: L.LeafletMouseEvent) => callbacks.current.onMapClick?.(e.latlng.lat, e.latlng.lng);
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") callbacks.current.onPlacementCancel?.(); };
    map.on("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      map.off("click", handleClick);
      window.removeEventListener("keydown", handleKey);
      container.classList.remove("map-placing");
    };
  }, [ready, placementMode]);

  useImperativeHandle(ref, () => ({
    zoomIn: () => mapRef.current?.zoomIn(),
    zoomOut: () => mapRef.current?.zoomOut(),
    resetView: () => mapRef.current?.setView([CASPIAN_OVERVIEW.lat, CASPIAN_OVERVIEW.lng], CASPIAN_OVERVIEW.zoom),
    fitActive: () => {
      const Leaflet = leafletRef.current;
      const open = incidentsRef.current.filter((i) => !isClosed(i));
      if (!Leaflet || !mapRef.current || !open.length) return;
      mapRef.current.fitBounds(Leaflet.latLngBounds(open.map((i) => [i.lat, i.lng] as [number, number])), { padding: [48, 48], maxZoom: 10 });
    },
    focusIncident: (incident) => {
      const map = mapRef.current;
      if (!map) return;
      // Only pan when the incident is off-screen; never reset the user's zoom.
      if (!map.getBounds().pad(-0.1).contains([incident.lat, incident.lng])) map.panTo([incident.lat, incident.lng]);
    },
    flyTo: (lat, lng, zoom) => mapRef.current?.flyTo([lat, lng], zoom ?? Math.max(mapRef.current.getZoom(), 9), { duration: 0.8 }),
  }), []);

  return (
    <div className="map-panel">
      <div ref={containerRef} className="map-canvas" role="region" aria-label={label} />
      {!ready && (
        <div className="map-overlay" role="status">
          <LoaderCircle size={20} className="spinner" aria-hidden="true" />
          <span>{t.mapPanel.loading}</span>
        </div>
      )}
      {ready && tileState === "error" && (
        <div className="map-banner map-banner--error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{t.mapPanel.tileError}</span>
          <button type="button" onClick={() => { setTileState("loading"); tilesRef.current?.redraw(); }}>
            <RotateCcw size={14} aria-hidden="true" />{t.session.retry}
          </button>
        </div>
      )}
      {placementMode && placementHint && (
        <div className="map-banner map-banner--hint" role="status">{placementHint}</div>
      )}
    </div>
  );
}
