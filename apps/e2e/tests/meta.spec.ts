import { expect, test } from '../fixtures';

test('signed out, the meta is ranked by leader and each leader has its own page', async ({ page }) => {
  await page.goto('/meta');
  await expect(page.getByText('Ranked by their share of top lists. Open a leader for its core cards, builds and results.')).toBeVisible();
  await page.getByRole('link', { name: /^1\. Roronoa Zoro, 1 list, 100% of the meta, 1 win$/ }).click();
  // One list is too few for a core: the page shows the list as played.
  await expect(page.getByRole('heading', { name: 'The list' })).toBeVisible();
  await expect(page.getByText('Sign in to check this list against your collection.')).toBeVisible();
  await expect(page.getByText('Usopp').filter({ visible: true }).first()).toBeVisible();
  // The results link to each list, which credits its source.
  await page.getByRole('link', { name: 'Winner of 256, E2E Regionals' }).click();
  await expect(page.getByRole('link', { name: 'View this list on Example' })).toBeVisible();
});
