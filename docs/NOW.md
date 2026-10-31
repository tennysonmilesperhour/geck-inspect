# Now: the scoreboard

The 90-day plan (Part E5 of `docs/planning/comprehensive-review-2026-10-14.md`) asks one question: will crested gecko breeders pay for records, passports and transfers? These are the numbers that answer it. They live on the Weekly scoreboard card, just above the Growth funnel card (Admin panel, Overview, and again under Product analytics), and are copied here by hand once a week. The card reads `admin_scoreboard()` (migration `20261015151500_scoreboard.sql`, in production).

## Where the numbers stand

Read from production on 28 October 2026 (about 02:00 UTC), from `admin_scoreboard()` and `admin_revenue_summary()` run as the admin. Admin account left out of every number, as before. The TestFlight sandbox Breeder purchase is left out too: it belongs to an internal QA test account and every App Store event behind it is a sandbox (test) event, so no money moved and real paying breeders are 0.

| Number | Today | Day 30, 17 Nov | Day 60, 17 Dec | Day 90, 17 Jan 2027 |
|---|---|---|---|---|
| Breeder conversations held | 0 recorded | 15+ | 20 | |
| Collections hand-imported | 0 recorded | 5 | 10 | |
| Paying breeders (not comped) | 0 (the card shows 1, the sandbox purchase) | 2 | 6 | 10+ at $10 a month or more |
| Recurring revenue, comps left out (scoreboard) | $2.99 (the card shows $7.99 with the sandbox purchase) | | | |
| Monthly recurring (Revenue card, matches Stripe) | $8.98 ($5.99 of it ends about 1 Nov) | | under $50 with cost over $150 is a tripwire | |
| Passports issued | 4 (plus 2 on the admin's geckos) | 10 | 50 | |
| Passports claimed | 0 (plus 3 from the admin's own sales) | | 15 | 25+ |
| Claimers still active 2 weeks on | 0 of 0 (admin's own sales left out) | | 3 | |
| Weekly active breeders (logging records) | 2 | | 4+ | 5+ for four straight weeks |
| Weekly active members (signed in) | 11 of 76 (10 of 71 with internal accounts left out) | | | |
| Signups, last 7 days | 5 | | | |
| Day-one first gecko rate | 0 of 5 (0%) | | | |
| Monthly cost | not recorded | under $100 | | |

**Day 30 gaps (17 November, 20 days away):**

- Breeder conversations: 0 of 15.
- Collections hand-imported: 0 of 5.
- Paying breeders: 0 of 2.
- Passports issued: 4 of 10.
- Monthly cost: not recorded, so "under $100" cannot be checked yet.

Under the Day 30 rule, fewer than 15 conversations means engineering pauses and the time goes to conversations. If some conversations have happened but were not typed in, record them on the card: the scoreboard only knows what "Record by hand" holds.

Notes on today's numbers:

- **Paying breeders is 0; the card shows 1.** The card counts the sandbox purchase as a Breeder annual plan ($60 a year, so $5.00 a month at list price, which is why its revenue tile reads $7.99). The change that leaves sandbox purchases and internal accounts out of the card ships today; until it is live, use this page's numbers.
- **The Stripe Breeder month.** One member paid $5.99 for one month of Breeder on 1 October (UTC) and cancelled 45 minutes later, so the plan ends about 1 November (Stripe's date is 05:11 UTC) and does not renew. A goodwill comp (given on 5 October) keeps them on Breeder until 1 December. E5 says a comped account is not evidence, so the scoreboard leaves them out of paying breeders and its revenue figure. One Keeper pays $2.99 a month, which is the whole of the scoreboard's recurring revenue. One lifetime Enterprise plan has no lifetime payment on record and is not counted (a lifetime plan counts only when the ledger holds a lifetime purchase; an older monthly payment does not make it paid).
- **Revenue today.** The scoreboard shows $2.99 (the Keeper). The Revenue card on Admin, Overview shows $8.98: the Keeper plus the cancelled Breeder month, which shows under "Cancellations scheduled" and drops off about 1 November. From then both should read $2.99. The day 60 tripwire uses the Revenue card's figure ("Two revenue figures" below says why).
- **The $2.99 refund (17 Oct) is still not on the Revenue card** (refunds read $0 on 28 October). Stripe sends the app only the events its webhook endpoint is subscribed to, and `charge.refunded` and the dispute events were never added there. Adding them is line 9 of the top ten below; then resend the refund's `charge.refunded` event from its page in the Stripe Dashboard.
- **Weekly active breeders, last 8 weeks (newest first):** 2, 2, 1, 3, 0, 1, 1, 3. Each is a 7-day window ending when the card was read, then a week earlier each time (windows ending 27 Oct, 20 Oct, 13 Oct and so on back to 8 Sep, in Denver dates; computed from today's owners, see "What weekly active breeders leaves out" below). This week's 2 are both real breeders. The week to 20 October includes the internal QA account; without it that week is 1. The 17 October reading used windows ending that day, so the two series do not line up week for week.
- **Weekly active members** is 11 of 76 on the card. Five of the 76 are internal: the QA account (active this week), a test account on the admin's own address and the three App Store review accounts. With them left out it is 10 of 71. The Morph ID evaluation account was already left out.
- **Passports.** 4 issued, by 4 different members (3 on 17 October). None has been claimed yet; all 3 claims so far are buyers of the admin's own sales, which is also why "Claimers still active 2 weeks on" is 0 of 0.
- **Conversations, imports and monthly cost read 0 or "not recorded"** because `scoreboard_entries` is empty: nothing has been typed into "Record by hand" yet.
- **Signups and the first-gecko rate.** 5 signups in the last 7 days. The rate uses accounts from 8 to 1 days old, so every account in it has had a full first day: none of those 5 added a gecko on day one (1 of 5 on 17 October).
- **App Store payers** count by their `keeper` or `breeder` entitlement, Breeder winning when a member has both. Trials, promotional grants and RevenueCat's Test Store do not count; the legacy `Geck Inspect Pro` entitlement belongs to Test Store products (`docs/BILLING.md`). Apple sandbox purchases still count on the card until today's change is live; the only active App Store entitlement on 28 October was the QA sandbox purchase.
- **Email delivery** on the card now shows delivered, opened, clicked and bounced as well as sent, because the Resend webhook has been live since 24 October. Opens are mostly mail apps, not people (`docs/marketing/email-brain.md`, section 4). The weekly email log is section 8 of that file.

## Top ten this week (draft, 28 Oct)

**Draft for Tennyson to rewrite.** E0 rule 5 says he rewrites the top ten every Monday; a Claude session wrote this one from production and the work shipping on 28 October.

1. **Breeder conversations.** 0 of 15 with 20 days to Day 30. Book them before anything else, offer a hand import in each (0 of 5), and record both under "Record by hand". The questions, the $120 offer and a block to fill in per call are in `docs/planning/breeder-interviews-2026-10.md`.
2. **Shipping today: Pattern studio crash fixed.** The Morph Guide's Pattern studio tab no longer blanks the whole page.
3. **Shipping today: email address exposure, step 1.** The app stops reading other members' addresses; step 2, the database lock, follows once open tabs have reloaded.
4. **Shipping today: an honest scoreboard.** Sandbox purchases and internal accounts are left out, and a "prepaid" entry records a Founding Breeder year paid outside Stripe.
5. **Shipping today: Morph ID photo path to a first gecko.** A Morph ID result in the guided first gecko becomes a saved gecko.
6. **Shipping today: passport funnel tracking, and Sold offers the transfer.** Marking a gecko Sold offers to send the buyer a transfer link. The gecko stays private, and a link already sent is never replaced without saying so.
7. **Shipping today: admin two-factor in Settings, Security.** Enrol an authenticator app before the 16 November reminder; requiring it for admin powers waits until you have.
8. **Your step: backup secrets.** Add `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` at https://github.com/tennysonmilesperhour/geck-inspect/settings/secrets/actions/new (which values: `docs/OPERATIONS.md`, section 2). Until then there is no copy of member records outside Supabase.
9. **Your step: Stripe refund and dispute events.** Add them to the endpoint at https://dashboard.stripe.com/webhooks, then resend the 17 October `charge.refunded` event.
10. **Your steps: routines access, the Geck Intellect key, monthly cost.** Give both scheduled routines the repository and connectors at https://claude.ai/code (Routines); replace the revoked Supabase key in the geck-data Vercel project, or pause it; enter last month's total under "Record by hand", Monthly cost.

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

Once a week, copy the card's numbers into the table above and change the date line. Keep the old numbers out; git keeps the history. Leave out anything the notes say to leave out (the sandbox purchase, until the card does it itself).
