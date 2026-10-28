# Breeder conversations, October and November 2026

The 90-day plan's Day 30 check (17 November) needs 15 breeder conversations on record. Fewer than 15 means engineering pauses and the time goes to conversations (`docs/NOW.md`). On 28 October none were recorded. This file is where each one goes, so the answers are in one place when the Day 30 and Day 60 decisions are made.

Two places to record each call:

1. **The scoreboard**, so the count is right: Admin panel (https://geckinspect.com/AdminPanel), Overview, Weekly scoreboard, Record by hand. Kind "Conversation", the date, the breeder's name. An imported collection is a second entry, kind "Import". A breeder who pays the $120 Founding Breeder year is recorded too (see "If they say yes" below).
2. **This file**, so the answers are kept. Copy the blank block at the bottom, fill it in after the call, and commit it (or paste it to a session and ask for it to be added).

This repository is public. Write each breeder as a short label you will recognise (a first name and a town, or a business name they already show publicly), never an email address or phone number.

## Who to talk to first

- **The breeders from the old platform** whose geckos are still on file but who never made a login on the new one (8 of them, 150 geckos, on 27 October). They cannot get the app's emails, so write to each one personally from your own inbox. The query that lists them is in the 27 October report (`select p.email, ... having count(g.id) >= 5`); run it in the SQL editor, never commit its results.
- **The breeder who came back on 11 October** and has loaded 20 geckos.
- **The outreach list** in the breeder tracker, warmest first.
- About 5 calls a week reaches 15 by 17 November.

## The conversation (15 minutes)

From `docs/planning/growth-plan-2026-10.md`, section 5. Ask in this order, and listen more than you talk.

1. How do you track your collection today (spreadsheet, MorphMarket, notebook, an app)? What do you hate about it?
2. Walk me through the last gecko you sold. Where did the buyer find you, and what did they ask for?
3. What would make you give a buyer a Geck Inspect passport with every animal?
4. Which of these would you pay for: lineage and passports, the genetics calculator, reminders, a breeder page, Morph ID?
5. Watch them add one gecko on their own phone without help. Note every hesitation.

Then the offer (Part E, item 14 of `docs/planning/comprehensive-review-2026-10-14.md`):

- **The Founding Breeder year: $120, paid up front.** Prepayment is the test. A comped account is not evidence.
- **The one ask:** the passport QR card goes with every animal sold.
- **Offer to import their collection for them** (a spreadsheet or a MorphMarket export).
- Comp through `membership_comps` only a breeder who declines to pay but will send cards.

## If they say yes

- **To the $120 year:** take it with a Stripe Payment Link made in the Stripe Dashboard (no change to the public prices), give the access with a `membership_comps` row, and record a "Prepaid" entry on the scoreboard with their name and the amount, so they count as a paying breeder. The prepaid entry kind ships with the scoreboard work of 28 October; until it is live, note the payment here and in the scoreboard's Conversation note.
- **To an import:** send the file to a session ("import this collection for <label>"), then record an Import entry.
- **To sending cards:** note how many animals they sell a year. Each one is a keeper who arrives with a gecko already in their account.

## What to listen for

- The words they use for their records and their buyers. Those words belong on the landing page.
- Whatever they already pay for (MorphMarket, a website, a spreadsheet template). That is the real price comparison.
- Any hesitation in question 5. Each one is a bug in the first five minutes.
- Whether a passport sounds like a gift to the buyer or extra work for them.

## Conversations

### Template (copy this block)

```
### <date>: <short label, no email or phone>

- Where they sell, and about how many animals a year:
- Followers or audience (approximate):
- 1. How they track today, and what they hate:
- 2. The last sale (where the buyer found them, what the buyer asked):
- 3. What would make them give a passport with every animal:
- 4. What they would pay for:
- 5. Adding a gecko on their phone (every hesitation):
- The $120 Founding Breeder year: yes / no / maybe, and why
- Will send passport cards with sales: yes / no / maybe
- Wants their collection imported: yes / no (format: spreadsheet / MorphMarket / other)
- Follow-up promised, and by when:
- Recorded on the scoreboard: Conversation / Import / Prepaid
```

No conversations recorded yet (28 October 2026).
