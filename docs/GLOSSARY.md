# Glossary

The words this project uses, in one place. Two kinds: product words (what things in Geck Inspect are called) and crested gecko words (what the hobby calls things). When a document or a prompt uses one of these, it means what this page says.

Written 11 November 2026. If a name here and a name in the app disagree, the app wins; fix this page.

## Product words

| Word | What it means |
|---|---|
| **Member** | Anyone with an account. "Keeper" and "breeder" are kinds of member. |
| **Keeper** | A member who keeps crested geckos as pets. Also the name of the first paid plan. Context tells which. |
| **Breeder** | A member who pairs and sells. Also the name of the second paid plan. |
| **Keeper mode** | A menu setting that hides the breeding and selling pages (8 destinations in place of 12). A preference, not a permission. Set by the first-run question, changed in Settings. |
| **Guest, the demo** | A visitor looking around without an account. They see a sample collection and nothing they do is saved. |
| **Collection** | A member's geckos. Collections can be shared with another member as an editor or a viewer. |
| **Gecko record** | Everything about one animal on one screen: photo, parents, value, weights, feeding, sheds, vet visits, breeding, passport. Opens as a window over My Geckos or as its own page (`/GeckoDetail`). |
| **Today** | The first tab on a phone: what is due today (feedings, weigh-ins, hatch windows), the week ahead, then the collection. |
| **Log** | Recording a care event. The Log tab opens a sheet with Feeding, Weigh-in, Shed and Field Mode. |
| **One-tap log** | The page behind every "Log feeding" button and reminder link (`/log`): Fed or Refused in one tap. Code calls it QuickLog. |
| **Field Mode** | A full-screen logger for use with a gecko in the other hand: big rows, a number pad, works with no signal. |
| **Passport** | A gecko's public page and QR card, showing its lineage and weigh-ins. Has a code like `GI-2026-AB3K`. Making one makes the gecko public. The 90-day plan counts passports issued and claimed. |
| **QR card** | The printable card with the passport's QR code, for the tub or the buyer. |
| **Transfer** | Handing a gecko's whole record to a new owner. The seller creates a link or QR code; it expires after 72 hours. |
| **Claim** | The buyer accepting a transfer. "Passports claimed" on the scoreboard means transfers accepted. |
| **Morph ID** | Photo identification of a gecko's visible traits. The page is `/Recognition`. It reads what is visible; it cannot prove a gene. Free members get one a month. |
| **Genetics Calculator** | Offspring odds for a pairing (`/calculator`). Public, no account needed. |
| **Breeding plan, pairing** | A sire and a dam put together, with their eggs. "Pair" and "plan" mean the same thing in the app. |
| **Hatchery** | The Breeding tab that lists eggs in incubation. |
| **Business Tools** | Money in and out, sales, pricing and waitlists (`/MarketplaceSalesStats`). |
| **Market Intelligence** | The Market page: asking prices across listing sites. The live tabs belong to the Enterprise plan, which is off sale. |
| **Price Index** | The public table of crested gecko asking prices by trait (`/crested-gecko-price`, `/data`). Asking prices from listings, not sale prices. |
| **Value estimate** | What a gecko is likely to list for, from the Price Index, shown on its record. An estimate, not an appraisal. |
| **Portfolio** | The estimated value of a whole collection. |
| **Plans** | Free (10 geckos), Keeper ($2.99 a month, 50 geckos), Breeder ($5.99 a month, unlimited), Enterprise ($99.99 a month, off sale). The code is the truth: `src/lib/tierLimits.js` and `src/lib/stripe-config.js`. |
| **Comp** | A paid plan given free to a member. A comped account does not count as a paying breeder on the scoreboard. |
| **Founding Breeder offer** | $120 prepaid for a year of Breeder, offered in breeder conversations. |
| **Weekly active breeder** | A member who logged a weigh-in, feeding, shed, vet visit or event on their own gecko in the last 7 days. The plan's main number. Not the same as "weekly active member" (anyone who signed in). |
| **Scoreboard** | The weekly numbers the 90-day plan is judged by, on the Admin panel and copied into `docs/NOW.md`. |
| **Decision day** | 17 January 2027, when the plan ends in one of three outcomes: Invest, Maintain or Reference. |
| **Part E** | The active 90-day plan: Part E of `docs/planning/comprehensive-review-2026-10-14.md`. |
| **Retired feature** | A feature switched off behind a redirect on 16 October 2026 or earlier. Its code and tables are kept. List: `docs/planning/retired-features-2026-10.md`. |
| **Weekly Gecko Notes** | One short care email a week. The notes live in `content/weekly-notes/`. |
| **Getting-started emails** | The day 0 to day 14 emails a new member gets. Docs call them lifecycle emails. |
| **Routine** | A scheduled Claude session (for example the Monday agent review). Lives in Tennyson's Claude account, not in this repo. |
| **Owner step** | Something only Tennyson can do by hand: a dashboard setting, a secret, a phone check. All of them are in `docs/OWNER-STEPS.md`. |
| **Geck Data** | The separate project that collects listing prices. It feeds the Price Index and Market Intelligence. |

