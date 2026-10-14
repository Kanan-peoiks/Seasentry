"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, LoaderCircle, MapPin, Satellite, ShieldCheck } from "lucide-react";
import landing from "./landing.module.css";
import styles from "./cinematic.module.css";
import type { EarthScene } from "./earthScene";
import type { OceanScene } from "./oceanScene";
import { SAR_H, SAR_W, SPILL_1, SPILL_2, toPath } from "./storyImagery";

/* ------------------------------------------------------------------ copy */

const copy = {
  en: {
    names: ["Orbit", "Approach", "Scan", "Detect", "Analyze", "Respond", "Monitor", "Platform"],
    demo: "Real archive image. Area and confidence are illustrative.",
    skip: "Skip the story",
    scroll: "Scroll to begin",
    loading: "Preparing orbital view…",
    rail: "Story chapters",
    credits: [
      "Earth imagery: NASA Blue Marble",
      "NASA Terra MODIS · southern Caspian Sea, 12 Dec 2016",
      "Radar: TerraSAR-X ScanSAR · Montara spill, Timor Sea, 21 Sep 2009 · © DLR, CC BY 3.0",
      "Radar: TerraSAR-X ScanSAR · Montara spill, Timor Sea, 21 Sep 2009 · © DLR, CC BY 3.0",
      "Radar: TerraSAR-X ScanSAR · Montara spill, Timor Sea, 21 Sep 2009 · © DLR, CC BY 3.0",
      "Containment boom deployment exercise, Bahrain, 2006 · U.S. Navy photo (public domain)",
      "Contains modified Copernicus Sentinel-1 data (2021) · Syrian coast, 24–25 Aug 2021 · EU / DEFIS",
      "",
    ],
    place: ["", "Caspian Sea", "Montara · Timor Sea", "12.67°S 124.54°E", "12.67°S 124.54°E", "", "Jablah – Baniyas coast", ""],
    c1: { k: "01 · Orbit to ocean", t: "Radar that sees through clouds and night.", b: "Satellites pass over the Caspian every few days. SeaSentry turns each pass into a clear view of the sea." },
    c2: { k: "02 · Satellite scanning", t: "A swath of sea, read line by line.", b: "Radar measures how rough the water is. Smooth, dark patches can mean oil damping the waves. This is a real radar image of the 2009 Montara spill.", rows: [["Sensor", "Synthetic-aperture radar"], ["Resolution", "≈ 18 m"], ["Works through", "Cloud and darkness"]] },
    c3: { k: "03 · AI detection", t: "The analysis isolates what does not belong.", b: "Detection outlines the dark patches and scores how closely each one matches an oil slick.", panel: "Detections", area: "Estimated area", conf: "Confidence", time: "Observed", coords: "Coordinates", status: "Status", statusV: "Awaiting specialist review", source: "Satellite source", sourceV: "TerraSAR-X" },
    c4: { k: "04 · Spill intelligence", t: "From observation to something you can act on.", b: "Each layer adds context. A specialist reviews all of it before any decision.", layers: ["Spill boundary", "Affected area", "Detection confidence", "Observation details", "Weather and drift when the data supports it"] },
    c5: { k: "05 · Response", t: "Detection becomes a coordinated response.", b: "Vessels tow containment boom to corral the oil for skimmers. Recovery takes days of coordinated work. It is never instant.", remain: "Remaining surface area", note: "Illustrative recovery sequence", boom: "Containment boom", vessel: "Boom-towing vessel" },
    c6: { k: "06 · Monitoring and recovery", t: "Watch the area until it is clear.", b: "Repeat passes show how a slick moves and spreads. Here: two real Sentinel-1 passes, one day apart.", life: ["Detect", "Analyze", "Respond", "Monitor", "Recover"], day1: "24 Aug", day2: "25 Aug" },
    c7: { k: "07 · The platform", t: "Now open the real workspace.", b: "The map-first workspace puts incidents, imagery, review and reporting in one place.", launch: "Launch Platform", signin: "Sign in", guest: "Guest access. Read-only demo." },
    units: "km²",
  },
  az: {
    names: ["Orbit", "Yaxınlaşma", "Skan", "Aşkarlama", "Təhlil", "Cavab", "Monitorinq", "Platforma"],
    demo: "Real arxiv təsviri. Sahə və etibarlılıq illüstrativdir.",
    skip: "Hekayəni keç",
    scroll: "Başlamaq üçün aşağı sürüşdür",
    loading: "Orbital görünüş hazırlanır…",
    rail: "Hekayə hissələri",
    credits: [
      "Yer təsviri: NASA Blue Marble",
      "NASA Terra MODIS · Cənubi Xəzər, 12 dekabr 2016",
      "Radar: TerraSAR-X ScanSAR · Montara sızması, Timor dənizi, 21 sentyabr 2009 · © DLR, CC BY 3.0",
      "Radar: TerraSAR-X ScanSAR · Montara sızması, Timor dənizi, 21 sentyabr 2009 · © DLR, CC BY 3.0",
      "Radar: TerraSAR-X ScanSAR · Montara sızması, Timor dənizi, 21 sentyabr 2009 · © DLR, CC BY 3.0",
      "Bəndin yerləşdirilməsi təlimi, Bəhreyn, 2006 · ABŞ Hərbi Dəniz Qüvvələri (ictimai mülkiyyət)",
      "Copernicus Sentinel-1 məlumatları əsasında (2021) · Suriya sahili, 24–25 avqust 2021 · AB / DEFIS",
      "",
    ],
    place: ["", "Xəzər dənizi", "Montara · Timor dənizi", "12.67°S 124.54°E", "12.67°S 124.54°E", "", "Cəblə – Baniyas sahili", ""],
    c1: { k: "01 · Orbitdən dənizə", t: "Buludları və gecəni keçən radar.", b: "Peyklər Xəzər üzərindən bir neçə gündən bir keçir. SeaSentry hər keçidi dənizin aydın görünüşünə çevirir." },
    c2: { k: "02 · Peyk skanı", t: "Dəniz zolağı sətir-sətir oxunur.", b: "Radar suyun kələ-kötürlüyünü ölçür. Hamar, tünd ləkələr neftin dalğaları sakitləşdirməsi demək ola bilər. Bu, 2009-cu il Montara sızmasının real radar təsviridir.", rows: [["Sensor", "Sintetik aperturlu radar"], ["Ayırdetmə", "≈ 18 m"], ["Keçir", "Bulud və qaranlıq"]] },
    c3: { k: "03 · Süni intellekt aşkarlaması", t: "Təhlil yerinə düşməyəni ayırır.", b: "Aşkarlama tünd ləkələri çərçivəyə alır və hər birinin neft ləkəsinə nə qədər uyğun olduğunu qiymətləndirir.", panel: "Aşkarlamalar", area: "Təxmini sahə", conf: "Etibarlılıq", time: "Müşahidə", coords: "Koordinatlar", status: "Status", statusV: "Mütəxəssis gözlənilir", source: "Peyk mənbəyi", sourceV: "TerraSAR-X" },
    c4: { k: "04 · Sızma təhlili", t: "Müşahidədən əməli məlumata.", b: "Hər qat kontekst əlavə edir. Qərardan əvvəl mütəxəssis hamısını yoxlayır.", layers: ["Sızma sərhədi", "Təsirlənən sahə", "Aşkarlama etibarlılığı", "Müşahidə məlumatları", "Məlumat dəstəkləyəndə hava və drift"] },
    c5: { k: "05 · Cavab tədbiri", t: "Aşkarlama koordinasiyalı cavaba çevrilir.", b: "Gəmilər bəndi dartaraq nefti skimmerlər üçün toplayır. Bərpa günlərlə koordinasiyalı iş tələb edir. Heç vaxt ani deyil.", remain: "Qalan səth sahəsi", note: "İllüstrativ bərpa ardıcıllığı", boom: "Saxlama bəndi", vessel: "Bəndi dartan gəmi" },
    c6: { k: "06 · Monitorinq və bərpa", t: "Ərazi təmizlənənə qədər izlə.", b: "Təkrar keçidlər ləkənin necə yerdəyişdiyini və yayıldığını göstərir. Burada bir gün fərqlə iki real Sentinel-1 keçidi var.", life: ["Aşkarlama", "Təhlil", "Cavab", "Monitorinq", "Bərpa"], day1: "24 avq", day2: "25 avq" },
    c7: { k: "07 · Platforma", t: "İndi real iş sahəsini aç.", b: "Xəritə əsaslı iş sahəsi hadisələri, təsvirləri, baxışı və hesabatı bir yerdə toplayır.", launch: "Platformanı aç", signin: "Daxil ol", guest: "Qonaq girişi. Baxış rejimi." },
    units: "km²",
  },
};

