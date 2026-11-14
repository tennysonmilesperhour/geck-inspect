# Private sale prices, 13 November 2026

What a gecko sold for, and what a buyer paid on a claimed transfer, were readable by members who had no business seeing them. This file says what was wrong, what was weighed, what was built, how it was checked, and what is left. It was raised as decision E14 in `docs/OWNER-STEPS.md` and built the same day, when Tennyson asked for it.

## 1. What was wrong

Checked against production on 13 November 2026.

| Where | Who could read it | Live data |
|---|---|---|
| `geckos.sold_price` | Every signed-in member, on any gecko with `is_public = true` (the read rule `geckos_read_visible`) | 9 geckos had a sale price, and all 9 were public. 325 of 391 geckos are public |
| `ownership_records.sale_price` | Anyone, signed in or not, on a gecko whose passport is public (`ownership_records_read`); also every later owner of the animal (`ownership_records_read_animal_owner`) | 6 records, none with a price yet. The next claimed transfer with a price on a passport gecko would have published it |

No screen showed another member's sale price. The data was readable through the API by anyone with an account and some skill, and the passport page asked for the ownership price column without showing it. An earlier note ("a gecko that has a passport shows its sold price") understated it: almost every gecko is public whether or not it has a passport.

## 2. What was weighed

1. **Take the column away from members** (`revoke select (sold_price) ... from authenticated`), the way signed-out visitors lost `created_by` in October. Rejected: Postgres refuses a whole `select *` once one column in it is not granted, and the app reads geckos with `select *` in dozens of places. Every open tab would fail to load My Geckos until reloaded, and the owner could no longer read their own price.
2. **Hide the rows behind a view.** Rejected: every page that reads other members' public geckos (the gallery, breeder pages, lineage, the passport) would have to move to the view at once, and an open tab would show empty pages.
3. **Move the price to its own table that only the owner can read, and leave the old column always null.** Chosen. Nothing an open tab asks for is refused. A tab from before the change reads null where it used to read the price (Business then counts the asking price) until it reloads, and its saves still land, because the database moves any price written to the old column.

## 3. What was built

Migration `supabase/migrations/20261113172624_private_sale_prices.sql`:

- **`gecko_sale_prices`** (one row per gecko with a price). Read: the gecko's owner, members of a shared collection it sits in, admins. Delete: the owner, collection editors, admins (the same people who may edit the gecko). Insert and update: nobody directly.
- **`ownership_record_prices`** (one row per ownership record with a price). Read: the member the record belongs to (the buyer) and admins. The seller still sees the price on the transfer request, as before.
- **Triggers.** A price written to `geckos.sold_price` or `ownership_records.sale_price` is moved into the new table and the column is set to null. A gecko's price is deleted when the gecko is unarchived (the sale is undone; My Geckos and the record page cleared it this way before) and when the gecko changes owner (a claimed transfer or a deleted account, both of which cleared the column before). So `claim_transfer` and `admin_erase_account` needed no change.
- **The activity feed of a shared collection** still lists "sale price" when a member changes one, from a trigger on the new table. Undoing a sale or a change of owner adds nothing extra: those already write their own entries.
- **The 9 existing prices were moved** in the same migration, with the "last changed" stamp and the activity feed paused for that one statement, as `20261002220914` and `20261003004122` did.

The app (`src/lib/geckoSalePrices.js`, wired in `src/api/supabaseEntities.js`):

- The Gecko entity puts the price back on every gecko it reads or saves, so every screen keeps using `gecko.sold_price` unchanged. It reads the member's prices once and keeps them for 30 seconds. Nothing is read for a signed-out visitor or in the demo.
- Saving a price works as it did (the trigger moves it). Taking a price away cannot be seen by the database, since the column is always null, so a save with `sold_price: null` also deletes the row.
- The long form saves through `save_gecko_record`, which never touches the price; its result gets the price merged back.
- The data export includes `ownership_record_prices`; gecko prices are already in the exported geckos.
- The code loads with the first gecko read, not with the app. To keep every public page under its size limit, the time zone helper that runs after sign-in now loads the same way. Every page loads about 0.25 kB less than before this change.

## 4. A hole found and closed while building it

A trigger runs before an insert is checked for a duplicate id. So a member could insert a "new" gecko that names another member's gecko id, with a price and `on conflict do nothing`: the trigger would overwrite the other gecko's private price, and then the insert would do nothing. The triggers now store a price on an insert only when no row with that id exists. The regression file proves it (without the guard, the test shows another member setting Alice's price to $1).

## 5. How it was checked

- **SQL harness**, on Postgres 16 with every migration replayed (327): `supabase/tests/private_sale_prices_regressions.sql` and all 40 other SQL test files pass, the transfer race checks pass, and a second run of the migration changes nothing. The new test fails, as it should, against a copy whose read rule lets every member in and against a copy without the insert guard.
- **Unit tests**: `src/lib/__tests__/geckoSalePrices.test.js` (the store) and `src/api/__tests__/geckoSalePrices.entity.test.js` (the Gecko entity against a fake database that behaves like the triggers), plus the whole suite.
- **Browser tests**: the fake database in `e2e/support/fake-supabase.js` now moves prices the way the triggers do, and `e2e/member-flow.e2e.js` checks that marking Mango sold for $300 leaves the gecko's row at null and puts 300 in `gecko_sale_prices`.
- **After the merge** (applied 13 November, about 17:58 UTC), read-only in production: no gecko or ownership record holds a price in the old column; `gecko_sale_prices` holds the 9 moved prices; a signed-in account that owns none of them reads none of them (it still sees the 325 public geckos); the owner of one sold gecko reads that one price.

## 6. What it does not cover, and what is next

1. **Owner email addresses** (`created_by`) are still readable by signed-in members on every public gecko, and on public breeding plans and the weight, feeding, shed, vet and ownership records of public passports. Profiles are not (only the member and admins read them). Holding the email back means the same two-step change already done for photos and forum posts on 31 October: the app reads named columns and identifies the owner by `owner_profile_id`, then the column is taken away from members. For geckos that is larger, because the app compares `gecko.created_by` with the member's email to decide what they may edit, in many places. Estimate: two to three days, with step 2 waiting a few days after step 1. Decision E16 in `docs/OWNER-STEPS.md`.
2. **The passport step on the sold sheet** (`OFFER_PASSPORT_AT_SALE` in `src/components/transfers/SellHandoverSheet.jsx`) was switched off because a passport would have shown the sale price. Switched back on on 14 November 2026, once members could no longer read the owner's email either (decision E15; `docs/DECISIONS.md`, entry 69).
3. **The old columns** stay, always null, with a comment saying so. Dropping them would break any client that still names them; there is no reason to.
4. **New price columns** go in a table only the owner can read, never on a row others can read (`docs/RULES.md`, section 5; `docs/DECISIONS.md`, entry 67).
