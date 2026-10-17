import { expect, test } from '@playwright/test';
import { createTransferFixture, installFixture } from './support/transfer-fixture.js';

test.use({ reducedMotion: 'reduce' });

test('the card record groups its actions and keeps care edits when moving between sections', async ({ context, page }, testInfo) => {
  const { fake, owner } = createTransferFixture({ withTransfer: false });
  await installFixture(context, fake, owner);
  await page.goto('/MyGeckos');
  await page.getByRole('button', { name: 'View Mango' }).click();
  const record = page.getByRole('dialog', { name: 'Mango', exact: true });
  await expect(record).toBeVisible();
  await expect(record.getByRole('button', { name: 'Edit Mango' })).toBeVisible();
  await expect(record.getByRole('button', { name: 'Log event', exact: true })).toBeVisible();
  const nav = record.getByRole('navigation', { name: 'Parts of this record' });
  await expect(nav.getByRole('link')).toHaveText(['Overview', 'Care history', 'Breeding', 'Sharing', 'More']);
  await expect(record.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('detail-overview.png'), fullPage: true });

  await nav.getByRole('link', { name: 'Care history', exact: true }).click();
  await expect(record.locator('#record-care-history')).toBeFocused();
  await record.locator('#record-weight-grams').fill('43.2');
  await nav.getByRole('link', { name: 'Sharing', exact: true }).click();
  await expect(record.locator('#record-sharing')).toBeFocused();
  await expect(record.getByRole('heading', { name: 'Sharing and records' })).toBeInViewport();
  await expect(record.getByRole('button', { name: 'Transfer to a new owner' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('detail-sharing.png'), fullPage: true });
  await nav.getByRole('link', { name: 'Care history', exact: true }).click();
  await expect(record.locator('#record-weight-grams')).toHaveValue('43.2');
  expect(fake.table('weight_records')).toHaveLength(1);

  // The record and its controls must fit the viewport on the phone project.
  const overflow = await record.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
  await page.getByRole('button', { name: 'Close the record' }).click();
  await expect(record).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View Mango' })).toBeFocused();
});

test('an owner generates a QR code and can revoke the link from Transfers', async ({ context, page }, testInfo) => {
  const { fake, owner } = createTransferFixture({ withTransfer: false });
  await installFixture(context, fake, owner);
  await page.goto('/MyGeckos');
  await page.getByRole('button', { name: 'View Mango' }).click();
  const record = page.getByRole('dialog', { name: 'Mango', exact: true });
  await record.getByRole('navigation', { name: 'Parts of this record' }).getByRole('link', { name: 'Sharing', exact: true }).click();
  await record.getByRole('button', { name: 'Transfer to a new owner' }).click();
  const dialog = page.getByRole('dialog', { name: 'Transfer Mango', exact: true });
  await dialog.getByRole('button', { name: 'Create QR link', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Transfer started' })).toBeVisible();
  const resultDialog = page.getByRole('dialog', { name: 'Transfer started' });
  await expect(resultDialog.getByRole('img', { name: 'Transfer QR code' })).toBeVisible();
  await expect(resultDialog.getByLabel('Claim link')).toHaveValue(/\/claim\/[a-f0-9]{64}$/);
  const transfer = fake.table('transfer_requests')[0];
  expect(transfer).toMatchObject({ animal_id: 'fixture-mango', claim_mode: 'link', to_email: null, status: 'pending' });
  expect(fake.calls.some((call) => call.path === '/rest/v1/rpc/create_transfer')).toBe(true);
  expect(fake.calls.some((call) => call.path === '/rest/v1/transfer_requests' && call.method === 'POST')).toBe(false);
  expect(fake.table('geckos')[0].created_by).toBe(owner.email);
  await page.screenshot({ path: testInfo.outputPath('owner-qr-link.png'), fullPage: true });
  const overflow = await resultDialog.evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
  await resultDialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Close the record' }).click();
  await page.getByRole('button', { name: 'Transfers', exact: true }).click();
  await page.getByRole('button', { name: 'Show QR code', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Transfer QR code' }).getByRole('img', { name: 'Transfer QR code' })).toBeVisible();
  await page.getByRole('dialog', { name: 'Transfer QR code' }).getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel transfer', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Cancel this transfer?' }).getByRole('button', { name: 'Cancel transfer', exact: true }).click();
  await expect(page.getByText('Transfer cancelled', { exact: true })).toBeVisible();
  expect(transfer.status).toBe('cancelled');
  expect(fake.table('geckos')[0].created_by).toBe(owner.email);
});
