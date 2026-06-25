import { expect, test } from '@playwright/test';

/**
 * Smoke test: the app loads, the Explore tab is active, and the Cytoscape
 * canvas renders something (a <canvas> element) for the demo project.
 * Requires the backend running on :8000 with the demo project seeded.
 */
test('Explore view renders the graph canvas', async ({ page }) => {
  await page.goto('/');

  // Brand + tabs are present.
  await expect(page.getByText('Weave')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Explore' })).toBeVisible();

  // The Cytoscape host mounts a <canvas> once the graph has loaded.
  const host = page.getByTestId('cy-canvas');
  await expect(host).toBeVisible({ timeout: 15_000 });
  await expect(host.locator('canvas').first()).toBeVisible({ timeout: 15_000 });

  // The legend of node kinds is shown over the canvas.
  await expect(page.getByLabel('Node kind legend')).toBeVisible();
});
