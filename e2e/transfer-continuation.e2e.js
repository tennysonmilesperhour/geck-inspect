import { expect, test } from '@playwright/test';
import { createTransferFixture, installFixture, PRIVATE_MESSAGE, RECIPIENT } from './support/transfer-fixture.js';

test.use({ reducedMotion: 'reduce' });

async function signIn(page, email = RECIPIENT.email, password = RECIPIENT.password) {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
}

async function expectPrivate(page) {
  await expect(page.getByText('Mango', { exact: true })).toHaveCount(0);
  await expect(page.getByText(PRIVATE_MESSAGE)).toHaveCount(0);
  await expect(page.getByText('owner@example.com')).toHaveCount(0);
  await expect(page.getByText('Lilly White Harlequin', { exact: true })).toHaveCount(0);
}

async function expectSuccess(page, fake, recipient) {
  await expect(page.getByRole('link', { name: 'View my collection' })).toBeVisible();
  expect(fake.table('geckos')[0].created_by).toBe(recipient.email);
  expect(fake.table('transfer_requests')[0]).toMatchObject({ status: 'claimed', to_user_id: recipient.id });
  expect(fake.table('weight_records')).toHaveLength(1);
  expect(fake.table('feeding_records')).toHaveLength(1);
}

test('a signed-in recipient explicitly accepts a private QR transfer and sees the existing gecko', async ({ context, page }, testInfo) => {
  const { fake, recipient, token } = createTransferFixture();
  await installFixture(context, fake, recipient);
  await page.goto(`/claim/${token}`);
  await expect(page.getByRole('button', { name: 'Accept ownership' })).toBeVisible();
  await expectPrivate(page);
  expect(fake.calls.filter((call) => call.path.endsWith('/claim_transfer'))).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath('private-claim.png'), fullPage: true });
  await page.getByRole('button', { name: 'Accept ownership' }).click();
  await expectSuccess(page, fake, recipient);
  await page.screenshot({ path: testInfo.outputPath('claim-success.png'), fullPage: true });
  await page.reload();
  await expect(page.getByRole('link', { name: 'View my collection' })).toBeVisible();
  await page.getByRole('link', { name: 'View my collection' }).click();
  await expect(page.getByRole('button', { name: 'View Mango' })).toBeVisible();
});

for (const confirmation of ['token link', 'implicit callback']) {
test(`signup keeps the transfer in the ${confirmation} opened on a fresh device`, async ({ context, page, browser }, testInfo) => {
  const { fake, token } = createTransferFixture();
  await installFixture(context, fake);
  await page.goto(`/claim/${token}`);
  await expect(page.getByRole('link', { name: 'Create account', exact: true })).toBeVisible();
  await expectPrivate(page);
  await page.getByRole('link', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/AuthPortal.*redirect=/);
  await page.getByLabel('Display name').fill('New Recipient');
  await page.getByLabel('Email', { exact: true }).fill('new-recipient@example.com');
  await page.getByLabel('Password', { exact: true }).fill(RECIPIENT.password);
  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const signup = fake.calls.find((call) => call.path === '/auth/v1/signup');
  const callback = new URL(new URLSearchParams(signup.search).get('redirect_to'));
  expect(callback.pathname).toBe('/AuthPortal');
  expect(callback.searchParams.get('redirect')).toBe(`/claim/${token}`);
  await page.screenshot({ path: testInfo.outputPath('signup-confirmation.png'), fullPage: true });

  // No local/session storage crosses to this context. The exact email
  // callback carries continuation through verification and session setup.
  const { viewport, isMobile, hasTouch, deviceScaleFactor, userAgent } = testInfo.project.use;
  // Manual contexts do not inherit Playwright's fixture context options.
  const freshContext = await browser.newContext({ viewport, isMobile, hasTouch, deviceScaleFactor, userAgent, reducedMotion: 'reduce', serviceWorkers: 'block' });
  await installFixture(freshContext, fake);
  const freshPage = await freshContext.newPage();
  const newRecipient = fake.account('new-recipient@example.com');
  if (confirmation === 'token link') {
    const tokenLink = new URL('/AuthPortal', callback.origin);
    tokenLink.search = new URLSearchParams({ token_hash: `confirmation-${newRecipient.id}`, type: 'signup', next: callback.href }).toString();
    await freshPage.goto(tokenLink.href);
  } else {
    const session = fake.confirmAccount(newRecipient.email);
    callback.hash = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: '3600', token_type: 'bearer', type: 'signup' }).toString();
    await freshPage.goto(callback.href);
  }
  await expect(freshPage).toHaveURL(new RegExp(`/claim/${token}$`));
  await expect(freshPage.getByRole('button', { name: 'Accept ownership' })).toBeVisible();
  await expectPrivate(freshPage);
  await freshPage.getByRole('button', { name: 'Accept ownership' }).click();
  await expectSuccess(freshPage, fake, newRecipient);
  await freshContext.close();
});
}

