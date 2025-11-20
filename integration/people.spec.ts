import { test, expect } from '@playwright/test';

test.describe('People Component', () => {
  test('should load the page and display initial people', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await expect(page.getByText('Sort')).toBeVisible();
    await expect(page.getByText('Create Person')).toBeVisible();

    // Should have initial people loaded (at least 5)
    const listItems = page.locator('.ant-list-item');
    await expect(listItems).toHaveCount(5);
  });

  test('should click sort button multiple times', async ({ page }) => {
    await page.goto('/');

    const sortButton = page.getByRole('button', { name: /Sort/i });
    await expect(sortButton).toBeVisible();

    // Click sort button multiple times
    for (let i = 0; i < 5; i++) {
      await sortButton.click();
      // Wait a bit between clicks
      await page.waitForTimeout(200);
    }

    // Verify button still works
    await expect(sortButton).toBeEnabled();
  });

  test('should create multiple people', async ({ page }) => {
    await page.goto('/');

    const createButton = page.getByRole('button', { name: 'Create Person' });
    await expect(createButton).toBeVisible();

    // Get initial count
    const initialCount = await page.locator('.ant-list-item').count();

    // Create 3 new people
    for (let i = 0; i < 3; i++) {
      await createButton.click();

      // Wait for at least one "Creating..." text to appear
      await expect(page.getByText('(Creating...)').first()).toBeVisible({ timeout: 1000 });

      // Wait a bit before next creation
      await page.waitForTimeout(500);
    }

    // Wait for all creations to complete (3-5 seconds each)
    await page.waitForTimeout(6000);

    // Should have more people now
    const newCount = await page.locator('.ant-list-item').count();
    expect(newCount).toBeGreaterThan(initialCount);
  });

  test('should update multiple people', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForSelector('.ant-list-item');

    // Click on multiple update buttons (get fresh selectors each time)
    for (let i = 0; i < 3; i++) {
      // Get all "Update" buttons (excluding ones that are already updating)
      const updateButtons = page.getByRole('button', { name: 'Update', exact: true });
      const count = await updateButtons.count();

      if (count === 0) break; // No more buttons to click

      // Click the first available update button
      await updateButtons.first().click();

      // Wait for at least one "Updating…" text to appear
      await expect(page.getByText('Updating', { exact: false }).first()).toBeVisible({ timeout: 2000 });

      // Wait a bit before clicking next
      await page.waitForTimeout(500);
    }
  });

  test('should delete people', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForSelector('.ant-list-item');

    const initialCount = await page.locator('.ant-list-item').count();

    // Get all delete buttons and click the first 2
    const deleteButtons = page.getByRole('button', { name: /Delete/ });
    const deleteCount = Math.min(await deleteButtons.count(), 2);

    for (let i = 0; i < deleteCount; i++) {
      // Always get the first delete button since items shift after deletion
      const button = page.getByRole('button', { name: 'Delete' }).first();
      await button.click();

      // Wait for at least one "Deleting" text to appear
      await expect(page.getByText('Deleting').first()).toBeVisible({ timeout: 1000 });

      // Wait a bit before next deletion
      await page.waitForTimeout(500);
    }

    // Wait for deletions to complete
    await page.waitForTimeout(6000);

    // Should have fewer people now
    const newCount = await page.locator('.ant-list-item').count();
    expect(newCount).toBeLessThan(initialCount);
  });

  test('stress test: lots of clicking on various items', async ({ page }) => {
    await page.goto('/');

    // Wait for page to load
    await page.waitForSelector('.ant-list-item');

    // Click sort button multiple times
    const sortButton = page.getByRole('button', { name: /Sort/i });
    for (let i = 0; i < 10; i++) {
      await sortButton.click();
      await page.waitForTimeout(100);
    }

    // Create 5 people
    const createButton = page.getByRole('button', { name: 'Create Person' });
    for (let i = 0; i < 5; i++) {
      await createButton.click();
      await page.waitForTimeout(300);
    }

    // Update multiple people
    const updateButtons = page.getByRole('button', { name: 'Update' });
    const updateCount = Math.min(await updateButtons.count(), 4);
    for (let i = 0; i < updateCount; i++) {
      await updateButtons.nth(i).click();
      await page.waitForTimeout(200);
    }

    // More sorting
    for (let i = 0; i < 5; i++) {
      await sortButton.click();
      await page.waitForTimeout(100);
    }

    // Delete 3 people
    for (let i = 0; i < 3; i++) {
      const button = page.getByRole('button', { name: 'Delete' }).first();
      await button.click();
      await page.waitForTimeout(300);
    }

    // Wait for all operations to complete
    await page.waitForTimeout(7000);

    // Verify the page is still functional
    await expect(sortButton).toBeEnabled();
    await expect(createButton).toBeEnabled();
  });
});
