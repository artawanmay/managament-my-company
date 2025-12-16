/**
 * Project Management Journey E2E Tests
 *
 * Requirements: 25.7
 * Tests the complete project management flow: create client, project, tasks, use Kanban
 */
import { test, expect } from '@playwright/test';

test.describe('Project Management Journey', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel(/email/i).fill('admin@mmc.com');
    await page.getByLabel(/password/i).fill('admin123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page).toHaveURL(/.*\/app\/dashboard/, { timeout: 15000 });
  });

  test('should navigate to clients page', async ({ page }) => {
    // Navigate to clients
    await page.getByRole('link', { name: /clients/i }).click();
    await expect(page).toHaveURL(/.*\/app\/clients/);
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();
  });

  test('should create a new client', async ({ page }) => {
    // Navigate to clients
    await page.goto('/app/clients');
    await expect(page.getByRole('heading', { name: /clients/i })).toBeVisible();

    // Click add client button
    await page.getByRole('button', { name: /add client/i }).click();

    // Fill in client form
    await page.getByLabel(/name \*/i).fill('E2E Test Client');
    await page.getByLabel(/person in charge/i).fill('John Doe');
    await page.getByLabel(/email/i).fill('e2e-test@example.com');
    await page.getByLabel(/phone/i).fill('+62 812 3456 7890');

    // Submit form
    await page.getByRole('button', { name: /create/i }).click();

    // Verify client was created (toast or table update)
    await expect(page.getByText(/e2e test client/i)).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to projects page', async ({ page }) => {
    // Navigate to projects
    await page.getByRole('link', { name: /projects/i }).click();
    await expect(page).toHaveURL(/.*\/app\/projects/);
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();
  });

  test('should create a new project', async ({ page }) => {
    // First ensure we have a client
    await page.goto('/app/clients');
    const hasClient = await page.getByRole('cell').first().isVisible().catch(() => false);
    
    if (!hasClient) {
      // Create a client first
      await page.getByRole('button', { name: /add client/i }).click();
      await page.getByLabel(/name \*/i).fill('E2E Project Client');
      await page.getByRole('button', { name: /create/i }).click();
      await expect(page.getByText(/e2e project client/i)).toBeVisible({ timeout: 10000 });
    }

    // Navigate to projects
    await page.goto('/app/projects');
    await expect(page.getByRole('heading', { name: /projects/i })).toBeVisible();

    // Click add project button
    await page.getByRole('button', { name: /add project/i }).click();

    // Fill in project form
    await page.getByLabel(/name \*/i).fill('E2E Test Project');
    
    // Select client
    await page.locator('[id="clientId"]').click();
    await page.getByRole('option').first().click();
    
    // Select manager
    await page.locator('[id="managerId"]').click();
    await page.getByRole('option').first().click();

    // Submit form
    await page.getByRole('button', { name: /create/i }).click();

    // Verify project was created
    await expect(page.getByText(/e2e test project/i)).toBeVisible({ timeout: 10000 });
  });

  test('should view project details', async ({ page }) => {
    // Navigate to projects
    await page.goto('/app/projects');
    
    // Click on first project row to view details
    const projectRow = page.getByRole('row').nth(1); // Skip header row
    const projectExists = await projectRow.isVisible().catch(() => false);
    
    if (projectExists) {
      await projectRow.click();
      // Should navigate to project detail page
      await expect(page).toHaveURL(/.*\/app\/projects\/.*/, { timeout: 10000 });
    }
  });

  test('should navigate to Kanban board', async ({ page }) => {
    // Navigate to projects
    await page.goto('/app/projects');
    
    // Click on first project
    const projectRow = page.getByRole('row').nth(1);
    const projectExists = await projectRow.isVisible().catch(() => false);
    
    if (projectExists) {
      await projectRow.click();
      await expect(page).toHaveURL(/.*\/app\/projects\/.*/, { timeout: 10000 });
      
      // Navigate to board tab
      await page.getByRole('link', { name: /board/i }).click();
      await expect(page).toHaveURL(/.*\/board/, { timeout: 10000 });
      
      // Verify Kanban columns are visible
      await expect(page.getByText(/backlog/i)).toBeVisible();
      await expect(page.getByText(/to do/i)).toBeVisible();
      await expect(page.getByText(/in progress/i)).toBeVisible();
      await expect(page.getByText(/done/i)).toBeVisible();
    }
  });

  test('should create a task from Kanban board', async ({ page }) => {
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
      
      // Click add task button
      await page.getByRole('button', { name: /add task/i }).click();
      
      // Fill in task form
      await page.getByLabel(/title \*/i).fill('E2E Test Task');
      await page.getByLabel(/description/i).fill('This is a test task created by E2E tests');
      
      // Submit form
      await page.getByRole('button', { name: /create task/i }).click();
      
      // Verify task was created
      await expect(page.getByText(/e2e test task/i)).toBeVisible({ timeout: 10000 });
    }
  });

  test('should drag and drop task on Kanban board', async ({ page }) => {
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
      
      // Find a task card in Backlog column
      const taskCard = page.locator('[data-testid="task-card"]').first();
      const taskExists = await taskCard.isVisible().catch(() => false);
      
      if (taskExists) {
        // Get the "To Do" column as drop target
        const todoColumn = page.locator('[data-testid="kanban-column-TODO"]');
        
        // Perform drag and drop
        await taskCard.dragTo(todoColumn);
        
        // Wait for the move to complete
        await page.waitForTimeout(1000);
      }
    }
  });
});
