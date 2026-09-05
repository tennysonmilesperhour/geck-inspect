# RLS policy consolidation (F46 remainder)

Proposed 4 September 2026 from the live performance advisor. Nothing in
this file has been applied yet; each batch becomes one timestamped
migration when approved, applied by hand as described in docs/MIGRATIONS.md.

## Why this matters, in plain language

Row Level Security (RLS) is the set of rules Postgres checks on every row
to decide whether the caller may see or change it. When a table has two
"permissive" rules for the same action, Postgres has to evaluate both on
every row and OR the results. On small tables that costs nothing you can
feel. As gecko_images (3,800 rows), user_events (5,800) and the record
tables grow, it becomes a tax on every query. It also hides mistakes: when
two rules overlap, the looser one silently wins, which is exactly how
gecko_images ended up letting a member update an image after it was
verified (see batch 1).

The advisor lists 274 warnings, but they collapse to 53 tables and a
handful of patterns. Most are the same shape: a SELECT rule plus a
"manage own" or "admins write" rule declared FOR ALL, which implicitly
includes SELECT and so duplicates it. The fix in every case is the same
move: turn the FOR ALL rule into three rules (INSERT, UPDATE, DELETE) and
leave exactly one SELECT rule, folding any extra reader (admin, owner) into
it with OR. Access for real users does not change unless the notes say so.

Verification for every batch: apply inside a transaction, then run the
policy count query and a smoke test that sets `role authenticated` and a
fake JWT for a member and for an admin (`set local request.jwt.claims`) and
confirms the same rows are visible and writable as before. Then re-run the
performance advisor and confirm the table's warnings are gone.

## Batch 1: gecko_images (recommended first, also a security fix)

Nine policies, four duplicate groups. Two generations coexist: a legacy
`public`-role set (read_all, insert_own, update_own, delete_own) and a
newer `authenticated` set that was written to be stricter (insert only
while unverified, owner may update only while unverified, reviewers and
admins may update anything). Because both are permissive, the legacy set
wins: today a member can insert a row with verified = true, and can edit
their image after an expert verified it.

Proposed single set (roles anon, authenticated where reads are public):

| Cmd | Rule |
|---|---|
| SELECT | `true` |
| INSERT | `created_by = (select auth.email()) and verified is not true` |
| UPDATE | using: owner and `verified is not true`, or admin, or expert_reviewer; with check: same |
| DELETE | owner or admin |

Behaviour change: a member can no longer set verified on insert or edit a
verified image. That is the behaviour the newer policies intended.

## Batch 2: profiles UPDATE

`profiles_update_own` and `profiles_update_admin` both allow UPDATE. Merge
into one: using `email = (select auth.email()) or created_by = (select
auth.email()) or is_admin()`, with check the same. The privileged-column
triggers keep doing the real protection. No behaviour change.

## Batch 3: the records tables (feeding, shed, vet, ownership, transfer)

Each has a scoped `*_read` SELECT (author, owner, admin, or public
passport) plus "Users manage own ..." FOR ALL. Replace each FOR ALL with
INSERT / UPDATE / DELETE on `created_by = (select auth.email())`. The
SELECT already covers the author, so nothing changes for anyone.
transfer_requests is the same shape with its "Sender and recipient read"
policy.

## Batch 4: public read plus "Users manage own" (12 tables)

answers, breeder_profiles, breeder_reviews, breeding_loans,
breeding_projects, clutches, collection_valuations,
genetic_outcome_predictions, morph_price_entries, price_alerts,
question_votes, questions. All have SELECT `true` plus a FOR ALL owner
rule with no WITH CHECK (so the USING expression doubles as the insert
check). Split the FOR ALL into I/U/D on `created_by = (select
auth.email())`. No behaviour change.

Flag, separate decision, not part of the merge: collection_valuations,
price_alerts and breeding_loans are readable by everyone including
visitors. Valuations are a member's collection worth, alerts are their
buying intent, loans carry stud fees. These probably want owner-only
SELECT like the record tables got in batch D. Say the word and batch 4
tightens them at the same time.

## Batch 5: public read plus "admins write" (14 reference tables)

care_guide_sections, change_logs, expert_actions, forum_categories,
gecko_of_the_day, morph_guides, morph_price_cache, morph_traits,
page_config, payment_events, user_badges, plus admin_tasks (admin-only
both ways, so simply drop the redundant "Admins read tasks") and
app_settings (three SELECT rules, fold to one: `is_public = true or
is_admin()`). Split each `*_write_admin` FOR ALL into I/U/D on
`is_admin()`. Where the read rule already lets admins see everything
(change_logs, expert_actions, payment_events) nothing else changes; the
others are public anyway.

## Batch 6: store tables

store_categories, store_products, store_promo_codes, store_vendors: public
read of active rows plus admin FOR ALL. Admins currently see inactive rows
through the FOR ALL rule, so the merged SELECT must be `<active condition>
or is_admin()`, then admin write becomes I/U/D. store_orders: one SELECT
`own or is_admin()`, admin I/U/D. store_order_items: merge the two SELECTs
with OR. store_fulfillments: same as orders. testimonials: SELECT
`approved = true or is_admin()`, admin I/U/D. No behaviour change.

## Batch 7: blog tables

blog_categories, blog_posts, blog_tags: `*_admin_all` (authenticated, FOR
ALL, is_blog_admin()) plus `*_public_read`. Blog admins need to see drafts,
so the single SELECT becomes `<public condition> or is_blog_admin()` and
admin write becomes I/U/D. No behaviour change.

## Batch 8: collections, members, messages, votes, offers, waitlists

- collections: one SELECT `owner or is_collection_member(...)`; owner I/U/D.
- collection_members: one SELECT `member or owner`; one UPDATE `member or
  owner`; owner INSERT and DELETE.
- direct_messages: drop "users can unsend own recent messages". The
  authenticated `direct_messages_delete_own` already allows a sender to
  delete at any time, so the five-minute rule has been dead since it was
  added. If the five-minute limit is what you actually want, say so and
  the merge goes the other way (keep the window, drop sender from the
  broad rule).
- classification_votes: one SELECT `true` (authenticated) since any
  signed-in member may already read every vote; one INSERT `created_by =
  email or reviewer_email = email`.
- mentor_offers, gecko_waitlists: split the owner FOR ALL into I/U/D.

## Out of scope for this repo: geck_data

Four geck_data tables (breeding_pairs, clutches, hatchlings, profiles) have
the same owner-FOR-ALL plus admin-read shape, and 14 geck_data policies
still call auth.uid() per row. That schema is owned by the geck-data
repo's migrations, so the fix belongs there (same recipe: split FOR ALL,
wrap auth.uid() in a sub-select).

## Bonus: four duplicate indexes

feeding_records, ownership_records, shed_records and vet_records each
carry two identical indexes on animal_id (`idx_*_animal` and
`*_animal_id_idx`). Dropping one of each pair is free and safe; it can ride
along with batch 3.
