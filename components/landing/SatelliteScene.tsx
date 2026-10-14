"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw, Satellite, ShieldCheck } from "lucide-react";
import styles from "./satellite-scene.module.css";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export default function SatelliteScene({ lang }: { lang: "en" | "az" }) {
  const id = useId().replaceAll(":", "");
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia(REDUCED_QUERY).matches, () => false);
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const c = lang === "az" ? {
    scene: "Xəzər dənizini müşahidə edən peykin illüstrativ orbital keçidi", illustration: "İllüstrativ orbital keçid", target: "Xəzər dənizi", oversight: "Mütəxəssis baxışı", pause: "Animasiyanı dayandır", resume: "Animasiyanı davam etdir", replay: "Keçidi yenidən göstər", reduced: "Hərəkət azaldılıb",
  } : {
    scene: "Illustrative orbital pass of an observation satellite over the Caspian Sea", illustration: "Illustrative orbital pass", target: "Caspian Sea", oversight: "Specialist review", pause: "Pause animation", resume: "Resume animation", replay: "Replay orbital pass", reduced: "Reduced motion",
  };

  return <div className={styles.scene} data-paused={paused || reduced}>
    <div className={styles.sceneSource}><Satellite size={15} aria-hidden="true" /><span>Sentinel-1 SAR</span></div>
    <svg key={run} viewBox="0 0 800 690" role="img" aria-label={c.scene} className={styles.orbitalScene}>
      <defs>
        <radialGradient id={`ocean-${id}`} cx="35%" cy="24%" r="80%"><stop stopColor="#106087" /><stop offset=".48" stopColor="#06385F" /><stop offset="1" stopColor="#021830" /></radialGradient>
        <radialGradient id={`atmosphere-${id}`}><stop offset=".78" stopColor="#00B8D9" stopOpacity="0" /><stop offset=".9" stopColor="#00B8D9" stopOpacity=".11" /><stop offset=".96" stopColor="#00B8D9" stopOpacity=".04" /><stop offset="1" stopColor="#00B8D9" stopOpacity="0" /></radialGradient>
        <radialGradient id={`shade-${id}`} cx="30%" cy="26%" r="78%"><stop offset=".25" stopColor="#03234D" stopOpacity="0" /><stop offset="1" stopColor="#021327" stopOpacity=".78" /></radialGradient>
        <linearGradient id={`land-${id}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#266C78" /><stop offset="1" stopColor="#0B364B" /></linearGradient>
        <linearGradient id={`beam-${id}`} x1="0" x2="0" y1="0" y2="1"><stop stopColor="#00C5C8" stopOpacity="0" /><stop offset=".7" stopColor="#00C5C8" stopOpacity=".08" /><stop offset="1" stopColor="#00C5C8" stopOpacity=".32" /></linearGradient>
        <linearGradient id={`panel-${id}`} x1="0" x2="1" y1="0" y2="1"><stop stopColor="#00B8D9" /><stop offset="1" stopColor="#0375A4" /></linearGradient>
        <linearGradient id={`bus-${id}`} x1="0" x2="1"><stop stopColor="#FBF9F0" /><stop offset=".52" stopColor="#E5EBE9" /><stop offset="1" stopColor="#92B0C1" /></linearGradient>
        <clipPath id={`earth-${id}`}><circle cx="440" cy="426" r="225" /></clipPath>
        <pattern id={`cells-${id}`} width="20" height="19" patternUnits="userSpaceOnUse"><path d="M20 0H0V19" fill="none" stroke="#03234D" strokeOpacity=".7" strokeWidth="1.5" /></pattern>
      </defs>

      <g className={styles.stars} fill="#A4D7EA"><circle cx="85" cy="146" r="1.2" /><circle cx="683" cy="112" r="1.4" /><circle cx="694" cy="255" r="1" /><circle cx="132" cy="359" r="1.1" /><circle cx="744" cy="411" r="1" /><circle cx="73" cy="509" r="1.3" /><circle cx="665" cy="588" r="1.2" /><circle cx="278" cy="89" r="1" /><circle cx="579" cy="66" r="1" /><circle cx="717" cy="654" r="1" /></g>
      <ellipse cx="440" cy="344" rx="340" ry="165" transform="rotate(-24 440 344)" fill="none" stroke="#4685A8" strokeOpacity=".3" strokeDasharray="4 8" />
      <circle cx="440" cy="426" r="260" fill={`url(#atmosphere-${id})`} />
      <circle cx="440" cy="426" r="225" fill={`url(#ocean-${id})`} stroke="#52B8D1" strokeOpacity=".65" strokeWidth="1.4" />

      <g clipPath={`url(#earth-${id})`}>
        <g className={styles.land} fill={`url(#land-${id})`} stroke="#5D98A2" strokeWidth="1.2" strokeLinejoin="round">
          <path d="M210 290L239 280 248 255 272 242 285 254 303 251 308 268 329 266 340 245 362 254 377 235 403 233 420 215 457 212 490 190 548 198 583 225 615 229 668 267 692 315 684 354 648 368 623 352 605 373 575 366 561 393 540 400 527 429 508 441 491 420 485 394 462 381 447 362 424 363 410 342 391 345 373 328 360 336 348 318 327 321 316 306 303 310 295 296 279 308 256 304 237 317 210 306Z" />
          <path d="M270 361L290 348 318 350 346 365 363 391 393 411 381 445 366 459 359 494 340 522 316 517 305 494 295 479 289 446 270 425 261 392Z" />
          <path d="M462 394L478 407 496 421 481 439 462 430 452 409Z" />
          <path d="M532 445L550 434 564 452 576 466 595 473 610 503 601 514 579 500 564 478 546 465Z" />
          <path d="M592 543L629 539 658 563 651 595 613 607 585 585Z" />
          <path d="M369 217L377 195 384 181 392 201 388 224Z" />
        </g>
        <g fill="none" stroke="#82C9D8" strokeOpacity=".14" strokeWidth=".8"><ellipse cx="440" cy="426" rx="225" ry="58" transform="rotate(12 440 426)" /><ellipse cx="440" cy="365" rx="211" ry="50" transform="rotate(12 440 365)" /><ellipse cx="440" cy="493" rx="207" ry="50" transform="rotate(12 440 493)" /><ellipse cx="440" cy="426" rx="100" ry="225" transform="rotate(22 440 426)" /><ellipse cx="440" cy="426" rx="173" ry="225" transform="rotate(22 440 426)" /><path d="M355 206Q384 432 525 634" /></g>
        <path d="M437 305C446 300 458 306 457 317L464 326 456 339 461 353 451 365 453 379 445 394 430 394 423 383 428 366 424 351 433 337 429 325Z" fill="#0B6584" stroke="#6ADDD9" strokeWidth="1.3" />
        <circle cx="440" cy="426" r="225" fill={`url(#shade-${id})`} />
        <g className={styles.scanFootprint}><ellipse cx="441" cy="386" rx="44" ry="17" transform="rotate(-21 441 386)" fill="#00C5C8" fillOpacity=".11" stroke="#00C5C8" strokeOpacity=".7" /><path d="M409 390L471 370M415 397L476 376" stroke="#00C5C8" strokeOpacity=".4" /></g>
        <g className={styles.targetRings} fill="none" stroke="#00C5C8"><ellipse cx="431" cy="383" rx="20" ry="12" /><ellipse cx="431" cy="383" rx="34" ry="21" /><ellipse cx="431" cy="383" rx="50" ry="31" /></g>
        <circle cx="431" cy="383" r="4" fill="#7DF1E5" />
      </g>

      <path d="M146 452C162 562 388 623 598 511" fill="none" stroke="#00B8D9" strokeOpacity=".6" strokeWidth="1.2" />
      <path d="M594 508L603 507 599 516" fill="none" stroke="#00B8D9" strokeOpacity=".6" strokeWidth="1.2" />

      <g className={styles.satellitePass}>
        <g className={styles.scanBeam}><path d="M440 192L396 404Q442 420 487 380Z" fill={`url(#beam-${id})`} /><path d="M440 192L396 404M440 192L487 380" stroke="#00C5C8" strokeOpacity=".34" strokeWidth="1" /></g>
        <g transform="rotate(-18 440 148)" className={styles.satellite}>
          <path d="M397 143H355M483 143H526" stroke="#A8C8D1" strokeWidth="7" />
          <g fill={`url(#panel-${id})`} stroke="#61D9EB" strokeWidth="1.2"><rect x="303" y="105" width="99" height="71" rx="5" /><rect x="478" y="105" width="99" height="71" rx="5" /></g>
          <g fill={`url(#cells-${id})`}><rect x="306" y="108" width="93" height="65" rx="3" /><rect x="481" y="108" width="93" height="65" rx="3" /></g>
          <path d="M307 109H398M482 109H573" stroke="#ACF2F1" strokeOpacity=".55" />
          <path d="M414 106Q440 91 466 106V166Q440 183 414 166Z" fill={`url(#bus-${id})`} stroke="#F7FBF7" strokeWidth="1.2" />
          <ellipse cx="440" cy="106" rx="26" ry="10" fill="#FBF9F0" stroke="#D9E6E7" strokeWidth="1" />
          <path d="M423 115V158" stroke="#FFFFFF" strokeOpacity=".9" strokeWidth="2.5" /><rect x="449" y="115" width="10" height="39" rx="5" fill="#03234D" /><path d="M416 161Q440 176 464 161" fill="none" stroke="#7E9DAC" strokeWidth="2" />
          <path d="M440 172V190" stroke="#C1D9DE" strokeWidth="5" /><path d="M416 179Q440 198 464 179Q463 194 440 199Q417 194 416 179Z" fill="#FBF9F0" stroke="#B8D5DC" strokeWidth="1" /><ellipse cx="440" cy="179" rx="24" ry="8" fill="#B5D0D9" /><path d="M440 180V168" stroke="#FBF9F0" strokeWidth="2" /><circle cx="440" cy="166" r="3" fill="#FBF9F0" />
          <path d="M440 96V79L451 69" fill="none" stroke="#CCDDE0" strokeWidth="2" /><circle cx="452" cy="68" r="3" fill="#00C5C8" />
        </g>
      </g>

      <g className={styles.targetCallout}>
        <path d="M428 387L361 418H236" fill="none" stroke="#8DCDC9" strokeOpacity=".65" strokeWidth="1" /><circle cx="236" cy="418" r="2.5" fill="#00C5C8" />
        <text x="235" y="442" fill="#DDEFF2" fontSize="16">{c.target}</text><text x="235" y="462" fill="#8BAFCB" fontSize="11">40.4° N / 49.9° E</text>
      </g>
      <g fill="#B6CDDD" fontSize="10"><text x="677" y="353" transform="rotate(90 677 353)">EARTH OBSERVATION</text></g>
    </svg>
    <div className={styles.observationNote}><span><ShieldCheck size={14} aria-hidden="true" />{c.oversight}</span><span className={styles.observationLine} /></div>
    <div className={styles.sceneFooter}><span>{c.illustration}</span><div>{reduced ? <span className={styles.reducedNote}>{c.reduced}</span> : <><button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? c.resume : c.pause} title={paused ? c.resume : c.pause} aria-pressed={paused}>{paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}</button><button type="button" onClick={() => { setRun((value) => value + 1); setPaused(false); }} aria-label={c.replay} title={c.replay}><RotateCcw size={14} aria-hidden="true" /></button></>}</div></div>
  </div>;
}
