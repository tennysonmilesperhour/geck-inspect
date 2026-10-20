# The email brain, 20 October 2026

How Geck Inspect writes, sends and judges email. Read this before writing or changing any email: the getting-started emails (`supabase/functions/_shared/lifecycle-copy.ts`), Weekly Gecko Notes (`content/weekly-notes/`), reminders or anything new. Every rule here has a reason, and most reasons have a source (section 7).

## 1. What Tennyson needs to do

Three dashboard steps. Until step 1 is done, nobody can see whether any email works.

1. **Connect Resend's webhook (opens, clicks, bounces, complaints).** Not done: `email_deliveries` holds 97 "sent" rows and not one other event, and `resend-webhook` has not been called once.
   - https://resend.com/webhooks, Add endpoint
   - URL: `https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/resend-webhook`
   - Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`
   - Copy the signing secret (starts with `whsec_`) into https://supabase.com/dashboard/project/mmuglfphhwlaluyfyxsp/functions/secrets as `RESEND_WEBHOOK_SECRET`
   - https://resend.com/domains, the geckinspect.com domain, turn on **Click tracking** (open tracking too, but section 4 explains why opens barely count)
2. **Send as a person, and let replies reach you.** Same secrets page:
   - `EMAIL_FROM_PERSONAL` = `Tennyson at Geck Inspect <tennyson@geckinspect.com>` (any address on the verified geckinspect.com domain works for sending)
   - `EMAIL_REPLY_TO` = an inbox you actually read
   - Only the getting-started emails and Weekly Gecko Notes use these. Reminders, digests and alerts keep `EMAIL_FROM`.
   - The day 0 and day 1 emails ask a question to reply to **only when `EMAIL_REPLY_TO` is set**, so nobody is asked something no one will read.
3. **Answer the replies.** At this list size a reply is the best signal there is (section 4), and Godin's strongest kind of permission is a personal relationship. A two-line answer is enough.

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
- **Opens and clicks are unknown**, because the webhook was never connected (section 1).
- **No bounces or complaints have been recorded**, but that also comes from the webhook, so it proves nothing yet.
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
5. **Triggered by what they did, not by the calendar.** Behaviour-triggered emails get about twice the clicks of scheduled sends. The getting-started emails already branch on the member's record. The weekly notes do not yet (section 6).
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
- **Weekly Gecko Notes:** from day 16, **only for members with at least one gecko on record or who signed in within the last 60 days** (since 20 October, `20261020230000_email_relevance_and_outcomes.sql`). Before the gate the next week's list was 57 members; after it, 35. The 22 left out have no gecko and have not signed in for two months. Their switch is untouched: the moment they sign in or add a gecko, they are back on the next hourly run.
- **Reminders and alerts** (weigh-in due, feeding due, messages): the member asked for these per gecko or per type. Out of scope here.

## 6. What is next, in order

1. **Connect the webhook** (section 1). Without it, no click, bounce or complaint is known.
2. **Read `email_outcomes(60)` every Monday** for four weeks, and add a line to the log below.
3. **Re-permission email for the 22 dormant members.** One email, once: "Still keeping crested geckos? Say yes and the weekly notes keep coming; otherwise I'll stop." Only a click keeps them on. This is Godin's rule applied to people who never really asked.
4. **Make the weekly notes personal and seasonal.** A note can use the member's record (the weight-trend note naming their gecko whose last weigh-in is oldest; the lay box note only to keepers with an adult female) and the time of year (heat in summer, humidity in winter). Notes for breeders go to breeders.
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
