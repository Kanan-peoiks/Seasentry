"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, Brain, Check, ChevronRight, Droplets, Eye, FileCheck2, LoaderCircle, Menu, Satellite, ShieldCheck, Waves, X } from "lucide-react";
import { loginAsDemo } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/useLanguage";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageToggle from "@/components/ui/LanguageToggle";
import SatelliteScene from "./SatelliteScene";
import CinematicStory, { useCinematicEligible } from "./CinematicStory";
import styles from "./landing.module.css";

const copy = {
  en: {
    territory: "A clearer view of the Caspian",
    headline: ["Protecting Our Oceans", "From Space"],
    subtitle: "Advanced satellite intelligence for detecting, analyzing, and responding to marine oil spills.", heroPrimary: "Explore Platform", heroSecondary: "Discover How It Works", launch: "Launch Platform",
    explore: "Explore the workspace", workflow: "How it works", capabilities: "Capabilities", demoNote: "Guest access. No signup. Read-only demo.", humanNote: "Technology detects. People decide.",
    signal: "An observation becomes a decision.", signalBody: "SeaSentry connects what the satellite sees with what your team needs to do next.",
    satelliteTitle: "See the evidence clearly", satelliteBody: "Inspect Sentinel-1 radar imagery, compare the original with the detection overlay, and understand the measured signals.", satelliteTag: "Satellite evidence", original: "Original imagery", overlay: "Detection overlay",
    humanTitle: "Keep the decision human", humanBody: "Confirm, reject or escalate a possible spill. A specialist reviews the evidence before an operational decision.", humanTag: "Specialist review",
    responseTitle: "Make the next step practical", responseBody: "Estimate cleanup requirements, follow an incident through resolution, and create a report your team can share.", responseTag: "Response planning",
    stagesTitle: "One signal. A clear path forward.", stagesBody: "A continuous workflow from first observation to a documented response.",
    stages: [["Detect", "Scan a location or report an observation."], ["Analyze", "Inspect the imagery, measured signals and context."], ["Decide", "A specialist reviews the available evidence."], ["Respond", "Plan requirements and document the outcome."]],
    workspaceTitle: "The sea, the signals, the whole picture.", workspaceBody: "A map-first workspace puts the coastline, incident queue and local conditions together. Move from the regional overview to the evidence behind a single observation.",
    preview: "Illustrative workspace preview", monitor: "Monitoring map", queue: "Review queue", review: "Specialist review required", event: "Possible surface anomaly", pending: "Awaiting specialist", context: "Local conditions", observation: "Observation details", source: "Sentinel-1 radar imagery", mapLabel: "Illustrative Caspian monitoring map with two observations near Baku and Sangachal",
    ready: "A better view. A clearer response.", readyBody: "Open the demo workspace and follow an observation from first signal to a human decision.",
    footer: "Caspian Sea oil-spill intelligence", about: "About SeaSentry", menu: "Open navigation", closeMenu: "Close navigation", loading: "Opening workspace…", baku: "Baku", sea: "Caspian Sea", sangachal: "Sangachal coast", corridor: "Baku corridor", skip: "Skip to content", nav: "Main navigation", footerNav: "Footer navigation",
  },
  az: {
    territory: "Xəzərə daha aydın baxış",
    headline: ["Okeanlarımızı", "Kosmosdan qoruyuruq"],
    subtitle: "Dəniz neft sızmalarını aşkarlamaq, təhlil etmək və onlara cavab vermək üçün qabaqcıl peyk intellekti.", heroPrimary: "Platformanı kəşf et", heroSecondary: "Necə işlədiyini kəşf et", launch: "Platformanı aç",
    explore: "İş sahəsini aç", workflow: "Necə işləyir", capabilities: "İmkanlar", demoNote: "Qonaq girişi. Qeydiyyatsız. Baxış rejimi.", humanNote: "Texnologiya aşkarlayır. İnsan qərar verir.",
    signal: "Müşahidə qərara çevrilir.", signalBody: "SeaSentry peykin gördüklərini komandanın növbəti addımı ilə əlaqələndirir.",
    satelliteTitle: "Sübutları aydın gör", satelliteBody: "Sentinel-1 radar təsvirlərini yoxla, orijinalı aşkarlama qatı ilə müqayisə et və ölçülmüş göstəriciləri anla.", satelliteTag: "Peyk sübutları", original: "Orijinal təsvir", overlay: "Aşkarlama qatı",
    humanTitle: "Qərarı insana saxla", humanBody: "Mümkün sızmanı təsdiq et, rədd et və ya eskalasiya et. Əməliyyat qərarından əvvəl mütəxəssis sübutlara baxır.", humanTag: "Mütəxəssis baxışı",
    responseTitle: "Növbəti addımı planlaşdır", responseBody: "Təmizləmə tələblərini hesabla, hadisəni həllinə qədər izlə və komandanla paylaşmaq üçün hesabat yarat.", responseTag: "Cavab tədbiri",
    stagesTitle: "Bir siqnal. Aydın növbəti addım.", stagesBody: "İlk müşahidədən sənədləşdirilmiş cavab tədbirinə qədər davamlı iş axını.",
    stages: [["Aşkarlama", "Məkanı skan et və ya müşahidəni bildir."], ["Təhlil", "Təsvirə, ölçülmüş göstəricilərə və şəraitə bax."], ["Qərar", "Mütəxəssis mövcud sübutları yoxlayır."], ["Cavab", "Tələbləri planlaşdır və nəticəni sənədləşdir."]],
    workspaceTitle: "Dəniz, siqnallar və tam mənzərə.", workspaceBody: "Xəritə əsaslı iş sahəsi sahili, hadisə növbəsini və yerli şəraiti birləşdirir. Regional görünüşdən tək bir müşahidənin arxasındakı sübutlara keç.",
    preview: "İş sahəsinin illüstrativ görünüşü", monitor: "Monitorinq xəritəsi", queue: "Baxış növbəsi", review: "Mütəxəssis baxışı tələb olunur", event: "Mümkün səth anomaliyası", pending: "Mütəxəssis gözlənilir", context: "Yerli şərait", observation: "Müşahidə məlumatları", source: "Sentinel-1 radar təsvirləri", mapLabel: "Bakı və Səngəçal yaxınlığında iki müşahidə olan illüstrativ Xəzər monitorinq xəritəsi",
    ready: "Daha aydın baxış. Dəqiq cavab.", readyBody: "Demo iş sahəsini aç və müşahidəni ilk siqnaldan insan qərarına qədər izlə.",
    footer: "Xəzər dənizində neft sızması monitorinqi", about: "SeaSentry haqqında", menu: "Naviqasiyanı aç", closeMenu: "Naviqasiyanı bağla", loading: "İş sahəsi açılır…", baku: "Bakı", sea: "Xəzər dənizi", sangachal: "Səngəçal sahili", corridor: "Bakı dəhlizi", skip: "Məzmuna keç", nav: "Əsas naviqasiya", footerNav: "Alt naviqasiya",
  },
};

