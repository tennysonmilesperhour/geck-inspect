# Weekly Gecko Notes, 18 October 2026

After a member's first two weeks (the five getting-started emails, `lifecycle-emails-2026-10.md`), each member gets **Weekly Gecko Notes**: one short email a week with one practical crested gecko tip and one button, in order, for as long as they stay subscribed. New notes are added over time by a scheduled Claude session, so a member who reaches the end simply waits for the next one.

Everything here is built and tested. **Nothing is sent yet**: the switch is off, and send-email refuses every note until a postal address is set.

## 1. What Tennyson needs to do

1. **Set the postal address.** In the Supabase dashboard (Edge Functions, Secrets), set `EMAIL_POSTAL_ADDRESS` to a street address, or a registered PO box or mail receiving agency. US law (CAN-SPAM) expects a postal address in commercial email. While it is empty, send-email skips every weekly note, and the skip uses up nothing.
2. **Turn the notes on**, in the SQL editor, once the address is set:

   ```sql
   update public.app_settings set value = 'true'::jsonb where key = 'weekly_notes_enabled';
   ```

   To see who would be asked about on the next run (it sends nothing):

   ```sql
   select * from public.weekly_notes_candidates();
   ```

   Setting the value back to `false` stops the next run.
3. **After the first merge that only adds a note**, check in the Supabase dashboard (Edge Functions, send-email) that the deployed version moved. That is how a new note goes live (section 6).

## 2. The rules

- **Never twice.** A member never gets the same note twice, and a repeated or overlapping run cannot double-send.
- **Spacing.** At most one weekly note per member in any 7 days, and none while the member is inside the 16-day getting-started window. At most one email of either kind (getting-started or weekly) per member in any 20 hours.
- **Who.** Only members who can sign in (a confirmed, not deleted, not anonymous, not banned account, the same rules as the getting-started emails), with the master email switch on, the Weekly Gecko Notes switch on, and an address that has not bounced or reported spam.
- **Stopping.** Every note has its own "stop Weekly Gecko Notes" link and one-click header. It turns off only these emails; reminders and the other emails the member chose keep coming. Settings has a switch for it. Stopping lasts until the member turns it back on.
- **The law.** No note goes out without a postal address. A note skipped for that reason, or because the member has had every note written so far, does not use up the member's next note. A member who has caught up gets the next note within a day of it being added.

## 3. How it works

Every hour at 50 past, the job `weekly-notes-hourly` runs `enqueue_weekly_notes()`. While the switch is off, its first statement returns and that is all (one lookup an hour). When it is on:

1. It picks the members who may get a note (`weekly_notes_candidates`), oldest last-asked first, at most 20 a run.
2. For each one it writes the time into `weekly_notes_polls` (one row per member) and asks send-email about them. A member is asked at most once in any 20 hours; the poll row is claimed first, so two runs that overlap never ask about the same member twice.
3. **send-email decides**, because only send-email can see two things: the `EMAIL_POSTAL_ADDRESS` secret, and the list of written notes (the catalog bundled with the function). In order, it checks the run marker, the postal address and that the catalog is not empty, then the master switch, that the address can sign in and is not suppressed, and that a signed unsubscribe link can be made. Any of these can skip the email, and none of them writes anything.
4. Then it calls `claim_weekly_note`. Under a lock for that member, the database checks every rule again (both switches, the suppression list, the 16-day window, 7 days since the last note, 20 hours since a getting-started email), picks the first note in the catalog the member has not had, and writes the ledger row in `weekly_notes_sends`, which is unique on the address and the note.
5. Only a claimed note is sent.

What that guarantees:

- No address, no unsubscribe link, or a caught-up member means no ledger row, so the member's next note is never used up.
- The same note can never go twice: the unique key, the lock and the poll claim each prevent it.
- The 7-day and 20-hour rules are checked twice, once when choosing candidates and once in the claim.
- A caught-up member, or one skipped for a missing address, is asked about again every 20 to 21 hours. So a newly written note reaches them within a day of the merge that adds it, at a cost of at most one function call per member per day.
- Nothing depends on the order in which the migration, the functions and the site finish deploying.

A Resend failure after the claim leaves that note spent. Never sending a member the same note twice wins over always sending.

The two series never overlap: getting-started emails need an account younger than 16 days and weekly notes need one at least 16 days old, and a weekly note waits 20 hours after any getting-started email (a day 14 email sent late, on day 15).

