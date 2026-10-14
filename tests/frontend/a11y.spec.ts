import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { authenticate, fixtureIncidents, mockWorkspace } from "./fixtures";

const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBbkAAAAASUVORK5CYII=";

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
}

test("landing page (static hero) has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoViolations(page);
});

test.describe("landing story", () => {
  test.use({ reducedMotion: "no-preference" });

  test("detection chapter has no WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    const rail = page.getByRole("navigation", { name: /story chapters/i });
    test.skip(await rail.count() === 0, "story needs WebGL");
    await rail.getByRole("button", { name: "Detect" }).click();
    await expect(rail.getByRole("button", { name: "Detect" })).toHaveAttribute("aria-current", "step");
    await expectNoViolations(page);
  });
});

test("dashboard layer menu has no WCAG A/AA violations", async ({ page, context }) => {
  await authenticate(context);
  await mockWorkspace(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /layers/i }).click();
  await expect(page.getByRole("radio", { name: "Satellite" })).toBeAttached();
  await expectNoViolations(page);
});

test("incident panel with SAR comparison has no WCAG A/AA violations", async ({ page, context }) => {
  const incidents = structuredClone(fixtureIncidents);
  Object.assign(incidents[0], { sarImageBase64: PIXEL, sarOverlayBase64: PIXEL, detectionSource: "Sentinel-1 SAR" });
  await authenticate(context);
  await mockWorkspace(page, { incidents });
  await page.goto("/incidents");
  await page.getByText("#101").first().click();
  await expect(page.getByRole("slider", { name: /compare/i })).toBeVisible();
  await expectNoViolations(page);
});