test('a failed password sign-in retains the claim after local continuation storage is lost', async ({ context, page }) => {
  const { fake, recipient, token } = createTransferFixture();
  await installFixture(context, fake);
  await page.goto(`/claim/${token}`);
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await page.evaluate(() => localStorage.removeItem('geck_inspect_post_auth_redirect'));
  await signIn(page, recipient.email, 'wrong-password');
  await expect(page.getByText('Sign in failed', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/AuthPortal.*redirect=/);
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`/claim/${token}$`));
  await page.getByRole('button', { name: 'Accept ownership' }).click();
  await expectSuccess(page, fake, recipient);
});

test('expired email verification preserves the transfer for a successful login retry', async ({ context, page }) => {
  const { fake, recipient, token } = createTransferFixture();
  await installFixture(context, fake);
  const next = `/AuthPortal?redirect=${encodeURIComponent(`/claim/${token}`)}`;
  await page.goto(`/AuthPortal?token_hash=expired-fixture&type=signup&next=${encodeURIComponent(next)}`);
  await expect(page.getByText('That email link has expired or was already used', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/authError=link.*redirect=/);
  await signIn(page);
  await expect(page).toHaveURL(new RegExp(`/claim/${token}$`));
  await page.getByRole('button', { name: 'Accept ownership' }).click();
  await expectSuccess(page, fake, recipient);
});

test('an email-scoped transfer shows details only to the intended signed-in account', async ({ context, page }) => {
  const { fake, token } = createTransferFixture({ mode: 'email' });
  const other = fake.addAccount({ email: 'other@example.com' });
  await installFixture(context, fake, other);
  await page.goto(`/claim/${token}`);
  await expect(page.getByRole('button', { name: 'Accept ownership' })).toBeVisible();
  await expectPrivate(page);
  expect(fake.calls.filter((call) => call.path.endsWith('/claim_transfer'))).toHaveLength(0);
  await page.getByRole('button', { name: 'Accept ownership' }).click();
  await expect(page.getByRole('heading', { name: 'Use the invited account' })).toBeVisible();
  expect(fake.table('transfer_requests')[0].status).toBe('pending');
});

for (const [status, title] of [['expired', 'Transfer expired'], ['cancelled', 'Transfer cancelled'], ['claimed', 'Already claimed']]) {
  test(`a ${status} link gives a clear private terminal state`, async ({ context, page }) => {
    const { fake, recipient, token } = createTransferFixture({ status });
    await installFixture(context, fake, recipient);
    await page.goto(`/claim/${token}`);
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expectPrivate(page);
    await expect(page.getByRole('button', { name: 'Accept ownership' })).toHaveCount(0);
  });
}

test('an unknown token shows no private data or claim action', async ({ context, page }) => {
  const { fake } = createTransferFixture();
  await installFixture(context, fake);
  await page.goto(`/claim/${'b'.repeat(64)}`);
  await expect(page.getByRole('heading', { name: 'Transfer not found' })).toBeVisible();
  await expectPrivate(page);
  await expect(page.getByRole('button', { name: 'Accept ownership' })).toHaveCount(0);
});
