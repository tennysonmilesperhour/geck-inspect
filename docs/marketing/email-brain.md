# The email brain, 20 October 2026

How Geck Inspect writes, sends and judges email. Read this before writing or changing any email: the getting-started emails (`supabase/functions/_shared/lifecycle-copy.ts`), Weekly Gecko Notes (`content/weekly-notes/`), reminders or anything new. Every rule here has a reason, and most reasons have a source (section 7).

## 1. Setup status and replies

Dashboard setup completed on 24 October 2026, around 12:35 MDT (18:35 UTC). End-to-end verification passed at 12:54 MDT (18:54 UTC) with one approved getting-started test email to Tennyson.

1. **Resend webhook connected.** Endpoint `6e56f06c-541f-4717-a3ef-52e9a8137bbd` is enabled at https://resend.com/webhooks/6e56f06c-541f-4717-a3ef-52e9a8137bbd.
   - URL: `https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/resend-webhook`
   - Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
   - Its signing secret is saved as `RESEND_WEBHOOK_SECRET` in Supabase; the saved SHA-256 digest matches the endpoint secret exactly. Never put the value in this document.
   - **Click and open tracking enabled.** Resend now requires a tracking subdomain. GoDaddy added `links.geckinspect.com` CNAME `links2.resend-dns.com`; public DNS resolves it. Resend reports the tracking CNAME as Verified.
   - **Verified end to end:** test email `01a16f42-fa0b-7ca8-bfa5-c8effb34d03b` produced `delivered` at 18:53:43 UTC, `clicked` at 18:54:27 UTC and `opened` at 18:54:33 UTC in `public.email_deliveries`. The tracked button redirected to `https://geckinspect.com/MyGeckos`; the click and pixel fetch were deliberate test actions, not member engagement. The earlier HTTP 401 was the deliberately unsigned probe, not a failed Resend signature.
2. **Personal sender and reply inbox configured.** Both secrets are saved:
   - `EMAIL_FROM_PERSONAL` = `Tennyson at Geck Inspect <tennyson@geckinspect.com>`
   - `EMAIL_REPLY_TO` = `tennysontaggart@gmail.com`
   - Getting-started emails, Weekly Gecko Notes and re-permission letters use these. Reminders, digests and alerts keep `EMAIL_FROM`.
   - Day 0 and day 1 reply questions are enabled by `EMAIL_REPLY_TO`.
   - **Verified actual sender and reply-to:** Resend and the received Gmail MIME headers both show the values above on the day 0 test, subject "Tennyson (setup test), start with one gecko". The reply question is present. Gmail placed it in the Promotions inbox, with SPF, DKIM and DMARC passing.
   - Sending DNS records are verified. Resend's existing inbound MX conflict remains; replies use Gmail and do not depend on Resend receiving mail for the domain.
3. **Answer the replies.** This remains Tennyson's ongoing task. At this list size a reply is the best signal there is (section 4), and Godin's strongest kind of permission is a personal relationship. A two-line answer is enough.

## 2. What the data said on 20 October

Read from production, 18 to 20 October.

| Email | Sent | Used the app within 72 h | Recorded something within 72 h |
|---|---|---|---|
| Getting-started day 0 | 9 | 4 | 1 |
| Getting-started day 1 | 6 | 1 | 0 |
| Getting-started day 3 | 2 | 0 | 0 |
| Getting-started day 7 | 1 | 1 | 0 |
| Getting-started day 14 | 1 | 0 | 0 |
| Weekly note 1 (heat) | 52 | **0** | **0** |

