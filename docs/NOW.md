# Now: the scoreboard

> **Refreshed 14 November 2026** (numbers read from production at about 19:40 UTC by a session). The top ten below is that session's draft for Tennyson to rewrite. Everything waiting on Tennyson, with links and values, is in `docs/OWNER-STEPS.md`.
>
> **Shipped since 31 October:**
> - 10 November: Sign in with Apple in the iPhone app, and Apple tokens revoked when an account is deleted.
> - 11 to 13 November, the experience review (`docs/planning/experience-review-2026-11-11.md`): sign-up by 6-digit code; Share and passport in the gecko record's top bar; Today is home on every device; one log screen for feeding and weights, with a rack walk in Field Mode; Quick Add for every new gecko and a long form in sections; Breeding planners as tabs; Settings in five tabs that save as you go; Morph ID upload first; one text floor and five colour roles; screens that cross-fade and saves that answer at once; no browser pop-ups; the sold sheet and tub labels.
> - 13 November: sale prices kept where only the owner can read them; Quick Add picks a feeding group; a hatch year can be saved on its own.
> - 13 and 14 November: members can no longer read another member's email address on geckos, breeding plans or care records (`docs/planning/owner-emails-2026-11.md`), and the sold sheet offers to make the gecko's passport again.

The 90-day plan (Part E5 of `docs/planning/comprehensive-review-2026-10-14.md`) asks one question: will crested gecko breeders pay for records, passports and transfers? These are the numbers that answer it. They live on the Weekly scoreboard card, just above the Growth funnel card (Admin panel, Overview, and again under Product analytics), and are copied here by hand once a week. The card reads `admin_scoreboard()` (migration `20261015151500_scoreboard.sql`, in production).

## Where the numbers stand

Read from production on 14 November 2026 (about 19:40 UTC), from `admin_scoreboard()` and `admin_revenue_summary()` run as the admin in a read-only transaction. The card leaves out the admin, the Morph ID evaluation account, App Store sandbox purchases and the 5 accounts flagged internal (the QA account, a test account on the admin's address and the three App Review accounts), so the card and this page agree.

| Number | Today | Day 30, 17 Nov | Day 60, 17 Dec | Day 90, 17 Jan 2027 |
|---|---|---|---|---|
| Breeder conversations held | 0 recorded | 15+ | 20 | |
| Collections hand-imported | 0 recorded | 5 | 10 | |
| Paying breeders (not comped) | 0 | 2 | 6 | 10+ at $10 a month or more |
| Recurring revenue, comps left out (scoreboard) | $2.99 | | | |
| Monthly recurring (Revenue card, matches Stripe) | $2.99 | | under $50 with cost over $150 is a tripwire | |
| Passports issued | 5 (plus 2 on the admin's geckos) | 10 | 50 | |
| Passports claimed | 0 (plus 3 from the admin's own sales) | | 15 | 25+ |
| Claimers still active 2 weeks on | 0 of 0 (admin's own sales left out) | | 3 | |
| Weekly active breeders (logging records) | 2 | | 4+ | 5+ for four straight weeks |
| Weekly active members (signed in) | 7 of 81 | | | |
| Signups, last 7 days | 2 | | | |
| Day-one first gecko rate | 0 of 2 (0%) | | | |
| Monthly cost | not recorded | under $100 | | |

Notes on today's numbers:

- **Money.** One Keeper pays $2.99 a month, which is the whole of the recurring revenue; the last Stripe payment was on 4 November. The Breeder month paid on 1 October ended on 1 November as scheduled (that member keeps a goodwill comp until 1 December, which the scoreboard leaves out). All time: 7 paid invoices, $14.96. No lifetime purchase.
- **The $2.99 refund (17 Oct) is still not on the Revenue card** (refunds read $0), because the Stripe webhook is not subscribed to refund and dispute events (`docs/OWNER-STEPS.md`, C4).
- **Weekly active breeders, last 8 weeks (newest first):** 2, 2, 1, 1, 2, 0, 3, 1 (7-day windows ending 14 Nov, 7 Nov, 31 Oct, 24 Oct, 17 Oct, 10 Oct, 3 Oct and 26 Sep). Internal accounts are left out.
- **Weekly active members** is 7 of 81, internal accounts left out (8 of 73 on 31 October).
- **Passports.** 5 issued (4 on 31 October). None claimed; all 3 claims so far are buyers of the admin's own sales. Since 14 November the sold sheet offers a passport at the sale (`docs/DECISIONS.md`, entry 69).
- **Signups and the first-gecko rate.** 2 signups in the last 7 days; neither added a gecko on day one.
- **Rows typed in by hand** (`scoreboard_entries`): none yet, so the conversations, imports and monthly cost rows read 0 or "not recorded".
- **Email.** Week of 9 November (Monday start, so far): 30 Weekly Gecko Notes sent (29 delivered), 6 getting-started emails, 2 weigh-in reminders and a few others. Week of 2 November: 40 Weekly Gecko Notes (38 delivered, 1 bounced), 20 weekly digests (19 delivered), 14 getting-started emails, 7 weigh-in reminders. Opens are mostly mail apps, not people (`docs/marketing/email-brain.md`, section 4).
- **Market feed: running again.** The last complete US pass was 10 November and the US Price Index's last full day is 13 November; 8,028 listings were seen in the last 3 days (92.7% coverage) and 280 were new. `daily-canary` has passed every day since 31 October.

## Top ten this week (draft, 14 Nov)

**Draft for Tennyson to rewrite.** E0 rule 5 says he rewrites the top ten every Monday; a Claude session wrote this one on 14 November and checked what it could from production.

1. **Your step: iPhone build 15 from `main` as of 14 November or later**, then the recording, screenshots and submission (`docs/OWNER-STEPS.md`, B3). A build made earlier cannot load geckos any more.
2. **Your step: backup secrets.** The 8 November backup run still skipped its upload. Add `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` at https://github.com/tennysonmilesperhour/geck-inspect/settings/secrets/actions/new (which values: `docs/OPERATIONS.md`, section 2). Until both are set there is no copy of member records outside Supabase.
3. **Your step: admin two-factor.** Still none enrolled on 14 November. Enrol an authenticator app in Settings, Security (`docs/planning/admin-mfa-2026-10.md`, steps 1 to 3).
4. **Your step: make the repository private.** Still public on 14 November (`docs/OWNER-STEPS.md`, C3).
5. **Your step: Stripe refund and dispute events.** Add them to the endpoint at https://dashboard.stripe.com/webhooks, then resend the 17 October `charge.refunded` event.
6. **Your step: photo thumbnails.** Admin panel, System, Photo thumbnails, Make thumbnails (817 older photos on 31 October).
7. **Your step: sign-in link templates (PKCE).** Supabase, Authentication, Email Templates (`docs/planning/deploy-queue-2026-10-03.md`, round 3, item 2).
8. **Your step: Morph ID card views.** Vault secret `morph_share_view_key` (not there on 14 November) and the Vercel setting `MORPH_SHARE_VIEW_KEY`, then a production redeploy.
9. **Your steps: routines access, the Geck Intellect key, monthly cost** (carried over). Give both scheduled routines the repository and connectors at https://claude.ai/code (Routines); replace the revoked Supabase key in the geck-data Vercel project, or pause it; enter last month's total under "Record by hand", Monthly cost.
10. **Done since 31 October: the US market feed is running again** (above), and members can no longer read another member's email address on any row the app shows (`docs/planning/owner-emails-2026-11.md`).

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
