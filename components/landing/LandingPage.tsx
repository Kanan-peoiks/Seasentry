"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowRight, Brain, Check, ChevronRight, Droplets, Eye, LoaderCircle, Menu, Play, RotateCcw, Satellite, ShieldCheck, Waves, X } from "lucide-react";
import { loginAsDemo } from "@/lib/auth";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/useLanguage";
import ThemeToggle from "@/components/ui/ThemeToggle";
import LanguageToggle from "@/components/ui/LanguageToggle";
import styles from "./landing.module.css";

const copy = {
  en: {
    territory: "Built for the Caspian Sea", headline: ["See the Caspian.", "Act with clarity."], subtitle: "Satellite evidence. Human judgement. One workspace to investigate possible oil spills and plan the response.",
    explore: "Explore the workspace", workflow: "How it works", capabilities: "Capabilities", demoNote: "Guest access · no signup · read-only demo", humanNote: "Technology detects. People decide.",
    signal: "A signal is only the beginning.", signalBody: "Bring the evidence, the decision and the response into one clear operational picture.",
    satelliteTitle: "Start with the evidence", satelliteBody: "Review Sentinel-1 radar imagery, compare the original and overlay, and see the detector’s measured signals.", satelliteTag: "Satellite imagery", humanTitle: "Keep the decision human", humanBody: "Confirm, reject or escalate a detection. Every operational action stays in the hands of a specialist.", humanTag: "Specialist review", responseTitle: "Turn a decision into a plan", responseBody: "Estimate cleanup requirements, follow the incident through resolution, and create a shareable report.", responseTag: "Response planning",
    stagesTitle: "One signal. A clear path forward.", stagesBody: "From a satellite observation to a documented response, with human review at the centre.",
    stages: [ ["Detect", "Scan a location or report an observation."], ["Analyze", "Inspect the imagery, signals and context."], ["Decide", "A specialist reviews the available evidence."], ["Respond", "Plan requirements and document resolution."] ],
    workspaceTitle: "The whole picture, without the noise.", workspaceBody: "A map-first workspace keeps the coastline, review queue and local conditions close. Open an incident to go from overview to evidence.", preview: "Workspace preview", monitor: "Monitoring map", queue: "Review queue", review: "Human review required", event: "Possible surface anomaly", simulated: "Illustrative scan · not a live detection", replay: "Replay scan", scan: "SAR scan", detected: "Signal found", human: "Human review", pending: "Awaiting specialist", ready: "Your next view of the Caspian starts here.", readyBody: "Explore the demo workspace and follow an incident from first signal to human decision.", footer: "Caspian Sea oil-spill intelligence", about: "About SeaSentry", menu: "Open navigation", closeMenu: "Close navigation", loading: "Opening workspace…",
  },
  az: {
    territory: "Xəzər dənizi üçün qurulub", headline: ["Xəzəri gör.", "Aydın qərar ver."], subtitle: "Peyk sübutu. Mütəxəssis qərarı. Mümkün neft sızmalarını araşdırmaq və cavab tədbirini planlaşdırmaq üçün vahid iş sahəsi.",
    explore: "İş sahəsini aç", workflow: "Necə işləyir", capabilities: "İmkanlar", demoNote: "Qonaq girişi · qeydiyyatsız · baxış rejimi", humanNote: "Texnologiya aşkarlayır. İnsan qərar verir.",
    signal: "Siqnal yalnız başlanğıcdır.", signalBody: "Sübutları, qərarı və cavab tədbirini aydın əməliyyat görünüşündə birləşdir.",
    satelliteTitle: "Sübutdan başla", satelliteBody: "Sentinel-1 radar təsvirini yoxla, orijinalı və overlay-i müqayisə et, detektorun ölçülmüş göstəricilərini gör.", satelliteTag: "Peyk təsvirləri", humanTitle: "Qərarı insana saxla", humanBody: "Aşkarlamanı təsdiq et, rədd et və ya eskalasiya et. Hər əməliyyat qərarı mütəxəssisin əlində qalır.", humanTag: "Mütəxəssis baxışı", responseTitle: "Qərarı plana çevir", responseBody: "Təmizləmə tələblərini hesabla, hadisəni həllinə qədər izlə və paylaşmaq üçün hesabat yarat.", responseTag: "Cavab tədbiri",
    stagesTitle: "Bir siqnal. Aydın növbəti addım.", stagesBody: "Peyk müşahidəsindən sənədləşdirilmiş cavab tədbirinə — mərkəzdə insan qərarı ilə.",
    stages: [ ["Aşkarlama", "Məkanı skan et və ya müşahidəni bildir."], ["Təhlil", "Təsvirə, göstəricilərə və şəraitə bax."], ["Qərar", "Mütəxəssis mövcud sübutları yoxlayır."], ["Cavab", "Tələbləri planlaşdır və nəticəni sənədləşdir."] ],
    workspaceTitle: "Tam mənzərə. Lazımsız qarışıqlıq olmadan.", workspaceBody: "Xəritə əsaslı iş sahəsində sahil, baxış növbəsi və yerli şərait yan-yanadır. Ümumi görünüşdən sübutlara keçmək üçün hadisəni aç.", preview: "İş sahəsinin təsviri", monitor: "Monitorinq xəritəsi", queue: "Baxış növbəsi", review: "Mütəxəssis baxışı tələb olunur", event: "Mümkün səth anomaliyası", simulated: "Demo skanı · real aşkarlama deyil", replay: "Skanı yenidən göstər", scan: "SAR skanı", detected: "Siqnal tapıldı", human: "İnsan qərarı", pending: "Mütəxəssis gözlənilir", ready: "Xəzərə növbəti baxışın buradan başlayır.", readyBody: "Demo iş sahəsini aç və hadisəni ilk siqnaldan insan qərarına qədər izlə.", footer: "Xəzər dənizində neft sızması monitorinqi", about: "SeaSentry haqqında", menu: "Naviqasiyanı aç", closeMenu: "Naviqasiyanı bağla", loading: "İş sahəsi açılır…",
  },
};