Names that used to mean something else, so old documents make sense:

| Old name | What it is now |
|---|---|
| Recognition, AI Morph Recognition | Morph ID |
| Project Manager | Season Planner (`/ProjectManager`) |
| Marketplace Sales Stats | Business Tools |
| Geck Answers | Folded into the Forum on 29 September 2026 |
| Breeding ROI | Folded into Breeding (the pairing value box) and Business Tools |
| Marketplace | The "In-app listings" tab of Market |
| Lifecycle emails | Getting-started emails |

## Crested gecko words

The full genetics glossary (about 70 terms, each with a definition) is in the app's Genetics Guide and its source is `src/data/genetics-glossary.js`. That file is the authority. The short list below is what a session needs to write correct copy.

| Word | What it means |
|---|---|
| **Morph** | A variant with a known, predictable inheritance pattern. |
| **Trait** | A look whose genetics are not mapped, usually controlled by many genes (Harlequin, Pinstripe, Dalmatian spots, base colour). Do not show single-gene odds for a trait. |
| **Lilly White** | Incomplete dominant. One copy shows. Two copies (Super Lilly White) die in the egg, so Lilly White is never paired to Lilly White. Note the spelling: two Ls. |
| **Axanthic** | Recessive. Lacks yellow and red pigment. Two copies needed to show. |
| **Cappuccino** | Incomplete dominant. Two copies make the Super Cappuccino (also called Melanistic), which has documented health concerns. |
| **Sable** | Incomplete dominant, on the same gene as Cappuccino. |
| **Highway** | Incomplete dominant, provisionally a third version of the same gene. Highway to Highway is not recommended. |
| **Luwak** | One Cappuccino copy and one Sable copy. Never a super. |
| **Frappuccino** | Cappuccino with Lilly White. Not a super form. |
| **Phantom** | Recessive. Adds dark pigment and mutes pattern. Two copies make a visual Phantom (what a plain "Phantom" tag means in Geck Inspect); one copy (het Phantom) looks normal. |
| **Het** | Carries one hidden copy of a recessive gene. "100% het" is guaranteed by parentage; "66% possible het" and "50% possible het" are odds. |
| **Super** | Two copies of an incomplete dominant gene. |
| **Visual** | The animal shows the trait. |
| **Proven** | An inheritance claim shown by documented breeding results. |
| **Fired up, fired down** | The dark, saturated state at night or under stress, and the pale daytime state. The same gecko can look like two morphs. |
| **Sire, dam** | Father, mother. |
| **Clutch** | Usually two eggs. A female lays several clutches a season. |
| **Gravid** | Carrying eggs. |
| **CGD** | Complete gecko diet: the powdered food mixed with water. |
| **Holdback** | An animal the breeder keeps for their own project. |
| **Tail status** | Crested geckos drop their tails and do not regrow them. A tailless adult is normal. |

Rules for copy: use the specific crested gecko term (Lilly White, Harlequin, Phantom, Cappuccino, Axanthic, Sable, Highway), never a generic reptile example. The species is the crested gecko, *Correlophus ciliatus*; "crestie" is hobby slang and is fine in casual copy.
