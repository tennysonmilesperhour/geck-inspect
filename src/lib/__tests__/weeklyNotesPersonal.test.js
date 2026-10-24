// Weekly Gecko Notes that fit the member: seasons, audiences and the lead
// built from the member's record, plus the one-time re-permission email.
// docs/marketing/email-brain.md, sections 5 and 6.
import { describe, expect, it } from 'vitest';
import * as lifecycleCopy from '../../../supabase/functions/_shared/lifecycle-copy.ts';
import * as weeklyNotes from '../../../supabase/functions/_shared/weekly-notes.ts';
import { WEEKLY_NOTES } from '../../../supabase/functions/_shared/weekly-notes.generated.ts';
import { parseNote, noteProblems, readWeeklyNotes } from '../../../scripts/lib/weekly-notes.mjs';
import { fakeFetch, fakeSupabase, loadFunction, postJson } from './edgeHarness';

const { weeklyNoteMemberPlan, weeklyNoteEmail, weeklyNoteLead, weeklyNoteVisitorSlugs, repermissionEmail } = weeklyNotes;
const NOTES = readWeeklyNotes();
const slugOf = (step) => WEEKLY_NOTES.find((n) => n.step === step).slug;

const NEWCOMER = { gecko_count: 0, stale: null, female: null, breeder: false };
const KEEPER = { gecko_count: 2, stale: { id: 'g1', name: 'Mango', last_weight_grams: '12.44', last_weight_date: '2026-10-02' }, female: null, breeder: false };
const BREEDER = { ...KEEPER, female: { id: 'g2', name: 'Peach', adult: true }, breeder: true };

describe('which notes fit a member', () => {
  it('holds the heat note for May to September', () => {
    expect(weeklyNoteMemberPlan(KEEPER, 10).slugs).not.toContain(slugOf(1));
    expect(weeklyNoteMemberPlan(KEEPER, 7).slugs[0]).toBe(slugOf(1));
    expect(weeklyNoteVisitorSlugs(1)).not.toContain(slugOf(1));
    expect(weeklyNoteVisitorSlugs(6)).toContain(slugOf(1));
    expect(weeklyNoteVisitorSlugs()).toContain(slugOf(1));
  });

  it('sends the keeper, female and breeder notes only to members whose record fits', () => {
    const newcomer = weeklyNoteMemberPlan(NEWCOMER, 10).slugs;
    const keeper = weeklyNoteMemberPlan(KEEPER, 10).slugs;
    const breeder = weeklyNoteMemberPlan(BREEDER, 10).slugs;
    for (const step of [3, 7, 15]) {
      expect(newcomer).not.toContain(slugOf(step));
      expect(keeper).toContain(slugOf(step));
    }
    for (const step of [12, 13, 14]) {
      expect(keeper).not.toContain(slugOf(step));
      expect(breeder).toContain(slugOf(step));
    }
    // A young female gets the 40 g and 18 months note, not the lay box.
    const young = weeklyNoteMemberPlan({ ...KEEPER, female: { name: 'Peach', adult: false } }, 10).slugs;
    expect(young).toContain(slugOf(12));
    expect(young).not.toContain(slugOf(13));
  });

  it('keeps step order and passes each note its catalog step', () => {
    const plan = weeklyNoteMemberPlan(KEEPER, 10);
    expect([...plan.steps].sort((a, b) => a - b)).toEqual(plan.steps);
    plan.slugs.forEach((slug, i) => expect(WEEKLY_NOTES.find((n) => n.slug === slug).step).toBe(plan.steps[i]));
  });
});

