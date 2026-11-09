import fs from 'node:fs';

import { USERS } from '../env';
import { expect, scrollUntil, signIn, test } from '../fixtures';

// One collector's journey; each step builds on the previous one's collection.
test.describe.configure({ mode: 'serial' });
test.use({ permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true });

const card = (page: import('@playwright/test').Page, name: string, code: string) =>
  page.getByRole('button', { name: new RegExp(`^${name}, ${code}(,|$)`) });

let csvBackup = '';

test('signed out, the collection asks you to sign in', async ({ page }) => {
  await page.goto('/collection');
  await expect(page.getByText('Create a free account to track every card')).toBeVisible();
});

test('a new collection starts empty', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/collection');
  await expect(page.getByText('Nothing ticked off yet')).toBeVisible();
});

test('collect mode on a set page adds and removes copies', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/set/en-569101');
  await expect(page.getByText('You own 0 of 154')).toBeVisible();
  await page.getByRole('switch', { name: 'Tap to collect' }).click();
  await expect(page.getByText('Tap a card to add a copy')).toBeVisible();
  await card(page, 'Roronoa Zoro', 'OP01-001').click();
  await card(page, 'Roronoa Zoro', 'OP01-001').click();
  await card(page, 'Trafalgar Law', 'OP01-002').click();
  await expect(page.getByText('You own 2 of 154')).toBeVisible();
  // The tally strip names the last tap and can undo it.
  await expect(page.getByText(/Added 1 · Trafalgar Law/)).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByText('You own 1 of 154')).toBeVisible();
  await card(page, 'Trafalgar Law', 'OP01-002').click();
  await page.getByRole('button', { name: 'Remove one OP01-002' }).click();
  await expect(page.getByText('You own 1 of 154')).toBeVisible();
  // On phones the filters sit behind one button.
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('radio', { name: 'Missing' }).click();
  await expect(card(page, 'Roronoa Zoro', 'OP01-001')).toHaveCount(0);
});

test('the card page stepper changes the count', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/card/OP01-001');
  await expect(page.getByText('In your collection')).toBeVisible();
  await page.getByRole('button', { name: 'Add one OP01-001' }).click();
  await page.getByRole('button', { name: 'Add one OP01-001' }).click();
  await expect(page.getByText('You own 4 copies of this card')).toBeVisible();
});

test('importing a pasted list previews exactly, then commits', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/collection/import');
  await page.getByLabel('Paste your list').fill('4xOP01-016\n2x OP01-025_p1\n1xOP01-016\n3xOP99-999\nthis is not a card\n1 OP01-001 JP');
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('Check before importing')).toBeVisible();
  const preview = await page.locator('body').innerText();
  expect(preview).toContain('3 printings recognised.');
  // Every change is listed, in copies: 5 Nami, 2 alt-art Zoro, 1 Japanese Zoro.
  expect(preview).toContain('Adds 8 copies across 3 printings.');
  expect(preview).toContain('0 → 5');
  expect(preview).toMatch(/1 card number not found/);
  expect(preview).toContain('OP99-999');
  expect(preview).toMatch(/1 line couldn’t be read/);
  await page.getByRole('button', { name: 'Add 8 copies' }).click();
  await expect(page.getByText('Import complete')).toBeVisible();
  await page.getByRole('button', { name: 'View collection' }).click();
  // English side: 4 × OP01-001 + 5 × OP01-016 + 2 × OP01-025_p1 (the Japanese OP01-001 shows under JP).
  await expect(page.getByText('11 cards ·').first()).toBeVisible();
});

test('exports as CSV and as a list', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/collection');
  await expect(page.getByText('11 cards ·').first()).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
  csvBackup = fs.readFileSync((await download.path())!, 'utf8');
  expect(csvBackup.startsWith('printing_id,quantity,code')).toBe(true);
  expect(csvBackup).toContain('en:OP01-016,5,OP01-016');
  await page.getByRole('button', { name: 'Copy as list' }).click();
  await expect(page.getByText('Copied 4 lines')).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('5x OP01-016 EN Nami');
  expect(clip).toContain('1x OP01-001 JP');
});

