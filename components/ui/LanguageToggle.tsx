"use client";

import { toggleLanguage } from "@/lib/i18n";
import { useLanguage } from "@/lib/useLanguage";

export default function LanguageToggle({ size = 40, className = "" }: { size?: number; className?: string }) {
  const { lang } = useLanguage();
  const label = lang === "en" ? "Azərbaycan dilinə keç" : "Switch to English";

  return (
    <button type="button" className={`ui-icon-button ui-language-toggle ${className}`} style={{ width: size, height: size }} title={label} aria-label={label} onClick={() => toggleLanguage()}>
      <span lang={lang === "en" ? "az" : "en"}>{lang === "en" ? "AZ" : "EN"}</span>
    </button>
  );
}
