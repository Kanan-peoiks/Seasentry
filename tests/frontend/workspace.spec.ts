import { expect, test } from "@playwright/test";
import { authenticate, fixtureIncidents, mockWorkspace } from "./fixtures";

// 1×1 PNG: enough for components that only need an image to be present.
const PIXEL = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBbkAAAAASUVORK5CYII=";

test("base map switches to daily MODIS and is remembered after reload", async ({ page, context }) => {
  await authenticate(context);
  await mockWorkspace(page);
  await page.route("https://gibs.earthdata.nasa.gov/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(PIXEL, "base64") }));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /layers/i }).click();

  const modisTile = page.waitForRequest(/gibs\.earthdata\.nasa\.gov/);
  await page.getByRole("radio", { name: "Daily MODIS" }).check({ force: true });
  await modisTile;
  await expect(page.locator(".leaflet-control-attribution")).toContainText("Terra MODIS");

  await page.reload();
  await page.getByRole("button", { name: /layers/i }).click();
  await expect(page.getByRole("radio", { name: "Daily MODIS" })).toBeChecked();
});

test("SAR evidence compares the original tile with the detector overlay", async ({ page, context }) => {
  const incidents = structuredClone(fixtureIncidents);
  Object.assign(incidents[0], { sarImageBase64: PIXEL, sarOverlayBase64: PIXEL, detectionSource: "Sentinel-1 SAR" });
  await authenticate(context);
  await mockWorkspace(page, { incidents });
  await page.goto("/incidents");
  await page.getByText("#101").first().click();

  const slider = page.getByRole("slider", { name: /compare original and ai overlay/i });
  await expect(slider).toBeVisible();
  await expect(page.getByRole("img", { name: /overlay/i })).toBeAttached();

  await slider.fill("30");
  await expect(page.locator(".sar-compare-frame")).toHaveAttribute("style", /--pos:\s*30%/);
  await slider.press("ArrowRight");
  await expect(page.locator(".sar-compare-frame")).toHaveAttribute("style", /--pos:\s*31%/);
});
