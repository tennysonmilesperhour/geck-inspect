# Lifecycle emails and the email delivery log, 16 October 2026

Plan items E2 16 (four lifecycle emails) and the email half of E2 20 (a Resend bounce and complaint webhook) from `comprehensive-review-2026-10-14.md`, plus two small email defects. Everything here is built and tested and **nothing is sent yet**: the lifecycle emails wait for Tennyson to approve the copy below and flip one switch.

## 1. What Tennyson needs to do

1. **Read the copy in section 4** and reply with changes or "approved". Every variant a member can receive is shown, filled in for a sample member (Sam, whose first gecko is Mango, a Lilly White Harlequin).
2. **Apply the migration** `supabase/migrations/20261015151200_lifecycle_emails.sql` and **deploy** `send-email` and the new `resend-webhook` function (`supabase functions deploy resend-webhook --no-verify-jwt`). The migration is additive and safe to run twice.
3. **Connect Resend's webhook.** In the Resend dashboard: Webhooks, Add endpoint, `https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/resend-webhook`, tick the email events (sent, delivered, delivery delayed, opened, clicked, bounced, complained). Copy its signing secret (starts with `whsec_`) into the Supabase function secret `RESEND_WEBHOOK_SECRET`. Turn on open and click tracking for the sending domain, or opens and clicks stay at zero.
4. **Add a postal address** to the footer: the function secret `EMAIL_POSTAL_ADDRESS` (a PO box or registered agent address works). US law expects one in email that mentions upgrades; the footer prints it as soon as the secret is set. Weekly Gecko Notes (below) do not send at all without it.
5. **Turn the lifecycle emails on** once the copy is approved, in the SQL editor:

   ```sql
   update public.app_settings set value = 'true'::jsonb where key = 'lifecycle_emails_enabled';
   ```

   To see who would get what before switching on (it sends nothing):

   ```sql
   select * from public.lifecycle_email_candidates();
   ```

   Setting the value back to `false` stops the next run.

## 2. How the lifecycle emails work

- **Who.** Members who joined in the last 16 days, can sign in (a confirmed, not deleted, not banned account), have email notifications on, and whose address has not bounced or complained. Profiles imported from the old platform, which cannot sign in, never get them.
- **What.** Up to five short emails, one next step each, built from the member's own records:

  | Step | When | Only if | One next step |
  |---|---|---|---|
  | Day 0 | one to two hours after joining | always | add a first gecko; or weigh it; or add the rest |
  | Day 1 | 24 to 72 hours after joining | no gecko yet | add the gecko you know best |
  | Day 3 | days 3 to 5 | has a gecko | add the sire and dam, open the family tree |
  | Day 7 | days 7 to 9 | has a gecko | weigh the first gecko (one-tap log link) |
  | Day 14 | days 14 to 16 | has a gecko | weigh it again |

  The review counts day 7 and day 14 as one weigh-in email, which is why the plan says "four". A member who never adds a gecko gets day 0 and day 1 and nothing more.
- **After day 14.** Weekly Gecko Notes take over once the account is 16 days old: one short email a week, in order, with its own stop link (`docs/planning/weekly-notes-2026-10.md`). The two never overlap, and a weekly note waits 20 hours after any lifecycle email. The footer of every lifecycle email now mentions them without promising them, because they wait for a switch and a postal address and the member may turn them off: "It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings." (It used to say the emails stop after two weeks.) The day 0 email now asks for a scale that reads to 0.1 g, and day 14 gives the reminder rhythm (every 14 days while growing, 21 as a sub-adult, 30 as an adult), so the weekly notes repeat the same facts.
- **Never twice.** Each member and step gets one row in `lifecycle_email_sends` before the email is handed over, and the row is unique, so a repeated or overlapping run cannot send a step again. At most one lifecycle email per member in any 20 hours. A step whose window has passed is dropped, so turning the switch on never sends a "welcome" to someone who joined weeks ago.
- **Preferences.** Day 0, 1 and 3 follow the member's *Platform Announcements* email switch; day 7 and 14 follow *Breeding & Care Updates*. The master email switch, the unsubscribe link and the one-click List-Unsubscribe header work exactly as for every other notification email.
- **When.** A job runs every hour at 35 past (`lifecycle-emails-hourly`). The welcome waits until the account is an hour old, so it can mention what the member did in onboarding (a first gecko, a first weight), and goes with the next hourly run after that: one to two hours after joining. The brief asked for a daily job; hourly sends the welcome within two hours instead of up to a day later, and each later step arrives at about the time of day the member joined. While the switch is off each run is one lookup.
- **Where the words live.** `supabase/functions/_shared/lifecycle-copy.ts`. Changing a sentence is a `send-email` deploy, not a migration. The test `src/lib/__tests__/lifecycleEmails.test.js` fails if this preview and the real copy drift apart; after a copy change, refresh the preview with `WRITE_LIFECYCLE_PREVIEW=1 pnpm vitest run src/lib/__tests__/lifecycleEmails.test.js`.
- **Dependency.** The weigh-in links open `/log?gecko=<id>&type=weight`, the one-tap log page being built in the same round. Do not turn the switch on before that page is live, or day 0 and the weigh-in emails link to a page that does not exist yet.

