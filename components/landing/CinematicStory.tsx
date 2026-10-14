"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, Check, LoaderCircle, MapPin, Satellite, ShieldCheck } from "lucide-react";
import landing from "./landing.module.css";
import styles from "./cinematic.module.css";
import type { EarthScene } from "./earthScene";
import type { OceanScene } from "./oceanScene";

/* ------------------------------------------------------------------ copy */

const copy = {
  en: {
    names: ["Orbit", "Approach", "Scan", "Detect", "Analyze", "Respond", "Monitor", "Platform"],
    demo: "Demonstration data. Not a live observation.",
    skip: "Skip the story",
    scroll: "Scroll to begin",
    loading: "Preparing orbital view…",
    rail: "Story chapters",
    c1: { k: "01 · Orbit to ocean", t: "Radar that sees through clouds and night.", b: "Sentinel-1 passes over the Caspian every few days. SeaSentry turns each pass into a view of the sea." },
    c2: { k: "02 · Satellite scanning", t: "A swath of sea, read line by line.", b: "Synthetic-aperture radar measures how rough the water is. Smooth, dark patches can mean oil damping the waves.", rows: [["Source", "Sentinel-1 SAR"], ["Band", "C-band radar"], ["Region", "Caspian Sea"]] },
    c3: { k: "03 · AI detection", t: "The analysis isolates what does not belong.", b: "A detection overlay outlines the dark patch and scores how closely it matches an oil slick.", panel: "Detection", area: "Estimated area", conf: "Confidence", time: "Observed", coords: "Coordinates", status: "Status", statusV: "Awaiting specialist review", source: "Satellite source", sourceV: "Sentinel-1 SAR" },
    c4: { k: "04 · Spill intelligence", t: "From observation to something you can act on.", b: "Each layer adds context. A specialist reviews all of it before any decision.", layers: ["Spill boundary", "Affected area", "Detection confidence", "Observation details", "Weather and drift when the data supports it"] },
    c5: { k: "05 · Response", t: "Detection becomes a coordinated response.", b: "Vessels and containment boom are placed around the slick, then recovery proceeds over days. It is never instant.", remain: "Remaining surface area", detected: "Detected extent", note: "Illustrative recovery sequence" },
    c6: { k: "06 · Monitoring and recovery", t: "Watch the area until it is clear.", b: "Repeat passes show how the slick changes, so the response can be adjusted and the outcome documented.", life: ["Detect", "Analyze", "Respond", "Monitor", "Recover"] },
    c7: { k: "07 · The platform", t: "Now open the real workspace.", b: "The map-first workspace puts incidents, imagery, review and reporting in one place.", launch: "Launch Platform", signin: "Sign in", guest: "Guest access. Read-only demo." },
    units: "km²",
  },
  az: {
    names: ["Orbit", "Yaxınlaşma", "Skan", "Aşkarlama", "Təhlil", "Cavab", "Monitorinq", "Platforma"],
    demo: "Demo məlumat. Canlı müşahidə deyil.",
    skip: "Hekayəni keç",
    scroll: "Başlamaq üçün aşağı sürüşdür",
    loading: "Orbital görünüş hazırlanır…",
    rail: "Hekayə hissələri",
    c1: { k: "01 · Orbitdən dənizə", t: "Buludları və gecəni keçən radar.", b: "Sentinel-1 Xəzər üzərindən bir neçə gündən bir keçir. SeaSentry hər keçidi dənizin görünüşünə çevirir." },
    c2: { k: "02 · Peyk skanı", t: "Dəniz zolağı sətir-sətir oxunur.", b: "Sintetik aperturlu radar suyun kələ-kötürlüyünü ölçür. Hamar, tünd ləkələr neftin dalğaları sakitləşdirməsi demək ola bilər.", rows: [["Mənbə", "Sentinel-1 SAR"], ["Diapazon", "C-diapazon radarı"], ["Region", "Xəzər dənizi"]] },
    c3: { k: "03 · Süni intellekt aşkarlaması", t: "Təhlil yerinə düşməyəni ayırır.", b: "Aşkarlama qatı tünd ləkəni çərçivəyə alır və neft ləkəsinə nə qədər uyğun olduğunu qiymətləndirir.", panel: "Aşkarlama", area: "Təxmini sahə", conf: "Etibarlılıq", time: "Müşahidə", coords: "Koordinatlar", status: "Status", statusV: "Mütəxəssis gözlənilir", source: "Peyk mənbəyi", sourceV: "Sentinel-1 SAR" },
    c4: { k: "04 · Sızma təhlili", t: "Müşahidədən əməli məlumata.", b: "Hər qat kontekst əlavə edir. Qərardan əvvəl mütəxəssis hamısını yoxlayır.", layers: ["Sızma sərhədi", "Təsirlənən sahə", "Aşkarlama etibarlılığı", "Müşahidə məlumatları", "Məlumat dəstəkləyəndə hava və drift"] },
    c5: { k: "05 · Cavab tədbiri", t: "Aşkarlama koordinasiyalı cavaba çevrilir.", b: "Gəmilər və bənd ləkənin ətrafına yerləşdirilir, bərpa günlər çəkir. Heç vaxt ani deyil.", remain: "Qalan səth sahəsi", detected: "Aşkarlanmış sərhəd", note: "İllüstrativ bərpa ardıcıllığı" },
    c6: { k: "06 · Monitorinq və bərpa", t: "Ərazi təmizlənənə qədər izlə.", b: "Təkrar keçidlər ləkənin necə dəyişdiyini göstərir, cavab tənzimlənir və nəticə sənədləşdirilir.", life: ["Aşkarlama", "Təhlil", "Cavab", "Monitorinq", "Bərpa"] },
    c7: { k: "07 · Platforma", t: "İndi real iş sahəsini aç.", b: "Xəritə əsaslı iş sahəsi hadisələri, təsvirləri, baxışı və hesabatı bir yerdə toplayır.", launch: "Platformanı aç", signin: "Daxil ol", guest: "Qonaq girişi. Baxış rejimi." },
    units: "km²",
  },
};

