/**
 * Canvas half of the landing story: a procedurally generated Sentinel-1-style
 * SAR scene of the sea, the scan that sweeps it, the AI detection mask, the
 * illustrative response (vessels + containment boom) and the hand-off into a
 * flat monitoring map. Every value is a pure function of the story progress,
 * so scrubbing backwards plays the sequence in reverse.
 *
 * All imagery here is illustrative demonstration content, not a live pass.
 */

export type OceanScene = {
  /** Build the (expensive) textures ahead of time. Safe to call repeatedly. */
  prepare: () => void;
  draw: (progress: number, time: number, wide: boolean) => void;
  resize: () => void;
};

const T = 768; // texture edge, px
const SLICK = { x: 470, y: 404, angle: 0.42 };
const TAU = Math.PI * 2;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hash(ix: number, iy: number, seed: number) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function valueNoise(x: number, y: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}
function fbm(x: number, y: number, seed: number, octaves: number) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Slick outline in texture space, elongated along the wind direction. */
function slickPoint(theta: number) {
  const r = 1 + 0.34 * Math.sin(2 * theta + 1) + 0.2 * Math.sin(3 * theta + 2.1) + 0.11 * Math.sin(5 * theta + 0.4) + 0.06 * Math.sin(9 * theta);
  const ex = Math.cos(theta) * r * 92;
  const ey = Math.sin(theta) * r * 44;
  const c = Math.cos(SLICK.angle);
  const s = Math.sin(SLICK.angle);
  return { x: SLICK.x + ex * c - ey * s, y: SLICK.y + ex * s + ey * c };
}
const SLICK_POINTS = Array.from({ length: 96 }, (_, i) => slickPoint((i / 96) * TAU));

