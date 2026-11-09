import { USERS } from '../env';
import { expect, signIn, test } from '../fixtures';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('a saved deck is checked against the collection and the missing cards can be copied', async ({ page }) => {
  await signIn(page, USERS.deckbuilder);

  // Own 1 Zoro leader and 4 Nami; the deck also wants 4 Usopp.
  await page.goto('/collection/import');
  await page.getByLabel('Paste your list').fill('1xOP01-001\n4xOP01-016');
  await page.getByRole('button', { name: 'Preview import' }).click();
  await page.getByRole('button', { name: 'Add 5 copies' }).click();
  await expect(page.getByText('Import complete')).toBeVisible();

  await page.goto('/deck/new');
  await page.getByLabel('Deck name').fill('Red Zoro test');
  await page.getByLabel('Decklist').fill('1xOP01-001\n4xOP01-016\n4xOP01-004');
  await expect(page.getByText('You own 5 of these 9 cards.')).toBeVisible();
  await page.getByRole('button', { name: 'Save deck' }).click();

  await expect(page.getByText('Red Zoro test').first()).toBeVisible();
  // The answer comes first: pull what you own, buy the rest.
  await expect(page.getByText('Pull 5')).toBeVisible();
  await expect(page.getByText('Buy 4')).toBeVisible();
  await page.getByRole('radio', { name: /^Missing/ }).click();
  await expect(page.getByText('Need 4').first()).toBeVisible();
  await page.getByRole('button', { name: 'Copy missing' }).click();
  await expect(page.getByText('Copied 4 missing cards (Sim format).')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('4xOP01-004');
});
