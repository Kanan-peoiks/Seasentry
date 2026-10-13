"use client";

import { toggleLanguage } from "@/lib/i18n";
import { useLanguage } from "@/lib/useLanguage";

export default function LanguageToggle({ size = 34 }: { size?: number }) {
  const { lang } = useLanguage();

  return (
    <button
      type="button"
      title={lang === "en" ? "Azərbaycan dilinə keç" : "Switch to English"}
      aria-label={lang === "en" ? "Azərbaycan dilinə keç" : "Switch to English"}
      onClick={() => toggleLanguage()}
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
        fontSize: size < 30 ? 10 : 11,
        fontWeight: 700,
        letterSpacing: "0.02em",
        fontFamily: "inherit",
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
      {lang === "en" ? "AZ" : "EN"}
    </button>
  );
}