- **Weekly note 1 went to 53 members. 40 had no gecko on record and 38 had not signed in for a month.** None of the 53 opened the app in the next three days. That is the definition of noise: mail to people who stopped listening, about something they did not ask about (a heat warning in October).
- **Opens and clicks were unknown** when this was written, because the webhook was not connected yet. It was connected on 24 October; the weekly log (section 8) has the numbers since.
- **No bounces or complaints had been recorded** then. The first two soft bounces came on 26 October (section 8). One soft bounce never stops mail. Since 28 October, an address that soft bounces on 3 different emails within 30 days goes on the do-not-email list as `soft_bounced` (`20261028025800_soft_bounce_suppression.sql`). It works for members only, because the delivery log keeps no visitor addresses. A hard bounce or a spam report still stops mail at once.
- The day 0 email does bring people back (4 of 9). It rarely gets them to do the one thing it asks.

## 3. The principles

Each one is a rule we follow, then why.

1. **Permission is a privilege, not a right.** An address in the database is not permission to send. Godin: permission marketing is "the privilege (not the right) of delivering anticipated, personal and relevant messages to people who actually want to get them." So we only send to people the email can help (section 5), and every email has a one-click stop.
2. **Anticipated, personal, relevant.** Every email must pass all three:
   - *Anticipated:* the member knows why it came. The footer says so in one line.
   - *Personal:* it uses the member's own record (their gecko's name, last weight, missing parents). Personalization beyond the first name beats the first name alone.
   - *Relevant:* it fits where the member is now (no gecko yet, one gecko, a breeder with pairings) and the season.