function tracePath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], scale: number) {
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = SLICK.x + (p.x - SLICK.x) * scale;
    const y = SLICK.y + (p.y - SLICK.y) * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

export function createOceanScene(canvas: HTMLCanvasElement, fontFamily: string): OceanScene {
  const ctx = canvas.getContext("2d");
  let W = 1;
  let H = 1;
  let dpr = 1;
  let sar: HTMLCanvasElement | null = null;
  let optical: HTMLCanvasElement | null = null;
  let fields: { rough: Float32Array; land: Float32Array } | null = null;

  const makeCanvas = () => {
    const c = document.createElement("canvas");
    c.width = T;
    c.height = T;
    return c;
  };

  const buildFields = () => {
    const rough = new Float32Array(T * T);
    const land = new Float32Array(T * T);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const nx = x / T;
        const ny = y / T;
        rough[y * T + x] = fbm(nx * 7, ny * 7, 3, 4);
        // Signed land field: positive on the Absheron coast in the upper-left corner.
        const coast = 0.5 - (nx * 0.62 + ny * 0.5) + (fbm(nx * 4, ny * 4, 11, 4) - 0.5) * 0.34;
        land[y * T + x] = coast;
      }
    }
    fields = { rough, land };
  };

  const paintSar = () => {
    if (!fields) return;
    const c = makeCanvas();
    const g = c.getContext("2d");
    if (!g) return;
    const img = g.createImageData(T, T);
    for (let i = 0; i < T * T; i++) {
      const isLand = fields.land[i] > 0;
      const rough = fields.rough[i];
      const speckle = Math.min(2.4, -Math.log(1e-3 + Math.random()) * 0.62);
      let L = isLand ? (0.44 + rough * 0.5) * (0.55 + speckle * 0.45) : (0.07 + rough * rough * 0.34) * speckle;
      L = Math.min(1, L);
      img.data[i * 4] = 8 + L * 150;
      img.data[i * 4 + 1] = 26 + L * 190;
      img.data[i * 4 + 2] = 44 + L * 205;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    sar = c;
  };

  const paintOptical = () => {
    if (!fields) return;
    const c = makeCanvas();
    const g = c.getContext("2d");
    if (!g) return;
    const img = g.createImageData(T, T);
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        const i = y * T + x;
        const land = fields.land[i];
        const rough = fields.rough[i];
        const glint = Math.pow(fbm(x / 22, y / 90, 5, 2), 5) * 70;
        let r: number, gg: number, b: number;
        if (land > 0) {
          const m = rough;
          r = lerp(104, 150, m);
          gg = lerp(110, 140, m);
          b = lerp(72, 98, m);
        } else {
          const shelf = clamp01(-land * 3.2);
          r = lerp(34, 6, shelf) + rough * 12 + glint * 0.5;
          gg = lerp(124, 62, shelf) + rough * 24 + glint;
          b = lerp(146, 96, shelf) + rough * 26 + glint;
          const foam = clamp01(1 - -land / 0.025);
          r += foam * 130;
          gg += foam * 120;
          b += foam * 110;
        }
        img.data[i * 4] = r;
        img.data[i * 4 + 1] = gg;
        img.data[i * 4 + 2] = b;
        img.data[i * 4 + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    optical = c;
  };

  const prepare = () => {
    if (!fields) buildFields();
    else if (!sar) paintSar();
    else if (!optical) paintOptical();
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    W = canvas.clientWidth || 1;
    H = canvas.clientHeight || 1;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  resize();

  const draw = (p: number, t: number, wide: boolean) => {
    if (!ctx) return;
    if (!sar) { prepare(); prepare(); if (!sar) return; }
    if (!optical && p > 0.5) prepare();

    // ---- camera over the imagery --------------------------------------
    const zoom =
      p < 0.44 ? 1.16 + smooth(0.28, 0.34, p) * -0.04
      : p < 0.62 ? lerp(1.12, 1.5, smooth(0.44, 0.6, p))
      : p < 0.7 ? lerp(1.5, 1.6, smooth(0.62, 0.7, p))
      : p < 0.84 ? lerp(1.6, 1.05, smooth(0.7, 0.8, p))
      : lerp(1.05, 1.16, smooth(0.84, 0.93, p));
    const k = (Math.max(W, H) / (T * 0.95)) * zoom;
    const shiftX = wide ? W * 0.15 : 0;
    const shiftY = wide ? 0 : -H * 0.12;
    const focusMix = smooth(0.44, 0.6, p) * (1 - smooth(0.84, 0.93, p) * 0.85);
    let fx = lerp(T / 2, SLICK.x, focusMix);
    let fy = lerp(T / 2, SLICK.y, focusMix);
    const minX = (W / 2 + shiftX) / k;
    const maxX = T - (W / 2 - shiftX) / k;
    const minY = (H / 2 + shiftY) / k;
    const maxY = T - (H / 2 - shiftY) / k;
    fx = minX < maxX ? Math.min(maxX, Math.max(minX, fx)) : T / 2;
    fy = minY < maxY ? Math.min(maxY, Math.max(minY, fy)) : T / 2;
    // The sea never stands perfectly still.
    fx += Math.sin(t * 0.21) * 1.4;
    fy += Math.cos(t * 0.17) * 1.1;

    const ox = W / 2 + shiftX;
    const oy = H / 2 + shiftY;
    const toScreen = (x: number, y: number) => ({ x: ox + (x - fx) * k, y: oy + (y - fy) * k });

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#02162f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(k, k);
    ctx.translate(-fx, -fy);

    // ---- imagery -------------------------------------------------------
    const opticalMix = optical ? smooth(0.64, 0.72, p) : 0;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(sar, 0, 0);
    if (optical && opticalMix > 0) {
      ctx.globalAlpha = opticalMix;
      ctx.drawImage(optical, 0, 0);
      ctx.globalAlpha = 1;
    }

    // ---- the slick -----------------------------------------------------
    const shrink = lerp(1, 0.24, smooth(0.76, 0.93, p));
    const breathe = 1 + Math.sin(t * 0.7) * 0.012;
    ctx.save();
    ctx.shadowColor = "rgba(2,8,18,.9)";
    ctx.shadowBlur = 10 * k;
    tracePath(ctx, SLICK_POINTS, shrink * breathe);
    ctx.fillStyle = `rgba(2,8,18,${0.9 * (1 - opticalMix)})`;
    ctx.fill();
    if (opticalMix > 0) {
      ctx.shadowColor = "rgba(36,22,10,.8)";
      tracePath(ctx, SLICK_POINTS, shrink * breathe);
      ctx.fillStyle = `rgba(30,20,12,${0.78 * opticalMix})`;
      ctx.fill();
      // Thin-film sheen at the edge of the slick.
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.4 / k;
      ctx.strokeStyle = `rgba(190,170,110,${0.35 * opticalMix})`;
      ctx.stroke();
    }
    ctx.restore();

    // Detected extent stays on the water as a reference once cleanup begins.
    const refAlpha = smooth(0.76, 0.82, p) * (1 - smooth(0.93, 0.97, p));
    if (refAlpha > 0.01) {
      ctx.save();
      ctx.setLineDash([6 / k, 6 / k]);
      ctx.lineWidth = 1.3 / k;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * refAlpha})`;
      tracePath(ctx, SLICK_POINTS, 1);
      ctx.stroke();
      ctx.restore();
    }

    // ---- AI detection mask --------------------------------------------
    const mask = smooth(0.47, 0.54, p) * (1 - smooth(0.7, 0.76, p) * 0.55);
    if (mask > 0.01) {
      ctx.save();
      tracePath(ctx, SLICK_POINTS, shrink * breathe);
      ctx.fillStyle = `rgba(0,197,200,${0.18 * mask})`;
      ctx.fill();
      ctx.setLineDash([9 / k, 5 / k]);
      ctx.lineDashOffset = -t * 14 / k;
      ctx.lineWidth = 2 / k;
      ctx.strokeStyle = `rgba(0,230,230,${0.95 * mask})`;
      ctx.stroke();
      ctx.restore();
    }

    // ---- response: vessels, boom, zone --------------------------------
    const arrive = smooth(0.71, 0.78, p);
    const boomP = smooth(0.74, 0.81, p);
    const ringScale = lerp(1.55, 1.12, smooth(0.8, 0.93, p));
    const stationAngles = [-0.9, 2.2, 4.4];
    const ringPoint = (a: number, scale: number) => {
      const rx = 94 * scale;
      const ry = 52 * scale;
      const c = Math.cos(SLICK.angle);
      const s = Math.sin(SLICK.angle);
      return { x: SLICK.x + Math.cos(a) * rx * c - Math.sin(a) * ry * s, y: SLICK.y + Math.cos(a) * rx * s + Math.sin(a) * ry * c };
    };
    if (arrive > 0.001 && p < 0.97) {
      const fade = 1 - smooth(0.93, 0.97, p);
      ctx.save();
      ctx.globalAlpha = fade;
      // response zone
      ctx.setLineDash([4 / k, 8 / k]);
      ctx.lineWidth = 1.2 / k;
      ctx.strokeStyle = "rgba(0,184,217,.7)";
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) { const pt = ringPoint((i / 64) * TAU, 2.2); if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y); }
      ctx.stroke();
      ctx.fillStyle = "rgba(0,184,217,.06)";
      ctx.fill();
      ctx.setLineDash([]);

      // containment boom, drawn between consecutive vessels
      ctx.lineCap = "round";
      ctx.lineWidth = 3.2 / k;
      ctx.strokeStyle = "#F2A93B";
      for (let s = 0; s < 3; s++) {
        const a0 = stationAngles[s];
        const a1 = stationAngles[(s + 1) % 3] + (s === 2 ? TAU : 0);
        const local = clamp01(boomP * 3 - s);
        if (local <= 0) continue;
        ctx.beginPath();
        const steps = 26;
        for (let i = 0; i <= steps * local; i++) {
          const pt = ringPoint(lerp(a0, a1, i / steps), ringScale);
          if (i === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
        }
        ctx.setLineDash([5 / k, 2.2 / k]);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // vessels sail in from the open water, each slightly later than the last
      stationAngles.forEach((a, i) => {
        const local = smooth(0.71 + i * 0.012, 0.78 + i * 0.012, p);
        const station = ringPoint(a, ringScale);
        const startDir = a + 0.35;
        const start = { x: SLICK.x + Math.cos(startDir) * 520, y: SLICK.y + Math.sin(startDir) * 420 };
        const x = lerp(start.x, station.x, local);
        const y = lerp(start.y, station.y, local);
        const heading = Math.atan2(station.y - start.y, station.x - start.x) + (local >= 0.999 ? Math.sin(t * 0.6 + i) * 0.05 : 0);
        const moving = local < 0.999;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(heading);
        if (moving) {
          const wake = ctx.createLinearGradient(0, 0, -34, 0);
          wake.addColorStop(0, "rgba(255,255,255,.55)");
          wake.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = wake;
          ctx.beginPath(); ctx.moveTo(-6, -1.6); ctx.lineTo(-34, -6); ctx.lineTo(-34, 6); ctx.lineTo(-6, 1.6); ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = "#FBF9F0";
        ctx.strokeStyle = "#03234D";
        ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(5, 4); ctx.lineTo(-8, 4); ctx.lineTo(-8, -4); ctx.lineTo(5, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#03234D";
        ctx.fillRect(-5, -2.4, 6, 4.8);
        ctx.fillStyle = "#F2A93B";
        ctx.fillRect(-7.5, -1.2, 2, 2.4);
        ctx.restore();
      });
      ctx.restore();
    }

    // ---- repeat coverage (monitoring) ---------------------------------
    const cover = smooth(0.85, 0.93, p);
    if (cover > 0.001) {
      ctx.save();
      const passes = [
        { x: SLICK.x - 150, a: 0.12, label: "T+0" },
        { x: SLICK.x + 10, a: 0.12, label: "T+12 d" },
        { x: SLICK.x + 170, a: 0.12, label: "T+24 d" },
      ];
      passes.forEach((pass, i) => {
        const local = clamp01(cover * 3 - i);
        if (local <= 0) return;
        ctx.save();
        ctx.translate(pass.x, SLICK.y);
        ctx.rotate(pass.a);
        ctx.globalAlpha = local * (1 - smooth(0.95, 0.99, p) * 0.6);
        ctx.fillStyle = "rgba(0,197,200,.06)";
        ctx.strokeStyle = "rgba(0,230,230,.85)";
        ctx.lineWidth = 1.4 / k;
        ctx.setLineDash([10 / k, 6 / k]);
        ctx.fillRect(-72, -330, 144, 660);
        ctx.strokeRect(-72, -330, 144, 660);
        ctx.setLineDash([]);
        ctx.fillStyle = "#BFF3F7";
        ctx.font = `600 ${11 / k}px ${fontFamily}`;
        ctx.fillText(pass.label, -64, -314);
        ctx.restore();
      });
      ctx.restore();
    }
    ctx.restore(); // back to screen space

    // ---- flat map hand-off --------------------------------------------
    const map = smooth(0.93, 0.985, p);
    if (map > 0.001) {
      ctx.fillStyle = `rgba(6,29,59,${0.9 * map})`;
      ctx.fillRect(0, 0, W, H);
    }

    // ---- graticule + coordinates (scan chapters and beyond) -----------
    const hud = smooth(0.3, 0.36, p);
    if (hud > 0.001) {
      ctx.save();
      ctx.globalAlpha = hud * (0.35 + map * 0.45);
      ctx.strokeStyle = "rgba(160,215,235,.55)";
      ctx.fillStyle = "rgba(190,230,242,.9)";
      ctx.lineWidth = 1;
      ctx.font = `500 11px ${fontFamily}`;
      const step = 128;
      for (let gx = 0; gx <= T; gx += step) {
        const s = toScreen(gx, 0).x;
        if (s < 0 || s > W) continue;
        ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s, H); ctx.stroke();
        ctx.fillText(`${(50.0 + gx * 0.0009).toFixed(2)}°E`, s + 6, H - 14);
      }
      for (let gy = 0; gy <= T; gy += step) {
        const s = toScreen(0, gy).y;
        if (s < 0 || s > H) continue;
        ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(W, s); ctx.stroke();
        ctx.fillText(`${(40.75 - gy * 0.0006).toFixed(2)}°N`, 12, s - 6);
      }
      ctx.restore();
    }

    // ---- scan sweep (screen space) ------------------------------------
    const scan = smooth(0.32, 0.47, p);
    const scanVisible = smooth(0.31, 0.35, p) * (1 - smooth(0.47, 0.52, p));
    if (scanVisible > 0.001) {
      const fx0 = wide ? W * 0.3 : W * 0.08;
      const fx1 = W * 0.94;
      const fy0 = H * 0.1;
      const fy1 = H * 0.9;
      const sy = lerp(fy0, fy1, scan);
      ctx.save();
      ctx.globalAlpha = scanVisible;
      const trail = ctx.createLinearGradient(0, sy - 120, 0, sy);
      trail.addColorStop(0, "rgba(0,197,200,0)");
      trail.addColorStop(1, "rgba(0,197,200,.2)");
      ctx.fillStyle = trail;
      ctx.fillRect(fx0, Math.max(fy0, sy - 120), fx1 - fx0, Math.min(120, sy - fy0));
      ctx.strokeStyle = "rgba(120,240,240,.95)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(fx0, sy); ctx.lineTo(fx1, sy); ctx.stroke();
      // swath corners
      ctx.strokeStyle = "rgba(220,248,250,.9)";
      ctx.lineWidth = 2;
      const corner = 22;
      for (const [cx, cy, dx, dy] of [[fx0, fy0, 1, 1], [fx1, fy0, -1, 1], [fx0, fy1, 1, -1], [fx1, fy1, -1, -1]] as const) {
        ctx.beginPath(); ctx.moveTo(cx + dx * corner, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * corner); ctx.stroke();
      }
      ctx.restore();
    }

    // ---- detection brackets + label (screen space) --------------------
    const bracket = smooth(0.5, 0.56, p) * (1 - smooth(0.7, 0.74, p));
    if (bracket > 0.001) {
      const c = toScreen(SLICK.x, SLICK.y);
      const hw = 125 * k * shrink + 16;
      const hh = 72 * k * shrink + 16;
      ctx.save();
      ctx.globalAlpha = bracket;
      ctx.strokeStyle = "#BFF3F7";
      ctx.lineWidth = 1.6;
      const len = 16;
      for (const [sx, sy2] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        const x = c.x + sx * hw;
        const y = c.y + sy2 * hh;
        ctx.beginPath(); ctx.moveTo(x - sx * len, y); ctx.lineTo(x, y); ctx.lineTo(x, y - sy2 * len); ctx.stroke();
      }
      ctx.font = `600 12px ${fontFamily}`;
      const label = "SPILL-DEMO · 0.87";
      const tw = ctx.measureText(label).width + 16;
      ctx.fillStyle = "rgba(3,35,77,.92)";
      ctx.fillRect(c.x - hw, c.y - hh - 28, tw, 22);
      ctx.fillStyle = "#BFF3F7";
      ctx.fillText(label, c.x - hw + 8, c.y - hh - 12);
      ctx.restore();
    }
  };

  return { prepare, draw, resize };
}
