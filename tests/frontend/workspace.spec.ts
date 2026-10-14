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
