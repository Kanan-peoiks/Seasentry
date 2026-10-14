export function setWorkspaceQuery(values: Record<string, string | null | undefined>, push = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === "" || value === "all") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

// Browsers ship incomplete ICU data for "az" (months render as "M10"), so
// Azerbaijani month names are spelled out here.
const AZ_MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
const AZ_MONTHS_LONG = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

function bakuParts(timestamp: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", year: "numeric", month: "numeric", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(timestamp));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: Number(get("month")), day: get("day"), time: `${get("hour")}:${get("minute")}` };
}

/** "14 Oct, 10:00" / "14 okt, 10:00" in Baku time. */
export function formatWorkspaceTime(timestamp: string, lang: "en" | "az") {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "—";
  if (lang === "az") {
    const p = bakuParts(timestamp);
    return `${p.day} ${AZ_MONTHS[p.month - 1]}, ${p.time}`;
  }
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(timestamp));
}

/** "14 Oct 2026, 10:00" / "14 oktyabr 2026, 10:00" in Baku time. */
export function formatWorkspaceDateTime(timestamp: string, lang: "en" | "az") {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "—";
  const p = bakuParts(timestamp);
  if (lang === "az") return `${p.day} ${AZ_MONTHS_LONG[p.month - 1]} ${p.year}, ${p.time}`;
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Baku", dateStyle: "medium", timeStyle: "short", hourCycle: "h23" }).format(new Date(timestamp));
}

export function matchesIncidentDate(timestamp: string, filter: string, now = Date.now()) {
  const date = Date.parse(timestamp);
  if (!Number.isFinite(date)) return filter === "all";
  if (filter === "today") {
    const day = (value: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Baku", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
    return day(date) === day(now);
  }
  if (filter === "7d" || filter === "30d") return date <= now && date >= now - (filter === "7d" ? 7 : 30) * 86400000;
  return true;
}