The limit of 20 a run spreads the first switch-on for the 64 accounts over about four hours and keeps send-email under Resend's rate limit. Raise it (the `p_limit` argument) when eligible members per day pass about 400.

### The pieces

| Piece | Where |
|---|---|
| The switch `weekly_notes_enabled` (false, not public) | `app_settings`, migration `20261018002200_weekly_notes.sql` |
| The member's switch `profiles.email_weekly_notes_enabled` (on for new members) | same migration. Its own column, never part of the Settings form, so the whole-form save (or a stale Settings tab) cannot switch it back on. Existing members who had Platform Announcements off started opted out |
| The ledger `weekly_notes_sends` (id, email, step, slug, created_date) | same migration. Keyed on the slug, so adding or renumbering notes later never re-sends one; `step` records the note's position when it was sent |
| The poll table `weekly_notes_polls` (email, polled_at) | same migration |
| `weekly_notes_candidates`, `claim_weekly_note`, `enqueue_weekly_notes`, `unsubscribe_weekly_notes_by_token` | same migration |
| Account deletion erases both tables' rows | `20261018002300_erase_weekly_notes.sql` (the full `admin_erase_account`, two lines added) |
| The send and the claim | `supabase/functions/send-email/index.ts` |
| One-click stop with `&scope=weekly` | `supabase/functions/email-unsubscribe/index.ts` |
| The words | `content/weekly-notes/NNN-slug.md`, one file per note |
| The catalog send-email ships | `supabase/functions/_shared/weekly-notes.generated.ts`, written by `pnpm build:weekly-notes` |
| The helper send-email calls | `supabase/functions/_shared/weekly-notes.ts` |
| The rules every note follows | `scripts/lib/weekly-notes.mjs` |
| The Settings switch | `src/components/settings/WeeklyNotesSetting.jsx`, saved by `User.setWeeklyNotes` |
| The stop page | `src/pages/Unsubscribe.jsx` with `?scope=weekly` |
| Tests | `src/lib/__tests__/weeklyNotes.test.js`, `supabase/tests/weekly_notes_regressions.sql`, the Unsubscribe and Settings switch tests, `privacyPolicy.test.js`, and the accepted-facts check in `scripts/check-genetics-consistency.mjs` |

Every note is tagged `weekly_notes` in Resend and in the delivery log, so `email_delivery_stats` has one row per week for the whole series (not one per note), and the admin scoreboard's limits are safe. Per-note counts come from the ledger (section 7).

### What each email looks like

Subject and heading: the note's subject. Then the body, the one button, and the footer send-email adds:

```text
<body>

<button words>: https://geckinspect.com<path>

You are getting Weekly Gecko Notes, one short email a week, because you have a Geck Inspect account.
Stop Weekly Gecko Notes: https://geckinspect.com/Unsubscribe?t=<token>&scope=weekly
Geck Inspect, <postal address>
```

The HTML version has "Change preferences" (Settings) next to the stop link. A member with no gecko gets the note's no-gecko button when the note has one.

## 4. The notes

