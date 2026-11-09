import { MAILPIT_URL } from '../env';
import { expect, test } from '../fixtures';

test('sign-in validates the form and shows server errors', async ({ page, allowedConsoleErrors }) => {
  allowedConsoleErrors.push(/status of 400/); // the wrong-password request itself
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Password').fill('secret123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
  await page.getByLabel('Email').fill('zoro@example.com');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid login credentials')).toBeVisible();
});

test('sign-up validates the form', async ({ page }) => {
  await page.goto('/auth/sign-up');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Enter a display name')).toBeVisible();
  await expect(page.getByText('Use at least 8 characters')).toBeVisible();
});

type MailpitSummary = { ID: string; Subject: string };

/** Waits for the newest email to `to` in the local test inbox. */
async function latestEmail(to: string): Promise<{ subject: string; html: string }> {
  for (let i = 0; i < 30; i++) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await search.json()) as { messages: MailpitSummary[] };
    const first = messages[0];
    if (first) {
      const message = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${first.ID}`)).json()) as { HTML: string };
      return { subject: first.Subject, html: message.HTML };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No email to ${to} arrived in ${MAILPIT_URL}`);
}

test('sign-up sends the branded confirmation email and its link signs you in', async ({ page }) => {
  const email = `e2e-signup-${Date.now()}@example.com`;
  await page.goto('/auth/sign-up');
  await page.getByLabel('Display name').fill('Usopp');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('e2e-usopp-password');
  await page.getByLabel('Confirm password').fill('e2e-usopp-password');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Check your email')).toBeVisible();

  const { subject, html } = await latestEmail(email);
  expect(subject).toBe('Confirm your Yonko email');
  expect(html).toContain('Confirm email');
  const link = /href="([^"]+)"/.exec(html)?.[1]?.replace(/&amp;/g, '&');
  expect(link, 'confirmation link in the email').toBeTruthy();

  // The link verifies the address, then returns to /auth/callback, which signs in and opens the account page.
  await page.goto(link!);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
});
