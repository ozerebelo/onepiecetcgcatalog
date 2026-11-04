import { expect, test } from '../fixtures';

test('card search pages in more results as you scroll', async ({ page }) => {
  await page.goto('/cards');
  await page.getByText('Filters', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Character' }).first().click();
  await expect(page.getByText(/^\d[\d,]* cards$/).first()).toBeVisible();
  await page.mouse.move(640, 600);
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 4000);
    await page.waitForTimeout(400);
  }
  expect(await page.getByRole('link', { name: /OP\d\d-\d{3}|ST\d\d-\d{3}|EB\d\d-\d{3}|P-\d{3}/ }).count()).toBeGreaterThan(60);
});

test('card page on a wide screen', async ({ page }) => {
  await page.goto('/card/OP01-120');
  await expect(page.getByText('Shanks').first()).toBeVisible();
});

test('the web top bar navigates between tabs', async ({ page }) => {
  await page.goto('/cards');
  await page.getByRole('tab', { name: 'Collection', exact: true }).first().click();
  await expect(page).toHaveURL(/\/collection$/);
  await page.getByRole('tab', { name: 'Decks', exact: true }).first().click();
  await expect(page).toHaveURL(/\/decks$/);
});
