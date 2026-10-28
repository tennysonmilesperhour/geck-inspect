import { expect, test } from '@playwright/test';
import { createFakeSupabase } from './support/fake-supabase.js';
const email = 'report-review@example.com';
const today = new Date().toISOString();
test('a member can focus and type a report without dismissing its dialog', async ({context, page, isMobile}) => {
  const fake = createFakeSupabase({seed: {forum_posts: [{id:'post-1', title:'QA post', content:'Test content', created_by:'author@example.com', author_name:'Author', created_date:today, approval_status:'approved'}]}});
  await fake.install(context);
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost|e2e\.supabase\.test)/, route => route.fulfill({status:204, body:''}));
  await context.addInitScript(() => {
    localStorage.setItem('geck_inspect_tutorial_seen', '1');
    localStorage.setItem('geck_inspect_role_chosen', '1');
  });
  await context.route('**/__qa_session', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
  await page.goto('/__qa_session');
  await page.evaluate(async (email) => {
    const body = JSON.stringify({email, password:'test-only-passphrase'});
    const options = {method:'POST', headers:{'content-type':'application/json'}, body};
    await fetch('https://e2e.supabase.test/auth/v1/signup', options);
    const session = await (await fetch('https://e2e.supabase.test/auth/v1/token?grant_type=password', options)).json();
    localStorage.setItem('sb-e2e-auth-token', JSON.stringify(session));
  }, email);
  Object.assign(fake.table('profiles')[0], {onboarding_role:'breeder', onboarding_completed_at:today});
  await page.goto('/ForumPost?id=post-1');
  const report = page.getByRole('button', {name:'Report this forum post'});
  if (isMobile) await report.tap(); else await report.click();
  const category = page.getByRole('combobox');
  if (isMobile) await category.tap(); else await category.click();
  await page.getByRole('option', { name: 'Something else', exact: true }).click();
  const field = page.getByLabel('What happened?');
  if (isMobile) await field.tap(); else await field.click();
  await field.pressSequentially('QA test only. No violation.');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(field).toHaveValue('QA test only. No violation.');
  // An outside touch must not discard a report in progress.
  if (isMobile) await page.touchscreen.tap(4, 4); else await page.mouse.click(4, 4);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(field).toHaveValue('QA test only. No violation.');
  await page.getByRole('button', {name:'Submit report', exact:true}).click();
  await expect(page.getByText('Report sent', {exact:true})).toBeVisible();
  expect(fake.table('content_reports')).toHaveLength(1);
  expect(fake.table('content_reports')[0].reason).toBe('QA test only. No violation.');
  await report.click();
  await page.getByRole('button', {name:'Close', exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The signed-in forum page names its columns and never asks for the
  // author's email (Part E item E1 4); likes come from forum_like_state.
  const forumReads = fake.calls.filter((c) => c.method === 'GET' && /^\/rest\/v1\/forum_(posts|comments|likes)$/.test(c.path));
  expect(forumReads.length).toBeGreaterThan(0);
  for (const read of forumReads) {
    expect(new URLSearchParams(read.search).get('select')).not.toMatch(/^\*$|created_by|user_email/);
  }
  expect(fake.calls.some((c) => c.path === '/rest/v1/rpc/forum_like_state')).toBe(true);
});