describe('the lead from the member\'s record', () => {
  const weightNote = WEEKLY_NOTES.find((n) => n.step === 2);

  it('opens with the gecko waiting longest for a weigh-in', () => {
    const email = weeklyNoteEmail(weightNote.slug, { hasGecko: true, facts: KEEPER });
    expect(email.body.startsWith('Mango has gone longest without a weigh-in: the last was Oct 2, at 12.4 g. Start the line there.\n\n')).toBe(true);
    expect(email.body.endsWith(weightNote.body)).toBe(true);
  });

  it('falls back to the next alternative, then to no lead', () => {
    const unweighed = { ...KEEPER, stale: { name: 'Mango', last_weight_grams: null, last_weight_date: null } };
    expect(weeklyNoteLead(weightNote.lead, unweighed)).toBe('Mango has no weight on record yet, so this week is a good time to start the line.');
    expect(weeklyNoteLead(weightNote.lead, NEWCOMER)).toBeNull();
    expect(weeklyNoteEmail(weightNote.slug, { hasGecko: false, facts: NEWCOMER }).body).toBe(weightNote.body);
    expect(weeklyNoteEmail(weightNote.slug, { hasGecko: true, visitor: true }).body).toBe(weightNote.body);
  });

  it('keeps line breaks and control characters out of a name', () => {
    const lead = weeklyNoteLead(['{gecko} first.'], { stale: { name: 'Mango\r\nBcc: x@evil.test' } });
    expect(lead).toBe('Mango Bcc: x@evil.test first.');
  });

  it('names a female with the right possessive', () => {
    const note = WEEKLY_NOTES.find((n) => n.step === 12);
    expect(weeklyNoteLead(note.lead, { female: { name: 'Bess' } })).toContain("on Bess' record");
  });

  it('checks the new front matter', () => {
    const base = ['---', 'step: 1', 'slug: heat-is-the-bigger-risk', 'subject: Heat', 'preview: Days of 72 to 78°F, nights cooler.', 'cta: Open', 'path: /CareGuide/temperature', 'sources: src/data/husbandry-facts.js:68-75'];
    const parse = (extra) => parseNote('001-heat-is-the-bigger-risk.md', [...base, ...extra, '---', 'Body.', ''].join('\n'));
    expect(parse(['months: 11-2']).months).toEqual([11, 12, 1, 2]);
    expect(parse(['months: 13']).errors.join()).toMatch(/months "13"/);
    expect(parse(['audience: owners']).errors.join()).toMatch(/audience "owners"/);
    const bad = parse(['lead: {snake} is here and needs a weigh-in soon.']);
    expect(noteProblems(bad).join()).toMatch(/unknown placeholders \{snake\}/);
  });

  it('every lead in the catalog passes the writing rules once filled', () => {
    for (const note of NOTES) {
      expect(noteProblems(note).filter((p) => p.startsWith('lead'))).toEqual([]);
    }
  });
});

// ---------- send-email ---------------------------------------------------------

const ENV = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  RESEND_API_KEY: 're_test',
  EMAIL_POSTAL_ADDRESS: '123 Gecko Lane, Springfield, OR 97477',
};
const SITE = 'https://geckinspect.com';