/* ----------------------------------------------------------- capability */

const BOUNDS = [0, 0.09, 0.36, 0.48, 0.6, 0.7, 0.81, 0.92];
const LENGTH_VH = 960;
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

let webglSupport: boolean | null = null;
function hasWebGL() {
  if (webglSupport !== null) return webglSupport;
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2") || probe.getContext("webgl");
    webglSupport = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch { webglSupport = false; }
  return webglSupport;
}

function subscribeEligibility(onChange: () => void) {
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function eligibleSnapshot() {
  if (window.matchMedia(REDUCED_QUERY).matches) return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return false;
  return hasWebGL();
}

/** True only when the cinematic story can run: no reduced-motion/save-data preference and WebGL works. */
export function useCinematicEligible() {
  return useSyncExternalStore(subscribeEligibility, eligibleSnapshot, () => false);
}

/** Heading whose words rise in one after another when the chapter becomes active. */
function Words({ text }: { text: string }) {
  return <>{text.split(" ").map((w, i) => <span key={`${w}-${i}`} className={styles.word} style={{ ["--i" as string]: i }}>{w}</span>).flatMap((el, i) => (i ? [" ", el] : [el]))}</>;
}

type LayerKey = "caspian" | "sar" | "sarInner" | "scan" | "response" | "responseInner" | "monitor" | "monitorTop" | "divider";

/** Position a cover-fitted layer so `fx/fy` (percent of the image) sits at the stage centre, zoomed by `z`. */
function frame(el: HTMLElement | null | undefined, fx: number, fy: number, z: number) {
  if (!el || !el.parentElement) return;
  // Keep the focal point inside the range where the image still covers every stage edge.
  const marginX = (el.parentElement.clientWidth / 2 / (el.offsetWidth * z)) * 100;
  const marginY = (el.parentElement.clientHeight / 2 / (el.offsetHeight * z)) * 100;
  fx = marginX < 50 ? Math.min(100 - marginX, Math.max(marginX, fx)) : 50;
  fy = marginY < 50 ? Math.min(100 - marginY, Math.max(marginY, fy)) : 50;
  el.style.transformOrigin = `${fx}% ${fy}%`;
  el.style.transform = `translate(-${fx}%, -${fy}%) scale(${z})`;
}
function fade(el: HTMLElement | null | undefined, o: number) {
  if (!el) return;
  el.style.opacity = String(o);
  el.style.visibility = o < 0.002 ? "hidden" : "visible";
}

/* ------------------------------------------------------------- component */

type Props = {
  lang: "en" | "az";
  hero: ReactNode;
  /** Shown if WebGL fails after the story started. */
  fallback: ReactNode;
  onLaunch: () => void;
  busy: boolean;
  error: string | null;
  loadingLabel: string;
};

export default function CinematicStory({ lang, hero, fallback, onLaunch, busy, error, loadingLabel }: Props) {
  const c = copy[lang];
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const earthCanvasRef = useRef<HTMLCanvasElement>(null);
  const oceanCanvasRef = useRef<HTMLCanvasElement>(null);
  // Stable registry filled by callback refs; read only inside the animation loop.
  const [layers] = useState<Partial<Record<LayerKey, HTMLElement | null>>>(() => ({}));
  const mask1Ref = useRef<SVGPathElement>(null);
  const mask2Ref = useRef<SVGPathElement>(null);
  const tagsRef = useRef<SVGGElement>(null);
  const areaRef = useRef<HTMLElement>(null);
  const confRef = useRef<HTMLElement>(null);
  const remainRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLSpanElement>(null);
  const [view, setView] = useState({ chapter: 0, step: 0 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const targetRef = useRef(0);
  const setLayer = (key: LayerKey) => (el: HTMLElement | null) => { layers[key] = el; };

  useEffect(() => {
    const container = containerRef.current;
    const stage = stageRef.current;
    const earthCanvas = earthCanvasRef.current;
    const oceanCanvas = oceanCanvasRef.current;
    if (!container || !stage || !earthCanvas || !oceanCanvas) return;

    let raf = 0;
    let disposed = false;
    let visible = true;
    let earth: EarthScene | null = null;
    let ocean: OceanScene | null = null;
    let wide = true;
    let smoothed = 0;
    let last = performance.now();
    let lastChapter = -1;
    let lastStep = -1;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const lowPower = coarse || window.innerWidth < 760 || (navigator.hardwareConcurrency ?? 8) <= 4;
    const L = layers;

    const readScroll = () => {
      const rect = container.getBoundingClientRect();
      const hdr = parseFloat(getComputedStyle(stage).top) || 0;
      const total = Math.max(1, rect.height - stage.offsetHeight);
      targetRef.current = clamp01((hdr - rect.top) / total);
    };
    readScroll();
    smoothed = targetRef.current;

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { rootMargin: "100px" });
    io.observe(container);

    const sizeAll = () => {
      wide = stage.clientWidth / Math.max(1, stage.clientHeight) > 1.05;
      earth?.resize();
      ocean?.resize();
    };
    const ro = new ResizeObserver(() => { sizeAll(); readScroll(); });
    ro.observe(stage);

    const onPointer = (event: PointerEvent) => {
      if (coarse) return;
      const rect = stage.getBoundingClientRect();
      earth?.setPointer(((event.clientX - rect.left) / rect.width - 0.5) * 2, -((event.clientY - rect.top) / rect.height - 0.5) * 2);
    };
    stage.addEventListener("pointermove", onPointer);
    window.addEventListener("scroll", readScroll, { passive: true });

    const idle = (fn: () => void, delay: number) => {
      const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
      window.setTimeout(() => { if (disposed) return; if (ric) ric(fn, { timeout: 1500 }); else fn(); }, delay);
    };

    void import("./oceanScene").then((m) => {
      if (disposed) return;
      const family = getComputedStyle(oceanCanvas).fontFamily || "system-ui, sans-serif";
      ocean = m.createOceanScene(oceanCanvas, family);
      idle(() => ocean?.prepare(), 2500);
      idle(() => ocean?.prepare(), 3000);
      idle(() => ocean?.prepare(), 3500);
    }).catch(() => { /* the final map scene is optional; the story still works without it */ });
    void import("./earthScene").then((m) => {
      if (disposed) return;
      try {
        earth = m.createEarthScene({ canvas: earthCanvas, lowPower, onReady: () => { if (!disposed) setReady(true); } });
        sizeAll();
      } catch {
        if (!disposed) setFailed(true);
      }
    }).catch(() => {
      // The 3D chunk failed to load (offline, blocked): fall back to the static hero.
      if (!disposed) setFailed(true);
    });

    /** Real imagery layers: every value is a pure function of progress, so scrubbing back replays in reverse. */
    const applyLayers = (p: number, t: number) => {
      // Caspian MODIS: picks up where the globe leaves off and keeps descending towards Absheron.
      const casp = smooth(0.255, 0.3, p) * (1 - smooth(0.355, 0.385, p));
      fade(L.caspian, casp);
      if (casp > 0) {
        const k = smooth(0.255, 0.385, p);
        frame(L.caspian?.firstElementChild as HTMLElement, lerp(50, 35, k), lerp(48, 26, k), lerp(1.12, 2.9, k * k));
      }

      // Real SAR scene: scan, detection, analysis.
      const sar = smooth(0.355, 0.385, p) * (1 - smooth(0.69, 0.72, p));
      fade(L.sar, sar);
      if (sar > 0) {
        const zoomIn = smooth(0.48, 0.585, p);
        const drift = Math.sin(t * 0.15) * 0.4;
        frame(L.sarInner, lerp(54, 60, zoomIn) + drift, lerp(50, 44, zoomIn), lerp(1.04, 1.16, zoomIn) + smooth(0.6, 0.7, p) * 0.04);
        const scan = smooth(0.37, 0.47, p);
        const scanVisible = smooth(0.365, 0.38, p) * (1 - smooth(0.47, 0.5, p));
        if (L.scan) {
          L.scan.style.opacity = String(scanVisible);
          L.scan.style.setProperty("--scan", `${lerp(2, 100, scan)}%`);
        }
        const draw1 = smooth(0.49, 0.55, p);
        const draw2 = smooth(0.515, 0.565, p);
        mask1Ref.current?.style.setProperty("stroke-dashoffset", String(1 - draw1));
        mask2Ref.current?.style.setProperty("stroke-dashoffset", String(1 - draw2));
        const pulse = 0.85 + Math.sin(t * 2.4) * 0.15;
        mask1Ref.current?.style.setProperty("fill-opacity", String(smooth(0.53, 0.57, p) * 0.26 * pulse));
        mask2Ref.current?.style.setProperty("fill-opacity", String(smooth(0.55, 0.59, p) * 0.22 * pulse));
        if (tagsRef.current) tagsRef.current.style.opacity = String(smooth(0.55, 0.59, p));
      }

      // Real response photo, descending towards the boom.
      const resp = smooth(0.69, 0.72, p) * (1 - smooth(0.8, 0.83, p));
      fade(L.response, resp);
      if (resp > 0) {
        const k = smooth(0.69, 0.83, p);
        frame(L.responseInner, lerp(48, 56, k), lerp(50, 58, k), lerp(1.32, 1.06, k));
      }

      // Two real Sentinel-1 passes, one day apart, compared with a wipe.
      const mon = smooth(0.8, 0.83, p) * (1 - smooth(0.92, 0.95, p));
      fade(L.monitor, mon);
      if (mon > 0) {
        const wipe = smooth(0.835, 0.9, p);
        frame(L.monitor?.firstElementChild as HTMLElement, 48, 34, lerp(1.06, 1.14, smooth(0.8, 0.95, p)));
        if (L.monitorTop) L.monitorTop.style.clipPath = `inset(0 0 0 ${wipe * 100}%)`;
        if (L.divider) { L.divider.style.left = `${wipe * 100}%`; L.divider.style.opacity = String(wipe > 0.002 && wipe < 0.998 ? 1 : 0); }
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) { last = now; return; }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      smoothed += (targetRef.current - smoothed) * (1 - Math.exp(-dt * 5));
      if (Math.abs(targetRef.current - smoothed) < 0.00005) smoothed = targetRef.current;
      const p = smoothed;
      const t = now / 1000;

      const earthFade = 1 - smooth(0.255, 0.3, p);
      const oceanFade = smooth(0.92, 0.95, p);
      earthCanvas.style.opacity = String(earthFade);
      oceanCanvas.style.opacity = String(oceanFade);
      stage.style.setProperty("--shade", String(1 - smooth(0.29, 0.34, p) * 0.2));

      if (earthFade > 0.001) earth?.render(p, t);
      if (oceanFade > 0.001) ocean?.draw(p, t, wide);
      applyLayers(p, t);

      // Chapter + progressive layer step are the only values React needs to know about.
      let chapter = 0;
      for (let i = 0; i < BOUNDS.length; i++) if (p >= BOUNDS[i]) chapter = i;
      let step = 0;
      if (chapter === 4) step = Math.min(4, Math.floor(((p - BOUNDS[4]) / (BOUNDS[5] - BOUNDS[4])) * 5.4)) + 1;
      if (chapter !== lastChapter || step !== lastStep) {
        lastChapter = chapter;
        lastStep = step;
        stage.dataset.step = String(step);
        setView({ chapter, step });
      }

      // Live numbers are written straight to the DOM, so scrubbing does not re-render React.
      const reveal = smooth(0.5, 0.58, p);
      if (areaRef.current) areaRef.current.textContent = (38.6 * reveal).toFixed(1);
      if (confRef.current) confRef.current.textContent = `${Math.round(91 * reveal)}%`;
      if (remainRef.current) {
        const shrink = lerp(1, 0.38, smooth(0.72, 0.81, p));
        remainRef.current.textContent = `${Math.round(shrink * 100)}%`;
      }
      if (timelineRef.current) timelineRef.current.style.transform = `scaleX(${smooth(0.835, 0.9, p)})`;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", readScroll);
      earth?.dispose();
    };
  }, [layers]);

  const jump = (index: number) => {
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return;
    const total = container.offsetHeight - stage.offsetHeight;
    const containerTop = container.getBoundingClientRect().top + window.scrollY;
    const hdr = parseFloat(getComputedStyle(stage).top) || 0;
    // Land a little into the chapter so its imagery has already arrived.
    const into = index === 0 ? 0 : (BOUNDS[Math.min(index + 1, BOUNDS.length - 1)] - BOUNDS[index]) * 0.35;
    window.scrollTo({ top: containerTop - hdr + total * (BOUNDS[index] + into), behavior: "smooth" });
  };

  if (failed) return <>{fallback}</>;

  const { chapter, step } = view;
  const active = (i: number) => (chapter === i ? "true" : "false");
  const credit = c.credits[chapter];
  const place = c.place[chapter];

  return (
    <div ref={containerRef} className={styles.story} style={{ height: `${LENGTH_VH}svh` }} data-ready={ready}>
      <div ref={stageRef} className={styles.stage}>
        <canvas ref={earthCanvasRef} className={styles.earthCanvas} aria-hidden="true" />

        {/* Real imagery. Positioned and faded every frame from the story progress. */}
        <div className={styles.photos} aria-hidden="true">
          <div ref={setLayer("caspian")} className={styles.layer}>
            <div className={styles.cover} style={{ ["--ar" as string]: 2600 / 2443 }}>
              <Image src="/story/caspian-modis.webp" alt="" fill sizes="(max-width: 700px) 200vw, 150vw" />
            </div>
          </div>

          <div ref={setLayer("sar")} className={`${styles.layer} ${styles.sar}`}>
            <div ref={setLayer("sarInner")} className={styles.cover} style={{ ["--ar" as string]: SAR_W / SAR_H }}>
              <Image src="/story/montara-sar.webp" alt="" fill sizes="(max-width: 700px) 250vw, 110vw" />
              <svg className={styles.overlay} viewBox={`0 0 ${SAR_W} ${SAR_H}`} preserveAspectRatio="none">
                <defs>
                  <pattern id="ss-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                    <line x1="0" y1="0" x2="0" y2="14" stroke="#00E6E6" strokeWidth="2.5" strokeOpacity=".32" />
                  </pattern>
                  <radialGradient id="ss-heat" cx="55%" cy="55%" r="55%">
                    <stop offset="0" stopColor="#F2A93B" stopOpacity=".55" />
                    <stop offset=".55" stopColor="#00C5C8" stopOpacity=".35" />
                    <stop offset="1" stopColor="#00C5C8" stopOpacity="0" />
                  </radialGradient>
                  <clipPath id="ss-clip"><path d={toPath(SPILL_1)} /></clipPath>
                </defs>
                <g className={styles.analysisArea}><path d={toPath(SPILL_1)} fill="url(#ss-hatch)" /></g>
                <g className={styles.analysisHeat} clipPath="url(#ss-clip)"><rect x="480" y="20" width="940" height="860" fill="url(#ss-heat)" /></g>
                <path ref={mask1Ref} className={styles.mask} d={toPath(SPILL_1)} pathLength={1} />
                <path ref={mask2Ref} className={styles.mask} d={toPath(SPILL_2)} pathLength={1} />
                <g ref={tagsRef} className={styles.tags}>
                  <rect x="1150" y="300" width="230" height="36" rx="5" />
                  <text x="1164" y="325">SPILL-1 · 0.91</text>
                  <rect x="560" y="900" width="230" height="36" rx="5" />
                  <text x="574" y="925">SPILL-2 · 0.78</text>
                </g>
                <g className={styles.analysisBox}>
                  <path d="M470 22h60M470 22v60M1410 22h-60M1410 22v60M470 880h60M470 880v-60M1410 880h-60M1410 880v-60" />
                  <text x="1410" y="916" textAnchor="end">TerraSAR-X · ScanSAR · 21.09.2009</text>
                </g>
              </svg>
            </div>
            <div ref={setLayer("scan")} className={styles.scan}><i /></div>
          </div>

          <div ref={setLayer("response")} className={styles.layer}>
            <div ref={setLayer("responseInner")} className={styles.cover} style={{ ["--ar" as string]: 2200 / 1572 }}>
              <Image src="/story/boom-response.webp" alt="" fill sizes="(max-width: 700px) 250vw, 140vw" />
              <svg className={styles.overlay} viewBox="0 0 1920 1372" preserveAspectRatio="none">
                <g className={styles.photoTags}>
                  <circle cx="1100" cy="787" r="8" /><path d="M1100 779V700" /><text x="1110" y="694">{c.c5.boom}</text>
                  <circle cx="1440" cy="905" r="8" /><path d="M1440 913V990" /><text x="1430" y="1016" textAnchor="end">{c.c5.vessel}</text>
                </g>
              </svg>
            </div>
          </div>

          <div ref={setLayer("monitor")} className={styles.layer}>
            <div className={styles.cover} style={{ ["--ar" as string]: 1300 / 1492 }}>
              <Image src="/story/sentinel1-day2.webp" alt="" fill sizes="(max-width: 700px) 200vw, 110vw" />
              <div ref={setLayer("monitorTop")} className={styles.compareTop}>
                <Image src="/story/sentinel1-day1.webp" alt="" fill sizes="(max-width: 700px) 200vw, 110vw" />
              </div>
              <div ref={setLayer("divider")} className={styles.divider}><span>{c.c6.day2}</span><span>{c.c6.day1}</span></div>
            </div>
          </div>
        </div>

        <canvas ref={oceanCanvasRef} className={styles.oceanCanvas} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.vignette} aria-hidden="true" />

        {!ready && <div className={styles.loader} role="status"><LoaderCircle className="spinner" size={18} aria-hidden="true" />{c.loading}</div>}

        <a className={styles.skipStory} href="#capabilities">{c.skip}<ArrowDown size={14} aria-hidden="true" /></a>

        {place && (
          <div className={styles.hudTop}>
            <span><Satellite size={14} aria-hidden="true" />{chapter === 1 ? "Terra MODIS" : chapter === 6 ? "Sentinel-1" : "TerraSAR-X"}</span>
            <span><MapPin size={14} aria-hidden="true" />{place}</span>
          </div>
        )}
        {credit && <p className={styles.credit}>{credit}</p>}

        <div className={styles.panels}>
          <section className={`${styles.chapter} ${styles.heroChapter}`} data-active={active(0)}>
            <div className={landing.hero}>{hero}</div>
            <p className={styles.scrollHint}><span aria-hidden="true" />{c.scroll}</p>
          </section>

          <section className={styles.chapter} data-active={active(1)}>
            <p className={styles.kicker}>{c.c1.k}</p><h2><Words text={c.c1.t} /></h2><p className={styles.body}>{c.c1.b}</p>
          </section>

          <section className={styles.chapter} data-active={active(2)}>
            <p className={styles.kicker}>{c.c2.k}</p><h2><Words text={c.c2.t} /></h2><p className={styles.body}>{c.c2.b}</p>
            <dl className={styles.facts}>{c.c2.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>

          <section className={styles.chapter} data-active={active(3)}>
            <p className={styles.kicker}>{c.c3.k}</p><h2><Words text={c.c3.t} /></h2><p className={styles.body}>{c.c3.b}</p>
            <div className={styles.detection}>
              <div className={styles.detectionHead}><ShieldCheck size={15} aria-hidden="true" />{c.c3.panel}<em>2</em></div>
              <dl>
                <div><dt>{c.c3.area}</dt><dd><strong ref={areaRef}>0.0</strong> {c.units}</dd></div>
                <div><dt>{c.c3.conf}</dt><dd><strong ref={confRef}>0%</strong></dd></div>
                <div><dt>{c.c3.time}</dt><dd>21.09.2009</dd></div>
                <div><dt>{c.c3.coords}</dt><dd>12.67°S 124.54°E</dd></div>
                <div><dt>{c.c3.source}</dt><dd>{c.c3.sourceV}</dd></div>
                <div><dt>{c.c3.status}</dt><dd>{c.c3.statusV}</dd></div>
              </dl>
              <p className={styles.panelNote}>{c.demo}</p>
            </div>
          </section>

          <section className={styles.chapter} data-active={active(4)}>
            <p className={styles.kicker}>{c.c4.k}</p><h2><Words text={c.c4.t} /></h2><p className={styles.body}>{c.c4.b}</p>
            <ol className={styles.layers}>{c.c4.layers.map((l, i) => <li key={l} data-on={step > i}><span aria-hidden="true">{step > i ? <Check size={13} /> : i + 1}</span>{l}</li>)}</ol>
          </section>

          <section className={styles.chapter} data-active={active(5)}>
            <p className={styles.kicker}>{c.c5.k}</p><h2><Words text={c.c5.t} /></h2><p className={styles.body}>{c.c5.b}</p>
            <div className={styles.remain}><span>{c.c5.remain}</span><strong ref={remainRef}>100%</strong><em>{c.c5.note}</em></div>
          </section>

          <section className={styles.chapter} data-active={active(6)}>
            <p className={styles.kicker}>{c.c6.k}</p><h2><Words text={c.c6.t} /></h2><p className={styles.body}>{c.c6.b}</p>
            <ol className={styles.life}>{c.c6.life.map((l) => <li key={l} data-on="true">{l}</li>)}</ol>
            <div className={styles.timeline} aria-hidden="true"><span ref={timelineRef} /></div>
            <p className={styles.fine}>{c.c6.day1} → {c.c6.day2} 2021</p>
          </section>

          <section className={`${styles.chapter} ${styles.finale}`} data-active={active(7)}>
            <p className={styles.kicker}>{c.c7.k}</p><h2><Words text={c.c7.t} /></h2><p className={styles.body}>{c.c7.b}</p>
            <div className={styles.mini} aria-hidden="true"><i /><i /><i /><b /></div>
            <div className={styles.actions}>
              <button type="button" className={landing.primary} onClick={onLaunch} disabled={busy} aria-busy={busy}>
                {busy ? <LoaderCircle className="spinner" size={18} aria-hidden="true" /> : null}<span>{busy ? loadingLabel : c.c7.launch}</span><ArrowRight size={18} aria-hidden="true" />
              </button>
              <Link className={styles.signin} href="/login">{c.c7.signin}</Link>
            </div>
            <p className={styles.fine}>{c.c7.guest}</p>
            {error && <p className={styles.error} role="alert">{error}</p>}
          </section>
        </div>

        <nav className={styles.rail} aria-label={c.rail}>
          {c.names.map((name, i) => (
            <button key={name} type="button" onClick={() => jump(i)} aria-label={name} aria-current={chapter === i ? "step" : undefined} data-active={chapter === i}>
              <span>{name}</span><i aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