function CaspianScene({ compact = false }: { compact?: boolean }) {
  const { lang } = useLanguage();
  const c = copy[lang];
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  const id = useId().replaceAll(":", "");
  const sea = "M326 48 C352 35 379 47 385 70 L423 65 436 91 418 111 441 134 422 157 439 181 409 197 407 219 389 245 388 278 365 302 383 326 374 359 391 383 383 422 363 450 353 486 329 506 305 497 273 505 246 484 239 455 250 430 244 402 259 373 254 344 268 318 266 284 279 260 273 232 291 203 284 180 302 157 300 129 282 111 289 88 307 87 309 64 Z";
  return <div className={`${styles.scene} ${compact ? styles.sceneCompact : ""}`}>
    <div className={styles.sceneTop}><span><Satellite size={15} aria-hidden="true" /> Sentinel-1 SAR</span><span className={styles.sceneDemo}>{lang === "az" ? "Demo səhnəsi" : "Demo scene"}</span></div>
    <svg viewBox="0 0 620 560" role="img" aria-label={c.simulated} className={styles.sceneMap}>
      <defs><linearGradient id={`sea${id}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#267f91" stopOpacity=".5" /><stop offset="1" stopColor="#122f49" /></linearGradient><pattern id={`grid${id}`} width="62" height="56" patternUnits="userSpaceOnUse"><path d="M62 0H0V56" fill="none" stroke="#8cb9ce" strokeOpacity=".1" strokeWidth=".8" /></pattern><clipPath id={`clip${id}`}><path d={sea} /></clipPath></defs>
      <rect width="620" height="560" fill={`url(#grid${id})`} />
      <g fill="none" stroke="#356074" strokeWidth="1" opacity=".38"><path d="M16 63Q189 123 253 79M-20 131Q148 186 220 146T256 84M-20 333Q76 294 170 324T253 311M420 261Q484 255 640 322M402 418Q493 369 640 426" /><path d="M-20 171Q113 216 218 166M-20 359Q82 333 169 353T247 335M418 292Q502 281 640 347M402 443Q503 395 640 457" /></g>
      <path d={sea} fill={`url(#sea${id})`} stroke="#75c6c8" strokeOpacity=".8" strokeWidth="1.7" />
      <g clipPath={`url(#clip${id})`}><path d="M217 155L443 227M219 220L445 292M217 285L443 357M217 350L443 422" stroke="#79c6bf" strokeOpacity=".13" strokeWidth="16" />
        <motion.rect key={run} x="220" width="240" height="84" fill="#70d1c2" fillOpacity=".24" initial={reduced ? { y: 280, opacity: 0 } : { y: -85, opacity: 0 }} animate={reduced ? { opacity: 0 } : { y: [-85, 440], opacity: [0, .9, .9, 0] }} transition={{ duration: 2.7, delay: .4, ease: "easeInOut" }} />
      </g>
      <text x="326" y="264" fill="#9bc1cf" fontSize="12" textAnchor="middle" transform="rotate(-82 326 264)" letterSpacing="5">{lang === "az" ? "XƏZƏR DƏNİZİ" : "CASPIAN SEA"}</text>
      <g fill="#85a9bb" fontSize="11"><text x="170" y="205">AZERBAIJAN</text><text x="434" y="202">TURKMENISTAN</text><text x="362" y="37">KAZAKHSTAN</text><text x="293" y="533">IRAN</text><text x="247" y="76">RUSSIA</text></g>
      <circle cx="261" cy="294" r="3" fill="#c2dde5" /><text x="240" y="287" textAnchor="end" fill="#d2e5ed" fontSize="12">Baku</text>
      <g><motion.circle key={`ring${run}`} cx="280" cy="318" r="21" stroke="#70d1c2" fill="#70d1c2" fillOpacity=".1" initial={reduced ? false : { opacity: 0, scale: .4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: reduced ? 0 : 2.4, duration: .8 }} style={{ transformOrigin: "280px 318px" }} /><circle cx="280" cy="318" r="5" fill="#a5edda" /><path d="M280 340L280 378 186 407" stroke="#70d1c2" strokeOpacity=".65" fill="none" strokeDasharray="3 4" /></g>
      <g fill="#678d9f" fontSize="10"><text x="18" y="30">46° N</text><text x="18" y="535">36° N</text><text x="536" y="535">54° E</text><text x="18" y="553">48° E</text></g>
    </svg>
    <motion.div key={`event${run}`} className={styles.scanEvent} initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduced ? 0 : 2.8, duration: .6 }}><span className={styles.eventIcon}><Eye size={19} aria-hidden="true" /></span><div><strong>{c.event}</strong><span>{c.review}</span></div><ChevronRight size={17} aria-hidden="true" /></motion.div>
    {!compact && <><div className={styles.sceneStages}><span><Check size={13} aria-hidden="true" />{c.scan}</span><span><Check size={13} aria-hidden="true" />{c.detected}</span><span className={styles.stageActive}><ShieldCheck size={13} aria-hidden="true" />{c.human}</span></div><div className={styles.sceneFooter}><span>{c.simulated}</span><button type="button" onClick={() => setRun((value) => value + 1)} aria-label={c.replay}><RotateCcw size={14} aria-hidden="true" /></button></div></>}
  </div>;
}