test('a CSV backup restores the collection exactly', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/collection/import');
  await page.getByLabel('Paste your list').fill('1xOP01-120');
  await page.getByRole('radio', { name: 'Replace all' }).click();
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('Check before importing')).toBeVisible();
  await expect(page.getByText('This removes 12 copies that are not in your list.')).toBeVisible();
  // Replace all stays disabled until a backup is saved or explicitly skipped.
  await expect(page.getByRole('button', { name: 'Replace my collection' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Continue without a backup' }).click();
  await page.getByRole('button', { name: 'Replace my collection' }).click();
  await expect(page.getByText('Import complete')).toBeVisible();

  await page.goto('/collection/import');
  await page.getByLabel('Paste your list').fill(csvBackup);
  await page.getByRole('radio', { name: 'Replace all' }).click();
  await page.getByRole('button', { name: 'Preview import' }).click();
  await expect(page.getByText('Check before importing')).toBeVisible();
  await page.getByRole('button', { name: 'Download backup (CSV)' }).click();
  await expect(page.getByRole('button', { name: 'Backup downloaded' })).toBeVisible();
  await page.getByRole('button', { name: 'Replace my collection' }).click();
  await expect(page.getByText('Your collection now has 12 cards in 4 printings')).toBeVisible();
});

test('progress shows on the Cards page and the collection is searchable', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/cards');
  await page.getByRole('checkbox', { name: 'Sets', exact: true }).click();
  await scrollUntil(page, '3 / 154 owned');
  await page.goto('/collection');
  await page.getByPlaceholder('Search name, number or type').fill('nami');
  await expect(page.getByText('1 printing · 5 copies')).toBeVisible();
});

test('alt arts count toward the playset: 2 base + 2 alt art is a full playset', async ({ page }) => {
  await signIn(page, USERS.collector);
  // The restored collection holds 2 alt-art OP01-025; add 2 base copies.
  await page.goto('/card/OP01-025');
  await page.getByRole('button', { name: 'Add one OP01-025' }).click();
  await page.getByRole('button', { name: 'Add one OP01-025' }).click();
  await expect(page.getByText('You own 4 copies of this card')).toBeVisible();

  await page.goto('/set/en-569101');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('radio', { name: 'Owned' }).click();
  // Both printings' rows show the card's full playset, each with its own copies.
  await expect(page.getByRole('link', { name: 'Roronoa Zoro, OP01-025, ×2, 4 of 4 for a playset' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Roronoa Zoro, OP01-025 · Alt art, ×2, 4 of 4 for a playset' })).toBeVisible();
  // In English: OP01-025 (2 + 2 alt art), OP01-001 (4) and Nami (5).
  await expect(page.getByText(/Full playsets: 3 of \d+ cards/)).toBeVisible();
});

test('collection filters: art, playset status, set; languages kept apart', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/collection');
  await page.getByRole('button', { name: /^Filters/ }).click();
  await page.getByRole('checkbox', { name: 'Alt art' }).click();
  await expect(page.getByText('1 printing · 2 copies')).toBeVisible();
  // Active filters show above the grid and can be removed one by one.
  await page.getByRole('button', { name: 'Remove filter: Alt art' }).click();
  // More than a playset, in English only: Nami (5). OP01-001 is 4 English + 1 Japanese, which
  // the app keeps apart, so it is exactly a playset.
  await page.getByRole('checkbox', { name: 'More than 4' }).click();
  await expect(page.getByText('1 printing · 5 copies')).toBeVisible();
  await page.getByRole('button', { name: /^Clear/ }).click();
  // The English OP-01 cards; switching the card language shows the Japanese ones instead.
  await page.getByRole('checkbox', { name: /^OP-01 Romance Dawn/ }).click();
  await expect(page.getByText('4 printings · 13 copies')).toBeVisible();
  await page.getByRole('radio', { name: 'JP', exact: true }).click();
  await expect(page.getByText('1 printing · 1 copy')).toBeVisible();
});

test('quick add from card search, with undo', async ({ page }) => {
  await signIn(page, USERS.collector);
  await page.goto('/cards');
  await page.getByPlaceholder('Search name, number or type').fill('OP01-016');
  const add = page.getByRole('button', { name: 'Add a copy of Nami (OP01-016)' });
  const saved = () => page.waitForResponse((r) => r.url().includes('adjust_collection_quantity') && r.ok());
  // +1 adds the English base art; Undo takes it back.
  await Promise.all([saved(), add.click()]);
  await expect(page.getByText('Added 1 · Nami OP01-016 (EN)')).toBeVisible();
  await Promise.all([saved(), page.getByRole('button', { name: 'Undo' }).click()]);
  await Promise.all([saved(), add.click()]);
  await page.goto('/collection');
  await page.getByPlaceholder('Search name, number or type').fill('nami');
  // 5 copies before, +1 −1 +1.
  await expect(page.getByText('1 printing · 6 copies')).toBeVisible();
});
