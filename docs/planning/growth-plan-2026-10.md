# Growth plan, October 2026

This pulls together five reviews done on 5 October: the competitor research (`competitive-landscape-2026-10.md`), the funnel analysis from production data (`growth-funnel-2026-10.md`), a real-browser test of the app (`qa-2026-10-05.md`), the first-impression review (`first-impression-2026-10.md`) and the measurement work (`instrumentation-2026-10.md`). Read this first; the others hold the evidence.

## 1. Where Geck Inspect stands

**The product is broad; the business is not working yet.** About 2,000 visitor sessions a month become about 20 signups. 7 add a gecko. Since mid-September, nobody has come back a week later. Real recurring revenue is $8.98 a month, and the one Breeder subscriber cancelled 45 minutes after paying (a credit-counting bug gave them 5 of their 6 Morph IDs; fixed 5 Oct). The admin account is most of all activity, so most dashboards were measuring Tennyson.

**The market moved.** Breed Ledger went multi-species and aims at dog breeders ($29 to $49 a month, about 33 breeders reported). ReptiDex is barely maintained and Geckistry runs on Breed Ledger. MorphMarket added husbandry reminders, live auctions and sold prices. Palmstreet live auctions are where the big crested breeders sell now. AI morph ID is no longer rare (Geckistry's is free).

**What Geck Inspect still uniquely has:** the deepest crested-gecko knowledge in one place (genetics with reverse calculation and clutch odds, Morph Guide, care guide, growth, breeding readiness), a Morph ID that admits uncertainty, lineage with passports and transfers, and the lowest paid prices.

**What it lacks:** an app in the stores, a place where buyers already are, proof on the landing page, and evidence that a newcomer gets value in the first five minutes.

## 2. The strategy in one line

Win crested gecko keepers one gecko at a time: get the first gecko in within a minute, give a personal reason to come back each week, and make every gecko a breeder sells carry Geck Inspect to the buyer.

Three loops matter, in this order:

1. **Activation:** first gecko in under a minute, with its lineage card, its value and what it needs next. Success: 60% of signups add a gecko on day one (today 32%).
2. **Retention:** personal reminders (weigh-ins, feeding, hatch dates, vet follow-ups) and a weekly note about your own animals, not a generic digest. Success: weekly active keepers (members logging care for their own geckos in the last 7 days, admin excluded) grows every week from about 1 today.
3. **Distribution through breeders:** every animal a breeder sells goes out with a passport QR card and a transfer link, so the buyer arrives with a gecko already in their account. Success: signups that arrive by passport, transfer, waitlist or store link.

North-star metric: **weekly active keepers**. It is on the admin Funnel card (with signups, first gecko within a day, and day-1 and week-2 return by source).

## 3. What changed on 5 October

- Measurement: first-touch source on every signup, the full first-gecko and care-logging funnel, admin excluded, and an admin Funnel card.
- Morph ID: no double charges on retries, slow runs refunded, the upgrade-month bug fixed (live, v64).
- Newcomer path: breeders no longer get a 24-step tour before their first gecko; one "Start free" button; the free calculator and Morph ID sit under the hero; plan buttons go to Create Account; the Enterprise card no longer shows a price for something that does not exist; spreadsheet import is offered in every empty state; the hero image is a third of its old size.
- Bugs found in a real browser: the demo Hatchery error, blocked placeholder images, stacked reminder cards, and pages Google could index for made-up breeder names.

In progress: a guided first gecko (photo or name, then parents, then the payoff screen), default reminders after the first gecko, a better demo (try adding a gecko, see sample prices), product screenshots on the landing page, a faster landing page, and sign-up prompts on the Morph Guide, Care Guide and calculator.

## 4. The next 30 days

| Week | Build (Claude sessions) | Tennyson |
|---|---|---|
| 1 (6 to 12 Oct) | Finish activation and landing work; review the Funnel card daily | Run `deploy-queue-2026-10-03.sql`; email the cancelled Breeder member and give back the credit; 5 breeder conversations (script below); NARBC Tinley Park is 10 to 11 Oct |
| 2 | Welcome and first-week emails (copy for approval); personal weekly note instead of the generic digest | Approve email copy; recruit 10 to 20 mid-size crested breeders for a free Breeder year |
| 3 | Breeder kit: printable passport QR cards for every sale, transfer link at checkout, "your crested gecko website for $5.99" page; MorphMarket import | Test the MorphMarket CSV round trip; send passport cards with sales |
| 4 | iPhone app: store listing, TestFlight, native push | Store accounts, screenshots, App Review |

Hold back: new features outside these three loops. Promote, the AI Consultant, the forum and the store stay as they are until activation and retention move.

## 5. Talk to five breeders this week

What only real users can tell us. Fifteen minutes each, on a call or at a show:

1. How do you track your collection today (spreadsheet, MorphMarket, notebook, an app)? What do you hate about it?
2. Walk me through the last gecko you sold. Where did the buyer find you, and what did they ask for?
3. What would make you give a buyer a Geck Inspect passport with every animal?
4. Which of these would you pay for: lineage and passports, the genetics calculator, reminders, a breeder page, Morph ID?
5. Watch them add one gecko on their own phone without help. Note every hesitation.

Write the answers in `docs/planning/breeder-interviews-2026-10.md`. Five honest conversations are worth more than any analysis in this folder.

## 6. Decisions waiting on Tennyson

- Run the SQL script (account erasure and the signed-out email lockdown).
- Email the cancelled Breeder member before 1 November and restore one October Morph ID credit.
- Are the first two paying members supporters or test accounts? If so, only one real member has evaluated and paid.
- Is `VITE_POSTHOG_KEY` set in production? PostHog may hold a month of visitor sources the database does not.
- Change the support address on the pricing page from the personal Gmail to a geckinspect.com address.
- Check the public Base44 page titled "Geck Inspect" that shows up in Morph ID searches (probably the old prototype) and take it down.
- The care guide uses en dashes in 78 number ranges ("15 to 20"); change them to "to"?
- Paid members are still charged for a "better photos needed" Morph ID answer (only the free try is refunded). Keep or refund?
