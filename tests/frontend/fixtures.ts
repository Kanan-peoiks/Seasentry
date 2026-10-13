import type { Page, BrowserContext } from "@playwright/test";

export const fixtureUser = { id: "test-user", name: "Aysel Məmmədova", email: "aysel@example.test", role: "operator", isDemo: false };
export const fixtureIncidents = [
  { id: "test-incident", displayId: "#101", title: "Sangachal coastal observation", location: "Sangachal coast", lat: 40.15, lng: 49.8, timestamp: "2026-10-14T06:00:00Z", areaM2: 320, aiProbability: 0, risk: "HIGH", status: "detected", portId: "sangachal", detectionSource: "Manual report", spillSource: "Pipeline leak", estimatedCause: "Reported observation — review required", aiSummary: "A field observer reported a possible surface slick.", humanDecision: "pending", reviewStatus: "PENDING", responseStatus: "Awaiting review", affectedVesselIds: [] },
  { id: "test-resolved", displayId: "#102", title: "Resolved terminal observation", location: "Baku Port", lat: 40.3, lng: 50.15, timestamp: "2026-10-13T06:00:00Z", areaM2: 150, aiProbability: 0, risk: "LOW", status: "resolved", portId: "baku", detectionSource: "Manual report", spillSource: "Port terminal", estimatedCause: "Operator observation", aiSummary: "Review and response completed.", humanDecision: "resolved", reviewStatus: "RESOLVED", responseStatus: "Resolved", affectedVesselIds: [] },
];

export async function authenticate(context: BrowserContext) {
  await context.addCookies([{ name: "seasentry_token", value: "fixture-session", domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
}

export async function mockWorkspace(page: Page, options: { role?: string; incidents?: typeof fixtureIncidents; meStatus?: number } = {}) {
  const incidents = structuredClone(options.incidents ?? fixtureIncidents);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const status = path === "/api/auth/me" ? (options.meStatus ?? 200) : 200;
    let body: unknown = [];
    if (path.startsWith("/api/auth/")) body = { user: { ...fixtureUser, role: options.role ?? "operator" } };
    else if (path === "/api/incidents") body = incidents;
    else if (path.endsWith("/decision")) {
      const action = route.request().postDataJSON()?.action;
      const incident = incidents[0];
      const state: Record<string, [string, string, string]> = { confirm: ["under_review", "confirmed_spill", "CONFIRMED"], reject: ["rejected", "false_positive", "REJECTED"], escalate: ["under_review", "escalated", "ESCALATED"], mark_cleaning: ["cleaning", "response_approved", "CLEANING"], resolve: ["resolved", "resolved", "RESOLVED"] };
      if (state[action]) [incident.status, incident.humanDecision, incident.reviewStatus] = state[action];
      body = incident;
    } else if (path === "/api/detect") body = { created: false, aiProbability: 0, message: "No anomaly" };
    else if (path === "/api/admin/stats") body = { totalUsers: 3, totalOperators: 1, totalAdmins: 1, loginsToday: 2, loginTrend: [] };
    else if (path === "/api/admin/users") body = [{ ...fixtureUser, createdAt: "2026-10-01T00:00:00Z" }];
    else if (path === "/api/feedback" && route.request().method() === "POST") body = { ok: true };
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(status === 200 ? body : { error: "Service unavailable" }) });
  });
  await page.route("**/*open-meteo.com/**", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  await page.route("https://*.tile.openstreetmap.org/**", async (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBbkAAAAASUVORK5CYII=", "base64") }));
}