function setup({ rpc = {}, env = {} } = {}) {
  const db = fakeSupabase((call) => {
    if (call.table === 'profiles') {
      return { data: { id: 'p1', role: 'user', email_notifications_enabled: true, email_notification_types: [] }, error: null };
    }
    if (call.rpc && rpc[call.rpc]) return rpc[call.rpc](call);
    if (call.rpc === 'email_has_login') return { data: true, error: null };
    if (call.rpc === 'email_is_suppressed') return { data: false, error: null };
    if (call.rpc === 'email_unsubscribe_token') return { data: 'p1.sig', error: null };
    if (call.rpc === 'weekly_note_facts') return { data: KEEPER, error: null };
    if (call.rpc === 'claim_weekly_note_from') return { data: { slug: slugOf(2), step: 2, has_gecko: true }, error: null };
    if (call.rpc === 'claim_weekly_notes_repermission') return { data: { claimed: true }, error: null };
    if (call.rpc === 'record_email_event') return { data: true, error: null };
    return undefined;
  });
  const net = fakeFetch(() => ({ body: { id: 'email-1' } }));
  const fn = loadFunction('send-email', {
    env: { ...ENV, ...env },
    globals: { createClient: () => db.client, fetch: net.fetch, ...lifecycleCopy, ...weeklyNotes },
  });
  const send = async (payload) => {
    const res = await fn.handle(postJson('https://x.test/', payload, { authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` }));
    return res.json();
  };
  return { db, net, send };
}

const WEEKLY = { user_email: 'sam@example.com', type: 'weekly_notes', weekly: { run_at: '2026-10-24T00:50:00Z' } };
const ASK = { user_email: 'sam@example.com', type: 'weekly_notes_repermission', repermission: { run_at: '2026-10-24T00:55:00Z' } };

describe('send-email personalises a weekly note', () => {
  it('reads the record, claims from the notes that fit and opens with the lead', async () => {
    const { db, net, send } = setup();
    expect(await send(WEEKLY)).toMatchObject({ delivered: 1 });
    expect(db.rpcCalls('weekly_note_facts')[0].args).toEqual({ p_email: 'sam@example.com' });
    const plan = weeklyNoteMemberPlan(KEEPER, new Date().getUTCMonth() + 1);
    expect(db.rpcCalls('claim_weekly_note_from')[0].args).toEqual({ p_email: 'sam@example.com', p_slugs: plan.slugs, p_steps: plan.steps });
    expect(net.requests[0].body.text.startsWith('Mango has gone longest without a weigh-in')).toBe(true);
  });

  it('waits for the next run when the record cannot be read, and claims nothing', async () => {
    const { db, net, send } = setup({ rpc: { weekly_note_facts: () => ({ data: null, error: { message: 'boom' } }) } });
    expect(await send(WEEKLY)).toEqual({ delivered: 0, skipped: 'weekly-notes-facts-failed' });
    expect(db.rpcCalls('claim_weekly_note_from')).toHaveLength(0);
    expect(net.requests).toHaveLength(0);
  });
});

describe('send-email sends the re-permission email once', () => {
  it('is a letter with a keep button carrying the signed token, and a stop link', async () => {
    const { db, net, send } = setup();
    expect(await send(ASK)).toMatchObject({ delivered: 1 });
    expect(db.rpcCalls('claim_weekly_notes_repermission')[0].args).toEqual({ p_email: 'sam@example.com' });
    const mail = net.requests[0].body;
    const copy = repermissionEmail();
    expect(mail.subject).toBe('Still keeping crested geckos?');
    expect(mail.text).toContain(`${copy.cta}: ${SITE}/KeepNotes?t=p1.sig`);
    expect(mail.text).toContain(`Stop Weekly Gecko Notes: ${SITE}/Unsubscribe?t=p1.sig&scope=weekly`);
    expect(mail.text).toContain(weeklyNotes.REPERMISSION_REASON);
    expect(mail.text).toContain('Geck Inspect, 123 Gecko Lane');
    expect(mail.headers['List-Unsubscribe']).toBe('<https://project.supabase.co/functions/v1/email-unsubscribe?t=p1.sig&scope=weekly>');
    expect(mail.tags).toEqual([{ name: 'type', value: 'weekly_notes_repermission' }]);
    expect(`${copy.title}\n${copy.preheader}\n${copy.body}`).not.toMatch(/—|–|--/);
  });

  it('sends nothing without the run marker, without a postal address, or when the claim says no', async () => {
    let t = setup();
    expect(await t.send({ ...ASK, repermission: undefined })).toEqual({ delivered: 0, skipped: 'repermission-without-run' });
    t = setup({ env: { EMAIL_POSTAL_ADDRESS: '' } });
    expect(await t.send(ASK)).toEqual({ delivered: 0, skipped: 'repermission-no-postal-address' });
    t = setup({ rpc: { claim_weekly_notes_repermission: () => ({ data: { reason: 'already-sent' }, error: null }) } });
    expect(await t.send(ASK)).toEqual({ delivered: 0, skipped: 'repermission-not-claimed' });
    expect(t.net.requests).toHaveLength(0);
  });
});
