# Now: the scoreboard

The 90-day plan (Part E5 of `docs/planning/comprehensive-review-2026-10-14.md`) asks one question: will crested gecko breeders pay for records, passports and transfers? These are the numbers that answer it. They live on the Weekly scoreboard card, just above the Growth funnel card (Admin panel, Overview, and again under Product analytics), and are copied here by hand once a week. The card reads `admin_scoreboard()` (migration `20261015151500_scoreboard.sql`, in production).

## Where the numbers stand

Read from production on 31 October 2026 (about 00:50 UTC), from `admin_scoreboard()` and `admin_revenue_summary()` run as the admin in a read-only transaction. Since the 28 October change the card itself leaves out the admin, the Morph ID evaluation account, App Store sandbox purchases and the 5 accounts flagged internal (the QA account, a test account on the admin's address and the three App Review accounts), so the card and this page now agree.

| Number | Today | Day 30, 17 Nov | Day 60, 17 Dec | Day 90, 17 Jan 2027 |
|---|---|---|---|---|
| Breeder conversations held | 0 recorded | 15+ | 20 | |
| Collections hand-imported | 0 recorded | 5 | 10 | |
| Paying breeders (not comped) | 0 | 2 | 6 | 10+ at $10 a month or more |
| Recurring revenue, comps left out (scoreboard) | $2.99 | | | |
| Monthly recurring (Revenue card, matches Stripe) | $8.98 ($5.99 of it ends at 05:11 UTC on 1 Nov) | | under $50 with cost over $150 is a tripwire | |
| Passports issued | 4 (plus 2 on the admin's geckos) | 10 | 50 | |
| Passports claimed | 0 (plus 3 from the admin's own sales) | | 15 | 25+ |
| Claimers still active 2 weeks on | 0 of 0 (admin's own sales left out) | | 3 | |
| Weekly active breeders (logging records) | 1 | | 4+ | 5+ for four straight weeks |
| Weekly active members (signed in) | 8 of 73 | | | |
| Signups, last 7 days | 4 | | | |
| Day-one first gecko rate | 0 of 3 (0%) | | | |
| Monthly cost | not recorded | under $100 | | |

**Day 30 gaps (17 November, 17 days away):**

- Breeder conversations: 0 of 15.
- Collections hand-imported: 0 of 5.
- Paying breeders: 0 of 2.
- Passports issued: 4 of 10.
- Monthly cost: not recorded, so "under $100" cannot be checked yet.

Under the Day 30 rule, fewer than 15 conversations means engineering pauses and the time goes to conversations. If some conversations have happened but were not typed in, record them on the card: the scoreboard only knows what "Record by hand" holds.

Notes on today's numbers:

- **Nothing moved on the money side since 28 October.** No Stripe payment since 4 October, no new subscription, no cancellation in the last 30 days, no lifetime purchase. One Keeper pays $2.99 a month, which is the whole of the scoreboard's recurring revenue.
- **The Stripe Breeder month ends on 1 November.** One member paid $5.99 for one month of Breeder on 1 October (UTC) and cancelled 45 minutes later; Stripe ends it at 05:11 UTC on 1 November and it does not renew. A goodwill comp (given on 5 October) keeps them on Breeder until 1 December. E5 says a comped account is not evidence, so the scoreboard leaves them out. From 1 November both revenue figures should read $2.99. One lifetime Enterprise plan has no lifetime payment on record and is not counted.
- **The $2.99 refund (17 Oct) is still not on the Revenue card** (refunds read $0). Stripe has never sent the app a `charge.refunded` or dispute event, because the webhook endpoint is not subscribed to them. Line 4 of the top ten.
- **Weekly active breeders, last 8 weeks (newest first):** 1, 1, 2, 1, 2, 1, 1, 1 (7-day windows ending 30 Oct, 23 Oct, 16 Oct and so on back to 11 Sep, in Denver dates). This series leaves internal accounts out, so it reads lower than the 28 October page (2, 2, 1, 3, ...), which counted them in some weeks and used windows ending 27 Oct.
- **Weekly active members** is 8 of 73, internal accounts left out (10 of 71 on 28 October, also without them).
- **Passports.** 4 issued, by 4 different members. None claimed; all 3 claims so far are buyers of the admin's own sales.
- **Conversations, imports and monthly cost read 0 or "not recorded"** because `scoreboard_entries` is still empty.
- **Signups and the first-gecko rate.** 4 signups in the last 7 days. The rate uses accounts from 8 to 1 days old: none of the 3 such accounts added a gecko on day one.
- **Email, week of 26 October (Monday start, so far):** 22 Weekly Gecko Notes sent (19 delivered, 2 bounced), 14 "Still keeping crested geckos?" emails (all delivered), 8 getting-started emails and a few reminders. Opens are mostly mail apps, not people (`docs/marketing/email-brain.md`, section 4).
- **Market feed.** Still stalled: the last complete US pass was 19 October and the US Price Index's last full day is 6 October, so `daily-canary` has failed on 28, 29 and 30 October as designed (`docs/OPERATIONS.md`, section 5).

## Top ten this week (draft, 31 Oct)

**Draft for Tennyson to rewrite.** E0 rule 5 says he rewrites the top ten every Monday; a Claude session wrote this one from production on 31 October. Nothing new has shipped since 28 October, so the list is the steps that are waiting.

1. **Breeder conversations.** 0 of 15 with 17 days to Day 30. Book them before anything else, offer a hand import in each (0 of 5), and record both under "Record by hand". The questions, the $120 offer and a block to fill in per call are in `docs/planning/breeder-interviews-2026-10.md`.
2. **Your step: backup secrets.** Add `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` at https://github.com/tennysonmilesperhour/geck-inspect/settings/secrets/actions/new (which values: `docs/OPERATIONS.md`, section 2). The 25 October run still skipped; until both are set there is no copy of member records outside Supabase.
3. **Your step: admin two-factor.** Enrol an authenticator app in Settings, Security (`docs/planning/admin-mfa-2026-10.md`, steps 1 to 3). None is enrolled yet.
4. **Your step: Stripe refund and dispute events.** Add them to the endpoint at https://dashboard.stripe.com/webhooks, then resend the 17 October `charge.refunded` event.
5. **Your step: photo thumbnails.** Admin panel, System, Photo thumbnails, Make thumbnails: 817 older photos still load full size on cards.
6. **Your step: the US market feed.** The full pass has been stalled since 19 October and the canary fails daily until it runs again (`docs/planning/market-habit-2026-09-30.md`).
7. **Your step: sign-in link templates (PKCE).** Supabase, Authentication, Email Templates (`docs/planning/deploy-queue-2026-10-03.md`, round 3, item 2).
8. **Your step: Morph ID card views.** Vault secret `morph_share_view_key` and the Vercel setting `MORPH_SHARE_VIEW_KEY`, then a production redeploy.
9. **Done 31 October: email addresses, step 2.** `20261031061000_member_email_columns_revoke.sql` is live: signed-in accounts can no longer read other members' email addresses on photo, forum, breeder, badge, giveaway, reaction and price rows (`docs/planning/deploy-queue-2026-10-03.md`, 31 October, step 2). Left for later: `geckos.created_by` (identity migration, E4 32).
10. **Your steps: routines access, the Geck Intellect key, monthly cost** (carried over from 28 October; the first two could not be checked from here). Give both scheduled routines the repository and connectors at https://claude.ai/code (Routines); replace the revoked Supabase key in the geck-data Vercel project, or pause it; enter last month's total under "Record by hand", Monthly cost.

## Day 90: the three outcomes

On 17 January 2027 one of these goes into `docs/DECISIONS.md`:

- **Invest:** 10 or more paying breeders at $10 a month or more, 5 or more weekly active breeders for four straight weeks, 25 or more passports claimed, at least one referral from a breeder's buyer.
- **Maintain:** 3 to 9 paying breeders.
- **Reference:** fewer than 3.

Day 30 rule: fewer than 15 conversations means engineering pauses and the time goes to conversations.

## How to read the card

- **Each number has its definition written under it.** If a number looks wrong, read the definition first.
- **The chips under each number are the targets.** Green means met today. Amber is the next checkpoint not yet met. Grey is a later checkpoint.
- **Two kinds of "weekly active" sit side by side.** Weekly active breeders counts members who logged a weigh-in, feeding, shed, vet visit or event on a gecko they own in the last 7 days. This is the plan's number. Weekly active members counts anyone who signed in or used the app while signed in. It is always bigger, because looking is not logging. Quote the first when someone asks how many people use Geck Inspect, and say which one you mean.
- **What weekly active breeders leaves out.** Egg and clutch logging does not count, so a breeder who only logs clutches in breeding season will not show. It also counts only records on geckos the member owns today (the 8-week history too), so a weigh-in on a gecko later sold through a passport drops out of past weeks.
- **Two revenue figures.** "Recurring revenue, comps left out" on the scoreboard counts paying members who hold no comp, at today's list prices; it goes with the paying breeders number. "Monthly recurring" on the Revenue card (Admin, Overview) comes from Stripe's records, comped payers included, so it should match Stripe, and it is the one the day 60 tripwire (cost over $150 a month with revenue under $50) uses, because a comped payer's money is real money. When a payer also holds a comp the two differ, and the scoreboard tile says by how much. App Store payers count on the scoreboard (at list prices) but not on the Revenue card, which reads Stripe only.
- **The day 90 paying breeders chip counts every Breeder or Enterprise payer.** The Invest test also asks for $10 a month or more each, and Breeder lists at $5.99, so check the plan prices by eye before calling Invest.
- **Conversations, imports and cost are typed in by you.** Use the "Record by hand" form on the card: pick what happened, the date and the breeder, and save. Add a monthly cost entry once a month (Supabase, Vercel, Resend, AI and the rest). Entries can be deleted from the list under the form.
- **"Plus N" lines** are the admin account's own passports and sales. They are real, but they show your own breeding, not other breeders using the product.

## Updating this page

Once a week, copy the card's numbers into the table above and change the date line. Keep the old numbers out; git keeps the history. Since 28 October the card leaves out sandbox purchases and internal accounts itself, so its numbers can be copied as they are.
