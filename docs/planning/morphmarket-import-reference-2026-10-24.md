# MorphMarket import reference, 24 October 2026

Source: the signed-in [Import Animals page](https://www.morphmarket.com/inventory/import), Supported Fields section, read on 24 October 2026. Both the new spreadsheet and Old Import show this list. The completed live checks below also prove creation, updates and return import for two disposable Not For Sale records.

The [Seller's Guide](https://support.morphmarket.com/article/123-importing-exporting-animals), updated 15 October 2026, confirms CSV, TSV and JSON input, a 1,000-row spreadsheet limit, matching updates by Animal_ID, and the Synchronize/Replace option. Leave that option off for partial batches: it archives animals missing from the upload. Hidden spreadsheet columns still participate in an import.

## Complete supported field list

Names below are the canonical spellings displayed by the importer. Boolean fields accept `Yes, No, True, False, Y, N, T, F, 1, 0`.

| Field | Accepted values and constraints |
| --- | --- |
| Category | Required species category. The real export uses Crested Geckos. Accepted for both disposable listings in the live upload. |
| Title | Required text, maximum 200 characters. Traits are inferred from it unless Traits is supplied. |
| Animal_Id | Required unique seller ID, maximum 100 characters. Letters, numbers, hyphen, slash, dot, underscore. Spaces become underscores. Existing ID updates; new ID creates. |
| Maturity | Required for animals. Baby, Juvenile, Subadult, Adult, Not Ready. Hatchling also means Baby. |
| Price | Seller Profile currency, excluding shipping. Positive price required for For Sale and Sold. `inquire` depends on membership. |
| State | For Sale, Not For Sale, Sold, On Hold, Breeder, Holdback, Pet, For Sale (Needs Image), Loaned, Archived, Deleted. Blank defaults to For Sale even on updates. |
| Visibility | Public (default), Unlisted, Private. Works together with State and Enabled. |
| Enabled | Active (default), Inactive, Expired. Works together with State and Visibility. |
| Sex | Male or M; Female or F; Unsexed or U; Mixed. Blank means Unsexed. Sex counts in Quantity take precedence. |
| Dob | YYYY, YYYY-MM, YYYY-MM-DD, MM-YYYY, MM-DD-YYYY, Mon DD YYYY, DD-Mon-YYYY, Mon-YYYY. Use hyphens for year-first dates. |
| Weight | Positive whole grams, without a unit. |
| Quantity | Whole total, male.female, or male.female.unsexed. Default 1. Multiple sex counts create separate IDs with sex suffixes. |
| Group_Id | Up to 50 characters using letters, numbers, hyphen, slash, dot, underscore. No spaces. |
| Traits | Recognized category-specific names separated by spaces. Overrides title-derived traits; blank uses the title. |
| Photo_Urls | Public HTTP(S) links separated by spaces or commas. Shared Google Drive file links supported. Supplied links replace photos; blank preserves photos. Photos are downloaded after import. New For Sale listings require a photo before public display. |
| Video_Url | One HTTP(S) YouTube or Vimeo link. |
| Desc | Public listing description, maximum 3,000 characters. |
| Length | Number without units; Length_Type required with it. |
| Length_Type | total_length_m, total_length_cm, snout_to_vent_m, snout_to_vent_cm. Length required with it. |
| Proven_Breeder | Boolean; blank means unknown. |
| Is_Group | Boolean. Yes prices the group as a lot; No prices each animal individually. |
| Wholesale_Price | Seller Profile currency, excluding shipping. Required when Wholesale_Only is Yes. |
| Wholesale_Only | Boolean; Yes requires Wholesale_Price. |
| Wholesale_Description | Up to 3,000 characters. The page says this saves on updates only, not newly created animals. |
| Origin | Self Produced, Captive Bred, Captive Hatched/Born, Wild Caught. |
| Diet | Comma-separated: Rat (Live), Rat (Frozen/Thawed), Rat (Pre-Killed), Mouse (Live), Mouse (Frozen/Thawed), Mouse (Pre-Killed), Soft-Furred Rat (Live), Soft-Furred Rat (Frozen/Thawed), Soft-Furred Rat (Pre-Killed), Quail, Chicken, Rabbit, Cricket, Roach, Mealworm, Superworm, Hornworm, Waxworm, Fruit Fly, Bsfl, Vegetables, Dry Feed, Meal Replacement, Other. |
| Min_Shipping | Number in Seller Profile currency. For Sale needs a shipping option. Equal min/max sets a fixed charge; both zero means free shipping. |
| Max_Shipping | Number in Seller Profile currency; upper end of shipping range. |
| Is_Rep_Photo | Boolean for representative photos. Category rules still apply. |
| Is_Negotiable | Unspecified, Firm Price, Will Consider. The description also accepts No/Yes for firm/negotiable. |
| Is_For_Trade | Unspecified, Will Consider, No Trades, Yes, No. The page's example is True. |
| Enable 'Buy Now' | Boolean. Requires an eligible store with connected payments, a set price, fixed/free shipping or local pickup, and individual or group sales. Wholesale-only excluded. |
| Private_Notes | Internal animal notes, not public listing text. |

## Current safety decision

On 24 October Tennyson superseded the earlier warning-only choice: do not allow exports that could erase MorphMarket data. CSV download and copy are now paused in both screens and in the shared production CSV builder, including for otherwise complete geckos. Import remains available. The formatter remains covered by header, round-trip and formula-neutralization tests, but it is not a production export entry point.

The current exporter has 14 columns, not the 15 initially counted in conversation. MorphMarket supports 33. The full matching workspace now stores all 33 fields privately and shows changes against a fresh source file. Downloads remain gated pending expanded live preservation proof.

### Missing fields to support

| Area | MorphMarket fields absent from the current export |
| --- | --- |
| Visibility and activity | Visibility, Enabled |
| Groups | Group_Id, Is_Group |
| Media | Video_Url, Is_Rep_Photo |
| Measurements and breeding | Length, Length_Type, Proven_Breeder |
| Wholesale | Wholesale_Price, Wholesale_Only, Wholesale_Description |
| Food | Diet |
| Shipping | Min_Shipping, Max_Shipping |
| Sale preferences | Is_Negotiable, Is_For_Trade, Enable 'Buy Now' |
| Private information | Private_Notes |

Existing columns also need exact preservation: title is generated, State collapses several MorphMarket states to Not For Sale, Quantity is fixed at one, Origin defaults to Captive Bred, and unknown sex becomes Unsexed. An Animal_ID can be sanitized differently, and partial birth dates cannot be represented by Geck Inspect's full hatch date. Filling three missing values alone cannot prove that all existing data survives.

Implemented full matching workflow: retain all original supported fields from a fresh MorphMarket export in owner-only listing storage, expose those values for editing, match existing animals by exact seller Animal_ID, and apply only explicit edits. Keep Private_Notes and wholesale details out of public gecko payloads. Preserve unsupported read-only columns in the source reference, without pretending they are writable. Validate MorphMarket's own export spellings and allowed values before re-import. Re-enable downloads only after disposable listings prove that all populated fields survive an update. A current source file is needed because Geck Inspect cannot see later MorphMarket edits automatically.

## Earlier Geck Inspect mapping and data preservation

- Export `State`, `Desc`, and `Photo_Urls`, remove the unsupported Currency column, and use `Subadult`.
- Retain `Animal_ID` first, the existing stable ID mapping, ISO full dates, comma-separated photos, one animal per row, and Captive Bred origin. Do not change a gecko's ID between uploads. IDs must be distinct after punctuation cleanup.
- Use spaces between exported traits and whole grams for weight. Do not invent maturity for an unknown hatch date. The seller must add a hatch date in Geck Inspect or choose maturity in MorphMarket before importing.
- Omit optional Price, DOB, Weight, Traits, Desc and Photo_Urls columns when every exported cell is empty. The preview uses the same columns as the file.
- Live data-loss check: omitting Price, DOB and Weight entirely did not preserve them. The new spreadsheet importer added the missing fields as blank; both prices became $0, and both birth dates and weights were cleared. Restored all test values with the full CSV. Empty-column omission is only presentation, not protection. Both export screens warn to fill missing values before uploading updates.
- The field reference says blank Photo_Urls preserves photos, blank Traits uses Title, and blank State becomes For Sale. Do not assume other omitted fields preserve existing data. Review the complete MorphMarket spreadsheet before importing, including fields Geck Inspect does not export.
- MorphMarket takes currency from Seller Profile, not the file. Check that it matches Geck Inspect prices. Shipping must be reviewed on MorphMarket; Geck Inspect does not invent a shipping charge.
- Import accepts State as well as old Status, exact sale-state matching, M/F sex abbreviations, and space/comma-separated photos. Private, unlisted, inactive and expired rows must not become public through import.
- Geck Inspect stores a full hatch date. Partial or unrecognized dates are left unset with a row warning rather than inventing a day.

## Real export inspected

Downloaded a real six-row CSV through Animal Manager on 24 October. It has
42 headers: the 33 input fields above plus Last_Update**, First_Listed**,
Last_Renewal**, Impression_Count**, Click_Count**, Inquiries_Count**,
Mm_Url**, Sires**, Dams**. Required headers are Category*, Title*, Animal_Id*.
The parser strips those trailing markers. No account data is committed;
the regression fixture keeps the format but uses substitute records.

The file has five crested geckos and one Leachianus. Parsing now yields five
crested records and warns that the other species was skipped. Full birth dates
use M/D/YYYY and are converted to ISO. Two dates contain only month/year and
remain unset with warnings. Photo counts are retained. All six source seller
IDs are blank, so the importer warns about repeat-import duplicates rather
than pretending the marketplace's listing number is the seller's Animal_ID.
After production deployment of `63994ac0`, loaded this same downloaded file
through Seller Console > MorphMarket Sync > Import CSV. The live dialog
showed five correct names, sexes, traits and prices and all eight expected
warnings. Cancelled the dialog without creating records because these are
existing animals, not the disposable test pair. This proves the deployed
file selection and preview path, not a completed import into the account.

## Live proof record

Completed on 24 October 2026 in Tennyson's signed-in accounts, with his permission to perform the steps.

### Store verification

- Store supplied by Tennyson: https://www.morphmarket.com/stores/tennyson_miles/.
- Local curl with `GeckInspectStoreCheck/1.0 (+https://geckinspect.com)` returned HTTP 403, a `Just a moment...` page and Cloudflare `challenge-platform` markers. No bypass attempted.
- My Store generated a code, which was saved in the store's About text and visibly confirmed on the public About tab. Pressed Check my store. Supabase row: `pending`, `needs_review=true`, `last_check_result="MorphMarket answered 403"`.
- Edge logs show successful function requests at 18:55:45 and 18:56:18 UTC. The HTTP 200 is the function response; the saved row records the blocked outbound read.
- Admin > Breeder verification > Code is there completed the hand check. Row became `verified`, `needs_review=false`, `last_check_result="verified by an admin"`.
- Saved My Store to publish the breeder profile and correct its older external store link. https://geckinspect.com/Breeder/thegeckogarden visibly shows Verified MorphMarket seller, linking to the supplied store.
- Hand review is the documented process when blocked. Leave the code until verified. Tennyson approved removal on 24 October. Removed only the code paragraph and confirmed it is absent from the public About text.

### CSV create, update and return

| Seller ID | MorphMarket listing | Initial / updated price | DOB | Exported weight | Photos |
| --- | --- | --- | --- | --- | --- |
| GI-MM-20261024-A | 4174375 | 125 / 126 | 2025-06-08 | 35 g | 1 |
| GI-MM-20261024-B | 4174376 | 175 / 175 | 2026-01-15 | 20 g | 2 |

Created two private Pet records through Add Gecko with test-only descriptions and images. Exported the selected pair through the production MorphMarket Export batch builder. Uploaded the unchanged download with Synchronize/Replace off. Both listings were created correctly as Not For Sale, with Crested Geckos, male/female, Lilly White/Harlequin, Adult/Subadult, Captive Bred, quantity one, descriptions, full dates and all three photos.

Changed A's price in Geck Inspect to 126, downloaded again, and uploaded the unchanged second file. The filtered MorphMarket list still contained exactly two animals with the same listing numbers and the updated price. No duplicates.

Downloaded those two Animal Records from MorphMarket. Its 42-column CSV uses starred required headers, M/D/YYYY dates and space-separated photos. Geck Inspect's live Import CSV preview read both without warnings. An initial save correctly refused the two duplicate seller IDs. Archived the original disposable source records and gave their IDs a `-SOURCE` suffix to free the original IDs, then imported again: two records created. Database checks confirmed IDs, sexes, prices, dates, weights, all three photos, private Pet status and multiline descriptions retained as notes. No further parser header fix was needed.

The separate missing-column test cleared prices, dates and weights as described above; the full CSV restored them. All four Geck Inspect test records and both MorphMarket test listings are now archived. Permanent deletion was left to Tennyson. Existing real animals were not changed.

Scope: live acceptance covers Not For Sale creation and update, the hand-check badge and return import. For Sale shipping, payment and sold-state workflows were not exercised. Tennyson initially chose warning-only, then superseded that choice with the safety pause described above.
