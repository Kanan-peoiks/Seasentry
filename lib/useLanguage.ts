"use client";

import { useSyncExternalStore } from "react";
import { getEffectiveLanguage, translations, LANGUAGE_CHANGE_EVENT, type Language, type Translations } from "./i18n";

function subscribe(onChange: () => void) {
  window.addEventListener(LANGUAGE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(LANGUAGE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Current UI language plus its translation dictionary, re-rendering when
 * the user toggles it (see LanguageToggle) or changes it in another tab.
 * The server render is always English; the stored choice applies on hydration. */
export function useLanguage(): { lang: Language; t: Translations } {
  const lang = useSyncExternalStore(subscribe, getEffectiveLanguage, () => "en" as Language);
  return { lang, t: translations[lang] };
}
