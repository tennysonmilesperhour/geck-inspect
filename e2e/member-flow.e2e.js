// The member flow from plan item E3 30, in a real browser: sign up, sign
// in, add a first gecko, log a feeding, start a transfer to a buyer, then
// archive the gecko as sold and send it to the buyer from the step that
// follows, with no console errors along the way. Supabase is the
// in-browser fake in support/fake-supabase.js, so the test also checks
// what the app wrote: the gecko, the feeding row, the transfer requests,
// the passport and the funnel events.
import { expect, test } from '@playwright/test';
import { createFakeSupabase } from './support/fake-supabase.js';
import { openGeckoRecord, transferRpcHandlers } from './support/transfer-fixture.js';

const MEMBER = { name: 'Sam Keeper', email: 'sam@example.com', password: 'correct-horse-battery' };
const BUYER = 'riley@example.com';

// Everything that is not the app or the fake (fonts, analytics, beacons)
// is answered empty, so the run never leaves the machine and a blocked
// request does not show up as a console error.
async function keepOffline(context) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost|e2e\.supabase\.test)/, (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
}

function watchConsole(page) {
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

test('a new member signs up, adds a gecko, logs a feeding, starts a transfer and sends a sold gecko to the buyer', async ({ context, page }) => {
  const fake = createFakeSupabase({ rpc: transferRpcHandlers() });
  await fake.install(context);
  await keepOffline(context);
  const problems = watchConsole(page);

  await test.step('sign up, confirm, sign in', async () => {
    await page.goto('/AuthPortal?mode=signup');
    await page.getByLabel('Display name').fill(MEMBER.name);
    await page.getByLabel('Email').fill(MEMBER.email);
    await page.getByLabel('Password').fill(MEMBER.password);
    await page.getByRole('button', { name: 'Create free account' }).click();
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

    // The fake treats the first sign-in as the confirmed email.
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await page.getByLabel('Email').fill(MEMBER.email);
    await page.getByLabel('Password').fill(MEMBER.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
    await expect(page.getByRole('heading', { name: 'Welcome to Geck Inspect' })).toBeVisible();
    await page.getByRole('button', { name: /I breed them/ }).click();
  });

  await test.step('add a first gecko', async () => {
    await expect(page).toHaveURL(/\/MyGeckos/);
    await expect(page.getByRole('heading', { name: 'Add your first gecko' })).toBeVisible();
    await page.getByRole('button', { name: /Type a name and morph/ }).click();
    const quickAdd = page.getByRole('dialog');
    await quickAdd.getByLabel('Name').fill('Mango');
    await quickAdd.getByRole('radio', { name: 'Female', exact: true }).click();
    await quickAdd.getByLabel('Weight today (g)').fill('18.5');
    await quickAdd.getByLabel('Morph (optional)').fill('Lilly White Harlequin');
    await quickAdd.getByRole('button', { name: 'Save and continue' }).click();

    // Step 2 of the first gecko flow: the parents, by name.
    await expect(page.getByText('Do you know Mango’s parents?')).toBeVisible();
    await page.getByLabel('Sire (father)').fill('Spud');
    await page.getByLabel('Dam (mother)').fill('Harley');
    await page.getByRole('button', { name: 'Save parents' }).click();

    // Step 3: what Mango needs next.
    await expect(page.getByText('What Mango needs next')).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const geckos = fake.table('geckos');
    expect(geckos).toHaveLength(1);
    expect(geckos[0]).toMatchObject({
      name: 'Mango',
      sex: 'Female',
      weight_grams: 18.5,
      morphs_traits: 'Lilly White Harlequin',
      sire_name: 'Spud',
      dam_name: 'Harley',
      created_by: MEMBER.email,
    });
    // The first weigh-in is written with the gecko, in the same save.
    expect(fake.table('weight_records')).toHaveLength(1);
  });

  const mango = () => fake.table('geckos')[0];

  await test.step('log a feeding', async () => {
    // The one-tap link a feeding reminder opens.
    await page.goto(`/log?type=feeding&gecko=${mango().id}`);
    await page.getByRole('button', { name: 'Fed', exact: true }).click();
    await expect(page.getByText('Fed, saved')).toBeVisible();

    const feedings = fake.table('feeding_records');
    expect(feedings).toHaveLength(1);
    expect(feedings[0]).toMatchObject({ animal_id: mango().id, accepted: true, created_by: MEMBER.email });
    // Each log carries a request id, so a retried save is never stored twice.
    expect(feedings[0].client_request_id).toEqual(expect.any(String));
  });

  await test.step('start a transfer to a buyer', async () => {
    await page.goto('/MyGeckos');
    await openGeckoRecord(page, 'Mango');
    // "Transfer Ownership" on the record window; the one-record rework
    // (October 2026) calls it "Transfer to a new owner".
    await page.getByRole('button', { name: /^Transfer (Ownership|to a new owner)$/ }).click();

    const dialog = page.getByRole('dialog', { name: 'Transfer Mango' });
    await dialog.getByRole('button', { name: 'Email a buyer' }).click();
    await dialog.getByLabel("Buyer's email").fill(BUYER);
    await dialog.getByLabel('Sale price (optional)').fill('250');
    await dialog.getByLabel('Message for the buyer (optional)').fill('Eating Pangea well, last weighed at 18.5 g.');
    await dialog.getByRole('button', { name: 'Send transfer' }).click();
    await expect(page.getByText('Transfer started')).toBeVisible();

    const transfers = fake.table('transfer_requests');
    expect(transfers).toHaveLength(1);
    expect(transfers[0]).toMatchObject({
      animal_id: mango().id,
      animal_type: 'gecko',
      to_email: BUYER,
      sale_price: 250,
      created_by: MEMBER.email,
      token: expect.any(String),
    });
    // The buyer is emailed the claim link for that same transfer.
    const emailed = fake.calls.find((c) => c.path === '/functions/v1/send-collection-invite');
    expect(emailed?.body).toEqual({ kind: 'transfer', token: transfers[0].token });
    await page.getByRole('dialog', { name: 'Transfer started' }).getByRole('button', { name: 'Done' }).click();
  });

  await test.step('mark the gecko sold and send it to the buyer from the next step', async () => {
    // Still on Mango's record. Archive as sold, with what it sold for.
    await page.getByRole('button', { name: 'Archive (sold, passed away or other)' }).click();
    const archive = page.getByRole('dialog', { name: 'Archive Mango' });
    await archive.getByRole('button', { name: 'Sold', exact: true }).click();
    await archive.getByLabel('Sold for ($)').fill('300');
    await archive.getByRole('button', { name: 'Archive as sold' }).click();

    // The skippable step: it names the gecko and says the passport goes public.
    const step = page.getByRole('dialog', { name: 'Send Mango to the buyer' });
    await expect(step).toBeVisible();
    await expect(step.getByText('Mango has no passport yet.', { exact: false })).toBeVisible();
    await expect(step.getByRole('button', { name: 'Not now' })).toBeVisible();
    expect(mango()).toMatchObject({ archived: true, archive_reason: 'sold', status: 'Sold', sold_price: 300 });
    // Showing the step makes no passport.
    expect(mango().passport_code ?? null).toBeNull();
    await step.getByRole('button', { name: 'Send to the buyer' }).click();

    // The usual transfer form, with the sale price carried over.
    const transfer = page.getByRole('dialog', { name: 'Transfer Mango' });
    await expect(transfer.getByLabel('Sale price (optional)')).toHaveValue('300');
    await expect(transfer.getByText('Sending makes Mango a passport', { exact: false })).toBeVisible();
    await transfer.getByRole('button', { name: 'Create QR link' }).click();
    await expect(page.getByText('Transfer started')).toBeVisible();

    // Sending made the passport (public, so its link works) and the link.
    expect(mango().passport_code).toMatch(/^GI-\d{4}-[A-Z2-9]{4}$/);
    expect(mango().is_public).toBe(true);
    const latest = fake.table('transfer_requests').at(-1);
    expect(latest).toMatchObject({ animal_id: mango().id, claim_mode: 'link', sale_price: 300, status: 'pending' });
    // The earlier emailed link for Mango was replaced.
    expect(fake.table('transfer_requests').filter((t) => t.status === 'pending')).toHaveLength(1);

    // The funnel events, with no email, name or code in them.
    const funnel = ['sold_transfer_step', 'passport_created', 'transfer_started'];
    // Events are written after the page is idle, so wait for the last one.
    await expect.poll(() => fake.table('user_events')
      .some((e) => e.event_name === 'transfer_started' && e.properties?.surface === 'sold_step')).toBe(true);
    const events = fake.table('user_events').filter((e) => funnel.includes(e.event_name));
    expect(events.map((e) => [e.event_name, e.properties.action || e.properties.surface])).toEqual(expect.arrayContaining([
      ['sold_transfer_step', 'shown'],
      ['sold_transfer_step', 'send'],
      ['passport_created', 'sold_step'],
      ['transfer_started', 'sold_step'],
    ]));
    const started = events.find((e) => e.event_name === 'transfer_started' && e.properties.surface === 'sold_step');
    expect(started.properties).toMatchObject({ method: 'link', has_price: true });
    const props = JSON.stringify(events.map((e) => e.properties));
    expect(props).not.toContain(MEMBER.email);
    expect(props).not.toContain('Mango');
    expect(props).not.toContain(mango().passport_code);
  });

  // The whole run, from the sign-up form to the transfer, logged nothing
  // to the console as an error and threw nothing uncaught.
  expect(problems).toEqual([]);
});
