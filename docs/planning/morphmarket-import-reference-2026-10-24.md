# MorphMarket import reference, 24 October 2026

Source: the signed-in [Import Animals page](https://www.morphmarket.com/inventory/import), Supported Fields section, read on 24 October 2026. Both the new spreadsheet and Old Import show this list. This is a reference check, not proof of a successful upload.

The [Seller's Guide](https://support.morphmarket.com/article/123-importing-exporting-animals), updated 15 October 2026, confirms CSV, TSV and JSON input, a 1,000-row spreadsheet limit, matching updates by Animal_ID, and the Synchronize/Replace option. Leave that option off for partial batches: it archives animals missing from the upload. Hidden spreadsheet columns still participate in an import.

## Complete supported field list

Names below are the canonical spellings displayed by the importer. Boolean fields accept `Yes, No, True, False, Y, N, T, F, 1, 0`.

| Field | Accepted values and constraints |
| --- | --- |
| Category | Required species category. The real export uses Crested Geckos. Creation acceptance still needs the test upload. |
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

## Geck Inspect mapping and data preservation

- Export `State`, `Desc`, and `Photo_Urls`, remove the unsupported Currency column, and use `Subadult`.
- Retain `Animal_ID` first, the existing stable ID mapping, ISO full dates, comma-separated photos, one animal per row, and Captive Bred origin. Do not change a gecko's ID between uploads. IDs must be distinct after punctuation cleanup.
- Use spaces between exported traits and whole grams for weight. Do not invent maturity for an unknown hatch date. The seller must add a hatch date in Geck Inspect or choose maturity in MorphMarket before importing.
- Omit optional Price, DOB, Weight, Traits, Desc and Photo_Urls columns when every exported cell is empty. The preview uses the same columns as the file.
- A mixed column can still contain blank cells. These can clear seller-entered values on re-import. The export screens disclose this. Omission is a precaution, not proof that MorphMarket preserves every omitted field. Confirm this on disposable listings before updating real inventory.
- The field reference explicitly confirms blank Photo_Urls preserves photos, blank Traits uses Title, and blank State becomes For Sale. It does not fully specify omitted-column behavior for Price, DOB or Weight.
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
This is a real-file parser check, not a completed import into the account.

## Live proof record

Pending: Tennyson's supplied store link, exact curl result with the function's User-Agent, his Check my store result, server logs, and public badge check. The initial production query on 24 October returned no store-link rows.

Pending: two disposable animals exported through Business Tools, created on MorphMarket, then updated by a second export without duplicates; their MorphMarket export imported through Geck Inspect; cleanup by Tennyson. Do not mark either feature proven until those checks have actually completed.
