import { expect, test } from "@playwright/test";
import { authenticate, mockWorkspace } from "./fixtures";

test("public landing is readable with reduced motion and no incident requests", async ({ page }) => {
  let incidentRequests = 0;
  page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/incidents") incidentRequests++; });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /guest|qonaq|explore platform|platformanı/i }).first()).toBeVisible();
  expect(incidentRequests).toBe(0);
});

test("a valid cookie recovers a session without localStorage", async ({ page, context }) => {
  await authenticate(context);
  await mockWorkspace(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Aysel Məmmədova").first()).toBeVisible();
});

test("backend outage is retryable without a login redirect", async ({ page, context }) => {
  await authenticate(context);
  await mockWorkspace(page, { meStatus: 502 });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: /retry|try again|yenidən/i }).first()).toBeVisible();
  await expect(page).toHaveURL(/dashboard/);
  expect((await context.cookies()).some((cookie) => cookie.name === "seasentry_token")).toBeTruthy();
});
