"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { getEffectiveTheme, subscribeTheme, toggleTheme, type Theme } from "@/lib/theme";
import { useLanguage } from "@/lib/useLanguage";

export default function ThemeToggle({ size = 40, className = "" }: { size?: number; className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, getEffectiveTheme, () => null as Theme | null);
  const { lang } = useLanguage();
  const label = theme === "dark" ? (lang === "az" ? "Açıq görünüşə keç" : "Switch to light mode") : (lang === "az" ? "Tünd görünüşə keç" : "Switch to dark mode");

  return (
    <button type="button" className={`ui-icon-button ${className}`} style={{ width: size, height: size }} title={label} aria-label={label} onClick={() => toggleTheme()} disabled={!theme}>
      {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
