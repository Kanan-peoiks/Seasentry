"use client";

import { useEffect } from "react";
import { useLanguage } from "@/lib/useLanguage";
import { applyTheme, getEffectiveTheme, THEME_CHANGE_EVENT } from "@/lib/theme";

export default function ClientPreferences() {
  const { lang } = useLanguage();
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    const sync = () => {
      const theme = getEffectiveTheme();
      applyTheme(theme);
      let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "theme-color";
        document.head.appendChild(meta);
      }
      meta.content = theme === "dark" ? "#0C2133" : "#F3F7F9";
    };
    sync();
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
  return null;
}