/* ----------------------------------------------------------- capability */

const BOUNDS = [0, 0.1, 0.3, 0.46, 0.6, 0.7, 0.83, 0.93];
const LENGTH_VH = 880;
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
  const areaRef = useRef<HTMLElement>(null);
  const confRef = useRef<HTMLElement>(null);
  const remainRef = useRef<HTMLElement>(null);
  const timelineRef = useRef<HTMLSpanElement>(null);
  const [view, setView] = useState({ chapter: 0, step: 0 });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const targetRef = useRef(0);

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
      idle(() => ocean?.prepare(), 1400);
      idle(() => ocean?.prepare(), 1800);
      idle(() => ocean?.prepare(), 2200);
    });
    void import("./earthScene").then((m) => {
      if (disposed) return;
      try {
        earth = m.createEarthScene({ canvas: earthCanvas, lowPower, onReady: () => { if (!disposed) setReady(true); } });
        sizeAll();
      } catch {
        if (!disposed) setFailed(true);
      }
    });

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) { last = now; return; }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      smoothed += (targetRef.current - smoothed) * (1 - Math.exp(-dt * 6));
      if (Math.abs(targetRef.current - smoothed) < 0.00005) smoothed = targetRef.current;
      const p = smoothed;
      const t = now / 1000;

      const earthFade = 1 - smooth(0.27, 0.34, p);
      const oceanFade = smooth(0.26, 0.33, p);
      earthCanvas.style.opacity = String(earthFade);
      oceanCanvas.style.opacity = String(oceanFade);
      oceanCanvas.style.transform = `scale(${lerp(1.18, 1, oceanFade)})`;
      stage.style.setProperty("--shade", String(1 - smooth(0.3, 0.36, p) * 0.35));

      if (earthFade > 0.001) earth?.render(p, t);
      if (oceanFade > 0.001) ocean?.draw(p, t, wide);

      // Chapter + progressive layer step are the only values React needs to know about.
      let chapter = 0;
      for (let i = 0; i < BOUNDS.length; i++) if (p >= BOUNDS[i]) chapter = i;
      let step = 0;
      if (chapter === 4) step = Math.min(4, Math.floor(((p - BOUNDS[4]) / (BOUNDS[5] - BOUNDS[4])) * 5.4)) + 1;
      if (chapter !== lastChapter || step !== lastStep) {
        lastChapter = chapter;
        lastStep = step;
        setView({ chapter, step });
      }

      // Live numbers are written straight to the DOM, so scrubbing does not re-render React.
      const reveal = smooth(0.47, 0.56, p);
      if (areaRef.current) {
        const shrink = lerp(1, 0.24, smooth(0.76, 0.93, p));
        areaRef.current.textContent = (12.4 * reveal * shrink * shrink).toFixed(1);
      }
      if (confRef.current) confRef.current.textContent = `${Math.round(87 * reveal)}%`;
      if (remainRef.current) {
        const shrink = lerp(1, 0.24, smooth(0.76, 0.93, p));
        remainRef.current.textContent = `${Math.round(shrink * shrink * 100)}%`;
      }
      if (timelineRef.current) timelineRef.current.style.transform = `scaleX(${smooth(0.83, 0.93, p)})`;
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
  }, []);

  const jump = (index: number) => {
    const container = containerRef.current;
    const stage = stageRef.current;
    if (!container || !stage) return;
    const total = container.offsetHeight - stage.offsetHeight;
    const containerTop = container.getBoundingClientRect().top + window.scrollY;
    const hdr = parseFloat(getComputedStyle(stage).top) || 0;
    window.scrollTo({ top: containerTop - hdr + total * (BOUNDS[index] + (index === 0 ? 0 : 0.012)), behavior: "smooth" });
  };

  if (failed) return <>{fallback}</>;

  const { chapter, step } = view;
  const active = (i: number) => (chapter === i ? "true" : "false");

  return (
    <div ref={containerRef} className={styles.story} style={{ height: `${LENGTH_VH}svh` }} data-ready={ready}>
      <div ref={stageRef} className={styles.stage}>
        <canvas ref={earthCanvasRef} className={styles.earthCanvas} aria-hidden="true" />
        <canvas ref={oceanCanvasRef} className={styles.oceanCanvas} aria-hidden="true" />
        <div className={styles.shade} aria-hidden="true" />
        <div className={styles.vignette} aria-hidden="true" />

        {!ready && <div className={styles.loader} role="status"><LoaderCircle className="spinner" size={18} aria-hidden="true" />{c.loading}</div>}

        <a className={styles.skipStory} href="#capabilities">{c.skip}<ArrowDown size={14} aria-hidden="true" /></a>

        {chapter >= 2 && chapter < 7 && (
          <div className={styles.hudTop}>
            <span><Satellite size={14} aria-hidden="true" />Sentinel-1 SAR</span>
            <span><MapPin size={14} aria-hidden="true" />{chapter >= 3 ? "40.62°N 50.41°E" : "Caspian Sea"}</span>
            <span className={styles.demoTag}>{c.demo}</span>
          </div>
        )}

        <div className={styles.panels}>
          <section className={`${styles.chapter} ${styles.heroChapter}`} data-active={active(0)}>
            <div className={landing.hero}>{hero}</div>
            <p className={styles.scrollHint}><span aria-hidden="true" />{c.scroll}</p>
          </section>

          <section className={styles.chapter} data-active={active(1)}>
            <p className={styles.kicker}>{c.c1.k}</p><h2>{c.c1.t}</h2><p className={styles.body}>{c.c1.b}</p>
          </section>

          <section className={styles.chapter} data-active={active(2)}>
            <p className={styles.kicker}>{c.c2.k}</p><h2>{c.c2.t}</h2><p className={styles.body}>{c.c2.b}</p>
            <dl className={styles.facts}>{c.c2.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          </section>

          <section className={styles.chapter} data-active={active(3)}>
            <p className={styles.kicker}>{c.c3.k}</p><h2>{c.c3.t}</h2><p className={styles.body}>{c.c3.b}</p>
            <div className={styles.detection}>
              <div className={styles.detectionHead}><ShieldCheck size={15} aria-hidden="true" />{c.c3.panel}<em>{c.demo}</em></div>
              <dl>
                <div><dt>{c.c3.area}</dt><dd><strong ref={areaRef}>0.0</strong> {c.units}</dd></div>
                <div><dt>{c.c3.conf}</dt><dd><strong ref={confRef}>0%</strong></dd></div>
                <div><dt>{c.c3.time}</dt><dd>09:41 UTC</dd></div>
                <div><dt>{c.c3.coords}</dt><dd>40.62°N 50.41°E</dd></div>
                <div><dt>{c.c3.source}</dt><dd>{c.c3.sourceV}</dd></div>
                <div><dt>{c.c3.status}</dt><dd>{c.c3.statusV}</dd></div>
              </dl>
            </div>
          </section>

          <section className={styles.chapter} data-active={active(4)}>
            <p className={styles.kicker}>{c.c4.k}</p><h2>{c.c4.t}</h2><p className={styles.body}>{c.c4.b}</p>
            <ol className={styles.layers}>{c.c4.layers.map((l, i) => <li key={l} data-on={step > i}><span aria-hidden="true">{step > i ? <Check size={13} /> : i + 1}</span>{l}</li>)}</ol>
          </section>

          <section className={styles.chapter} data-active={active(5)}>
            <p className={styles.kicker}>{c.c5.k}</p><h2>{c.c5.t}</h2><p className={styles.body}>{c.c5.b}</p>
            <div className={styles.remain}><span>{c.c5.remain}</span><strong ref={remainRef}>100%</strong><em>{c.c5.note}</em></div>
          </section>

          <section className={styles.chapter} data-active={active(6)}>
            <p className={styles.kicker}>{c.c6.k}</p><h2>{c.c6.t}</h2><p className={styles.body}>{c.c6.b}</p>
            <ol className={styles.life}>{c.c6.life.map((l, i) => <li key={l} data-on={i <= 3 || chapter >= 6}>{l}</li>)}</ol>
            <div className={styles.timeline} aria-hidden="true"><span ref={timelineRef} /></div>
            <p className={styles.fine}>{c.c5.detected} · {c.c5.note}</p>
          </section>

          <section className={`${styles.chapter} ${styles.finale}`} data-active={active(7)}>
            <p className={styles.kicker}>{c.c7.k}</p><h2>{c.c7.t}</h2><p className={styles.body}>{c.c7.b}</p>
            <div className={styles.mini} aria-hidden="true"><i /><i /><i /><b /></div>
            <div className={styles.actions}>
              <button type="button" className={landing.primary} onClick={onLaunch} disabled={busy} aria-busy={busy} tabIndex={chapter === 7 ? 0 : -1}>
                {busy ? <LoaderCircle className="spinner" size={18} aria-hidden="true" /> : null}<span>{busy ? loadingLabel : c.c7.launch}</span><ArrowRight size={18} aria-hidden="true" />
              </button>
              <Link className={styles.signin} href="/login" tabIndex={chapter === 7 ? 0 : -1}>{c.c7.signin}</Link>
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