| Step | Slug | Subject | Button | Button with no gecko |
|---|---|---|---|---|
| 1 | `heat-is-the-bigger-risk` | Heat is the bigger risk for a crested gecko | Open the temperature guide (`/CareGuide/temperature`) | same button |
| 2 | `watch-the-weight-trend` | One weight is a snapshot. The trend is the story. | Open your geckos (`/MyGeckos`) | Add a gecko (`/MyGeckos`) |
| 3 | `today-tells-you-what-is-due` | Check each gecko's weigh-in reminder | Open My Geckos (`/MyGeckos`) | Add a gecko (`/MyGeckos`) |
| 4 | `fresh-cgd-every-feeding` | Fresh CGD, every feeding | Open Today (`/Today`) | Read the CGD basics (`/CareGuide/cgd-basics`) |
| 5 | `shed-rhythm-by-stage` | How often should your gecko shed? | Log a shed (`/FieldMode`) | Read about shedding (`/CareGuide/shedding`) |
| 6 | `humidity-rises-at-night` | Humidity should rise at night and fall by day | Open the humidity guide (`/CareGuide/humidity`) | same button |
| 7 | `is-your-gecko-on-pace` | Is your gecko growing on pace? | Open My Geckos (`/MyGeckos`) | Read about weight tracking (`/CareGuide/weight-tracking`) |
| 8 | `never-pair-two-lilly-whites` | Why you should never pair two Lilly Whites | See the Lilly White pairing (`/calculator/pairing/lilly-white-x-normal`) | same button |
| 9 | `where-66-percent-het-comes-from` | Where "66% possible het" comes from | Run the het x het pairing (`/calculator/pairing/het-axanthic-x-het-axanthic`) | same button |
| 10 | `fire-it-up-before-the-photo` | Fire it up before you take the photo | Try Morph ID (`/Recognition`) | same button |
| 11 | `reading-het-labels` | What "100% het" and "possible het" really mean | Open your family trees (`/Lineage`) | Open the Genetics Guide (`/GeneticsGuide`) |
| 12 | `forty-grams-and-eighteen-months` | 40 g and 18 months: both, not either | Check your females (`/MyGeckos`) | Read about breeding readiness (`/CareGuide/breeding-readiness`) |
| 13 | `a-lay-box-for-every-female` | Every adult female needs a lay box | Open Breeding (`/Breeding`) | Read about egg laying (`/CareGuide/egg-laying`) |
| 14 | `pick-an-incubation-temperature` | Pick an incubation temperature, get a hatch window | Open Breeding (`/Breeding`) | Read about incubation (`/CareGuide/incubation`) |
| 15 | `a-passport-before-it-leaves` | Give your gecko a passport before it leaves | Make a passport (`/MyGeckos`) | Read about hatchling records (`/CareGuide/hatching-and-record-keeping`) |
| 16 | `start-from-the-gecko-you-want` | Start from the gecko you want | Plan backward (`/calculator/reverse`) | same button |

The text is the approved copy word for word, with three changes the tests forced:

- Note 14's button opened `/Breeding?tab=hatchery`. Buttons may not carry a query string (the link rules in section 8), so it opens `/Breeding` and says "Open Breeding" instead of "Open the Hatchery". The body already tells the member to pick the Hatchery tab.
- Notes 9 and 11 cited `src/data/keepers-guides/morph.js` lines 269 to 271 (and 270) as a source. Those lines are the "50% het, coin flip (visual x het)" badge on the do-not-use list, so the citation was dropped. The words of both notes did not change; the glossary lines they also cite support them.
- The preheaders in the brief are not used: the format has no field for them, and send-email does not send one.

## 5. Editorial guardrails (for whoever writes the notes)

**Which source wins.** Facts come from `src/data/husbandry-facts.js` and `scripts/lib/accepted-facts.mjs` first, then `src/data/care-guide.js`, then `src/data/morph-guide.js` for genetics. Where the Keeper's Guides disagree with those, leave the number out. When in doubt, leave the fact out.

**Never use:**

- `keepers-guides/morph.js:187`, which says het x het Axanthic gives 50% visuals (wrong)
- `keepers-guides/morph.js:150`, which calls Phantom polygenic
- `keepers-guides/morph.js:266-271`, the "50% het, coin flip (visual x het)" badge (wrong)
- `genetics-sections.jsx:516-517`, "none are expected to hatch" (use the accepted Super Lilly White fact instead)
- the Handbook's sexing accuracy figures
- the 30 to 50% figures, and any price, startup cost or market tier
- "cannot be sold on MorphMarket"
- named breeders used as evidence
- UVB bulb names, distances or hours
- cooling temperatures
- conflicting handling session lengths
- the humidity figures 60 to 80% or 40 to 50%
- quarantine of 60 or more days
- a hatchling's first meal at 72 hours
- the old getting-started line that a 1 g scale is fine (the day 0 email now says 0.1 g)

The source lines on this list are in `DO_NOT_CITE` in `scripts/lib/weekly-notes.mjs`; a note that cites one fails the tests.

**Pattern traits.** Harlequin, Pinstripe, Dalmatian and Tiger are single genes in the engine. Describe what you see, or credit Foundation Genetics if you call one polygenic. Never write "not proven" or "line-bred" in a sentence that names a modeled trait unless it also gives the engine's model (the genetics check enforces this).

**Seasons.** Write "when your room warms up" or "when your house cools", never a month or a season, because every member starts at note 1 on a different date.

