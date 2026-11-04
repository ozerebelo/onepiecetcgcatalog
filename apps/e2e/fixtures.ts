import { expect, test as base, type Page } from '@playwright/test';

import type { USERS } from './env';

const COLORS = ['#D7263D', '#2E9E5B', '#2D6CDF', '#8E44AD', '#4A4A4F', '#E0B000'];

/** Stand-in for an official card image (the official site refuses images embedded elsewhere). */
function placeholder(url: string) {
  const code = decodeURIComponent(url.split('/').pop()?.split('.')[0] ?? 'card');
  const color = COLORS[[...code].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="838"><rect width="600" height="838" rx="24" fill="${color}"/>
    <text x="300" y="700" font-family="Arial" font-size="56" font-weight="700" fill="#fff" text-anchor="middle">${code}</text></svg>`;
}

type Fixtures = {
  /** Console errors matching one of these don't fail the test (push a pattern, e.g. for an expected HTTP 400). */
  allowedConsoleErrors: RegExp[];
  guard: void;
};

/**
 * Every test: official images answered with placeholders, and any console error or uncaught page
 * error fails the test unless the test allowed it.
 */
export const test = base.extend<Fixtures>({
  allowedConsoleErrors: async ({}, use) => use([]),
  guard: [
    async ({ page, allowedConsoleErrors }, use) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !allowedConsoleErrors.some((p) => p.test(m.text()))) problems.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
      page.on('dialog', (d) => d.accept());
      await page.route(/onepiece-cardgame\.com/, (route) =>
        route.fulfill({ status: 200, contentType: 'image/svg+xml', body: placeholder(route.request().url()) }),
      );
      await use();
      expect(problems, 'no console or page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

type User = (typeof USERS)[keyof typeof USERS];

export async function signIn(page: Page, user: User) {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(`Signed in as ${user.email}`).first()).toBeVisible();
}

/** Lists are virtualised: scroll with the mouse wheel until `text` is rendered. */
export async function scrollUntil(page: Page, text: string | RegExp) {
  const size = page.viewportSize() ?? { width: 390, height: 844 };
  await page.mouse.move(size.width / 2, size.height * 0.7);
  for (let i = 0; i < 80; i++) {
    if (await page.getByText(text).filter({ visible: true }).count()) return;
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(100);
  }
  throw new Error(`Never scrolled to ${text}`);
}