export default function LandingPage() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const { acceptUser } = useSession();
  const c = copy[lang];
  const reduced = useReducedMotion();
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
  const openDemo = async () => {
    if (busy) return;
    setError(null); setBusy(true);
    const result = await loginAsDemo();
    if (result.ok) { acceptUser(result.user); router.push("/dashboard"); }
    else { setError(t.auth.demoFailed); setBusy(false); }
  };
  const demoButton = <button type="button" className={styles.primary} onClick={openDemo} disabled={busy} aria-busy={busy}>{busy ? <LoaderCircle className="spinner" size={18} aria-hidden="true" /> : <Play size={16} fill="currentColor" aria-hidden="true" />}{busy ? c.loading : t.landing.continueAsGuest}<ArrowRight size={18} aria-hidden="true" /></button>;
  const reveal = { initial: reduced ? false as const : { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: .15 }, transition: { duration: .55 } };
  return <div className={styles.page}>
    <a href="#landing-content" className="skip-link">{lang === "az" ? "Məzmuna keç" : "Skip to content"}</a>
    <header className={styles.header}><div className={styles.navInner}><Link href="/" className={styles.brand} aria-label="SeaSentry"><Waves size={29} strokeWidth={1.5} aria-hidden="true" /><span translate="no">SeaSentry</span></Link><nav className={styles.desktopNav} aria-label={lang === "az" ? "Əsas naviqasiya" : "Main navigation"}><a href="#capabilities">{c.capabilities}</a><a href="#workflow">{c.workflow}</a><a href="https://seasentryinfo.vercel.app" target="_blank" rel="noreferrer">{t.nav.about}</a></nav><div className={styles.navActions}><LanguageToggle size={40} /><ThemeToggle size={40} /><Link className={styles.signIn} href="/login">{t.nav.login}<ArrowRight size={15} aria-hidden="true" /></Link><button type="button" className={styles.menuButton} aria-expanded={menu} aria-controls="landing-nav" aria-label={menu ? c.closeMenu : c.menu} onClick={() => setMenu(!menu)}>{menu ? <X size={21} aria-hidden="true" /> : <Menu size={21} aria-hidden="true" />}</button></div></div>{menu && <nav id="landing-nav" className={styles.mobileNav} aria-label={c.menu}><a href="#capabilities" onClick={() => setMenu(false)}>{c.capabilities}</a><a href="#workflow" onClick={() => setMenu(false)}>{c.workflow}</a><Link href="/login">{t.nav.login}</Link><Link href="/register">{t.nav.register}</Link></nav>}</header>
    <main id="landing-content">
      <section className={styles.hero}><div className={styles.heroCopy}><motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} className={styles.territory}><span />{c.territory}</motion.div><motion.h1 initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65 }}>{c.headline[0]}<br />{c.headline[1]}</motion.h1><p className={styles.heroSub}>{c.subtitle}</p><div className={styles.heroActions}>{demoButton}<a className={styles.secondary} href="#workflow">{c.workflow}<ArrowDown size={16} aria-hidden="true" /></a></div><p className={styles.demoNote}>{c.demoNote}</p>{error && <p className={styles.demoError} role="alert">{error}</p>}<div className={styles.humanPromise}><ShieldCheck size={20} strokeWidth={1.6} aria-hidden="true" /><span>{c.humanNote}</span></div></div><CaspianScene /></section>
      <div className={styles.signalStrip}><span><Satellite size={18} aria-hidden="true" />Sentinel-1 SAR</span><span><Brain size={18} aria-hidden="true" />{lang === "az" ? "Sübut əsaslı analiz" : "Evidence-led analysis"}</span><span><ShieldCheck size={18} aria-hidden="true" />{lang === "az" ? "İnsan nəzarəti" : "Human oversight"}</span><span><Droplets size={18} aria-hidden="true" />{lang === "az" ? "Cavab tədbiri" : "Response planning"}</span></div>
      <section id="capabilities" className={styles.section}><motion.div {...reveal} className={styles.sectionHeading}><h2>{c.signal}</h2><p>{c.signalBody}</p></motion.div><div className={styles.features}><motion.article {...reveal} className={`${styles.feature} ${styles.featureEvidence}`}><div className={styles.featureTop}><Satellite size={25} strokeWidth={1.5} aria-hidden="true" /><span>{c.satelliteTag}</span></div><div className={styles.radarIllustration} aria-hidden="true"><div /><div /><div /><span /><i /></div><h3>{c.satelliteTitle}</h3><p>{c.satelliteBody}</p></motion.article><motion.article {...reveal} className={`${styles.feature} ${styles.featureHuman}`}><div className={styles.featureTop}><ShieldCheck size={25} strokeWidth={1.5} aria-hidden="true" /><span>{c.humanTag}</span></div><div className={styles.reviewIllustration}><span><Eye size={19} aria-hidden="true" />{c.review}</span><div><Check size={17} aria-hidden="true" />{lang === "az" ? "Yoxla və qərar ver" : "Review, then decide"}</div></div><h3>{c.humanTitle}</h3><p>{c.humanBody}</p></motion.article><motion.article {...reveal} className={`${styles.feature} ${styles.featureResponse}`}><div className={styles.featureTop}><Droplets size={25} strokeWidth={1.5} aria-hidden="true" /><span>{c.responseTag}</span></div><div><h3>{c.responseTitle}</h3><p>{c.responseBody}</p></div><ArrowRight size={24} strokeWidth={1.5} aria-hidden="true" /></motion.article></div></section>
      <section id="workflow" className={`${styles.section} ${styles.workflow}`}><motion.div {...reveal} className={styles.sectionHeading}><h2>{c.stagesTitle}</h2><p>{c.stagesBody}</p></motion.div><ol className={styles.steps}>{c.stages.map(([title, body], index) => { const Icon = [Satellite, Brain, ShieldCheck, Droplets][index]; return <motion.li {...reveal} key={title}><div className={styles.stepTop}><span>{String(index + 1).padStart(2, "0")}</span><Icon size={23} strokeWidth={1.5} aria-hidden="true" /></div><h3>{title}</h3><p>{body}</p></motion.li>; })}</ol></section>
      <section className={`${styles.section} ${styles.workspace}`}><motion.div {...reveal} className={styles.workspaceCopy}><h2>{c.workspaceTitle}</h2><p>{c.workspaceBody}</p><button type="button" className={styles.workspaceLink} disabled={busy} onClick={openDemo}>{c.explore}<ArrowRight size={18} aria-hidden="true" /></button></motion.div><motion.div {...reveal} className={styles.preview}><div className={styles.previewTop}><Waves size={18} aria-hidden="true" /><strong>SeaSentry</strong><span>{c.preview}</span></div><div className={styles.previewBody}><div className={styles.previewMap}><CaspianScene compact /></div><div className={styles.previewQueue}><h3>{c.queue}</h3><div><span className={styles.queueDot} /><strong>Sangachal coast</strong><p>{c.pending}</p></div><div><span className={styles.queueDot} /><strong>Baku corridor</strong><p>{c.review}</p></div><div className={styles.previewWeather}><Waves size={20} aria-hidden="true" /><span>{lang === "az" ? "Yerli şərait və mənbə vaxtı" : "Local conditions & observation time"}</span></div></div></div></motion.div></section>
      <section className={styles.finalCta}><div><span className={styles.finalIcon}><Waves size={32} strokeWidth={1.5} aria-hidden="true" /></span><h2>{c.ready}</h2><p>{c.readyBody}</p>{demoButton}<Link className={styles.registerLink} href="/register">{t.auth.createAccount}<ArrowRight size={15} aria-hidden="true" /></Link>{error && <p className={styles.demoError} role="alert">{error}</p>}</div></section>
    </main>
    <footer className={styles.footer}><div><Link href="/" className={styles.footerBrand} translate="no">SeaSentry</Link><p>{c.footer}</p></div><nav aria-label={lang === "az" ? "Alt naviqasiya" : "Footer navigation"}><a href="https://seasentryinfo.vercel.app" target="_blank" rel="noreferrer">{c.about}</a><Link href="/login">{t.nav.login}</Link><Link href="/register">{t.nav.register}</Link></nav></footer>
  </div>;
}