**Writing rules** (the tests enforce every one): no em dash, no en dash, no "--", no " - " and no "1-2" style ranges (write "1 to 2"); plain language and short sentences; crested gecko terms used precisely (Lilly White, Harlequin, Phantom, Cappuccino, Axanthic, Sable, Highway, Dalmatian, Pinstripe); never an invented statistic, study, quote, price, member count or personal story, and no first person singular; never call a note an article, a blog post or a newsletter issue, and never link the blog (blog work is shelved); never mention a retired feature (Promote, the AI Consultant, Other Reptiles, the supplies store, the website builder, the Morph Visualizer, and the older retired pages in `src/lib/retiredPages.js`); no CGD brand or marketplace names; percentages only from 5, 10, 25, 50, 66, 70, 80 and 100.

**Reserve topics** (ideas for the next notes, each with its source and the trap to avoid):

| Topic | Point it at | Watch out for |
|---|---|---|
| Tail loss: a crested gecko's tail does not grow back | `/CareGuide/tail-loss` | handling session lengths |
| A new gecko's first weeks: keep it apart, watch it eat | `/CareGuide/acclimation`, `/CareGuide/quarantine` | quarantine of 60 or more days |
| Picky eaters: what to check before you worry | `/CareGuide/picky-eaters` | brand names |
| Firing up and down as a health signal, not a morph | `/CareGuide/firing-up` | it repeats note 10; make it about health |
| Harlequin and Pinstripe: read the pattern you see | `/MorphGuide/harlequin`, `/MorphGuide/pinstripe` | the dual-model rule |
| Phantom is recessive: what a het can and cannot show | `/MorphGuide/phantom` | `morph.js:150` |
| Cappuccino and Sable: why breeders pair them, and Luwak | `/calculator/pairing/cappuccino-x-sable` | Super Cappuccino is not lethal but has documented health problems |
| Dalmatian spots: count them on the record photo | `/MorphGuide/dalmatian` | "line-bred" without the engine model |
| Hatchling care: the first weigh-in and the first sheds | `/CareGuide/hatchling-care` | a first meal at 72 hours |
| Senior geckos: what changes after 10 years | `/CareGuide/senior-care` | lifespan claims beyond husbandry-facts |
| Enclosure size by life stage | `/CareGuide/enclosure-size` | prices and product names |
| Vet visits and follow-ups on the record | `/MyGeckos` | none |
| Importing a spreadsheet of an existing collection | `/MyGeckos` | marketplace names |

## 6. Adding a note (for the scheduled session)

1. Read this document, including the do-not-use list in section 5.
2. Write `content/weekly-notes/<next NNN>-<slug>.md` in the format below, with its sources.
3. Run `pnpm build:weekly-notes`, then `pnpm vitest run src/lib/__tests__/weeklyNotes.test.js`, `node scripts/check-genetics-consistency.mjs` and `pnpm test`.
4. Commit to `main`. The merge redeploys send-email with the new catalog (every merge deploys every declared function), and members who were caught up get the new note within a day.

Rules for the session:

- **Keep at least 8 written notes ahead of the number of weeks since launch.** Launch is the day the switch was turned on; no member can be further along than one note a week since then, so this keeps every member at least 8 notes from the end. The query in section 7 gives both numbers.
- **Keep at least four unsent notes ahead of the furthest member** (the second query in section 7). If the first rule holds, this one does too.
- **Never rename or reuse a published slug.** The ledger is keyed on the slug, so a renamed note is a new note and goes again to everyone who had it.
- **Fix wording by editing the body.** The slug stays.
- **To withdraw a note, delete its file and renumber the rest** (the file names and the `step` lines). Renumbering never re-sends anything, because the ledger is keyed on the slug.
- A note inserted earlier in the order is sent next to anyone who has not had it, before the later notes they have not had.

### The file format

One UTF-8 file per note with LF line endings, at `content/weekly-notes/NNN-slug.md`. NNN is the step, zero-padded to three digits; the slug is lowercase words joined by single hyphens, at most 64 characters.

The file has two parts: a front matter block between two lines that are exactly `---`, then the body.

Front matter: one `key: value` per line. Everything after the first `: ` is the value, taken literally with no quotes. Only these keys:

