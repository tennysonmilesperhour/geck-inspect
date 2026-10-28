// The guided first gecko by photo (28 Oct 2026), in a real browser: a new
// free member picks "Add by photo" on the empty My Geckos page, adds a top
// and a side photo, says yes on Morph ID's permission step (on the page,
// not a browser pop-up), gets "Add this gecko" straight under the answer
// with no plans card on top, and saves the gecko from the short form with
// one name and "Save and continue". Supabase and Morph ID are the
// in-browser fake in support/fake-supabase.js.
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { createFakeSupabase } from './support/fake-supabase.js';

const MEMBER = { name: 'Sam Keeper', email: 'photo-path@example.com', password: 'correct-horse-battery' };
const PHOTO = fileURLToPath(new URL('../public/logo-96.png', import.meta.url));

// The shape recognize-gecko-morph answers with (its README), for a Lilly
// White on a harlequin base.
const ANALYSIS = {
  assessment_status: 'best_match',
  primary_morph: 'harlequin',
  visual_profile: { pattern_family: 'harlequin', pinning: 'none', banding: 'none', spotting: 'none', white_cream_traits: [] },
  candidate_morphs: [{ morph: 'harlequin', score: 78, why: 'Cream pattern on the flanks and legs.' }],
  genetic_traits: ['lily_white'],
  secondary_traits: [],
  base_color: 'dark_red',
  confidence_score: 78,
  model_signal: 78,
  photo_observations: [],
  evidence_markers: ['Bright white lateral pattern'],
  uncertainty_reasons: [],
  photo_assessment: { subject_is_crested_gecko: true, usable_for_id: true, quality_grade: 'good', issues: [], next_photo_needed: null },
  visual_evidence: { status: 'available', model: 'krthr/clip-embeddings', photo_count: 2, neighbors: [] },
  explanation: 'The white lateral pattern reads as Lilly White on a harlequin base.',
  taxonomy_version: '2026.09.06',
};

function watchConsole(page) {
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('dialog', (dialog) => {
    problems.push(`browser dialog: ${dialog.message()}`);
    dialog.dismiss();
  });
  return problems;
}

async function addPhoto(page, slot) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: new RegExp(`Add ${slot}`) }).click();
  await (await chooser).setFiles(PHOTO);
}

test('a new member adds a first gecko by photo with one name and one tap', async ({ context, page }) => {
  const quota = { remaining: 1 };
  const fake = createFakeSupabase({
    rpc: { morph_id_scans_remaining: () => ({ remaining: quota.remaining, bonus: 0 }) },
    functions: {
      'recognize-gecko-morph': (body) => {
        // The page wakes the photo model while photos are picked; that
        // call sends no photo.
        if (body?.action === 'warm') return { ok: true };
        quota.remaining = 0;
        return { success: true, analysis: ANALYSIS, tier: 'free', credits_remaining: 0 };
      },
    },
  });
  await fake.install(context);
  // Fonts, analytics and beacons are answered empty, so nothing leaves the machine.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost|e2e\.supabase\.test)/, (route) =>
    route.fulfill({ status: 204, body: '' }),
  );
  // Uploaded photos (and their thumbnails) are served back as an image.
  await context.route(/e2e\.supabase\.test\/storage\/v1\/object\/public\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', path: PHOTO, headers: { 'access-control-allow-origin': '*' } }),
  );
  await context.addInitScript(() => {
    localStorage.setItem('geck_inspect_tutorial_seen', '1');
    localStorage.setItem('geck_inspect_role_chosen', '1');
  });
  const problems = watchConsole(page);

  await test.step('sign up and land on the first gecko starter', async () => {
    await page.goto('/AuthPortal?mode=signup');
    await page.getByLabel('Display name').fill(MEMBER.name);
    await page.getByLabel('Email').fill(MEMBER.email);
    await page.getByLabel('Password').fill(MEMBER.password);
    await page.getByRole('button', { name: 'Create free account' }).click();
    await page.getByRole('button', { name: 'Back to sign in' }).click();
    await page.getByLabel('Email').fill(MEMBER.email);
    await page.getByLabel('Password').fill(MEMBER.password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
    await expect(page).toHaveURL(/\/(MyGeckos|Today)/);
    await page.goto('/MyGeckos');
    await expect(page.getByRole('heading', { name: 'Add your first gecko' })).toBeVisible();
    await page.getByRole('link', { name: /Add by photo/ }).click();
    await expect(page).toHaveURL(/\/Recognition/);
    await expect(page.getByText('Your first gecko, step 1 of 3')).toBeVisible();
  });

  await test.step('photos, then the permission step on the page', async () => {
    await addPhoto(page, 'top view');
    await addPhoto(page, 'side view');
    await page.getByRole('button', { name: /Identify morph/ }).click();
    const ask = page.getByRole('region', { name: 'Before we send your photos' });
    await expect(ask).toBeVisible();
    await expect(ask).toContainText('Anthropic');
    await expect(ask).toContainText('Replicate');
    const identified = () => fake.calls.filter((c) => c.path === '/functions/v1/recognize-gecko-morph' && c.body?.action !== 'warm');
    expect(identified()).toHaveLength(0);

    await ask.getByRole('button', { name: /Allow and identify/ }).click();
    await expect(page.getByText('Add this Lilly White to your collection')).toBeVisible();
    expect(identified()).toHaveLength(1);
    expect(identified()[0].body.imageUrls).toHaveLength(2);
    // The answer is not covered by the plans card for the scan just used;
    // the line under it says when the next free one comes.
    await expect(page.getByText("You have used this month's free Morph ID")).toHaveCount(0);
    await expect(page.getByText(/That was this month.s free identification/)).toBeVisible();
  });

  await test.step('one name and Save and continue', async () => {
    await page.getByRole('button', { name: /Add to my collection/ }).first().click();
    await expect(page).toHaveURL(/\/MyGeckos/);
    const form = page.getByRole('dialog');
    await expect(form.getByText('Name your gecko')).toBeVisible();
    await expect(form.getByText('Lilly White', { exact: true })).toBeVisible();
    // The name field is the only one to fill, and it has the focus.
    await expect(form.getByLabel('Name')).toBeFocused();
    await expect(form.getByLabel('Weight today (g)')).toHaveCount(0);
    await page.keyboard.type('Mango');
    await form.getByRole('button', { name: 'Save and continue' }).click();

    // Step 2 of the flow: the parents.
    await expect(page.getByText('Do you know Mango’s parents?')).toBeVisible();
    const geckos = fake.table('geckos');
    expect(geckos).toHaveLength(1);
    expect(geckos[0]).toMatchObject({ name: 'Mango', morphs_traits: 'Lilly White', created_by: MEMBER.email });
    expect(geckos[0].morph_tags).toEqual(expect.arrayContaining(['Lilly White', 'Harlequin']));
    expect(geckos[0].image_urls).toHaveLength(2);
  });

  // No browser pop-up, console error or uncaught error on the way.
  expect(problems).toEqual([]);
});
