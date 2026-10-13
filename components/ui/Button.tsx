"use client";

import type { ButtonHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; busy?: boolean };
export default function Button({ variant = "secondary", busy, children, className = "", disabled, type = "button", ...props }: Props) {
  return <button {...props} type={type} disabled={disabled || busy} aria-busy={busy || undefined} className={`ui-button ui-button--${variant} ${className}`}>
    {busy && <LoaderCircle size={16} className="spinner" aria-hidden="true" />}{children}
  </button>;
}
