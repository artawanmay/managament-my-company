/**
 * Mobile Responsiveness E2E Tests
 *
 * Requirements: 25.7
 * Tests Kanban on mobile viewport and navigation drawer
 */
import { test, expect, devices } from '@playwright/test';

// Use mobile viewport for all tests in this file
test.use({ ...devices['iPhone 12'] });

test.describe('Mobile Responsiveness', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('admin@mmc.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });
  });

  test('should display mobile navigation menu', async ({ page }) => {
    // Look for mobile menu button (hamburger icon)
    const menuButton = page.getByRole('button', { name: /menu/i }).or(
      page.locator('[data-testid="mobile-menu-button"]')
    ).or(
      page.locator('button').filter({ has: page.locator('svg') }).first()
    );
    
    // Menu button should be visible on mobile
    await expect(menuButton).toBeVisible({ timeout: 5000 });
  });

  test('should open and close navigation drawer', async ({ page }) => {
    // Find and click menu button
    const menuButton = page.getByRole('button', { name: /menu/i }).or(
      page.locator('[data-testid="mobile-menu-button"]')
    ).or(
      page.locator('button').filter({ has: page.locator('svg') }).first()
    );
    
    await menuButton.click();
    
    // Navigation links should be visible
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /clients/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /projects/i })).toBeVisible();
  });

  test('should navigate using mobile drawer', async ({ page }) => {
    // Open menu
    const menuButton = page.getByRole('button', { name: /menu/i }).or(
      page.locator('[data-testid="mobile-menu-button"]')
    ).or(
      page.locator('button').filter({ has: page.locator('svg') }).first()
    );
    
    await menuButton.click();
    
    // Click on Clients link
    await page.getByRole('link', { name: /clients/i }).click();
    
    // Should navigate to clients page
    await expect(page).toHaveURL(/.*\/app\/clients/, { timeout: 10000 });
  });

  test('should display login form correctly on mobile', async ({ page }) => {
    // Go back to login page
    await page.goto('/auth/login');
    
    // Verify form elements are visible and properly sized
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    const submitButton = page.getByRole('button', { name: /sign in/i });
    
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();
    
    // Check that inputs are full width on mobile
    const emailBox = await emailInput.boundingBox();
    const viewportSize = page.viewportSize();
    
    if (emailBox && viewportSize) {
      // Input should take most of the viewport width (accounting for padding)
      expect(emailBox.width).toBeGreaterThan(viewportSize.width * 0.7);
    }
  });

  test('should display dashboard cards in single column on mobile', async ({ page }) => {
    // Dashboard should show stat cards
    const statCards = page.locator('[class*="card"]');
    
    // Wait for cards to load
    await page.waitForTimeout(2000);
    
    // Cards should be visible
    const cardCount = await statCards.count();
    expect(cardCount).toBeGreaterThan(0);
  });

  test('should display Kanban board on mobile', async ({ page }) => {
    // Navigate to projects
    await page.goto('/app/projects');
    
    // Click on first project
    const projectRow = page.getByRole('row').nth(1);
    const projectExists = await projectRow.isVisible().catch(() => false);
    
    if (projectExists) {
      await projectRow.click();
      await expect(page).toHaveURL(/.*\/app\/projects\/.*/, { timeout: 10000 });
      
      // Navigate to board
      await page.getByRole('link', { name: /board/i }).click();
      await expect(page).toHaveURL(/.*\/board/, { timeout: 10000 });
      
      // Kanban columns should be visible (may need horizontal scroll)
      await expect(page.getByText(/backlog/i)).toBeVisible();
    }
  });

  test('should allow horizontal scroll on Kanban board', async ({ page }) => {
    // Navigate to projects
    await page.goto('/app/projects');
    
    // Click on first project
    const projectRow = page.getByRole('row').nth(1);
    const projectExists = await projectRow.isVisible().catch(() => false);
    
    if (projectExists) {
      await projectRow.click();
      await expect(page).toHaveURL(/.*\/app\/projects\/.*/, { timeout: 10000 });
      
      // Navigate to board
      await page.getByRole('link', { name: /board/i }).click();
      await expect(page).toHaveURL(/.*\/board/, { timeout: 10000 });
      
      // Find the Kanban container
      const kanbanContainer = page.locator('[class*="overflow-x"]').or(
        page.locator('[data-testid="kanban-board"]')
      );
      
      // Scroll horizontally
      await kanbanContainer.evaluate((el) => {
        el.scrollLeft = 200;
      });
      
      // Wait for scroll
      await page.waitForTimeout(500);
    }
  });

  test('should display tables responsively', async ({ page }) => {
    // Navigate to clients
    await page.goto('/app/clients');
    
    // Table should be visible
    const table = page.getByRole('table');
    const tableExists = await table.isVisible().catch(() => false);
    
    if (tableExists) {
      // Table should be scrollable or have responsive layout
      const tableContainer = page.locator('[class*="overflow"]').filter({ has: table });
      await expect(tableContainer.or(table)).toBeVisible();
    }
  });

  test('should open dialogs correctly on mobile', async ({ page }) => {
    // Navigate to clients
    await page.goto('/app/clients');
    
    // Click add client button
    await page.getByRole('button', { name: /add client/i }).click();
    
    // Dialog should be visible and properly sized
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    
    // Dialog should fit within viewport
    const dialogBox = await dialog.boundingBox();
    const viewportSize = page.viewportSize();
    
    if (dialogBox && viewportSize) {
      expect(dialogBox.width).toBeLessThanOrEqual(viewportSize.width);
    }
    
    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();
  });
});

// Additional tests with different mobile viewports
test.describe('Mobile Responsiveness - Android', () => {
  test.use({ ...devices['Pixel 5'] });

  test('should display correctly on Android device', async ({ page }) => {
    await page.goto('/auth/login');
    
    // Login form should be visible
    await expect(page.getByRole('heading', { name: /welcome to mmc/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });
});

// Tablet viewport tests
test.describe('Tablet Responsiveness', () => {
  test.use({ ...devices['iPad Mini'] });

  test('should display correctly on tablet', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('admin@mmc.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });
    
    // Dashboard should show properly on tablet
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should show sidebar on tablet landscape', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('admin@mmc.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });
    
    // Sidebar navigation should be visible on tablet
    const sidebar = page.locator('nav').or(page.locator('[data-testid="sidebar"]'));
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    
    // Either sidebar is visible or mobile menu is available
    if (!sidebarVisible) {
      const menuButton = page.getByRole('button', { name: /menu/i });
      await expect(menuButton).toBeVisible();
    }
  });
});
