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
  // The answer comes first: what you own, and what's missing.
  await expect(page.getByText('Own 5 · Missing 4')).toBeVisible();
  await page.getByRole('radio', { name: /^Missing/ }).click();
  // The verdict's "Missing 4" and the one missing row's.
  await expect(page.getByText('Missing 4', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'Copy missing' }).click();
  await expect(page.getByText('Copied 4 missing cards (Sim format).')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('4xOP01-004');

  // Deck depth: legality (these are Block 1 cards), the profile, a test hand and the visual list.
  await expect(page.getByText(/^Not Standard legal: \d cards are outside Blocks 2, 3, 4, 5/)).toBeVisible();
  await expect(page.getByText('Deck profile')).toBeVisible();
  await expect(page.getByLabel(/^Counter: \+/)).toBeVisible();
  await page.getByRole('button', { name: 'Draw a hand' }).click();
  await expect(page.getByRole('button', { name: 'New hand' })).toBeVisible();
  await expect(page.getByLabel('5 life cards')).toBeVisible();
  await page.getByRole('radio', { name: 'All' }).click();
  await page.getByRole('radio', { name: 'Cards' }).click();
  await expect(page.getByText('×4').first()).toBeVisible();

  // The card page lists the decks that use a card, and what's missing for each.
  await page.goto('/card/OP01-004');
  await expect(page.getByText('In 1 of your decks')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Red Zoro test, ×4' })).toBeVisible();

  // A deck's missing cards go on the wishlist in one tap.
  await page.goto('/decks');
  await page.getByText('Red Zoro test').first().click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Add missing to wishlist' }).click();
  await expect(page.getByText('1 card added to your wishlist.')).toBeVisible();
  await page.getByRole('button', { name: 'View' }).click();
  await expect(page.getByText('Usopp').first()).toBeVisible();
  await expect(page.getByText('want 4 · own 0')).toBeVisible();

  // Meta decks: how much of each you own, the best pickups, and your deck compared with the meta list.
  await page.goto('/decks');
  await page.getByRole('link', { name: 'Meta decks' }).click();
  await expect(page.getByText('What can you build')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Red Zoro, E2E Regionals, Winner of 256, own 5 of 13$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Usopp, OP01-004\. In 1 meta deck\. 4 copies to get$/ })).toBeVisible();
  await page.getByRole('link', { name: /^Red Zoro, E2E Regionals/ }).click();
  await expect(page.getByText('Missing 8')).toBeVisible();
  await page.getByRole('button', { name: 'Save as my deck' }).click();
  await expect(page.getByText('Saved to your decks.')).toBeVisible();
  // The saved copy matches the meta list exactly.
  await expect(page.getByText('Your list matches this meta list card for card.')).toBeVisible();
  // Robin's own list is the meta list without its 4 Zoro.
  await page.goto('/decks');
  await page.getByText('Red Zoro test').first().click();
  await expect(page.getByText('Compared with the meta')).toBeVisible();
  await expect(page.getByText('9 of 13 cards in common.')).toBeVisible();
  await expect(page.getByText('Roronoa Zoro', { exact: true }).first()).toBeVisible();
});
