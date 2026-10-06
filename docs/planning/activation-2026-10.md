# Activation pass, 5 October 2026

Goal: raise activation. Today 68% of new members never add a gecko, and none of the September signups came back a week later (`growth-funnel-2026-10.md`). The working aha moment is: **"my geckos are in, I can see their parents, and the app tells me what each one needs next."** This pass builds the path to that moment inside the first session, gives the member a reason to come back, and fixes the guest demo problems from `qa-2026-10-05.md`. It builds on the first-impression changes already merged (`first-impression-2026-10.md`).

Screenshots: [activation-2026-10/](activation-2026-10/) (22 files, numbered in the order a newcomer meets them; `m-` is a 390 x 844 phone, `d-` a 1440 x 900 laptop).

## 1. What changed, in plain words

1. **An empty collection is now a guided first gecko.** My Geckos and the Dashboard both open on one card: "Add your first gecko", three numbered steps, and two buttons: *Add by photo, first Morph ID free* and *Type a name and morph* (plus *Import a spreadsheet* for breeders). On a phone the buttons sit on the first screen; the archive, export and weigh-in buttons that had nothing to act on are hidden until there is a gecko ([before](activation-2026-10/01-m-mygeckos-empty-before.jpg), [after](activation-2026-10/02-m-mygeckos-empty-after.jpg)).
2. **Step 1, add the gecko.** By photo: Morph ID's free try opens with a "step 1 of 3" banner and a "Type it in instead" way out; its *Add to my collection* now opens the short Quick Add form already filled with the photos, the morph name (for example "Lilly White") and its tags, so the member only types a name. By typing: the same short Quick Add (name, sex, optional hatch date, weight and morph, feeding reminders on). Every step can be skipped ([choice](activation-2026-10/05-m-flow-1-choice-after.jpg), [form](activation-2026-10/06-m-flow-1-form-after.jpg)).
3. **Step 2, its parents.** Sire and dam by name ("names from the breeder are enough"), or picked from the collection when there are other geckos. Names are stored as the gecko's sire and dam names, which the record and the family tree already show as placeholders. Nothing here adds a gecko, so the Free plan's 10-gecko limit is never touched ([parents](activation-2026-10/07-m-flow-2-parents-after.jpg)).
4. **Step 3, the payoff.** One screen with: a family card (sire, dam, the gecko) with a link to the full family tree; **what it needs next**: the first weigh-in today with a box to log it right there (or the next weigh-in date), and the next feeding day from its feeding group; a **switch for each reminder**, on by default; and the **value estimate** from real listings (the existing value card). Then *Open its record*, *Add another gecko* or *Done* ([phone top](activation-2026-10/08-m-flow-3-payoff-after.jpg), [phone lower](activation-2026-10/09-m-flow-3-payoff-lower-after.jpg), [laptop](activation-2026-10/10-d-flow-3-payoff-after.jpg)).
5. **Reminders on by default, so there is a reason to come back.** Feeding: the first gecko joins a "My geckos" feeding group (CGD every 3 days) with reminders on, served by the existing daily feeding job. Weigh-in: new. Every gecko added through the flow gets a personal weigh-in reminder, every 14 days while growing and every 30 for adults, with the first nudge the day after it is added if it has no weight yet. Opt-out is visible in three places: on the payoff screen, on each gecko's record (under Weight History), and for the whole account in Settings, Notifications, Feeding Alerts. Turning a single gecko's feeding reminder off takes it out of the feeding group, so other geckos keep theirs.
6. **Guest demo: Add Gecko now converts.** In the demo, Add Gecko opens Quick Add (photo upload is replaced by a note that photos and Morph ID open with a free account). Saving shows **"Create a free account to keep Mango"** with *Create a free account* and *Back to the demo*. The gecko is kept in the browser; the sign-up page says "Mango is waiting" and has a *Back to the demo* link; once the account exists (including after confirming the email in the same browser), opening My Geckos saves Mango automatically and carries on at step 2 ([before](activation-2026-10/11-m-guest-addgecko-before.jpg), [keep](activation-2026-10/12-m-guest-addgecko-keep-after.jpg), [sign-up](activation-2026-10/13-m-guest-signup-with-draft-after.jpg), [saved after sign-up](activation-2026-10/14-m-guestdraft-saved-after.jpg)).
7. **Guest demo: prices are visible.** Market in the demo was a sign-in wall. It now shows a labelled sample: every demo gecko priced (the demo collection is worth $3,211 to $7,563, 15 of 15 priced) and the middle asking price by morph (Sable, Axanthic, Lilly White, Cappuccino and others), from a snapshot of the real Geck Data trait table taken 5 October, plus a sign-up button. The same snapshot puts the value card on demo gecko records, so tour stop 2 (Nimbus) now shows "what he is worth" ([before](activation-2026-10/15-m-guest-market-before.jpg), [after](activation-2026-10/16-m-guest-market-after.jpg), [laptop](activation-2026-10/17-d-guest-market-after.jpg), [Nimbus](activation-2026-10/22-d-guest-tour-2-after.jpg)).
8. **Guest demo: the tour card no longer covers the page.** On phones the tour is a one-line bar (stop, title, *Next*, a chevron for the full text, close), about 60 px tall instead of a third of the screen. Stop 3 no longer says "scroll down for the odds" while covering them. Floating notices (the tour or guest notice and feeding reminders) now share one stacked corner instead of overlapping, the sample feeding reminders wait until the tour is closed, and every page gets bottom padding equal to the stack's height so its last content can scroll clear ([stop 1 before](activation-2026-10/18-m-guest-tour-1-before.jpg), [after](activation-2026-10/19-m-guest-tour-1-after.jpg), [stop 3 before](activation-2026-10/20-m-guest-tour-3-before.jpg), [after](activation-2026-10/21-m-guest-tour-3-after.jpg)).