function WorkspacePreview({ lang }: { lang: "en" | "az" }) {
  const c = copy[lang];
  return <div className={styles.preview}>
    <div className={styles.previewTop}><Brand variant="compact" /><span>{c.preview}</span></div>
    <div className={styles.previewBody}>
      <div className={styles.previewMap}>
        <div className={styles.mapHeading}><span><Waves size={15} aria-hidden="true" />{c.monitor}</span><span>Sentinel-1 SAR</span></div>
        <svg viewBox="0 0 700 440" role="img" aria-label={c.mapLabel}>
          <g className={styles.mapGrid} fill="none" strokeWidth="1"><path d="M0 80H700M0 160H700M0 240H700M0 320H700M0 400H700M100 0V440M200 0V440M300 0V440M400 0V440M500 0V440M600 0V440" /></g>
          <g className={styles.mapContours} fill="none"><path d="M-20 57Q124 147 256 89M-20 91Q124 181 254 124M-20 329Q125 270 217 307T306 338M-20 361Q125 302 217 339T306 370M474 75Q561 162 722 106M461 110Q561 197 722 141M457 326Q580 246 722 295M457 359Q580 279 722 328" /></g>
          <path className={styles.mapSea} d="M345 27C367 17 398 25 405 48L432 44 446 66 426 88 440 115 418 136 432 155 414 178 411 202 393 227 394 253 376 276 387 297 379 324 389 346 377 378 359 399 337 414 308 407 283 414 261 394 263 367 277 342 272 317 284 289 279 265 291 241 286 219 302 190 296 167 313 145 305 124 312 100 296 87 304 64 326 62 328 39Z" />
          <g className={styles.mapSeaLines} fill="none"><path d="M316 95C394 83 416 103 432 128M299 162C363 149 397 171 415 195M281 250C326 229 375 239 394 263M273 329C308 302 359 315 381 341" /></g>
          <text x="353" y="258" textAnchor="middle" className={styles.mapSeaName} transform="rotate(-80 353 258)">{c.sea}</text>
          <circle cx="281" cy="247" r="4" fill="#FBF9F0" /><text x="263" y="244" textAnchor="end" className={styles.mapCity}>{c.baku}</text>
          <g className={styles.mapSignal}><circle cx="299" cy="264" r="20" /><circle cx="299" cy="264" r="6" /><circle cx="284" cy="306" r="16" /><circle cx="284" cy="306" r="5" /></g>
          <path d="M299 283V344H468" className={styles.mapCalloutLine} fill="none" strokeDasharray="4 5" />
          <g className={styles.mapCoordinates}><text x="20" y="30">46° N</text><text x="20" y="420">36° N</text><text x="636" y="420">54° E</text></g>
        </svg>
        <div className={styles.mapLegend}><span /><span>{c.event}</span><ShieldCheck size={14} aria-hidden="true" /></div>
      </div>
      <div className={styles.previewQueue}>
        <div className={styles.queueHeading}><h3>{c.queue}</h3><span>2</span></div>
        <div className={styles.queueItem}><div><span className={styles.queueDot} /><strong>{c.sangachal}</strong><ChevronRight size={14} aria-hidden="true" /></div><p>{c.pending}</p><span className={styles.reviewBadge}><ShieldCheck size={12} aria-hidden="true" />{c.humanTag}</span></div>
        <div className={styles.queueItem}><div><span className={styles.queueDot} /><strong>{c.corridor}</strong><ChevronRight size={14} aria-hidden="true" /></div><p>{c.review}</p></div>
        <div className={styles.previewContext}><Waves size={19} aria-hidden="true" /><div><strong>{c.context}</strong><span>{c.observation}</span></div></div>
        <div className={styles.previewSource}><Satellite size={15} aria-hidden="true" /><span>{c.source}</span></div>
      </div>
    </div>
  </div>;
}

