"use client";

import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";

export default function Notice({ children, tone = "info", action }: { children: ReactNode; tone?: "info" | "error" | "success"; action?: ReactNode }) {
  return <div className={`ui-notice ui-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>
    {tone === "error" ? <AlertCircle size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
    <div>{children}</div>{action && <div className="ui-notice-action">{action}</div>}
  </div>;
}