## 2. The server change, written but not applied

Weigh-in reminder settings live in `profiles.extra_data.care_reminders` (an existing column only the member and admins can read or write), so the app works today with no database change: the switches save, and the dates on screen are right.

What does need the server is **sending** the new weigh-in reminders. That is `supabase/migrations/20261005190000_personal_weighin_reminders.sql`, **not applied**:

- `enqueue_personal_weighin_reminders()`, a daily job at 14:20 UTC (ten minutes after feeding reminders). One message per member per day naming the geckos that are due ("Time to weigh Mango..."), linking straight to that gecko's record when there is one. Each gecko is reminded once per due date; weighing it moves the date. The member switch and the usual push and email preferences apply.
- The weekly 30-day nudge skips geckos the daily job covers and members who turned weigh-in reminders off, so nobody gets both.

The selection logic was checked read-only against production with made-up settings (parsing, bad values ignored); 0 members have settings today, and no email is on two profiles. It contains `revoke` lines, so apply it in the SQL Editor rather than through the MCP tool. It is listed in `deploy-queue-2026-10-03.md`.

## 3. How it is measured

All events go through `captureEvent`, so they land in `public.user_events` and in PostHog when it is on.

- **New: `first_gecko_flow`** with `step` (`add`, `parents`, `payoff`) and `action` (`start`, `shown`, `choose_photo`, `choose_type`, `saved`, `skipped`, `closed`, `guest_kept`, `guest_signup_clicked`, `guest_back_to_demo`, `weight_logged`, `reminder_on`, `reminder_off`, `open_lineage`, `open_record`, `add_another`, `done`). One event for the whole flow, so a single funnel shows where people drop. Added to `instrumentation-2026-10.md`.
- **Existing events, now fed by the flow:** `gecko_added` and `first_gecko_added` (sources `quick_add`, `morph_id_draft`, and new `demo_draft` for a gecko carried over from the demo), `weight_logged` (the payoff's weigh-in box), `signup_completed`, `guest_tour`, `market_view` (`surface: demo` in the demo).

Funnel to watch weekly (admin Funnel card plus one query on `user_events`):

1. `signup_completed`
2. `first_gecko_flow` add `saved` (first gecko on day one; 32% today)
3. `first_gecko_flow` parents `saved` (has a parent link)
4. `first_gecko_flow` payoff `shown`
5. a second session 1 to 7 days later, and a second `weight_logged` within 21 days (0 today)

The proposed activation definition from the funnel diagnosis still applies: 3 or more geckos with at least one parent link or one weight within 24 hours. Check after 4 to 6 weeks of signups whether that group returns more than the rest.

## 4. How it was verified

- Playwright (Chromium) at 390 x 844 with touch and 1440 x 900, against the dev server on port 5183 with the public Supabase URL and key in an uncommitted `.env.local`. The sandbox cannot reach Supabase, so every call was answered inside the browser: a brand new Free account whose database calls are kept in memory (so saving a gecko, the parents and the reminder settings really round-trip), and the guest demo with its built-in sample data.
- Walked end to end on both sizes: empty My Geckos and Dashboard; the flow by typing (Mango, Female, Lilly White Harlequin; parents Spud and Harley), which saved one gecko with the sire and dam names and its feeding group, and wrote `care_reminders.weigh_in.geckos.<id> = { on: true, every_days: 14, since: today }` next to the existing first-touch data without overwriting it; the guest tour, Market and Add Gecko; and a new account opening My Geckos with a demo gecko waiting, which saved it and opened step 2. No page errors in any run.
- `pnpm lint` clean, 1,311 unit tests pass (15 new: the guest draft, the care schedule, the reminder settings, and Quick Add's choice, Morph ID prefill, flow hand-off and guest keep), `vite build` succeeds. The demo price snapshot is its own 2.3 KB (compressed) file that loads only in the demo.
- Not checked here: the photo path against live Morph ID (the sandbox cannot run it), real photos, and a real email confirmation. Repeat the flow on a phone against geckinspect.com after deploying.

## 5. Files

- New: `src/components/onboarding/FirstGeckoStarter.jsx`, `src/components/onboarding/FirstGeckoFlow.jsx`, `src/lib/firstGeckoFlow.js`, `src/lib/careReminders.js`, `src/components/my-geckos/quickGeckoSave.js` (Quick Add's save, shared with the demo hand-off), `src/components/gecko/WeighInReminderSwitch.jsx`, `src/components/settings/WeighInReminderSetting.jsx`, `src/components/market/DemoMarketBrief.jsx`, `src/components/shared/FloatingNoticeStack.jsx`, `src/data/demoTraitValues.js`, the migration above, two test files.
- Changed: `src/pages/MyGeckos.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Recognition.jsx`, `src/pages/Market.jsx`, `src/pages/Settings.jsx`, `src/components/my-geckos/QuickAddGecko.jsx` (photo-or-type choice, prefill, step label, flow hand-off, guest mode), `src/components/my-geckos/GeckoDetailModal.jsx`, `src/components/gecko/MarketValueCard.jsx`, `src/components/auth/GuestDemoGuide.jsx`, `src/components/auth/GuestMockDisclaimer.jsx`, `src/components/auth/LoginPortal.jsx`, `src/components/feeding/FeedingAlertSystem.jsx`, `src/Layout.jsx`, `src/lib/guestTour.js`, `src/lib/morphIdDraft.js` (a plain morph name on the draft), `src/lib/traitValueTable.js` (demo snapshot), `src/lib/activation.js` (the signup record reads `extra_data` fresh so it never overwrites reminder settings).

## 6. Known limits and what to do next

1. **Apply the migration** (section 2). Until then the weigh-in reminders exist only as switches; the reason to come back is not delivered. This is the single most important follow-up.
2. **A day-1 email for members with no gecko** (funnel item 2, needs Tennyson's copy approval). The flow fixes the first session; a member who leaves before step 1 still hears nothing. The weigh-in job covers those who added one.
3. **Other add paths do not set a weigh-in reminder by default.** The full form, CSV import, hatching and Morph ID with an existing collection add geckos without one (any gecko can be switched on from its record). Once the migration has run and the first numbers look right, consider defaulting every new gecko, with the same per-gecko and account switches.
4. **The demo draft lives in one browser.** Signing up on a phone and confirming the email on a laptop leaves the gecko on the phone; it is saved the next time My Geckos opens there. It expires after two weeks.
5. **The photo path needs two photos** (top and side) and uses the one free Morph ID. A member who already used it sees the plans card; the banner's "Type it in instead" link is the way out. Worth watching `choose_photo` against `saved` with `source: morph_id_draft`.
6. **Demo prices are a dated snapshot** (5 Oct). Refresh `src/data/demoTraitValues.js` from `trait_value_table()` every month or two, or serve the aggregate table to signed-out visitors (a decision about showing listing data publicly, D20).
7. The value card is below the fold on the phone payoff screen. If `payoff shown` is high but `open_record` and second visits stay low, try moving a one-line estimate ("Mango is worth about $400") into the family card.

## Guest demo tours (6 Oct)

The three-stop demo is now a set of tours (`src/lib/guestTour.js`):

- **The one-minute tour** (marked "Start here"): My Geckos, Nimbus's record, the calculator with his parents, and the Market brief.
- **Topic tours** to dive deeper: Collection and care, Breeding and genetics (pairings, the hatchery tab, Nimbus's family tree, clutch odds), Morphs and Morph ID, Prices and value, and Community.
- **A tour picker** (bottom sheet on phones, centered panel on laptops) with an "I keep geckos / I breed geckos" toggle. The toggle sets the suggested order; the next unseen tour is marked, finished ones are ticked, and the card after each tour offers the suggested next one.
- The stop card has a progress bar, Back, a shortcut to all tours, and animated transitions (off for people who ask for reduced motion). Each stop scrolls the page back to the top.
- After the guest closes the tour, the yellow guest notice has a **Tours** button to reopen the picker.
- `/Breeding?tab=hatchery` now opens the hatchery tab directly.
- The `guest_tour` event now carries `tour` on every action, and adds the actions `hub`, `hub_close`, `role` and `back`.