export default function LandingPage() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const { acceptUser } = useSession();
  const c = copy[lang];
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setMenu(false); menuButtonRef.current?.focus(); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);

  const openDemo = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await loginAsDemo();
      if (result.ok) { acceptUser(result.user); router.push("/dashboard"); return; }
      setError(t.auth.demoFailed);
    } catch { setError(t.auth.demoFailed); }
    setBusy(false);
  };

  const story = useCinematicEligible();
  const demoButton = (label: string) => <button type="button" className={styles.primary} onClick={openDemo} disabled={busy} aria-busy={busy} aria-describedby={error ? "landing-demo-error" : undefined}>{busy ? <LoaderCircle className="spinner" size={18} aria-hidden="true" /> : null}<span>{busy ? c.loading : label}</span><ArrowRight size={18} aria-hidden="true" /></button>;

  const heroCopy = <div className={styles.heroCopy}>
    <p className={styles.territory}><span />{c.territory}</p>
    <h1>{c.headline[0]}<br />{c.headline[1]}</h1>
    <p className={styles.heroSub}>{c.subtitle}</p>
    <div className={styles.heroActions}>{demoButton(c.heroPrimary)}<a className={styles.secondary} href="#workflow">{c.heroSecondary}<ArrowDown size={16} aria-hidden="true" /></a></div>
    <p className={styles.demoNote}>{c.demoNote}</p>
    {error && <p id="landing-demo-error" className={styles.demoError} role="alert">{error}</p>}
    <div className={styles.humanPromise}><ShieldCheck size={20} strokeWidth={1.6} aria-hidden="true" /><span>{c.humanNote}</span></div>
  </div>;
  const signalStrip = <div className={styles.signalStrip}><span><Satellite size={18} aria-hidden="true" />Sentinel-1 SAR</span><span><Brain size={18} aria-hidden="true" />{lang === "az" ? "Sübut əsaslı təhlil" : "Evidence-led analysis"}</span><span><ShieldCheck size={18} aria-hidden="true" />{lang === "az" ? "İnsan nəzarəti" : "Human oversight"}</span><span><Droplets size={18} aria-hidden="true" />{c.responseTag}</span></div>;
  const staticHero = <section className={styles.hero}>
    <div className={styles.heroInner}>{heroCopy}<SatelliteScene lang={lang} /></div>
    {signalStrip}
  </section>;

  return <div className={styles.page}>
    <a href="#landing-content" className="skip-link">{c.skip}</a>
    <header className={styles.header}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.brandLink} aria-label="SeaSentry"><Brand variant="landing" /></Link>
        <nav className={styles.desktopNav} aria-label={c.nav}><a href="#capabilities">{c.capabilities}</a><a href="#workflow">{c.workflow}</a><a href="https://seasentryinfo.vercel.app" target="_blank" rel="noreferrer">{t.nav.about}</a></nav>
        <div className={styles.navActions}><LanguageToggle size={40} /><ThemeToggle size={40} /><button type="button" className={styles.launchNav} onClick={openDemo} disabled={busy}>{c.launch}<ArrowRight size={15} aria-hidden="true" /></button><Link className={styles.signIn} href="/login">{t.nav.login}<ArrowRight size={15} aria-hidden="true" /></Link><button ref={menuButtonRef} type="button" className={styles.menuButton} aria-expanded={menu} aria-controls="landing-nav" aria-label={menu ? c.closeMenu : c.menu} onClick={() => setMenu(!menu)}>{menu ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}</button></div>
      </div>
      {menu && <nav id="landing-nav" className={styles.mobileNav} aria-label={c.nav}><a href="#capabilities" onClick={() => setMenu(false)}>{c.capabilities}</a><a href="#workflow" onClick={() => setMenu(false)}>{c.workflow}</a><a href="https://seasentryinfo.vercel.app" target="_blank" rel="noreferrer">{c.about}</a><Link href="/login">{t.nav.login}</Link><Link href="/register">{t.nav.register}</Link></nav>}
    </header>
    <main id="landing-content">
      {story ? <>
        <CinematicStory lang={lang} hero={heroCopy} fallback={staticHero} onLaunch={openDemo} busy={busy} error={error} loadingLabel={c.loading} />
        <div className={styles.hero}>{signalStrip}</div>
      </> : staticHero}

      <section id="capabilities" className={styles.section}>
        <div className={styles.sectionHeading}><h2>{c.signal}</h2><p>{c.signalBody}</p></div>
        <div className={styles.features}>
          <article className={styles.evidenceFeature}>
            <div className={styles.featureTag}><Satellite size={18} aria-hidden="true" />{c.satelliteTag}</div>
            <div className={styles.evidenceVisual} aria-hidden="true"><div className={styles.radarImage}><span className={styles.radarCoast} /><i /><span className={styles.imageCaption}>{c.original}</span></div><div className={`${styles.radarImage} ${styles.radarOverlay}`}><span className={styles.radarCoast} /><i /><span className={styles.detectionOutline} /><span className={styles.imageCaption}>{c.overlay}</span></div><div className={styles.compareIcon}><ArrowRight size={18} /></div></div>
            <h3>{c.satelliteTitle}</h3><p>{c.satelliteBody}</p>
          </article>
          <div className={styles.decisionFeatures}>
            <article className={styles.humanFeature}><div className={styles.featureTag}><ShieldCheck size={18} aria-hidden="true" />{c.humanTag}</div><h3>{c.humanTitle}</h3><p>{c.humanBody}</p><div className={styles.reviewIllustration}><span><Eye size={17} aria-hidden="true" />{c.review}</span><Check size={17} aria-hidden="true" /></div></article>
            <article className={styles.responseFeature}><div className={styles.featureTag}><FileCheck2 size={18} aria-hidden="true" />{c.responseTag}</div><h3>{c.responseTitle}</h3><p>{c.responseBody}</p></article>
          </div>
        </div>
      </section>

      <section id="workflow" className={`${styles.section} ${styles.workflow}`}>
        <div className={styles.sectionHeading}><h2>{c.stagesTitle}</h2><p>{c.stagesBody}</p></div>
        <ol className={styles.steps}>{c.stages.map(([title, body], index) => { const Icon = [Satellite, Brain, ShieldCheck, Droplets][index]; return <li key={title}><div className={styles.stepTop}><span>{String(index + 1).padStart(2, "0")}</span><Icon size={25} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{body}</p></li>; })}</ol>
      </section>

      <section className={`${styles.section} ${styles.workspace}`}>
        <div className={styles.workspaceHeading}><div><h2>{c.workspaceTitle}</h2><p>{c.workspaceBody}</p></div><button type="button" className={styles.workspaceLink} disabled={busy} onClick={openDemo}>{c.explore}<ArrowRight size={18} aria-hidden="true" /></button></div>
        <WorkspacePreview lang={lang} />
      </section>

      <section className={styles.finalCta}><div className={styles.finalCtaInner}><div><p className={styles.finalPromise}><ShieldCheck size={17} aria-hidden="true" />{c.humanNote}</p><h2>{c.ready}</h2><p className={styles.finalBody}>{c.readyBody}</p></div><div className={styles.finalActions}>{demoButton(c.launch)}<Link className={styles.registerLink} href="/register">{t.auth.createAccount}<ArrowRight size={15} aria-hidden="true" /></Link></div></div></section>
    </main>
    <footer className={styles.footer}><div><Link href="/" className={styles.footerBrand} aria-label="SeaSentry"><Brand variant="default" /></Link><p>{c.footer}</p></div><nav aria-label={c.footerNav}><a href="https://seasentryinfo.vercel.app" target="_blank" rel="noreferrer">{c.about}</a><Link href="/login">{t.nav.login}</Link><Link href="/register">{t.nav.register}</Link></nav></footer>
  </div>;
}
