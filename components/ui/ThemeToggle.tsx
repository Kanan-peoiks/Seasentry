"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { getEffectiveTheme, toggleTheme, THEME_CHANGE_EVENT, type Theme } from "@/lib/theme";
import { useLanguage } from "@/lib/useLanguage";

export default function ThemeToggle({ size = 34 }: { size?: number }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");
  const { lang } = useLanguage();

  useEffect(() => {
    setMounted(true);
    setThemeState(getEffectiveTheme());
    const sync = () => setThemeState(getEffectiveTheme());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    window.addEventListener("storage", sync);
    window.addEventListener(THEME_CHANGE_EVENT, sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
    };
  }, []);

  if (!mounted) {
    return <span style={{ width: size, height: size, display: "inline-block" }} aria-hidden />;
  }

  return (
    <button
      type="button"
      title={theme === "dark" ? (lang === "az" ? "Açıq görünüşə keç" : "Switch to light mode") : (lang === "az" ? "Tünd görünüşə keç" : "Switch to dark mode")}
      aria-label={lang === "az" ? "Görünüşü dəyiş" : "Toggle color theme"}
      onClick={() => setThemeState(toggleTheme())}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: "1px solid var(--glass-border)",
        background: "transparent",
        color: "var(--text-secondary)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "var(--text-primary)";
        e.currentTarget.style.background = "var(--glass-bg-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "var(--text-secondary)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      {theme === "dark" ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </button>
  );
}
