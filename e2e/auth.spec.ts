import { test, expect } from "@playwright/test";

test.describe("Ironlox E2E", () => {
  test("landing page loads and shows auth form", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Ironlox")).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByText("Zero-knowledge password manager")).toBeVisible();
  });

  test("can switch between login and signup", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Create one").click();
    await expect(page.getByText("Create Account")).toBeVisible();
    await expect(page.getByPlaceholder("Your master password")).toBeVisible();

    await page.getByText("Sign in").click();
    await expect(page.getByText("Sign In")).toBeVisible();
  });

  test("shows password strength indicator on signup", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Create one").click();
    const passwordInput = page.getByPlaceholder("Your master password");
    await passwordInput.fill("weak");
    await expect(page.getByText("Weak")).toBeVisible();
    await passwordInput.fill("strongpassword123");
    await expect(page.getByText("Strong")).toBeVisible();
  });
});
