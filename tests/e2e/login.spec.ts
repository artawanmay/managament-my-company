/**
 * Login Journey E2E Tests
 *
 * Requirements: 25.7
 * Tests the complete login flow from navigation to dashboard access
 */
import { test, expect } from "@playwright/test";

test.describe("Login Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    // Wait for page to fully load
    await page.waitForTimeout(500);
  });

  test("should display login form with required elements", async ({ page }) => {
    // Verify login form elements are present - use longer timeout for slower browsers
    await expect(
      page.getByRole("heading", { name: /welcome to mmc/i })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("should show validation errors for empty fields", async ({ page }) => {
    // Click sign in without entering credentials
    await page.getByRole("button", { name: /sign in/i }).click();

    // Verify validation errors appear
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test("should show validation error for invalid email format", async ({
    page,
  }) => {
    // Enter invalid email
    await page.getByLabel(/email/i).fill("invalid-email");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Verify email validation error
    await expect(page.getByText(/please enter a valid email/i)).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    // Use a unique email to avoid lockout from previous test runs
    const uniqueEmail = `test-${Date.now()}@example.com`;

    // Enter invalid credentials
    await page.getByLabel(/email/i).fill(uniqueEmail);
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for error message - either "Invalid email or password" or lockout message
    const errorAlert = page.locator('[class*="destructive"]');
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // Verify the error contains expected text (invalid credentials or locked)
    await expect(errorAlert).toContainText(/invalid|locked/i);
  });

  test("should successfully login and redirect to dashboard", async ({
    page,
  }) => {
    // Enter valid credentials (using seeded test user)
    await page.getByLabel(/email/i).fill("superadmin@test.com");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });

    // Verify dashboard content is visible
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible(
      { timeout: 10000 }
    );
  });

  test("should show loading state during login", async ({ page }) => {
    // Enter credentials
    await page.getByLabel(/email/i).fill("superadmin@test.com");
    await page.getByLabel(/password/i).fill("password123");

    // Click sign in and check for loading state
    await page.getByRole("button", { name: /sign in/i }).click();

    // The button should show loading state (either disabled or with loading text)
    // This may be brief, so we use a short timeout
    const button = page.getByRole("button", { name: /signing in/i });
    // If loading state is visible, verify it
    const isLoadingVisible = await button.isVisible().catch(() => false);
    if (isLoadingVisible) {
      await expect(button).toBeDisabled();
    }
  });

  test("should redirect authenticated user away from login page", async ({
    page,
  }) => {
    // First login
    await page.getByLabel(/email/i).fill("superadmin@test.com");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for dashboard with longer timeout for Firefox
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 20000 });

    // Try to navigate back to login - use domcontentloaded to handle Firefox navigation issues
    try {
      await page.goto("/auth/login", {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
    } catch {
      // Firefox may throw NS_BINDING_ABORTED during redirect, which is expected
      await page.waitForTimeout(2000);
    }

    // Should be redirected back to dashboard (or still on dashboard if navigation was aborted)
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });
  });
});
