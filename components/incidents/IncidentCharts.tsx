"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import type { ProjectionPoint, ResponseOption } from "@/lib/spill-physics";
import { useLanguage } from "@/lib/useLanguage";

// Hex values mirror the app's CSS custom properties (app/globals.css) —
// hardcoded because SVG chart libraries need literal color strings.
const COLOR_ACCENT = "#087F7A";
const COLOR_HIGH = "#C44543";
const COLOR_MED = "#B7791F";
const COLOR_LOW = "#237F9C";
const COLOR_TEXT_SECONDARY = "#526778";
const COLOR_GRID = "#D6E2E8";

const tooltipStyle = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--glass-border)",
  borderRadius: 8,
  fontSize: 12,
};

// ------------------------------------------------------------------
// Detection confidence gauges — bigger, animated, and functional: they
// drive a computed composite score and a live recommendation line.
// ------------------------------------------------------------------

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(value), 60);
    return () => clearTimeout(t);
  }, [value]);

  const offset = circumference * (1 - animated / 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: "var(--glass-border)" }}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          style={{ stroke: color, transition: "stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)" }}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontSize: 22, fontWeight: 700, fill: "var(--text-primary)" }}
        >
          {value}%
        </text>
      </svg>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text-secondary)",
          textAlign: "center",
          maxWidth: size + 10,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function tierColor(score: number) {
  if (score >= 80) return COLOR_ACCENT;
  if (score >= 60) return COLOR_MED;
  return COLOR_HIGH;
}

export function ConfidenceGauges({
  texture,
  edge,
  contrast,
  composite,
}: {
  texture: number;
  edge: number;
  contrast: number;
  /** The real detection confidence (incident.aiProbability), shown as the
   * headline number — not recomputed from the illustrative sub-scores above,
   * so it always matches the "Model Confidence" shown elsewhere on this
   * incident. */
  composite: number;
}) {
  const { t } = useLanguage();
  const recommendation =
    composite >= 80
      ? t.charts.recommendationStrong
      : composite >= 60
      ? t.charts.recommendationModerate
      : t.charts.recommendationWeak;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-around", gap: 12, flexWrap: "wrap" }}>
        <Gauge label={t.charts.gaugeTexture} value={texture} color={tierColor(texture)} />
        <Gauge label={t.charts.gaugeEdge} value={edge} color={tierColor(edge)} />
        <Gauge label={t.charts.gaugeContrast} value={contrast} color={tierColor(contrast)} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, minWidth: 104 }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: tierColor(composite), lineHeight: 1 }}>
            {composite}%
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-tertiary)" }}>
            {t.charts.composite}
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 16,
          padding: "10px 12px",
          borderRadius: 8,
          background: `${tierColor(composite)}1A`,
          border: `1px solid ${tierColor(composite)}55`,
          fontSize: 12,
          color: "var(--text-secondary)",
          lineHeight: 1.5,
        }}
      >
        {recommendation}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// Spill projection — historical growth + two forward branches.
// ------------------------------------------------------------------

export function SpillProjectionChart({ series }: { series: ProjectionPoint[] }) {
  const { t } = useLanguage();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY }} axisLine={{ stroke: COLOR_GRID }} tickLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY }}
          axisLine={false}
          tickLine={false}
          width={72}
          tickFormatter={(v) => `${v} m²`}
        />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="historical" name={t.charts.observed} stroke={COLOR_TEXT_SECONDARY} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
        <Line type="monotone" dataKey="untouched" name={t.charts.ifUntouched} stroke={COLOR_HIGH} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} />
        <Line type="monotone" dataKey="responded" name={t.charts.ifResponseNow} stroke={COLOR_ACCENT} strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
// ------------------------------------------------------------------
// Response options — recommended strategies by time and cost.
// ------------------------------------------------------------------

export function ResponseOptionsBar({ data }: { data: ResponseOption[] }) {
  const { t } = useLanguage();
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={COLOR_GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: COLOR_TEXT_SECONDARY }} axisLine={{ stroke: COLOR_GRID }} tickLine={false} interval={0} />
        <YAxis yAxisId="hours" tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v}h`} />
        <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11, fill: COLOR_TEXT_SECONDARY }} axisLine={false} tickLine={false} width={64} tickFormatter={(v) => `$${v}`} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="hours" dataKey="hours" name={t.charts.timeToContain} fill={COLOR_LOW} radius={[4, 4, 0, 0]} />
        <Bar yAxisId="cost" dataKey="costUsd" name={t.charts.cost} fill={COLOR_ACCENT} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