## 3. The delivery log

- `send-email` tags every email with its type and writes a `sent` row to `public.email_deliveries`.
- `resend-webhook` checks Resend's signature (Svix) and writes delivered, delivery delayed, opened, clicked, bounced and complained rows. Resend retrying the same event never counts twice.
- A **hard bounce** or a **spam complaint** puts the address in `public.email_suppressions`, and `send-email` stops sending it notifications, digests, reminders and lifecycle emails. A soft bounce (full mailbox, server down) is logged but does not suppress. An admin lifts a suppression by deleting its row.
- Deleting an account keeps its suppression row on purpose, so the Privacy Policy (section 8) names every column the row holds: the address, the reason, the two dates, Resend's id for the email and, for a bounce, the bounce type and the mail server's message. `src/lib/__tests__/privacyPolicy.test.js` fails if a column is added to `email_suppressions` without matching wording in the policy.
- Opened and clicked rows only arrive while open and click tracking is turned on for the sending domain in Resend. The Privacy Policy says so.
- `public.email_delivery_stats` gives sent, delivered, opened, clicked, bounced and complained by email type and week, for the admin Funnel card (built by the scoreboard work).
- Only admins can read any of it. Members and visitors cannot.

## 4. The copy for approval

Each block is the plain-text version; the HTML version has the same words with the button in green. The last two lines are the footer.

<!-- preview:start -->
### Day 0, no gecko yet

Subject: Welcome to Geck Inspect, Sam

```text
Hi Sam,

Thanks for joining. Geck Inspect is a record book built for crested geckos: weights, feedings, sheds, parents and pairings, kept in one place you can show a buyer.

One thing to do today: add one gecko. A name and a morph are enough. Write the morph the way the breeder listed it, such as Lilly White, Harlequin, Dalmatian or Phantom. Not sure? Morph ID reads a top photo and a side photo and suggests the likely morph. Free members get one identification a month.

Everything else hangs off that record: the weight chart, the feeding day and the family tree.

[ Add your first gecko ]  https://geckinspect.com/MyGeckos

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 0, one gecko, no weight yet

Subject: Welcome to Geck Inspect, Sam

```text
Hi Sam,

Thanks for joining, and Mango is already in. Good start.

One thing to do today: weigh Mango and log it in grams. Use a kitchen scale that reads to 0.1 g. Weigh before a feeding so a full belly does not pad the number.

That first weight starts the growth curve, and the curve is what tells you when a female is big enough to breed. Most breeders wait for at least 40 g and 18 months.