3. **Would they miss it?** Godin's test for a newsletter is whether people would notice if it stopped. A weekly note earns its slot by being the tip a keeper would forward to a friend. If it would not be missed, do not send it.
4. **One email, one next step.** Each getting-started email moves the member one step toward the moment the app becomes useful: a gecko on record, then a first weight, then parents, then a trend. (Val Geisler's dinner party: take the coat, show them round, then serve dinner. Patrick McKenzie: write one email per step where new users stall.) One button.
5. **Triggered by what they did, not by the calendar.** Behaviour-triggered emails get about twice the clicks of scheduled sends. The getting-started emails branch on the member's record, and since 24 October so do the weekly notes (section 5).
6. **A letter from a person beats a designed card.** HubSpot found the more HTML-heavy an email, the lower its opens and clicks; simple letter-style emails won even though people *say* they prefer designed ones. A named sender ("person at company") does better than the company name alone. So since 20 October these emails are a plain white letter, no heading, signed "Tennyson", from Tennyson when step 1.2 is done.
7. **The subject says what is inside, using the member's data.** Clear beats clever on clicks (AWeber: clear subject lines drew 541% more response than clever ones; curiosity can win opens and lose clicks). Good: "Mango is in. Next: a first weight". Bad: "Welcome to Geck Inspect" (says nothing) or "You won't believe this" (clickbait).
8. **The preview line adds to the subject.** The grey text after the subject decides a lot of opens. Without it, mail apps show the first words of the email, which used to be "Geck Inspect" and the subject again. Every email now sets one, 20 to 100 characters, never a repeat of the subject. Put the useful number in it ("Every 14 days for juveniles, 21 for sub-adults, 30 for adults").
9. **Ask for replies, early.** A question in the first email (what got you into crested geckos, how many do you keep) starts a conversation, tells us who the members are, and replies are a good sign to inbox providers. Ask only when someone will answer.
10. **Less, and better.** Too much email is the top reason people unsubscribe. Our caps: one marketing email per member per 20 hours, one weekly note per 7 days, nothing to dormant members (section 5).
11. **People like us do things like this.** Crested gecko keepers follow what good breeders do. Frame steps as what careful keepers do ("a careful buyer asks for the hatch date and the weights"), always in crested gecko terms, never generic reptile terms.

## 4. How we judge an email

**Opens do not count.** Apple Mail loads every image when the message arrives, so more than half of all "opens" are a machine, not a person. An open rate mostly says how many members use an iPhone.

What counts, in order:

1. **Did they do the thing?** The share of recipients who recorded something (a gecko, a weight, a feeding, an event) within 72 hours. This is the number. `select * from public.email_outcomes(60);` in the SQL editor (admins only) gives, for every getting-started step and every weekly note: sent, came back to the app within 72 h, recorded something within 72 h, and turned the notes off afterwards.
2. **Replies.** Count them by hand. Any reply beats any click.
3. **Clicks**, once the webhook is connected (`select * from public.email_delivery_stats;`).
4. **Stops and complaints.** One spam complaint on a send to 50 people is a 2% rate, far over Gmail's 0.3% ceiling. **Any complaint means stop and look at that email.** A stop rate over 2% on one note means that note is noise.

Targets for now (to revise once there are 4 weeks of data):

| Email | Healthy | Rewrite it |
|---|---|---|
| Getting-started | 30% or more record something within 72 h | under 15% |
| Weekly note | 25% or more come back within 72 h, stops under 2% | under 10% come back, or any complaint |

**Do not A/B test subject lines.** Telling two versions apart from a 30% baseline needs thousands of people per version; with 50 per arm, a difference has to be 15 to 20 points before it is more than chance. Instead:

- Change one email at a time and compare its `email_outcomes` row before and after, over at least four weeks.
- When the list passes about 300 members, hold the email back from a random 10% and compare what they record with what the 90% record. That is the only honest answer to "does this email do anything".
- Read every reply. At this size what people say beats any statistic.

## 5. Who gets what

- **Getting-started emails:** members in their first 16 days, by step and record (`docs/planning/lifecycle-emails-2026-10.md`).
- **Weekly Gecko Notes:** from day 16, **only for members with at least one gecko on record, use of the app within the last 60 days, or a yes on purpose within the last year** (the Settings switch, the sign-up box, or the keep button below). The gate came on 20 October (`20261020230000_email_relevance_and_outcomes.sql`) and took the next week's list from 57 to 35; the yes rule came on 24 October. "Use of the app" is the latest of a typed sign-in, a saved session refreshing and anything the member did in the app (`weekly_notes_last_active`, since `20261024210200`; before that only a typed sign-in counted, so members who stay signed in looked dormant). Nobody's switch is touched: opening the app or adding a gecko lets a member back in on the next hourly run.
- **Which note, and how it opens (since 24 October).** Each note can say who it is for and when (`audience` and `months` in its file, `docs/planning/weekly-notes-2026-10.md` section 6), and send-email reads the member's record (`weekly_note_facts`) before choosing:
  - `keepers` (a gecko on record): the weigh-in reminder, on-pace and passport notes.
  - `female` (a female on record): 40 g and 18 months. `adult-female` (a female at 35 g or 18 months): the lay box. `breeders` (a breeding plan, an egg or a clutch): incubation temperature.
  - `months: 5-9`: the heat note waits for May to September (UTC months, read as northern hemisphere seasons). A note held back is not skipped: it comes in its season, or once the member's record fits.
  - A `lead` opens the note with the member's own gecko: "Mango has gone longest without a weigh-in: the last was Oct 2, at 12.4 g." If the record cannot fill it, the note starts as before. Visitors (sign-ups without an account) get every note marked for visitors in season, never a lead.
- **The re-permission email (since 24 October).** Members the gate leaves out get one email, once, from Tennyson: "Still keeping crested geckos?" The button opens `/KeepNotes`, which asks for one press (mail scanners open links) and records a yes, or a no. Doing nothing changes nothing: they are already left out, and come back if they open the app or add a gecko. 24 members qualified on 24 October; 22 after `20261024210200`. Switch: `app_settings` key `weekly_notes_repermission_enabled`, **on since 18:26 UTC on 24 October**; the first run that can send is 23:55 UTC on 25 October (7 days after the 18 October weekly notes), and the rest follow in the next two hourly runs. To stop it: `update public.app_settings set value = 'false'::jsonb where key = 'weekly_notes_repermission_enabled';`. It does nothing while the weekly notes themselves are off, and skips an inbox where another account already gets the notes. The job runs hourly at 55 past (`weekly-notes-repermission-hourly`), 20 at a time, and never within 7 days of a weekly note or 20 hours of a getting-started email. It goes once per inbox, not per account: since `20261024201200` the claim locks the inbox, so two accounts on one inbox (a plus-tag or dotted Gmail spelling) cannot both get it. Deleting an account erases its record. In `email_outcomes`, its "recorded" column counts the members who pressed keep.
- **Reminders and alerts** (weigh-in due, feeding due, messages): the member asked for these per gecko or per type. Out of scope here.

## 6. What is next, in order

1. **Watch real delivery and engagement** (section 1 setup and verification are complete). Exclude the documented setup test when judging member clicks or opens.
2. **Read `email_outcomes(60)` every Monday** for four weeks, and add a line to the log below.
3. **Read the re-permission result** two weeks after it goes out: `select * from public.email_outcomes(60) where kind = 're-permission';` and `select count(*) filter (where kept_at is not null) as kept, count(*) as sent from public.weekly_notes_repermission_sends;`. A keep rate under 10% says the list was mostly people who signed up once and moved on, which is fine: they stop getting mail.
4. **More personal notes.** New notes should use `audience` and `lead` where the record makes them sharper, for example a shed note for keepers that names a gecko with no shed logged.
5. **A holdout** once the list passes about 300 members (section 4).

## 7. Sources

- Godin, permission marketing defined: https://seths.blog/2008/01/permission-mark/ ; Forbes on the book at 15: https://www.forbes.com/sites/onmarketing/2014/04/30/seth-godins-permission-marketing-turns-15/ ; first four chapters free: https://seths.blog/2011/01/the-first-four-chapters-of-permission-marketing/
- Godin, smallest viable audience and "people like us": *This Is Marketing* (2018), contents at https://libcat.scu.edu/Record/b3217161/TOC
- Behaviour-triggered against scheduled email, about 2x clicks (162M emails): https://neilpatel.com/marketing-stats/trigger-based-vs-scheduled-email-performance/
- Automated flows against campaigns (Klaviyo, 5.58% against 1.69% clicks): https://klaviyo.com/products/email-marketing/benchmarks
- Lifecycle email for first-time users, about 15% conversion lift (consulting experience): https://www.kalzumeus.com/greatest-hits/
- Apple Mail Privacy Protection: https://support.apple.com/guide/mail/mlhlp1205/mac ; share of opens: https://www.litmus.com/blog/email-client-market-share-march-2022/
- Plain against HTML: https://blog.hubspot.com/marketing/plain-text-vs-html-emails-data
- Clear against clever subject lines: https://www.marketingdive.com/news/how-to-increase-subject-line-response-by-541/37041/
- Personalization beyond the first name: https://www.data-axle.com/about-us/news-media-coverage/data-email-subject-lines-under-21-characters-generate-the-highest-open-rates/
- Preview text: https://www.litmus.com/blog/8-embarrassing-preview-text-mistakes-4-tips-on-how-to-avoid-making-them
- Why people unsubscribe: https://www.marketingsherpa.com/article/chart/why-consumers-unsubscribe ; https://baymard.com/blog/newsletter-frequency
- Gmail and Yahoo sender rules (complaints under 0.3%, aim for 0.1%): https://blog.google/products/gmail/gmail-security-authentication-spam-protection/ ; https://senders.yahooinc.com/best-practices
- Sunsetting unengaged addresses: https://www.braze.com/docs/help/best_practices/email/sunset_policies/ ; https://www.validity.com/?p=18181
- Sample sizes for A/B tests: https://www.webit.de/en/marketing-automation/samples-ab/ ; holdout tests: https://docs.customer.io/journeys/holdout-test/
- Dinner party strategy (onboarding one step at a time): https://engage.so/blog/how-to-convert-free-trials-into-paying-customers-with-the-dinner-party-strategy/

Weak or vendor-only claims left out on purpose: "a single call to action lifts clicks 371%", the "4x opens, 10x clicks" welcome email multiple, and the 90% of readers who read the P.S. (paper mail, 1980s).

## 8. Log

| Week | What changed | Outcome |
|---|---|---|
| 20 Oct 2026 | Letter format, preview lines, personal sender (waiting on secrets), new getting-started subjects, reply questions, weekly-notes relevance gate, `email_outcomes` | Baseline in section 2 |
| 24 Oct 2026 | Weekly notes by audience and season with a personal lead; one-time re-permission email (24 members) and `/KeepNotes`. Webhook still not connected: no click data yet | Read 7 Nov |
| 24 Oct 2026 (setup check) | Enabled the seven-event Resend webhook; saved webhook, personal-sender and reply-to secrets; enabled click/open tracking and added the tracking CNAME. Tracking DNS is verified; the first post-setup email remains pending | `email_outcomes(60)`: day 0 sent/returned/recorded 11/5/1; day 1 8/1/0; day 3 3/0/0; day 7 1/1/0; day 14 1/0/0; weekly heat 54/0/0; weekly weight trend 1/0/0. All stops 0. `email_delivery_stats`: 108 sent across 15 type/week rows; delivered/opened/clicked/bounced/complained all 0. These are pre-setup counts, not evidence of zero engagement or complaints. No test email sent during this check. |
| 24 Oct 2026 (12:54 MDT verification) | One approved day 0 test to Tennyson through production `send-email`. Personal From, Gmail Reply-To and reply question verified in the received message; SPF/DKIM/DMARC pass. Signed delivered, clicked and opened events reached Supabase | `email_outcomes(60)` unchanged from the setup check: the test did not add a lifecycle send-ledger row. `email_delivery_stats`: 109 unique sent, 1 delivered, 1 clicked, 1 opened, 0 bounced/complained. The week of 19 Oct `lifecycle_day0` row is 6 sent / 1 delivered / 1 clicked / 1 opened. All three non-sent events belong to test `01a16f42-fa0b-7ca8-bfa5-c8effb34d03b`; exclude them from engagement conclusions. Two raw sent rows for this email (application and webhook) are deduplicated by the stats view. No bounce or complaint was simulated. |
| 26 Oct 2026 | Weekly note 2 (`watch-the-weight-trend`) went out on 25 and 26 Oct. The one-time re-permission email went to 22 members between 23:55 UTC on 25 Oct and 01:55 on 26 Oct. First full send with the webhook connected. The Morph ID evaluation account (no mailbox) was still getting weekly notes; `20261028014800_quiet_morph_eval_account.sql` turns its email off on 28 Oct | `email_outcomes(60)` read on 28 Oct, about 02:00 UTC (sent/returned/recorded): weekly note 2 29/2/1, 0 stops (28 of the 29 went on 25 and 26 Oct and 1 of those to the evaluation account; the 72 h window for the 26 Oct sends closes about 01:50 UTC on 29 Oct, so this is early). Re-permission 22/0/0: 0 kept, 1 stop. Getting-started day 0 14/6/1, day 1 11/2/0, day 3 3/0/0, day 7 5/2/0, day 14 2/0/0, all stops 0. Weekly note 1 54/0/0, now 1 stop. Weekly note 4 1/0/0. Delivery from `email_deliveries` since 00:00 UTC on 25 Oct, each email counted once by distinct `resend_email_id` (every email now has a send-email `sent` row and a webhook `sent` row, so raw sent rows double): weekly notes 29 sent, 26 delivered, 2 soft bounces (Transient), 1 click, 0 complaints. 13 delayed-delivery events on 2 emails: 9 on the evaluation account's note, which then soft bounced (fixed 28 Oct), and 4 on one member's note, which then soft bounced too. Re-permission 22 sent, 22 delivered, 0 bounces, 0 clicks, 0 complaints. Opens (13 and 6) are not evidence (section 4). Read next: Monday 2 Nov, for note 2's full 72 h and the next note; the re-permission keep rate on 9 Nov, two weeks after it went out (section 6, step 3). |
