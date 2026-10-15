# Now: the scoreboard

The 90-day plan (Part E5 of `docs/planning/comprehensive-review-2026-10-14.md`) asks one question: will crested gecko breeders pay for records, passports and transfers? These are the numbers that answer it. They live on the admin Funnel card (Admin panel, Overview, and again under Product analytics) and are updated here by hand once a week.

## Where the numbers stand

Read from production on 15 October 2026. Admin account left out of every number.

| Number | Today | Day 30, 17 Nov | Day 60, 17 Dec | Day 90, 17 Jan 2027 |
|---|---|---|---|---|
| Breeder conversations held | 0 recorded | 15+ | 20 | |
| Collections hand-imported | 0 recorded | 5 | 10 | |
| Paying breeders (not comped) | 0 | 2 | 6 | 10+ at $10 a month or more |
| Monthly recurring revenue | $2.99 | | under $50 with cost over $150 is a tripwire | |
| Passports issued | 3 (plus 2 on the admin's geckos) | 10 | 50 | |
| Passports claimed | 0 (plus 2 from the admin's own sales) | | 15 | 25+ |
| Claimers still active 2 weeks on | 0 of 1 | | 3 | |
| Weekly active breeders (logging records) | 2 | | 4+ | 5+ for four straight weeks |
| Weekly active members (signed in) | 9 of 62 | | | |
| Signups, last 7 days | 6 | | | |
| Day-one first gecko rate | 1 of 7 (14%) | | | |
| Monthly cost | not recorded | under $100 | | |

Notes on today's numbers:

- **Paying breeders is 0, not 1.** One member pays $5.99 a month for Breeder, but also holds a goodwill comp (one free month after the paid month, given on 5 October). E5 says a comped account is not evidence, so the card counts them apart. One Keeper pays $2.99, which is the whole of today's recurring revenue. One lifetime Enterprise plan has no payment on record and is not counted.
- **Weekly active breeders, last 8 weeks (newest first):** 2, 2, 1, 1, 1, 3, 1, 3.
- **Email delivery** shows on the card once the email delivery view is in production.

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
- **What weekly active breeders leaves out.** Egg and clutch logging does not count, so a breeder who only logs clutches in breeding season will not show. It also counts geckos the member owns today, so a weigh-in on a gecko later sold through a passport drops out of past weeks.
- **The day 90 paying breeders chip counts every Breeder or Enterprise payer.** The Invest test also asks for $10 a month or more each, and Breeder lists at $5.99, so check the plan prices by eye before calling Invest.
- **Conversations, imports and cost are typed in by you.** Use the "Record by hand" form on the card: pick what happened, the date and the breeder, and save. Add a monthly cost entry once a month (Supabase, Vercel, Resend, AI and the rest). Entries can be deleted from the list under the form.
- **"Plus N" lines** are the admin account's own passports and sales. They are real, but they show your own breeding, not other breeders using the product.

## Updating this page

Once a week, copy the card's numbers into the table above and change the date line. Keep the old numbers out; git keeps the history.