[ Log Mango's weight ]  https://geckinspect.com/log?gecko=g_mango&type=weight

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 0, one gecko already weighed

Subject: Welcome to Geck Inspect, Sam

```text
Hi Sam,

Thanks for joining. Mango is in with a first weight, so the growth chart has already started.

One thing to do next: add the rest of your collection. Name and morph are enough for each one. If you keep your animals in a spreadsheet or have a MorphMarket export, import it in one go instead.

[ Add your other geckos ]  https://geckinspect.com/MyGeckos

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 1, still no gecko (only sent when the collection is empty)

Subject: Start with the gecko you know best

```text
Hi Sam,

Your collection is still empty. That is normal on day one, so here is the shortest way in.

Pick the gecko you know best and add its name and morph. It takes two minutes. If you still have the breeder's listing, the morph line and the sire and dam names are all you need for now. Hatch date and photos can wait.

Keeping more than a handful? Import a spreadsheet or a MorphMarket export and the whole collection comes in at once.

[ Add a gecko ]  https://geckinspect.com/MyGeckos

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 3, no parents on record

Subject: Who are Mango's parents?

```text
Hi Sam,

Parents tell you what a photo cannot. A gecko with an Axanthic parent carries Axanthic even when it looks like a normal Harlequin, and only the pedigree shows it.

Add Mango's sire and dam. Names from the breeder's listing are enough; you do not need to own them. Geck Inspect draws the family tree from there, and every hatchling you log later lands on it.

[ Open Mango's family tree ]  https://geckinspect.com/Lineage?geckoId=g_mango

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 3, sire on record, dam missing

Subject: Who are Mango's parents?

```text
Hi Sam,

Parents tell you what a photo cannot. A gecko with an Axanthic parent carries Axanthic even when it looks like a normal Harlequin, and only the pedigree shows it.

Add Mango's dam. Names from the breeder's listing are enough; you do not need to own them. Geck Inspect draws the family tree from there, and every hatchling you log later lands on it.

[ Open Mango's family tree ]  https://geckinspect.com/Lineage?geckoId=g_mango

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 3, both parents on record

Subject: Mango's family tree is started

```text
Hi Sam,

Mango already has a sire and a dam on record, which puts you ahead of most keepers.

Open the family tree to see it, and add grandparents if the breeder gave you them. Each generation you record is evidence for what a gecko may carry. A normal-looking gecko with an Axanthic parent carries Axanthic, and only the pedigree shows it.

[ Open Mango's family tree ]  https://geckinspect.com/Lineage?geckoId=g_mango

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 7, no weight yet

Subject: Time to weigh Mango

```text
Hi Sam,

Mango has been in your collection for a week and has no weight yet. Weigh in grams, before a feeding, and log it. It is two taps from the button below.

Juveniles should gain steadily. A stall or a drop is often the first sign that something is off, well before you can see it.

[ Log Mango's weight ]  https://geckinspect.com/log?gecko=g_mango&type=weight

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 7, one weight

Subject: Time to weigh Mango

```text
Hi Sam,

Mango's last weight was 4.5 g on Oct 16. Weigh again this week and the chart turns into a trend.

Juveniles should gain steadily. A stall or a drop is often the first sign that something is off, well before you can see it.

[ Log Mango's weight ]  https://geckinspect.com/log?gecko=g_mango&type=weight

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 14, no weight yet

Subject: Two weeks in: weigh Mango again

```text
Hi Sam,

Mango still has no weight on record. Today is a good day for the first one.

Keep the rhythm: every 14 days while a crested gecko is growing, every 21 days as a sub-adult and every 30 days as an adult. The weigh-in reminder on Mango's record tells you when the next one is due, so check it is switched on.

[ Log Mango's weight ]  https://geckinspect.com/log?gecko=g_mango&type=weight

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 14, one weight

Subject: Two weeks in: weigh Mango again

```text
Hi Sam,

Mango's last weight was 4.5 g on Oct 16. One more turns that number into a trend.

Keep the rhythm: every 14 days while a crested gecko is growing, every 21 days as a sub-adult and every 30 days as an adult. The weigh-in reminder on Mango's record tells you when the next one is due, so check it is switched on.

[ Log Mango's weight ]  https://geckinspect.com/log?gecko=g_mango&type=weight

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```

### Day 14, three weights

Subject: Two weeks in: weigh Mango again

```text
Hi Sam,

Mango has 3 weights on record, enough to draw the start of a growth curve. The last was 6 g on Oct 28.

Keep the rhythm: every 14 days while a crested gecko is growing, every 21 days as a sub-adult and every 30 days as an adult. The weigh-in reminder on Mango's record tells you when the next one is due, so check it is switched on.

[ Log Mango's weight ]  https://geckinspect.com/log?gecko=g_mango&type=weight

You are getting this because you joined Geck Inspect on Oct 15. It is one of a few short emails in your first two weeks. After that, you may get Weekly Gecko Notes, one short tip a week. You can turn them off in Settings.
Change preferences or unsubscribe from these emails.
```
<!-- preview:end -->

## 5. Two email defects fixed in the same change

1. **The unsubscribe header could disappear.** If the signed unsubscribe link could not be made (the database hiccupped or the Vault secret was missing), `send-email` sent the email with no List-Unsubscribe header and no unsubscribe link in the footer. Now it tries twice, and if there is still no signed link the header and footer point at the email switches in Settings, which every recipient can open because addresses with no login are already skipped. An optional `UNSUBSCRIBE_MAILTO` secret adds a mailbox to the header for that case.
2. **Monthly allowances reset at midnight UTC.** Morph ID scans, health checks and AI drafts are counted per calendar month in UTC, so in the US they reset on the evening of the last day of the month (8 pm Eastern or 5 pm Pacific during daylight saving time, 7 pm and 4 pm in winter). Moving the boundary to a US time zone would mean changing the same rule in about eight places (the credit functions, Morph ID's allowance, four edge functions and two pages) at once, and the Morph ID allowance is being reworked in the same round, so it was not changed. Instead the Membership page FAQ and the "out of credits" messages now say when the reset happens.
