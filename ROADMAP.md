# ROADMAP.md - Geck Inspect

Last updated: 16 October 2026

## The plan

The active plan is **Part E of `docs/planning/comprehensive-review-2026-10-14.md`**: a 90-day plan that ends on decision day, 17 January 2027.

> **15 October 2026:** Tennyson asked for the whole of Part E to be implemented, following the review's own recommendations. Part E is therefore no longer a proposal; it replaces the feature audit as the active plan (rule E0.5). Items that only Tennyson can do (money, accounts, legal identity, approving customer-facing copy, tests on a phone) are built as far as a session can take them and then wait for him.

How to work it:

1. **E0** sets five rules. The most important: the next 90 days are a sales experiment (will crested gecko breeders pay for records, passports and transfers?), and breadth is frozen (no new pages, species, tiers, tools or integrations until weekly active breeders grow four weeks in a row).
2. **E1 to E4** are the work, in order: days 1 to 7 (security holes, alerts, backups, breeder outreach), weeks 2 to 4 (reminders, lifecycle emails, the Morph ID card, Stripe hygiene, docs, legal basics), weeks 5 to 8 (retire breadth, one gecko record, a Today screen, performance, SEO, domain fixes, testing, privacy), weeks 9 to 13 (decisions with evidence).
3. **E5** is the scoreboard (paying breeders, passports issued and claimed, weekly active breeders, monthly cost) with checkpoints on 17 November, 17 December and 17 January. The weekly top ten goes in `docs/NOW.md`.
4. **E6** lists what not to do before decision day.

"What's next on the roadmap?" means the first unfinished item in Part E. Progress is recorded with a dated line on the item or in `docs/NOW.md`.

The earlier plan, `docs/planning/feature-completeness-audit-2026-09-29.md`, is kept as reference: its status lines say how finished each feature is, and its section 8 phone and money checks still apply. Where it and Part E disagree, Part E wins.

## Shelved until Tennyson says otherwise

- **Blog posts and articles (shelved 30 Sep).** Don't write, draft, publish or suggest articles or blog posts, and don't turn the blog pipeline back on (paused since 15 July in `.github/workflows/blog-pipeline.yml`). The blog stays live as it is. The comparison draft stays in `docs/drafts/` untouched. The weekly growth report still lists search queries with no matching page as blog topics; treat those as data, not tasks. The blog half of plan step 33 waits with this.
- **Morph relationship explorer (shelved 16 Oct).** The former “Morph family map” is removed from the public Morph Guide but its component is retained in `src/components/morphguide/MorphFamilyMap.jsx`. Do not restore the current all-at-once network: “family” wrongly implies taxonomy or inheritance, while its edges only represent hand-authored common pairings and visual lookalikes. A future replacement should focus on one selected morph, clearly separate appearance, genetics and breeding relationships, use only individually reviewed example images, explain every connection, and ship only after the relationship data and the complete image set have been independently validated. The existing Patternless illustration is not an approved reference image.

## Retired 30 Sep

Everything left on the old roadmap no longer applies. The old item numbers are listed because older docs and code comments refer to them. Anything still worth doing is already in the plan above. In this table, "the plan above" and "plan step N" mean the feature audit (`docs/planning/feature-completeness-audit-2026-09-29.md`), which was the active plan when the table was written on 30 September.

| Old item | What happened |
|---|---|
| 1. Crested-gecko-first site audit | Done |
| 2. Confirm pricing | Documented in DECISIONS.md decision 27 |
| 3. SEO baseline tracking | Done: weekly growth report and SEO audit |
| 4. Comparison article | Shelved with the blog |
| 5. Breeder outreach | Retired |
| 6. NRBE Daytona | Retired (the date passed) |
| 7. PWA | Done. Offline is limited on purpose: the app opens, My Geckos and Field Mode show the last loaded collection, and Field Mode logs (feeding, shed, weight, note) wait on the phone and sync when back online. Everything else needs signal (plan step 2) |
| 8. Moat feature | Done: the genetics calculator |
| 9. Keeper product | Built; vet records are plan step 1 |
| 10. MorphMarket export | Done; the importer check is plan step 19 |
| 11. Content infrastructure | Done; the editorial calendar is shelved with the blog |
| 12. Shed prediction | Built |
| 13. Become institutional | Retired |
| 14. Genetic testing partnership | Retired |
| 15. International expansion | Retired |
| 16. Apps in both stores | Plan step 9; store billing steps moved to `docs/app-store-billing.md` |
| 17. Trademark and domains | Retired |
| 18. Data export messaging | Done |
| 19. Morph calculator plan | Done (18 Aug) |
| NOW list A to F (29 Sep) | F became the plan above and C is its section 8; A, B, D and E are retired |
| Launch review F43 and F55 | In the plan: F43 (enforce the CSP) is in step 34, F55 (real iPhone check) is in section 8 |
| VIP audit phased plan | Complete 29 Sep (sections 2E and 2F of `docs/planning/vip-audit-2026-09-27.md`) |
| Morph ID accuracy (parked 29 Sep) | The roadmap item was retired; notes kept in section 2A of the VIP audit. Morph ID itself kept shipping: outage handling that hands the scan back (13 Oct), Sable and Highway labels (written 14 Oct, live 15 Oct when the Supabase GitHub integration deployed `recognize-gecko-morph` from `main`), and the `morph-id-eval` workflow that grades it on held-out listings |
