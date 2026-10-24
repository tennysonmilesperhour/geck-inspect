import { expect, test } from '@playwright/test';
import { createFakeSupabase } from './support/fake-supabase.js';

const email = 'home-review@example.com';
const today = new Date().toISOString();
const year = new Date().getFullYear();

async function openDashboard(context, page, tier) {
  const fake = createFakeSupabase({
    seed: {
      geckos: [{ id: '00000000-0000-4000-8000-000000000501', name: 'Mango', created_by: email, asking_price: 400, archived: false, created_date: today, updated_date: today }],
      eggs: [{ id: 'egg-1', created_by: email, lay_date: `${year}-03-01`, status: 'Hatched', archived: true }],
      notifications: [{ id: 'event-1', user_email: email, is_read: false, type: 'new_reply', link: '/ForumPost?id=post-1', content: 'A new reply', created_date: today }],
    },
    rpc: { trait_value_table: () => [{ trait: 'Dalmatian', aliases: ['dalmatian'], age_class: 'hatchling', sex_class: 'unsexed', n: 100, p25: 100, p50: 150, p75: 200 }] },
  });
  await fake.install(context);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost|e2e\.supabase\.test)/, (route) => route.fulfill({ status: 204, body: '' }));
  await context.addInitScript(() => {
    localStorage.setItem('geck_inspect_tutorial_seen', '1');
    localStorage.setItem('geck_inspect_role_chosen', '1');
  });
  await page.goto('/AuthPortal?mode=signup');
  await page.getByLabel('Display name').fill('Sam Keeper');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('test-only-passphrase');
  const response = page.waitForResponse((res) => res.url().includes('/auth/v1/signup'));
  await page.getByRole('button', { name: 'Create free account' }).click();
  const user = await (await response).json();
  fake.table('gecko_images').push({ id: 'photo-1', owner_profile_id: user.id, primary_morph: 'harlequin', image_url: '/gecko-placeholders/celestial-adult-1024.webp', photo_is_illustrative: true, created_date: today });
  fake.table('profiles').push({ id: user.id, email, full_name: 'Sam Keeper', membership_tier: tier, role: 'user', onboarding_role: 'breeder', onboarding_completed_at: today, created_date: today });
  await page.getByRole('button', { name: 'Back to sign in' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('test-only-passphrase');
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page).toHaveURL(/\/(MyGeckos|Today)/);
  await page.goto('/Dashboard');
  await expect(page.getByRole('heading', { name: 'Your geckos', exact: true })).toBeVisible();
  return fake;
}

test('free home preserves modules and offers paid values without loading their data', async ({ context, page }, testInfo) => {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  const fake = await openDashboard(context, page, 'free');
  await page.locator('#home-community .tile').first().click();
  await expect(page.getByRole('dialog', { name: 'Illustrative photo' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Collection estimated value and season projected value on your homepage are included with paid plans.')).toBeVisible();
  expect(fake.calls.some((call) => call.path.endsWith('/trait_value_table'))).toBe(false);
  for (const heading of ['Community', 'Breeding & tools', 'Your Hatchery']) {
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Customize home' }).click();
  await page.getByRole('checkbox', { name: 'Community Pulse' }).uncheck();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.locator('#home-workspace').getByText('Community Pulse', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#home-workspace').getByText('Community Pulse', { exact: true })).toHaveCount(0);
  await expect(page.locator('#home-workspace').getByText('Today', { exact: true })).toBeVisible();
  if (testInfo.project.name === 'chromium') {
    const rail = page.locator('.desktop-sidebar-wrapper');
    const forum = rail.locator('[data-tutorial-id="Forum"]');
    await expect(forum).toHaveAttribute('data-new-events', 'true');
    await expect(rail).toHaveClass(/is-collapsed/);
    await expect(forum.locator('.nav-event-count')).toBeHidden();
    await expect(forum.locator('svg').first()).toHaveCSS('animation-name', 'nav-event-gold');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(forum.locator('svg').first()).toHaveCSS('animation-name', 'none');
    await forum.hover();
    await expect(rail).not.toHaveClass(/is-collapsed/);
    await expect(forum.locator('.nav-event-count')).toHaveText('1');
    await expect(forum.locator('.nav-event-count')).toBeVisible();
  } else {
    await page.getByRole('button', { name: 'More: open the full menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Menu' }).locator('[data-tutorial-id="Forum"] .nav-event-count')).toHaveText('1');
    await page.keyboard.press('Escape');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(problems).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('home-free.png'), fullPage: true });
  await page.getByRole('button', { name: 'Notifications', exact: true }).click();
  await page.getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect(page.locator('[data-tutorial-id="Forum"][data-new-events]')).toHaveCount(0);
  await expect.poll(() => fake.table('notifications')[0].is_read).toBe(true);
});

test('paid home uses actual collection values and editable season assumptions', async ({ context, page }, testInfo) => {
  const problems = [];
  page.on('pageerror', (error) => problems.push(error.message));
  const fake = await openDashboard(context, page, 'keeper');
  const portfolio = page.getByRole('link', { name: /Collection estimated value/ });
  await expect(portfolio).toContainText('$400');
  await expect(portfolio).toHaveAttribute('href', '/Portfolio');
  const projection = page.getByRole('button', { name: /Season projected value/ });
  await expect(projection).toContainText('$100');
  const careBox = await page.locator('#home-workspace').getByText('Today', { exact: true }).boundingBox();
  const valueBox = await projection.boundingBox();
  expect(careBox.y).toBeLessThan(valueBox.y);
  await projection.click();
  await page.getByLabel('Additional planned eggs').fill('10');
  await page.getByLabel('Expected hatch rate (%)').fill('80');
  await page.getByLabel('Average hatchling value (USD)').fill('250');
  await expect(page.getByRole('dialog')).toContainText('≈ $2,250');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(projection).toContainText('$2,250');
  await page.reload();
  await expect(page.getByRole('button', { name: /Season projected value/ })).toContainText('$2,250');
  expect(fake.calls.filter((call) => call.method === 'POST' && call.path === '/rest/v1/collection_valuations')).toHaveLength(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(problems).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('home-paid.png'), fullPage: true });
  await portfolio.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('home-paid-values.png') });
  await page.getByRole('heading', { name: 'Breeding & tools', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('home-breeding.png') });
  fake.table('profiles')[0].membership_tier = 'free';
  await page.reload();
  await expect(page.getByText('Collection estimated value and season projected value on your homepage are included with paid plans.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Collection estimated value/ })).toHaveCount(0);
});
