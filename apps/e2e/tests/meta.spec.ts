import { USERS } from '../env';
import { expect, signIn, test } from '../fixtures';

test('signed out, meta decks are public but ownership needs an account', async ({ page }) => {
  await page.goto('/meta');
  await expect(page.getByRole('link', { name: /^Red Zoro, E2E Regionals, Winner of 256/ })).toBeVisible();
  await expect(page.getByText('Sign in to see how much of each deck your collection already covers.')).toBeVisible();
  await page.getByRole('link', { name: /^Red Zoro/ }).click();
  await expect(page.getByText('Sign in to check this list against your collection.')).toBeVisible();
  await expect(page.getByText('Usopp').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View this list on Example' })).toBeVisible();
});
