import { expect, scrollUntil, test } from '../fixtures';

// Counts below come from the card data revision CI imports (see .github/workflows/ci.yml).

test('Cards page lists products by section, newest first', async ({ page }) => {
  await page.goto('/cards');
  await expect(page.getByRole('heading', { name: 'Sets & extra boosters' })).toBeVisible();
  await expect(page.getByText(/^\d+ products$/).first()).toBeVisible();
  await page.getByRole('checkbox', { name: 'Sets', exact: true }).click();
  await scrollUntil(page, 'OP-01');
  await expect(page.getByText('Romance Dawn').first()).toBeVisible();
  // The app-wide card language switch: Japanese products only.
  await page.getByRole('radio', { name: 'JP', exact: true }).click();
  await scrollUntil(page, 'PRB-01');
});

test('starter decks and promos come after the sets', async ({ page }) => {
  await page.goto('/cards');
  await page.getByRole('checkbox', { name: 'Starter decks' }).click();
  await expect(page.getByRole('heading', { name: 'Starter decks & promos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sets & extra boosters' })).toHaveCount(0);
});

test('search finds cards and the type filter narrows them', async ({ page }) => {
  await page.goto('/cards');
  await page.getByPlaceholder('Search name, number or type').fill('zoro');
  await expect(page.getByText('39 cards', { exact: true })).toBeVisible();
  await page.getByText('Filters', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Leader' }).first().click();
  await expect(page.getByText('3 cards', { exact: true })).toBeVisible();
});

test('card page shows printings with readable alt-art names', async ({ page }) => {
  await page.goto('/card/OP01-001');
  await expect(page.getByText('Roronoa Zoro').first()).toBeVisible();
  await expect(page.getByText(/^Printings \(\d+\)$/)).toBeVisible();
  await expect(page.getByText('Alt art', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/_p\d/)).toHaveCount(0);
  await page.getByText('Show Japanese text').click();
  await expect(page.getByText('ドン', { exact: false }).first()).toBeVisible();
});

test('set page filters by card type', async ({ page }) => {
  await page.goto('/set/en-569101');
  await expect(page.getByText('Romance Dawn').first()).toBeVisible();
  await expect(page.getByText('OP-01 · Set · English')).toBeVisible();
  const nami = page.getByRole('link', { name: /Nami, OP01-016/ }).first();
  await expect(nami).toBeVisible();
  // On phones the type chips sit behind the Filters button.
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('checkbox', { name: 'Leaders' }).click();
  await expect(page.getByRole('link', { name: /Roronoa Zoro, OP01-001/ }).first()).toBeVisible();
  await expect(nami).toHaveCount(0);
});

test('signed out, the account page invites you to sign in', async ({ page }) => {
  await page.goto('/account');
  await expect(page.getByText('Sign in to start your checklist')).toBeVisible();
});
