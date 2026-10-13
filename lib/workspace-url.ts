export function setWorkspaceQuery(values: Record<string, string | null | undefined>, push = false) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value == null || value === "" || value === "all") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export function formatWorkspaceTime(timestamp: string, lang: "en" | "az") {
  if (!timestamp || !Number.isFinite(Date.parse(timestamp))) return "—";
  return new Intl.DateTimeFormat(lang === "az" ? "az-AZ" : "en-GB", { timeZone: "Asia/Baku", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(timestamp));
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
