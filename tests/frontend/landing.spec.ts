import { expect, test } from "@playwright/test";

test.describe("cinematic landing story", () => {
  test.use({ reducedMotion: "no-preference" });

  // The story only runs with WebGL; headless runners without a GPU get the static hero instead.
  test.beforeEach(async ({ page }) => {
    await page.goto("about:blank");
    const webgl = await page.evaluate(() => Boolean(document.createElement("canvas").getContext("webgl")));
    test.skip(!webgl, "WebGL unavailable in this browser");
  });

  test("renders the chaptered story with a way to skip it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const rail = page.getByRole("navigation", { name: /story chapters/i });
    await expect(rail.getByRole("button")).toHaveCount(8);
    await expect(page.getByRole("link", { name: /skip the story/i })).toHaveAttribute("href", "#capabilities");
  });

  test("chapter rail jumps to the detection chapter", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: /story chapters/i }).getByRole("button", { name: "Detect" }).click();
    await expect(page.getByRole("navigation", { name: /story chapters/i }).getByRole("button", { name: "Detect" })).toHaveAttribute("aria-current", "step");
    await expect(page.getByText(/area and confidence are illustrative/i)).toBeVisible();
  });
});

test("reduced motion keeps the static hero and skips the story", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: /story chapters/i })).toHaveCount(0);
});
