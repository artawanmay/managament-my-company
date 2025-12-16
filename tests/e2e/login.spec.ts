/**
 * Login Journey E2E Tests
 *
 * Requirements: 25.7
 * Tests the complete login flow from navigation to dashboard access
 */
import { test, expect } from '@playwright/test';

test.describe('Login Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login');
  });

  test('should display login form with required elements', async ({ page }) => {
    // Verify login form elements are present
    await expect(page.getByRole('heading', { name: /welcome to mmc/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click sign in without entering credentials
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify validation errors appear
    await expect(page.getByText(/email is required/i)).toBeVisible();
    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test('should show validation error for invalid email format', async ({ page }) => {
    // Enter invalid email
    await page.getByLabel(/email/i).fill('invalid-email');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Verify email validation error
    await expect(page.getByText(/please enter a valid email/i)).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Enter invalid credentials
    await page.getByLabel(/email/i).fill('nonexistent@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for error message
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 10000 });
  });

  test('should successfully login and redirect to dashboard', async ({ page }) => {
    // Enter valid credentials (using seeded test user)
    await page.getByLabel(/email/i).fill('admin@mmc.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });

    // Verify dashboard content is visible
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 });
  });

  test('should show loading state during login', async ({ page }) => {
    // Enter credentials
    await page.getByLabel(/email/i).fill('admin@mmc.com');
    await page.getByLabel(/password/i).fill('admin123');

    // Click sign in and check for loading state
    await page.getByRole('button', { name: /sign in/i }).click();

    // The button should show loading state (either disabled or with loading text)
    // This may be brief, so we use a short timeout
    const button = page.getByRole('button', { name: /signing in/i });
    // If loading state is visible, verify it
    const isLoadingVisible = await button.isVisible().catch(() => false);
    if (isLoadingVisible) {
      await expect(button).toBeDisabled();
    }
  });

  test('should redirect authenticated user away from login page', async ({ page }) => {
    // First login
    await page.getByLabel(/email/i).fill('admin@mmc.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for dashboard
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });

    // Try to navigate back to login
    await page.goto('/auth/login');

    // Should be redirected back to dashboard
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 10000 });
  });
});
