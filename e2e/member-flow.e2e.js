// The member flow from plan item E3 30, in a real browser: sign up, sign
// in, add a first gecko, log a feeding, weigh it, start a transfer to a buyer, then
// archive the gecko as sold and send it to the buyer from the step that
// follows, with no console errors along the way. Supabase is the
// in-browser fake in support/fake-supabase.js, so the test also checks
// what the app wrote: the gecko, the feeding row, the transfer requests
// and the funnel events. The sold step warns before it replaces the link
// already emailed, and it never makes the gecko public.
import { expect, test } from '@playwright/test';
import { createFakeSupabase, SIGNUP_CODE } from './support/fake-supabase.js';
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

    // Confirm with the 6-digit code from the email, without leaving the
    // tab (experience review WP-12).
    await page.getByLabel('6-digit code').fill(SIGNUP_CODE);
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();

    // The first screen asks keeper or breeder as part of the page. Nothing
    // pops up over it.
    await expect(page.getByRole('heading', { name: 'How do you keep your crested geckos?' })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
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

  await test.step('weigh in from My Geckos, on the same log screen', async () => {
    // The Weigh-in button opens the log screen for every active gecko
    // (experience review WP-4); it used to open a window of its own.
    await page.goto('/MyGeckos');
    // One button in the toolbar on a laptop, another beside Add Gecko on a phone.
    await page.getByRole('button', { name: 'Weigh-in', exact: true }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/log\?type=weight&all=1/);
    await expect(page.getByText(/^last: 18\.5 g/)).toBeVisible();
    await page.getByLabel('Weight of Mango in grams').fill('19');
    await page.getByRole('button', { name: 'Save 1 weight' }).click();
    await expect(page.getByText('19 g, saved')).toBeVisible();

    const weights = fake.table('weight_records');
    expect(weights).toHaveLength(2);
    expect(weights.at(-1)).toMatchObject({ gecko_id: mango().id, weight_grams: 19, client_request_id: expect.any(String) });
    expect(mango().weight_grams).toBe(19);
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

    // The sold sheet carries on from the sale just saved (its step 1) with
    // its second and last step, the hand-over, which can be skipped. The
    // link emailed to the buyer a moment ago is still open, so the step
    // says plainly that a new one replaces it and offers to keep it. The
    // sheet says nothing about a passport or going public: a public gecko
    // shows its sold price to other members.
    const sheet = page.getByRole('dialog', { name: 'Sell and hand over Mango' });
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-sell-step-state]')).toHaveCount(2);
    await expect(sheet.locator('[data-sell-step-state="done"]')).toHaveCount(1);
    await expect(sheet.locator('[data-sell-step="passport"]')).toHaveCount(0);
    await expect(sheet.getByText(/passport|public/i)).toHaveCount(0);
    const step = sheet.locator('[data-sell-step="handover"]');
    await expect(step.getByRole('heading', { name: 'Send Mango to the buyer' })).toBeVisible();
    await expect(step.getByText(new RegExp(`You already emailed ${BUYER} a transfer link for Mango on [A-Z][a-z]+ \\d{1,2}\\.`))).toBeVisible();
    await expect(step.getByText('A new link replaces it, and the one you sent stops working.', { exact: false })).toBeVisible();
    await expect(step.getByRole('button', { name: 'Keep the link I sent' })).toBeVisible();
    await expect(step.getByText(/passport|public/i)).toHaveCount(0);
    expect(mango()).toMatchObject({ archived: true, archive_reason: 'sold', status: 'Sold' });
    // What Mango sold for is kept apart from its row, which every signed-in
    // member can read once a gecko is public; the column itself reads null.
    expect(mango().sold_price ?? null).toBeNull();
    expect(fake.table('gecko_sale_prices')).toEqual([expect.objectContaining({ gecko_id: mango().id, sold_price: 300 })]);
    // Showing the step changes nothing: the emailed link is still pending.
    expect(fake.table('transfer_requests').map((t) => t.status)).toEqual(['pending']);
    await step.getByRole('button', { name: 'Send a new link' }).click();

    // The usual transfer form, in the same sheet, with the sale price
    // carried over and the warning repeated next to the button that
    // replaces the link.
    const transfer = step;
    await expect(transfer.getByRole('heading', { name: 'Transfer Mango' })).toBeVisible();
    await expect(transfer.getByLabel('Sale price (optional)')).toHaveValue('300');
    await expect(transfer.getByText('This replaces the link you sent on', { exact: false })).toBeVisible();
    await transfer.getByRole('button', { name: 'Create QR link' }).click();
    await expect(page.getByText('Transfer started')).toBeVisible();

    // Only the transfer was made: no passport, and Mango stays private.
    expect(mango().passport_code ?? null).toBeNull();
    expect(mango().is_public ?? false).toBe(false);
    const latest = fake.table('transfer_requests').at(-1);
    expect(latest).toMatchObject({ animal_id: mango().id, claim_mode: 'link', sale_price: 300, status: 'pending' });
    // The emailed link was replaced, after the member was told and chose to.
    expect(fake.table('transfer_requests').map((t) => t.status)).toEqual(['cancelled', 'pending']);

    // The funnel events, with no email, name or code in them, and no
    // passport_created: the sheet never makes one.
    const funnel = ['sold_transfer_step', 'passport_created', 'transfer_started'];
    // Events are written after the page is idle, so wait for the last one.
    await expect.poll(() => fake.table('user_events')
      .some((e) => e.event_name === 'transfer_started' && e.properties?.surface === 'sold_step')).toBe(true);
    const events = fake.table('user_events').filter((e) => funnel.includes(e.event_name));
    expect(events.map((e) => e.event_name)).not.toContain('passport_created');
    expect(events.map((e) => [e.event_name, e.properties.action || e.properties.surface])).toEqual(expect.arrayContaining([
      ['sold_transfer_step', 'shown'],
      ['sold_transfer_step', 'send'],
      ['transfer_started', 'sold_step'],
    ]));
    const shown = events.find((e) => e.event_name === 'sold_transfer_step' && e.properties.action === 'shown');
    expect(shown.properties).toMatchObject({ has_passport: false, has_price: true, has_pending: true });
    const started = events.find((e) => e.event_name === 'transfer_started' && e.properties.surface === 'sold_step');
    expect(started.properties).toMatchObject({ method: 'link', has_price: true });
    const props = JSON.stringify(events.map((e) => e.properties));
    expect(props).not.toContain(MEMBER.email);
    expect(props).not.toContain(BUYER);
    expect(props).not.toContain('Mango');
  });

  // The whole run, from the sign-up form to the transfer, logged nothing
  // to the console as an error and threw nothing uncaught.
  expect(problems).toEqual([]);

  // After the console check, because requests fail with no signal.
  await test.step('with no signal the signed-in member sees the offline badge', async () => {
    // The badge loads after sign-in, not with the startup script
    // (src/components/shared/MemberOfflineSync.jsx).
    // Close the sold sheet first; while it is open the rest of the
    // page is hidden from screen readers, the badge included.
    await page.getByRole('dialog', { name: 'Sell and hand over Mango' }).getByRole('button', { name: 'Done' }).click();
    const badge = page.getByRole('status').filter({ hasText: /^Offline$/ });
    await context.setOffline(true);
    await expect(badge).toBeVisible();
    // One floating notice at a time (experience review B3): the badge is
    // the only one on screen, and no feedback bubble floats on a phone.
    await expect(page.locator('[data-floating-notice]')).toHaveCount(1);
    await expect(badge).toHaveAttribute('data-floating-notice', 'offline');
    await context.setOffline(false);
    await expect(badge).toHaveCount(0);
  });
});

// A wrong or expired code keeps the member on the screen and says what to
// do. (Its own test: the refused request is a console error, which the
// flow above does not allow.)
test('a wrong sign-up code is refused with a plain message, and a short one is not sent', async ({ context, page }) => {
  const fake = createFakeSupabase();
  await fake.install(context);
  await keepOffline(context);
  await page.goto('/AuthPortal?mode=signup');
  await page.getByLabel('Display name').fill('Robin Keeper');
  await page.getByLabel('Email').fill('robin@example.com');
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Create free account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  const verifyCalls = () => fake.calls.filter((call) => call.path === '/auth/v1/verify').length;
  await page.getByLabel('6-digit code').fill('123');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Type the 6-digit code' })).toBeVisible();
  expect(verifyCalls()).toBe(0);

  await page.getByLabel('6-digit code').fill('111111');
  await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'did not match or has expired' })).toBeVisible();
  expect(verifyCalls()).toBe(1);
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  expect(fake.account('robin@example.com').email_confirmed_at).toBeNull();
});