- `step` (required): an integer equal to NNN. Steps run 1 to N with no gaps.
- `slug` (required): the file name after `NNN-`. Never renamed once published.
- `subject` (required): the subject line and the email heading, 1 to 60 characters.
- `cta` (required): the button words, 1 to 40 characters.
- `path` (required): an in-app path from the live pages, starting with a single `/`. Not `/log`, not a bare `/Pedigree` or `/GeckoDetail`, not `/blog`, not a retired page, no query string. A `#anchor` only on `/Settings`, and only one that exists there.
- `cta_no_gecko` and `path_no_gecko` (optional, both or neither): the button for members with no gecko in their collection.
- `sources` (required): `; `-separated `file:line` or `file:start-end` references to the repo lines behind every fact in the note. For reviewers and the scheduled writer; never sent.

Body: plain text paragraphs separated by one blank line; lines inside a paragraph are joined with a space. 80 to 200 words. No greeting and no sign-off, no links, URLs or paths, no markdown or HTML characters (# * _ ` [ ] < >). Each note makes one practical point and asks for one action, which matches the button. send-email escapes the body, turns line breaks into line breaks in the HTML, and adds the button and the footer.

Example, `content/weekly-notes/001-heat-is-the-bigger-risk.md`:

```text
---
step: 1
slug: heat-is-the-bigger-risk
subject: Heat is the bigger risk for a crested gecko
cta: Open the temperature guide
path: /CareGuide/temperature
sources: src/data/husbandry-facts.js:67-75; src/data/care-guide.js:240-266
---
Crested geckos do best at room temperature. Days of 72 to 78°F suit them, with
a slight drop at night to 65 to 72°F.

The number to remember is 82°F. ...
```

## 7. Reading the numbers (read-only queries)

Delivery, opens and clicks for the whole series, by week (the same view the admin scoreboard reads):

```sql
select * from public.email_delivery_stats where email_type = 'weekly_notes' order by week desc;
```

Notes sent per step:

```sql
select step, slug, count(*) as sent, min(created_date)::date as first_sent, max(created_date)::date as last_sent
  from public.weekly_notes_sends
 group by step, slug
 order by step, slug;
```

How many members are within two notes of the end, the furthest member, and weeks since launch. Set `written` to the number of files in `content/weekly-notes`:

```sql
with catalog as (select 16 as written),
     per_member as (select email, count(*) as had from public.weekly_notes_sends group by email)
select count(*) filter (where p.had >= c.written - 2) as within_two_of_end,
       count(*) as members_with_a_note,
       coalesce(max(p.had), 0) as furthest_member,
       c.written - coalesce(max(p.had), 0) as unsent_ahead_of_furthest,
       (select ceil(extract(epoch from now() - min(created_date)) / 604800)::int
          from public.weekly_notes_sends) as weeks_since_launch
  from per_member p cross join catalog c
 group by c.written;
```

Who has stopped the notes, and who is still asked about:

```sql
select count(*) filter (where email_weekly_notes_enabled) as on,
       count(*) filter (where not email_weekly_notes_enabled) as off
  from public.profiles;

select count(*) as asked_in_the_last_day
  from public.weekly_notes_polls where polled_at > now() - interval '1 day';
```

A member asked about with no new ledger row was skipped by send-email (no postal address, caught up, a failed check, or not eligible any more). The reason is in the send-email function logs as `skipped: "weekly-notes-..."`: `weekly-notes-no-postal-address`, `weekly-notes-caught-up`, `weekly-notes-not-eligible`, `weekly-notes-no-token`, `weekly-notes-check-failed`, `weekly-notes-claim-failed`.

## 8. The tests

- `src/lib/__tests__/weeklyNotes.test.js`: the generated catalog is not stale; numbering, unique slugs and subjects; lengths; every writing rule, each shown catching its mistake; every button opens a live page (and `/blog`, retired pages, `/log`, `/Pedigree` and query strings are refused); every source points at real lines and none at the do-not-use list; send-email end to end (the payload's words ignored, every skip before the claim, the footer, the scoped links and headers, the tag); email-unsubscribe's weekly scope.
- `supabase/tests/weekly_notes_regressions.sql`: eligibility and each boundary, the job, the claim, never twice, the drip-only unsubscribe, a member's own switch, the defaults and the one-time backfill, the two series never overlapping, erasure, permissions, and the delivery numbers. It also runs the migration file a second time.
- `scripts/check-genetics-consistency.mjs` checks every note's subject and paragraphs against the accepted facts and the dual-model rule.
- `src/lib/__tests__/privacyPolicy.test.js` holds the Privacy Policy to the two tables' columns.
