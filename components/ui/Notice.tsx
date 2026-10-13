"use client";

import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";

type Tone = "info" | "error" | "success" | "warning";
const ICONS = { info: Info, error: AlertCircle, success: CheckCircle2, warning: TriangleAlert };

export default function Notice({ children, tone = "info", action }: { children: ReactNode; tone?: Tone; action?: ReactNode }) {
  const Icon = ICONS[tone];
  return <div className={`ui-notice ui-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
    <Icon size={18} aria-hidden="true" />
    <div className="ui-notice-body">{children}</div>{action && <div className="ui-notice-action">{action}</div>}
  </div>;
}
