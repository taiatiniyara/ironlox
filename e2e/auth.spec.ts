import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Ironlox — Auth", () => {
  test("login page loads and shows form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign In")).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByPlaceholder("Your master password")).toBeVisible();
  });

  test("signup page loads and shows form", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByText("Create Account")).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });

  test("can navigate between login and signup", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Create one").click();
    await expect(page).toHaveURL("/signup");
    await page.getByText("Sign in").click();
    await expect(page).toHaveURL("/login");
  });

  test("recovery page loads", async ({ page }) => {
    await page.goto("/login");
    await page.getByText("Use recovery key").click();
    await expect(page).toHaveURL("/recover");
    await expect(page.getByText("Recover Your Account")).toBeVisible();
  });

  test("MFA page loads", async ({ page }) => {
    await page.goto("/mfa");
    await expect(page.getByText("Two-Factor Authentication")).toBeVisible();
  });
});

test.describe("Ironlox — Vault Navigation", () => {
  test("redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/vault");
    await expect(page).toHaveURL("/login");
  });

  test("redirects to login from settings when unauthenticated", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL("/login");
  });

  test("redirects to login from security when unauthenticated", async ({ page }) => {
    await page.goto("/security");
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Ironlox — Import/Export", () => {
  test("import page loads", async ({ page }) => {
    await page.goto("/import");
    await expect(page.getByText("Upload CSV")).toBeVisible();
    await expect(page.getByText("Download Template")).toBeVisible();
  });

  test("export page loads", async ({ page }) => {
    await page.goto("/export");
    await expect(page.getByText("Export Your Data")).toBeVisible();
  });
});

test.describe("Ironlox — Onboarding", () => {
  test("welcome page loads with 3 options", async ({ page }) => {
    await page.goto("/onboarding/welcome");
    await expect(page.getByText("Welcome to Ironlox")).toBeVisible();
    await expect(page.getByText("Add your first password")).toBeVisible();
    await expect(page.getByText("Import from another password manager")).toBeVisible();
    await expect(page.getByText("Try the demo vault")).toBeVisible();
    await expect(page.getByText("Skip for now")).toBeVisible();
  });
});

test.describe("Ironlox — Accessibility (axe-core)", () => {
  test("login page has no critical a11y violations", async ({ page }) => {
    await page.goto("/login");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
  });

  test("signup page has no critical a11y violations", async ({ page }) => {
    await page.goto("/signup");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((v) => v.impact === "critical")).toEqual([]);
  });
});
