# Experience review, 11 November 2026

A review of how Geck Inspect feels to use: how smooth the main jobs are, how the screens look, what should be removed, merged, renamed or added. Written so another AI session can pick up any work package and build it without asking what was meant.

Screens and the script that made them: [experience-review-2026-11/](experience-review-2026-11/).

## 0. How to use this file (for the session that implements it)

1. Read section 2 first. It lists the rules this work must obey and the decisions that belong to Tennyson. Several packages are blocked on a decision; do not guess the answer.
2. Work packages are in section 9, in order. Each has the files, the change, and the checks that prove it is done. Finding IDs (A1, B3 and so on) point back to the evidence in section 5.
3. One package per pull request or commit. Run `pnpm lint`, `pnpm test` and `pnpm test:e2e` before pushing. After a visual change, re-run the screenshot script (section 10) and look at the phone screens.
4. When a package is finished, add a dated line under it in section 9 saying what shipped and what was left out.
5. If the code no longer matches a file reference here, trust the code and fix this file in the same commit.

Paste-ready prompt for a new session:

> Read `docs/planning/experience-review-2026-11-11.md`, sections 0, 2 and 9. Implement work package WP-N only. Follow its "Done when" checks exactly, obey the rules in section 2, and do not touch `src/pages/Home.jsx`, `src/pages/HomeControl.jsx`, `src/components/landing/` or the theme defaults (the homepage test is running). Re-run the screenshot script before and after, and add a dated status line under the package when finished.

## 1. The answer in short

The core of the product is well made. Today, the Log sheet, the one-tap log page, the short "add your first gecko" form and the gecko record are clear, fast and specific to crested geckos. A member who only ever used those five screens would call this a good app.

What stops it feeling smooth is everything around that core:

1. **The phone screen is crowded with floating things.** A glass header, a glass bottom bar that page text shows through, a feedback bubble that sits on top of list rows, a tour bar, feeding cards, an offline pill, a consent banner and an update banner can all appear, several at once (B1 to B6).
2. **The second visit is worse than the first.** The first gecko gets a 6-field form; every gecko after that gets a flat 25 to 31 control form with photos at the very bottom and no warning before entered data is thrown away (D1 to D5).
3. **There are six ways to log care and they disagree.** Undo, offline saving, back-dating and batch weights each exist in some and not others (E1 to E5).
4. **There are three different home screens** depending on the device and how the member arrived, and the laptop one opens on other people's activity (C1 to C4).
5. **The app often says nothing.** Saving a gecko, creating a pairing and adding eggs show no confirmation; some failures are written only to the developer console; 26 places still used the browser's own grey pop-ups, 11 of them in screens members use (F1 to F6).
6. **The action that the 90-day plan counts, issuing a passport, sits at the bottom of a 3,900 pixel scroll** (G3).
7. **Names drift.** The genetics calculator has six names, Batch Husbandry has three, My Geckos has four (H3).
8. **Small visible defects remain**: a dead link on the Breeding page, a chip that prints `✕`, a toolbar that overlaps on phones, money shown as `$34975.00` (A1 to A9).
9. **The visual system is close but loose**: 20 colour families, 583 uses of 10 or 11 pixel text, 42 different page-title styles, 274 spinners against about 25 skeletons (K1 to K9).
10. **Morph ID, the third most used page, is two or three taps away on a phone and shows a wall of cautions before the upload button** (I1 to I4).

None of this needs a new feature. About two thirds of the recommendations are removal, merging or finishing. Section 8 lists the additions worth making, and which of them wait until after decision day.

**What members actually open** (production, read only, the 30 days to 11 November, signed-in page views, admin account left out; internal test accounts may still be in these numbers, so read them as rough):

| Page | Members | Views |
|---|---|---|
| My Geckos | 31 | 170 |
| Today | 23 | 147 |
| Morph ID | 21 | 68 |
| Dashboard | 13 | 33 |
| Gecko record page | 10 | 41 |
| Lineage | 8 | 31 |
| Morph Guide | 7 | 33 |
| My Profile | 7 | 17 |
| Settings, Breeding, Market | 6 each | 22, 18, 18 |
| Pedigree, Quality Scale | 4 each | 11, 5 |
| Forum, Business Tools, Care Guide, Field Mode | 3 each | 9, 7, 6, 5 |
| Messages, Gallery, Membership, calculator | 2 each | 5, 3, 22, 2 |
| Pairing Planner, Season Planner, Season Timeline, Batch Husbandry, Buy Geckos | 1 each | 1 or 2 |

Three screens carry the product: My Geckos, Today and Morph ID. Polish should go there first, and the pages with one visitor should be folded into their parents, not polished.

## 2. The brief, with the gaps filled in

The request was: a full review to make this the smoothest and most beautiful app experience possible, with innovations, removals, reorganisation and user flow, specific enough to hand to another AI, published in the repo.

A request like that leaves out things a reviewer needs. Here is what was assumed, so Tennyson can correct any of it in one line.

| Question the request left open | Assumed answer | Why |
|---|---|---|
| Whose experience? | A crested gecko breeder with 20 to 200 animals, on an iPhone, standing at a rack. Second: a pet keeper with 1 to 5. | The 90-day plan tests whether breeders will pay; the growth plan names the phone as the main device. |
| Which screens matter most? | Today, My Geckos, the gecko record, logging, Morph ID, then Breeding. | Usage table above. |
| What does "smooth" mean in numbers? | Fewer taps and fewer decisions per job, no lost work, every action answered within a second, nothing floating over what is being read. | So that "done" can be checked. Gauges are in section 10. |
| What does "beautiful" mean here? | Calm and consistent. `docs/specs/DESIGN-SYSTEM.md` says "a serious tool for people who breed animals as a business: not cute, not gamified." The review holds the app to its own standard. No rebrand is proposed. | A new visual identity would break the running homepage test and the App Store screenshots. |
| May things be removed? | Hidden or merged, yes. Deleted, no. | Tennyson's 16 October rule: retired code and tables are kept (`retired-features-2026-10.md`, section 5). |
| May things be added? | Only inside pages that already exist, until decision day. | Rule E0.3 of the plan freezes breadth: no new pages, tools or integrations until weekly active breeders grow four weeks running. |
| How much may be built now? | Unknown. This is decision 1 below. | See the conflict that follows. |

**A conflict Tennyson should know about.** The active plan (Part E of `comprehensive-review-2026-10-14.md`) says two things that bear on this document:

- E6: "No new audits or reviews; this one and the adversarial one are enough for a quarter." This review exists because Tennyson asked for it, which overrides that line, but the reason for the line still stands: reviews are cheap and they are not the thing the plan is short of.
- The Day 30 rule: on 17 November (six days after this review), fewer than 15 breeder conversations means engineering pauses and the time goes to conversations. `docs/NOW.md` read 0 of 15 on 31 October.

So the honest framing is this. Nothing below will bring in a paying breeder by itself. Three packages do serve the plan's own numbers directly (WP-5 passports, WP-12 sign-up and first gecko, WP-0 visible defects) and are small. The rest makes the product nicer for the 8 or so members who use it each week, and is best scheduled after the Day 30 check or run by sessions in the background while Tennyson spends his own hours on calls.

**Rules every package must obey**

- The homepage A/B test is running. Do not change `src/pages/Home.jsx`, `src/pages/HomeControl.jsx`, `src/components/landing/` or the theme defaults. Queue such changes in `docs/planning/homepage-ab-test-2026-10.md`.
- The iPhone app is in App Store review work. A web change does not reach the iPhone app until the next build, and screens named in the review notes or shown in store screenshots should not change shape without checking `docs/planning/app-store-resubmission-2026-10-26.md`.
- Sidebar size is held by a test (`src/lib/navItems.derived.test.js`): 12 destinations, 8 in Keeper mode.
- No new pages, no new dependencies beyond the two named in WP-11, no deleted tables, no deleted retired code.
- Copy: no em dashes, plain words, crested gecko terms (Lilly White, Harlequin, Cappuccino, Axanthic, Sable, Highway).
- No blog or article work.
- Database changes follow `docs/MIGRATIONS.md`. Only WP-2 (one idempotent weigh-in save) might need one.

**Decisions: answered on 12 November 2026.** Tennyson asked for the rest of the recommendations to be built, so each decision below takes its recommended answer, and the remaining packages go ahead now. Decision 2 is built in its lighter form first: Today is the home on every device, and the Dashboard stays reachable as Today's "Overview".

**The decisions as they were put** (each blocked the package named)

1. **How much of this to build before decision day.** Recommended: WP-0, WP-5 and WP-12 now; WP-1 to WP-4 next; the rest after 17 November's check. Blocks: everything after WP-0.
2. **One home or two.** Recommended: Today becomes the home on every device and the Dashboard's useful parts (stats, values, quick links) become its second column on laptops. The lighter option keeps the Dashboard and only reorders it. Note that the Dashboard was rebuilt on 17 October at Tennyson's request, so this reverses part of a recent choice. Blocks: WP-8.
3. **Market Intelligence for members who cannot buy it.** Enterprise is off sale, yet the sidebar link shows for every breeder and three of its tabs say "not open to new members". Recommended: the link opens the member's own collection value (Portfolio) by default and the closed tabs are hidden until Enterprise returns. Blocks: part of WP-8.
4. **Email sign-up by 6-digit code in place of a link.** Answered yes on 11 November (Tennyson asked for WP-12 to be built). The code box is live; the template change is `docs/OWNER-STEPS.md`, step A3.
5. **The emoji rank badges** (egg, lizard, trophy, crown by gecko count) and the 24-step sidebar tutorial. Recommended: hide both. Blocks: part of WP-10 and WP-8.
6. **Messages on the phone header.** Two members opened Messages in 30 days. Recommended: fold it into the notifications bell and give its header slot to Morph ID. Blocks: part of WP-8.
7. **Community Pulse at the top of the home screen.** Recommended: off by default until there are at least 25 weekly active members; "Customize home" can switch it back on. Blocks: part of WP-8.

## 3. Method and limits

- **Screens.** The app was run locally and photographed with Chromium at 390 by 844 (phone, touch) and 1440 by 900 (laptop): 9 public pages and 28 app pages in the guest demo, at both sizes (74 screens), plus the add-gecko form, the Log sheet, the menu and a gecko record. The script is `experience-review-2026-11/capture.cjs`.
- **Code.** Three read-only sweeps of `src/` covered navigation and routes, visual consistency (counts by search), and the nine main flows step by step. Every defect cited below was then re-checked by hand against the file and line given.
- **Usage.** One read-only query of `user_events` in production for the table in section 1.
- **Earlier work read first**, so this does not repeat it: Part B and Part E of the 14 October review, the first-impression review, the mobile audit, the retired-features note, the signed-in home note, the design system document.

What this could not judge: real member photos (the sandbox blocks image hosts), a real iPhone (bounce, notch, keyboard, status bar), live Morph ID, live market data, email, Stripe, and screens that need a real account with data (Settings, Messages and My Profile were read in code only). The Dashboard's "0 keepers are tracking 0 geckos" line and the broken logo in the screenshots are sandbox effects, with one exception noted in A8.

## 4. What is already good (do not break it)

- **Today** (`src/pages/Today.jsx`): due items first, one button per card, the week ahead, then the collection. It opens offline with the last copy. This is the best screen in the app.
- **The Log sheet** (`src/components/navigation/LogSheet.jsx`): four plain choices with one line each.
- **The one-tap log page** (`src/pages/QuickLog.jsx`): Fed or Refused in one tap, "Mark all fed", undo per gecko, saves offline.
- **Field Mode** (`src/pages/FieldMode.jsx`): full screen, large rows, a number pad, a 10-second undo. Right for a hand holding a gecko.
- **Quick Add** (`src/components/my-geckos/QuickAddGecko.jsx`): six fields, one required, a real payoff screen.
- **The gecko record** (`src/components/gecko/record/GeckoRecord.jsx`): one scroll with jump links, the value estimate with its range and source, a weight chart against the typical band for the age.
- **Sign-up** (`src/components/auth/LoginPortal.jsx`): four inputs, Google and Apple, honest benefit lines.
- **The four phone tabs** and the 12-item sidebar held by a test.
- **Honest copy**: the Morph ID limits, "asking prices, not sale prices", "illustrative photo, not the sample animal".
- **Reduced motion, safe areas, 44 pixel touch targets on buttons, alt text on every image, an error boundary per page.**

## 5. Findings

Each finding has an ID, the evidence, and the fix. Severity: **High** means members hit it often or lose work; **Medium** means friction on a main path; **Low** means polish.

### A. Visible defects (fix first)

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| A1 | High | The "Clutch Lab" link on the Breeding page opens a 404. | `src/pages/Breeding.jsx:555` links to `/ClutchLab`; the only route is `/calculator/learn` (`src/App.jsx:525`). Confirmed in the browser. One member hit it this month. | Change the link to `/calculator/learn`. |
| A2 | High | "Pedigree Chart" on the Breeding page and "Pedigree" in the quick search open a page that says "Add a ?geckoId= query parameter". | `src/pages/Breeding.jsx:556`, `src/lib/navItems.js` (the Pedigree palette entry), `src/pages/Pedigree.jsx:415-430`. Still present from the 14 October review. | Remove both entry points. Pedigree is reached from a gecko's record ("Family tree"). If the page is opened without an id, show a gecko picker, not a developer message. |
| A3 | Med | Selected morph tags show the text `✕` after the name. | `src/components/my-geckos/MorphIDSelector.jsx:71`: the escape is written as plain text inside JSX, which prints it literally. | Use the lucide `X` icon (with `aria-hidden`) and an `aria-label` of "Remove {morph}". |
| A4 | Med | On a phone, the My Geckos sort control runs underneath the grid and list toggle, and the search placeholder is cut to "Search ge". | Screenshot `01`, second panel. `src/pages/MyGeckos.jsx` toolbar. | Put search on its own row; sort and view toggle share the next row. Shorten the sort label to "Newest". |
| A5 | Med | Money is shown as `$34975.00`. | `src/pages/MarketplaceSalesStats.jsx` has 12 `toFixed(2)` calls. Screenshot `05`, fourth panel. | One shared `formatMoney()` (thousands separators, no cents at $100 and above) used everywhere money is shown. Search `src/` for `toFixed(2)` near a `$`. |
| A6 | Med | A failed status change in the Hatchery shows the browser's own alert box. | `src/components/breeding/Hatchery.jsx:279`. | A toast, like every other failure. |
| A7 | Med | Batch Husbandry in the demo says "No feeding groups yet" while Today shows three groups. | Screenshot `04`, fourth panel. Found on 14 October, still there. | Read the demo's groups, or (better) retire the page into the log flow (WP-4). |
| A8 | Low | The app shell loads its logo from `https://geckinspect.com/logo.png`, not from the app itself. | `src/Layout.jsx:331, 978, 1141` use `APP_LOGO_URL`; the small local file `APP_LOGO_ICON_URL` (`/logo-96.png`) exists in `src/lib/constants.js:16`. | Use the local file in the shell. It is 8 KB instead of 170 KB and works offline and on preview builds. |
| A9 | Low | The iPhone app's launch background and status bar are a blue-black (`#020617`) while the app's page is green-black (`#0a1913`). | `capacitor.config.ts:16, 33`. | Set both to `#0a1913`. Rides with the next iPhone build. |
| A10 | Low | On a phone, "look around the demo" from the landing page opens the Dashboard, while every other phone entry opens Today. | `src/pages/HomeControl.jsx:466`. | Use `memberHome()`. **Queued:** this file is frozen by the homepage test. |
| A11 | Low | The design document is out of date in four places. | `docs/specs/DESIGN-SYSTEM.md`: fonts are self-hosted, not from Google Fonts; no component names DM Serif Display any more; the glass bars do have a solid fallback (`src/styles/layout-theme.css:1219`); 42 pages, not 43, use `p-4 md:p-8`. | Correct the four lines. |

### B. The phone screen is crowded

Look at screenshot `01`. On Today, at rest, a member sees: the glass header, a feedback bubble on top of the "This week" list, a tour bar (demo only), and a bottom bar with the page's text showing through behind the tab labels.

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| B1 | High | Page text is readable through the bottom bar, behind the tab labels. | Every phone screenshot. Styles at `src/styles/layout-theme.css:1156-1263`. | Raise the bar's own tint to about 85% opacity and add a short fade above it, so content dims before it reaches the labels. Keep the blur. |
| B2 | High | The round feedback button floats over list rows on every page. | `src/components/feedback/FeedbackWidget.jsx:152-159`, mounted at `src/Layout.jsx:1496`. It covers the right end of rows in Today, Forum, Market and Business Tools (screenshots `01`, `05`). | On phones, remove the floating button. Put "Send feedback" in the More menu and at the foot of Settings. Keep the edge tab on laptops, where it covers nothing. |
| B3 | High | Up to eight different floating notices can appear, with no rule for how many at once. | Consent banner and update banner both sit bottom-left (`src/components/shared/ConsentBanner.jsx`, `src/components/ui/UpdateNotification.jsx`); feeding cards, the push ask, the offline pill and the tour sit bottom-right (`src/Layout.jsx:1482-1491`, `src/components/shared/OfflineSyncStatus.jsx`). The offline pill is not hidden in Field Mode (`src/index.css:1098`). | One rule: at most one floating notice on screen. Give `FloatingNoticeStack` a priority order (update, consent, offline, feeding, tour) and route all five through it. Hide the offline pill in Field Mode, which shows its own status. |
| B4 | Med | Feeding reminder cards float over the page and come back after every reload when dismissed. | `src/components/feeding/FeedingAlertSystem.jsx:69-173`; dismissal is held in memory only. | Remove the floating cards. Today already lists what is due, and the menu already shows a count. On laptops, where the home may not be Today, show the count on the Today link. |
| B5 | Med | The More menu is see-through; the page behind collides with the menu text. | Screenshot `03`, third panel. `src/Layout.jsx:968-1105`. | Solid background at 96% or more for the drawer. Glass suits thin bars, not a full-height list. |
| B6 | Med | Two buttons open the same menu: the hamburger at top left and the More tab. | `src/Layout.jsx:1275-1281` and `:1431`. | Remove the hamburger on phones. Put the page title (or the wordmark on Today) in its place, which also tells the member where they are after the header scrolls. |
| B7 | Low | Tab labels are 9.5 pixels. | `src/styles/layout-theme.css:1168`. | 11 pixels, normal letter spacing. |
| B8 | Low | In the demo the menu shows a "VIEW ONLY" pill on 6 of 11 items. | Screenshot `03`. `src/Layout.jsx:905-912`. | One line at the top of the menu: "Demo: look around, nothing is saved." |

### C. Home: three different front doors

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| C1 | Med | Where a member lands depends on device and route: Today on a phone; My Geckos on a laptop after signing in; the Dashboard on a laptop at `/` or from the logo. | `src/lib/pwaLaunch.js:54-56`, `src/Layout.jsx:195-199`, `src/pages.config.js:149`. Comments in `src/App.jsx:76-82` and `:260-261` describe a third behaviour that the code does not have. | One answer: `memberHome()` everywhere, including `/` and the logo. Which page that is on laptops is decision 2. Fix the two comments. |
| C2 | Med | The laptop Dashboard's first screen is a greeting, a line about how many keepers use the app, four buttons and a feed of other members' activity. The member's own animals start below the fold. | Screenshot `06`. `src/pages/Dashboard.jsx:300-381`. With about 8 members active a week, the feed is mostly "A keeper uploaded a photo". | Lead with what is due and the member's own numbers. Community Pulse moves down or off by default (decision 7). |
| C3 | Med | The Dashboard's main button, "Log care", opens Batch Husbandry, which shows an empty state unless the member has set up feeding groups. | `src/pages/Dashboard.jsx:339`; `src/pages/BatchHusbandry.jsx:508-525`. | Point it at the log flow (`/log?type=feeding` built by `src/lib/today.js`), the same place Today's buttons go. |
| C4 | Low | The Dashboard hero carries "My Store" (shown with a lock), "Preview profile" (opens a new tab), "What's New" and a Sign out button. | `src/pages/Dashboard.jsx:300, 338-381`. | Keep one primary action. Sign out belongs in the profile menu; What's New in the More menu or Settings; My Store in Business Tools. |
| C5 | Low | Today and the Dashboard call each other "Daily Care" and "Overview" in their shared toggle, and "Today" and "Dashboard" in the menu. | `src/pages/Today.jsx:258-268`, `src/pages/Dashboard.jsx:287-297`. | Use the menu names in the toggle, or remove the toggle if decision 2 merges the pages. |

### D. Adding and editing a gecko

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| D1 | High | Only the first gecko gets the short form. The second and every later gecko opens the long form. | `src/pages/MyGeckos.jsx:540-550`: Quick Add runs only when the collection is empty. | "Add Gecko" always opens Quick Add. Its existing "More details" button hands the draft to the long form for members who want it. |
| D2 | High | The long form is one flat list of 25 controls (up to 31), and photos are the last thing in it. | `src/components/my-geckos/GeckoForm.jsx:640-1286`. | Group it into five labelled sections that collapse on phones, in this order: **Photos**; **Identity** (name, ID, sex, hatch date); **Parents**; **Morph and quality** (tags, quality, tail); **Selling and visibility** (for sale, price, description, public, gallery); **Care and notes** (weight, feeding group, collection, notes). Species, which is always Crested Gecko, comes out of the form. |
| D3 | High | Tapping outside the form, pressing Escape or tapping Cancel throws away everything typed and every photo uploaded, with no question. | `src/components/my-geckos/GeckoForm.jsx:580` calls `onCancel` on any close; there is no check for changes. | If anything changed, ask "Discard changes?" once. Better: keep the draft in the browser and offer "Pick up where you left off" next time. |
| D4 | Med | The morph is entered twice: a free-text box "Morphs & Traits" and a separate tag picker, which is a purple button that unfolds the whole catalogue. | `src/components/my-geckos/GeckoForm.jsx:904-913`; `src/components/my-geckos/MorphIDSelector.jsx`. | One field: a search box that suggests catalogue tags as the member types and accepts free text for anything not in the catalogue. Restyle it in the accent colour (see K2). |
| D5 | Med | Saving a new or edited gecko from the long form shows no confirmation; the form just closes and the list reloads. | `src/pages/MyGeckos.jsx:584-600`. | Toast "Jasper saved" with a "View" action. Add the new card in place before the reload finishes. |
| D6 | Med | "Edit" on the gecko record page leaves the record, opens My Geckos, and after saving the member is left on My Geckos. | `src/pages/GeckoDetail.jsx:166` and the `myGeckosHandoff` helper in `src/components/gecko/record/recordModel.js`. Archive and Mark sold do the same. | Open the form over the record and return to the record on save. |
| D7 | Low | The hatch date is three separate inputs (year text, month select, day text). | `src/components/my-geckos/GeckoForm.jsx:650-680`. | Keep the partial-date ability (breeders often know only the month) but lay it out as one row with clear placeholders, and accept a pasted full date. |

### E. Logging care: six tools for one job

| Tool | Where | Undo | Works offline | Other days | Many weights at once |
|---|---|---|---|---|---|
| One-tap log | `src/pages/QuickLog.jsx` | yes | yes | no | no (one Save each) |
| Field Mode | `src/pages/FieldMode.jsx` | yes | yes | yes | no |
| Batch Husbandry | `src/pages/BatchHusbandry.jsx` | no | no | no | yes, by group |
| Weigh-in mode | `src/components/my-geckos/WeighInMode.jsx` | no | no | yes | yes |
| Record weight form | `src/components/gecko/record/RecordWeights.jsx` | no | no | yes | no |
| Log event dialog | `src/components/my-geckos/EventTracker.jsx` | no | no | yes | no |

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| E1 | High | A member cannot predict which tool has undo, offline saving or back-dating. | Table above. | Make the one-tap log the single engine and give it the missing abilities: a date chip (Today, Yesterday, pick), and "Save all" for weights. Field Mode stays as the hands-full view of the same engine. Batch Husbandry and Weigh-in mode become entry points into it (their routes and buttons stay, their own save code goes). |
| E2 | High | Weigh-in mode can save some weights, report failure, and save the same ones again on retry. | `src/components/my-geckos/WeighInMode.jsx:97-119` uses `Promise.all`. | Save each weight on its own, mark saved rows, retry only the failed ones. Reuse the offline queue's request ids (`src/lib/offlineQueue.js`), which already prevent doubles. |
| E3 | Med | The one-tap log holds at most 10 geckos; the rest are sent to Field Mode, one gecko at a time. A breeder with 20 ungrouped geckos needs about 30 extra taps. | `src/lib/quickLog.js:17, 66-81`; message at `src/pages/QuickLog.jsx:643-648`. The cap exists because the ids travel in the link. | Inside the app, pass the list through router state or load "everything due" by type, with no cap. Keep the 10-id cap only for links in emails and notifications. |
| E4 | Med | Field Mode stays on the same gecko after a log; the member taps Back for every animal. | `src/pages/FieldMode.jsx:1058-1098`. | After a save, show "Next: Nimbus" as the main button, following the due order. End with a summary: "12 fed, 3 weighed, 1 refused". |
| E5 | Low | Weights are always typed from scratch. | `src/pages/QuickLog.jsx:483-501`. | Show the last weight and date beside the box, and ask for a second tap when the entry is more than 30% away from it (a slip of the decimal point is the usual cause). |

### F. The app often says nothing, or says it in the browser's voice

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| F1 | High | Adding eggs with the "1 Egg" and "2 Eggs" buttons shows no confirmation, cannot be undone, and a failure is written only to the developer console. | `src/components/breeding/BreedingPlanCard.jsx:102-131`. | Toast "2 eggs added to Onyx x Aria" with Undo for 8 seconds; a failure toast with Retry. |
| F2 | Med | No confirmation after creating a breeding plan, or after logging the first weight in the first-gecko flow. Failures in Batch Husbandry loading and Hatchery archiving go to the console only. | `src/pages/Breeding.jsx:230-240`; `src/components/onboarding/FirstGeckoFlow.jsx:123-144`; `src/pages/BatchHusbandry.jsx:566-568`; `src/components/breeding/Hatchery.jsx:252-263`. | Every save answers; every failure is shown with a way to retry. |
| F3 | Med | 26 browser pop-ups remained on 11 November: 20 `confirm()`, 4 `alert()` and 2 `prompt()` (one more `confirm()` sits in a `.js` file, `src/lib/aiConsent.js`). 11 are in screens members use (the rest are admin tools and retired features). The waitlist asks for a buyer's name and email through `prompt()`. | `confirm`: `src/components/settings/CollectionsCard.jsx:187, 342, 441`; `src/components/business/WaitlistsTab.jsx:337, 574`; `src/pages/MarketplaceSalesStats.jsx:550, 585, 596`; plus admin and retired files. `prompt`: `WaitlistsTab.jsx:349, 351`. `alert`: `Hatchery.jsx:279`, `src/components/store/StoreCart.jsx`. | One shared `ConfirmDialog` and one `useUndoToast`. Reversible actions use undo; permanent ones use the dialog. The waitlist gets a small form. Do the 11 member-facing calls first (Business Tools 3, Collections 3, Waitlists 4, Hatchery 1); admin tools can follow; skip retired features. |
| F4 | Med | There is no undo for deleting a gecko, deleting a breeding plan, a batch feed or a batch weigh-in. | Flow sweep, section L. | Deleting a gecko is already limited to archived animals behind a dialog, which is right. Give the other three an undo toast. |
| F5 | Med | Settings mixes two ways of saving. Some controls save at once; others wait for a "Save changes" bar; leaving the page with unsaved changes loses them silently. | `src/pages/Settings.jsx:675-691` (the bar); no navigation guard exists in `src/`. | Save everything as it changes, with a small "Saved" tick beside the control. Remove the bar. Text fields save when focus leaves them. |
| F6 | Low | Several links reload the whole app. | `src/pages/Settings.jsx:1195`; `src/pages/MyGeckos.jsx:708-712`; `src/Layout.jsx:628-630`; `src/pages/Membership.jsx:630-635`; `src/pages/QuickLog.jsx:405`. | Use the router's `Link` or `navigate`. Sign-in redirects that must leave the page are fine. |

### G. The gecko record and the passport

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| G1 | Med | The record opens with a small thumbnail and five jump chips that wrap to two rows on a phone. | Screenshot `02`, first panel. | A wide photo at the top that the member can swipe through, name and badges over its lower edge. Jump chips in one row that scrolls sideways. This is the screen a breeder shows a buyer; the animal should fill it. |
| G2 | Med | "View passport" and "QR card" open new tabs. | `src/components/gecko/record/RecordPassport.jsx:49-59`. | Open inside the app with a Back button. In the iPhone app a new tab leaves the app. |
| G3 | High | Making a passport, the action the plan counts (4 issued against a target of 10 by 17 November), is in the "Sharing and records" section near the bottom of the record: about 3,900 pixels of scroll on a phone. | Measured in the browser. `src/components/gecko/record/GeckoRecord.jsx:411-435`. | Add a Share button to the record's sticky top bar, beside "Log event". It opens a sheet: Make a passport (or View passport), QR card, Transfer to a new owner, Copy link. When a gecko is marked For Sale, show one line under its name: "Give the buyer its full history. Make a passport." |
| G4 | Med | A buyer who scans a transfer QR code and has no account goes through four screens before accepting: the claim page, sign-up, the email, then the claim page again. | `src/pages/ClaimAnimal.jsx:178-195`. | With email codes (WP-12) the buyer types a 6-digit code on the claim page and accepts there. Show the animal's photo and name on the claim page before sign-up, so the buyer sees what they are claiming. |
| G5 | Low | Making a passport quietly turns on public display and says so only in a toast. | `src/lib/makePassport.js:19-27`. | Say it before the tap: "This makes Jasper's record public so the link works." |

### H. Navigation, names and structure

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| H1 | Med | The genetics calculator, the feature the old roadmap called the moat, is not in the menu. It is reached from the quick search or a Dashboard link. Two signed-in members opened it in 30 days. | `src/lib/navItems.js` NAV_GROUPS. | Put it in Tools. The slot comes from decision 2 (the Dashboard link) or from folding the three guides. |
| H2 | Med | Morph ID is the third most used page and is two taps away on a phone (three if the Tools group is folded). | Navigation sweep, section 5. | A camera button in the phone header (decision 6). Also offer "Identify by photo" on each gecko's record (I3). |
| H3 | Med | The same thing has several names. | See the table below. | One name per page, used in the menu, the page title, the quick search and every button that leads there. |
| H4 | Med | The quick search shows breeder pages to keepers and "Sign out" to guests. It lists Morph ID and the Gallery twice. | `src/components/command-palette/CommandPalette.jsx` has no keeper or guest check. | Filter by Keeper mode and guest state; remove the duplicates. |
| H5 | Med | Three planning pages sit beside Breeding, each used by one member in 30 days: Pairing Planner, Season Planner (at `/ProjectManager`), Season Timeline (titled "Breeding Season"). | Screenshot `04`. `src/pages/Breeding.jsx:549-557`. | Make them tabs of Breeding: Plans, Hatchery, Pairing ideas, Season, Genetics, Archive. The old addresses redirect to the tab. No page is deleted. |
| H6 | Med | Selling is spread over nine places: Market, Market Pricing, Buy Geckos, Sell Geckos, My Listings, My Store, Business Tools, Portfolio, Liked Geckos. Several appear twice (as a page and as a tab inside Market). | Navigation sweep, section 3. | Two homes. **Business** (today's Business Tools): Money, Sales, Listings, Store, Waitlists. **Prices** (today's Market): My collection's value, Pricing by trait, In-app listings, and the closed live tabs when Enterprise returns. Standalone duplicates redirect to their tab and leave the quick search. |
| H7 | Low | "Favorite Pages" lets a member pin 4 of 12 menu items into a grid above the same 12 items. | `src/Layout.jsx:809-855`; `src/pages/Settings.jsx:741-759`. | Hide the feature. A 12-item menu does not need shortcuts to itself. Members who set favourites keep them until they clear them. |
| H8 | Low | The 24-step sidebar tutorial can still open by itself for an account in a half-finished onboarding state. | `src/Layout.jsx:274-276`. | Never open it automatically. The first-gecko flow and the empty states teach better (decision 5). |

One name per page (H3):

| Page | Names in use today | Use this |
|---|---|---|
| `/MyGeckos` | My Geckos, My Gecko Collection, Geckos, My Collection | **My Geckos** (tab label "Geckos") |
| `/Breeding` | Breeding, Breeding Management | **Breeding** |
| `/Lineage` | Lineage, Gecko Lineage, Lineage Tree | **Lineage** |
| `/Recognition` | Morph ID, Crested Gecko Morph ID, Identify morph with AI | **Morph ID** |
| `/calculator` | Genetics Calculator, Crested Gecko Genetics Calculator, Morph & Breeding Calculator, Genetic Calculator Tool, Calculate a pairing | **Genetics Calculator** (the long title stays in the public page's search title only) |
| `/BatchHusbandry` | Batch Husbandry, Batch Care, Log care | folded into the log flow |
| `/ProjectManager` | Season Planner, Project Manager | **Season** tab of Breeding |
| `/BreedingSeason` | Season Timeline, Breeding Season | part of the **Season** tab |
| `/Gallery` | Image Gallery, Community Gallery | **Community Gallery** |
| `/MarketplaceSalesStats` | Business Tools (its description also says "market intelligence") | **Business** |
| `/Market` | Market Intelligence, Market | **Prices** (decision 3) |
| `/Pedigree` | Pedigree, Pedigree Chart, Family tree | **Family tree** |
| `/Training` | AI Training Center, Morph ID Evidence Lab | **Morph ID review** (admin only) |

### I. Morph ID

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| I1 | High | On a phone the page opens with a heading, three steps, a warning line and then a large amber card of four cautions. The upload control is below all of it. | Screenshot `05`, third panel. `src/pages/Recognition.jsx:508` renders `MorphIdLimitsCard` above the uploader at `:570`. | Uploader first. Above it, one line: "Morph ID reads what is visible. A photo cannot prove a gene." with "What a photo can't tell you" as a link that unfolds the four cautions. Show the full cautions beside the result, where they change how the result is read. |
| I2 | Med | Free members have one scan a month. When it is used, the uploader disappears and a locked card takes its place. | `src/pages/Recognition.jsx:517-541`. | Keep the uploader visible but disabled, with the date the next free scan arrives. A member who knows when it returns comes back. |
| I3 | High | A result can only create a new gecko. There is no way to run Morph ID on a gecko already in the collection, or to save the result to one. | `src/pages/Recognition.jsx:258-275` is the only save path. | On the result: "Save to an existing gecko" with a picker, which fills that gecko's morph tags after the member confirms each one. On the gecko record: "Identify by photo", which opens Morph ID with that gecko's photos preloaded and returns to the record. 21 members used Morph ID this month and 31 keep collections; this joins the two. |
| I4 | Low | The consent step appears only after the member taps "Identify morph", which reads as the button failing. | `src/pages/Recognition.jsx:295-302, 654-659`. | Show the consent line under the button from the start for members who have not agreed yet, and label the button "Allow and identify". One tap, not two. |

### J. Sign-up, first run, plan limits, Settings

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| J1 | High | Email sign-up ends at "Check your email". The member must leave, find the message and tap a link; opened in a different browser, the link asks them to sign in a second time. The day-one first-gecko rate on the scoreboard is 0 of 3. | `src/components/auth/LoginPortal.jsx:318-361, 157-164`. | A 6-digit code typed into the same screen (Supabase supports this; the email template needs `{{ .Token }}`). The member never leaves the tab. Decision 4. |
| J2 | Med | The "keeper or breeder" question is a pop-up that appears 1.5 seconds after the first screen, on top of the "add your first gecko" card the member has started reading. In one timing it can open over step 2 of that flow. | `src/Layout.jsx:258-282`; `src/components/onboarding/FirstGeckoFlow.jsx` does not hold the prompt back. | Make the question the first panel of the first-gecko card itself: three choices, then the add form. No timer, no pop-up. Closing without choosing should ask again later, not record "show me everything". |
| J3 | Med | A display name is required to sign up. | `src/components/auth/LoginPortal.jsx:219-223, 569`. | Optional. Fall back to the part of the email before the @ and ask again the first time the name would be shown to someone else. The form says "You can change it later", but the field to change it is on My Profile, not in Settings (`src/pages/MyProfile.jsx:542-546`); add it to Settings. |
| J4 | Med | Plan limits are checked after the work, not before. A Free member fills in the whole new-pairing form and is refused on submit; a spreadsheet import reports skipped rows only when it has finished. | `src/pages/Breeding.jsx:197-202`; `src/components/my-geckos/CSVImportModal.jsx:510-522`. | Check when the form opens. For imports, say at the mapping step: "Your plan holds 10 geckos. This file has 34. The first 10 will be imported." |
| J5 | Med | After paying, the member lands on the Membership page, not back where they were stopped. | `src/pages/Membership.jsx:666` always returns to `/Membership`. | Carry the page they came from through checkout and return there with "You're on Breeder. Carry on." |
| J6 | Low | The plan-limit notice has six different forms (a modal, an inline error, a toast, a post-import note, a claim error, a locked card). | Flow sweep, section H. | One component with two shapes (inline and modal) and one voice. |
| J7 | Med | Settings is one page of about 23 sections and 65 to 75 controls, about 45 of them switches, with a "Jump to" strip of 21 to 24 links. Email notifications are 12 switches and push notifications are 18 more, in separate cards. | `src/pages/Settings.jsx`. | Five tabs: **Account** (name, photo, email, security, plan, sign out), **Look** (theme, accent, artwork), **Reminders** (one table: a row per kind of notice, a column each for email and push, plus feeding and weigh-in timing and time zone), **Breeder profile** (business details, socials, store policy, IDs, hatchery), **Data and privacy** (export, privacy, blocked users, delete account). |
| J8 | Low | `PLAN_LIMITS` lists CSV export, weight tracking and the lineage tree as paid features, but Free members use all three and the pricing page says they are free. | `src/components/subscription/PlanLimitChecker.jsx:36-37`; `src/pages/Membership.jsx:105-106`. | Remove the three keys so the code says what is true. |

### K. The visual system

Counts are from a search of `src/` (854 files, tests left out).

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| K1 | Med | Very small text is everywhere: 289 uses of 10 pixel text and 294 of 11 pixel, plus 9.5 pixel tab labels. | Search for `text-[10px]` and `text-[11px]`. | A floor of 12 pixels (`text-xs`) for anything a member reads. 11 pixels only for uppercase eyebrow labels. Add a test that fails if the count of `text-[10px]` rises. |
| K2 | Med | Twenty colour families are in use. Beyond the themed greys and the accent: amber 862, red 317, rose 266, purple 162, blue 157, sky 124, pink 93, stone 89, yellow 73, orange 72, violet 70, teal 50. One screen can show four accents. | Visual sweep, section 2. The calculator's "Fill parents" button and selected chips are purple (`src/pages/GeneticCalculatorTool.jsx:357-384`), and so are morph tags (`src/components/my-geckos/MorphIDSelector.jsx:68`). | Five roles and nothing else in app screens: accent (the member's choice), success (green), warning (amber), danger (red), neutral. Purple, blue, sky, pink, violet and teal are replaced by accent or neutral, except in illustrations, charts, and the male and female markers. Start with the three most used pages. |
| K3 | Med | Page titles are written 42 different ways. 33 of 86 pages use the shared header; 43 build their own. | Visual sweep, section 3. | Every app page uses `src/components/shared/PageHeader.jsx`. Dashboard, Today, Lineage, My Profile and the gecko record page first. |
| K4 | Low | Seven different content widths and three page paddings. | `max-w-5xl` 31, `6xl` 28, `4xl` 25, `7xl` 22 and others; `p-4 md:p-8` on 42 pages, `p-4 md:p-6` on 18. | Three widths: reading (`max-w-3xl`), standard (`max-w-5xl`), wide (`max-w-7xl`), set by one `PageContainer` component. One padding. |
| K5 | Low | The same small card for a number and its label is written 15 times under different names. | `StatCard`, `StatsTile`, `KpiCard`, `Stat`, `StatChip`, `StatPill`, `Metric` across pages. | One `Stat` component in `src/components/shared/`. |
| K6 | Med | Loading is mostly a spinner: 274 spinners against about 25 skeletons. The design document says the opposite should be true. Moving between pages shows a centred spinner. | `src/App.jsx:212-216, 240-244`. | Skeletons shaped like the page for the five main screens, and as the fallback while a page's code loads. Spinners only inside buttons. |
| K7 | Low | Three things move forever on every page: a bouncing arrow in the sidebar, a pulsing ring on Enterprise avatars, and a 28-second glow on the Dashboard. | `src/Layout.jsx:1058`; `src/styles/layout-theme.css:1070`; `src/pages/Dashboard.jsx:277`. | Remove the bounce and the glow. Motion should answer an action. |
| K8 | Low | Rank badges use emoji (egg, lizard, seedling, trophy, crown): 157 emoji in the code, most of them here. The design document says "not cute, not gamified". | `src/components/ui/UserBadge.jsx`, `src/lib/layoutConstants.js:21-25` (the ladder is defined twice), `src/pages/MyProfile.jsx`. | Hide the ladder, or replace it with one plain line such as "Keeping since 2024, 34 geckos" (decision 5). |
| K9 | Low | At least 51 icon-only buttons have no name for screen readers; 9 hand-built overlays lack the shared Escape and focus handling. | Visual sweep, sections 4 and 8. Worst file: `src/pages/MarketplaceSalesStats.jsx` (10). | Add `aria-label`s; move the overlays to the shared dialog or `useModalOverlay`. |
| K10 | Low | Leftovers: unused `--gi-*` colour variables and a block of commented-out starter code in `src/index.css:138-206, 958-970`; fonts named but never loaded ("Young Serif", `font-serif` in the care guide). | Visual sweep, section 1. | Delete the dead CSS. Leave files that belong to retired features. |

### L. Feel: motion, touch, speed

| ID | Sev | What | Evidence | Fix |
|---|---|---|---|---|
| L1 | Med | Screens swap instantly with no transition, so a tab change reads as a jump. | No route transition in `src/Layout.jsx`. | A 120 millisecond cross-fade using the browser's View Transitions feature (supported in Chrome and Safari; other browsers simply skip it). Off under reduced motion. |
| L2 | Med | Saves wait for the server before the screen changes. The data library is installed but its save helper is used nowhere (0 `useMutation` calls); pages reload their whole list after a save. | Visual sweep, section 7. | For the five most common writes (log feeding, log weight, add gecko, add eggs, toggle a reminder), change the screen first and roll back with a toast if the save fails. The reminder toggles in `FirstGeckoFlow.jsx:146-156` already do this and are the pattern to copy. |
| L3 | Med | In the iPhone app there is no touch feedback, no pull to refresh, and nothing that moves a field above the keyboard. | No `@capacitor/haptics`, no `@capacitor/keyboard`; `overscroll-behavior: none` in `src/index.css:14`. | Add the two Capacitor plugins. A light tap on Fed, Save and tab changes; pull to refresh on Today and My Geckos; scroll the focused field into view when the keyboard opens. Needs a real iPhone to check. |
| L4 | Low | Each page's code is fetched when the member taps, which adds a pause on slow connections. | Lazy routes in `src/App.jsx`. | After the first screen is idle, fetch the code for the other three tab destinations in the background. |
| L5 | Low | Buttons and cards have hover states but most have no pressed state, so a tap on a phone gives no visible answer until the save returns. | 12 uses of `active:scale` in all of `src/`. | A pressed style in `src/components/ui/button.jsx` and on tappable cards (slightly darker, 98% scale, 80 milliseconds). |

## 6. What to remove, hide or merge

Nothing here deletes a table or a retired feature's code. "Hide" means remove the entry point; "merge" means the old address redirects to the new place.

| Item | Action | Why |
|---|---|---|
| Floating feedback button on phones | Move into the More menu | B2 |
| Floating feeding cards | Remove; Today lists the same items | B4 |
| Hamburger button on phones | Remove; More does the same | B6 |
| "VIEW ONLY" pills in the demo menu | One line at the top | B8 |
| Dashboard hero buttons: My Store, Preview profile, What's New, Sign out | Move to Business, Profile, More | C4 |
| Community Pulse as the first thing on the home screen | Off by default | C2, decision 7 |
| Batch Husbandry page | Merge into the log flow | E1; 1 visitor in 30 days |
| Weigh-in mode's own save code | Merge into the log flow | E1, E2 |
| Pairing Planner, Season Planner, Season Timeline as separate pages | Merge as tabs of Breeding | H5; 1 visitor each |
| Buy Geckos, Sell Geckos, My Listings, Liked Geckos, Market Pricing as separate pages | Merge as tabs of Business or Prices | H6; 0 to 1 visitors each |
| "Pedigree" in the quick search and "Pedigree Chart" on Breeding | Remove | A2 |
| Favorite Pages | Hide | H7 |
| 24-step sidebar tutorial opening by itself | Stop | H8 |
| Emoji rank badges | Hide or replace | K8, decision 5 |
| Messages icon in the phone header | Fold into the bell | Decision 6; 2 visitors in 30 days |
| Species field on the gecko form | Remove | D2; the app is crested geckos only |
| Free-text morph box beside the tag picker | Merge into one field | D4 |
| "Save changes" bar in Settings | Remove once everything saves as it changes | F5 |
| Three endless animations | Remove | K7 |
| Unused CSS variables and commented starter code | Delete | K10 |
| The `isHatching` mode of the gecko form (no caller) | Ask Tennyson, then delete | `src/components/my-geckos/GeckoForm.jsx:41, 584` |

## 7. The structure to aim for

**Phone.** Tabs stay: Today, Geckos, Log, More. Header becomes: page title on the left; search, Morph ID (camera), and the bell on the right.

**Menu** (12, if decision 2 merges the Dashboard into Today):

| Group | Items |
|---|---|
| (home) | Today |
| Collection | My Geckos, Lineage |
| Breeding | Breeding (tabs: Plans, Hatchery, Pairing ideas, Season, Genetics, Archive), Genetics Calculator |
| Selling | Business (tabs: Money, Sales, Listings, Store, Waitlists), Prices |
| Tools | Morph ID |
| Learn | Morph Guide, Care Guide, Genetics Guide |
| Community | Forum |

Keeper mode (7): Today, My Geckos, Morph ID, Morph Guide, Care Guide, Genetics Guide, Forum.

If decision 2 keeps the Dashboard, the calculator's slot comes from folding the three guides into one "Guides" item that opens a page with three cards.

**The gecko record** is the centre of the product. Everything about one animal starts there: log, edit in place, identify by photo, family tree, value, share and passport, transfer.

**One log flow** behind every "log" button in the app: Today's cards, the Log tab, the Dashboard, My Geckos' Weigh-in button, reminders and emails all open the same screen with the right list.

## 8. Innovations

Ranked by how much smoother they make a real job. "Inside the freeze" means the idea lives in a page that already exists.

**Inside the freeze (can be built now)**

1. **Rack walk.** Field Mode follows the due list in order, moves to the next gecko after each save, and ends with a tally (E4). A breeder feeding 40 animals taps once per animal.
2. **Sell and hand over in one flow.** Marking a gecko Sold opens three steps on one sheet: sale price (optional), make the passport, show the QR code for the buyer to scan. The pieces all exist (`SoldTransferStep`, `makePassport`, `TransferDialog`); today they are three separate places. This is the plan's own loop.
3. **Morph ID on an animal you already own** (I3).
4. **Sign-up by code, and claim by code** (J1, G4). The buyer who scans a QR card owns the record 30 seconds later.
5. **Undo in place of "are you sure"** for everything reversible (F3, F4).
6. **A weight check that catches slips** (E5).
7. **A draft that survives** (D3): close the gecko form by accident, open it again, and the entries are there.
8. **Tub labels that open the log.** The passport QR card already exists and Printable Worksheets already prints. Add a worksheet of small labels, one per gecko, whose code opens that gecko's log page when scanned with the phone camera. No new page.

**After decision day (new surface, or needs native work)**

9. **Lock screen and home screen presence on iPhone**: a widget showing what is due today, and a live countdown for a clutch in its hatch window. The plan already ties the iPhone work to what breeders say in calls.
10. **Type or say it**: "fed the hatchlings", "Pixel 15.2 grams" in the quick search, turned into a log entry with one confirm.
11. **Read the scale**: point the camera at the scale's display and the weight fills itself in.
12. **Season wrap**: at the end of the season, one shareable card per breeder (pairs, eggs, hatch rate, best producer). It doubles as distribution.
13. **Buyer's first week**: after a claim, three short notes about that specific animal (what it eats, its weight history, when its next shed is likely), drawn from the seller's record.

## 9. Work packages

Effort: S is under a day, M is one to three days, L is a week. "Who" is a session unless it says Tennyson.

### WP-0. Visible defects (S)

Findings: A1, A2, A3, A4, A5, A6, A8, A11, C3, J8.

- `src/pages/Breeding.jsx:555-556`: point Clutch Lab at `/calculator/learn`; remove Pedigree Chart.
- `src/lib/navItems.js`: remove the Pedigree palette entry. `src/pages/Pedigree.jsx:415-430`: replace the developer message with a gecko picker.
- `src/components/my-geckos/MorphIDSelector.jsx:71`: icon and `aria-label`.
- `src/pages/MyGeckos.jsx`: phone toolbar on two rows.
- New `formatMoney` in `src/lib/`, with tests; use it in `src/pages/MarketplaceSalesStats.jsx` and wherever `toFixed(2)` follows a `$`.
- `src/components/breeding/Hatchery.jsx:279`: toast.
- `src/Layout.jsx:331, 978, 1141`: local logo.
- `src/pages/Dashboard.jsx:339`: "Log care" opens the log flow.
- `src/components/subscription/PlanLimitChecker.jsx:36-37`: remove the three unenforced keys.
- `docs/specs/DESIGN-SYSTEM.md`: the four corrections.
- Queue A9 in `docs/planning/app-store-resubmission-2026-10-26.md` and A10 in `docs/planning/homepage-ab-test-2026-10.md`.

Done when: `/ClutchLab` is not linked anywhere in `src/`; no page shows "?geckoId="; a selected morph tag shows a cross; at 390 pixels the My Geckos sort control and view toggle do not overlap; Business Tools shows `$34,975`; `grep -rn "alert(" src --include=*.jsx` finds nothing outside retired features; tests pass.

**Shipped 11 November 2026** (commit "Fix visible defects from the experience review (WP-0)"). All of the list above, with these differences. A2: the Pedigree page now lists the member's geckos with a search box when it is opened without one, so the two entry points were kept (they work now). A5: `formatMoney` in `src/lib/money.js` adds thousands separators and shows cents only when the amount has them (a ledger needs its cents; the "no cents at $100 and above" idea was dropped). A9: the launch colour was changed in `capacitor.config.ts` and `src/lib/nativeShell.js` and noted in the App Store document; it takes effect at the next iPhone build. A10 is queued in the homepage test document. Checks: lint, 3,838 unit tests, 40 browser tests.

### WP-1. Quiet the phone screen (S to M)

Findings: B1 to B8.

- `src/styles/layout-theme.css:1156-1263`: bar tint, fade, 11 pixel labels.
- `src/components/feedback/FeedbackWidget.jsx`, `src/Layout.jsx:1496`: no floating button below the `md` width; add "Send feedback" to the menu footer and Settings.
- `src/Layout.jsx:1482-1491` and the five notices: one queue with a priority order.
- `src/components/feeding/FeedingAlertSystem.jsx`: stop rendering cards; keep the count for the Today link.
- `src/Layout.jsx:968-1105`: solid drawer; one demo line; remove the phone hamburger and show the page title.

Done when: on every phone screenshot, no page text is readable through the bottom bar; nothing floats over a list row; at most one floating notice is visible in any state (add an e2e check that counts elements marked `data-floating-notice`); the e2e phone project still passes.

**Shipped 12 November 2026** (commit "Quiet the phone screen (WP-1)"). The bottom bar and the header carry the page colour at 85% under the glass (`--glass-tint`), with a short fade above the bar; the blur and the glass edge stay, so this adjusts decision 39 without dropping it. The phone header is the page's name, then Search, Morph ID and the bell; the hamburger is gone (the More tab opens the same menu) and Messages moved into the bell. Floating notices take turns through one queue (`src/components/shared/floatingNoticeQueue.js`): app update, analytics consent, offline status, the feeding reminder ask, the demo tour. The floating feeding cards are gone; one line offering reminders on this device is what is left of them. No floating feedback button on phones ("Send feedback" is in the menu and on Settings, Account). The menu is solid, and the demo shows one line in place of a pill on every item. A browser test counts the floating notices.

### WP-2. Every action answers, nothing is lost (M)

Findings: F1 to F6, D3, D5, E2.

- New `src/components/shared/ConfirmDialog.jsx` and `src/hooks/useUndoToast.js`.
- Replace `confirm`, `alert` and `prompt` in live features (list in F3).
- Toasts for gecko save, plan create, quick eggs (with undo), first weight.
- Show the failures that go to the console today.
- Unsaved-changes guard and browser draft for `GeckoForm.jsx`.
- `WeighInMode.jsx`: per-row saves with request ids.
- Settings saves as it changes (can ship with WP-9 instead).

Done when: the browser pop-ups gauge in section 10 lists only admin and retired-feature files; closing a changed gecko form asks first; a test proves a retried weigh-in does not create a second row; each of the four saves named shows a toast in an e2e or component test.

**Shipped 12 and 13 November 2026** (commits "Shared Undo toast and confirmation dialog", "No browser pop-ups on waitlists and reserves; plan limits said up front (WP-2, WP-13)", and the WP-3, WP-6 and WP-9 commits). The two shared pieces are `src/components/shared/ConfirmDialog.jsx` and `src/lib/undoToast.jsx` (a function, not the hook named above). Waitlists: adding a buyer is a small form, deleting a waitlist asks in a styled dialog, withdrawing a sign-up happens at once with Undo. Reserves: cancel and delete happen at once with Undo; completing a sale still asks, because it records revenue. Quick eggs have Undo and deleting a breeding plan asks in the styled dialog (WP-6). The long gecko form keeps a draft of an unsaved new gecko in the browser for 14 days and offers it back (WP-3). Settings saves as it changes (WP-9). **Still to do:** the cost delete on the Money tab has no Undo.

### WP-3. Adding a gecko (M)

Findings: D1, D2, D4, D6, D7.

Done when: "Add Gecko" opens Quick Add for any collection size; the long form shows five headed sections with Photos first; there is one morph field; Edit on the record page saves and stays on the record; the existing first-gecko e2e flows pass unchanged.

**Shipped 13 November 2026** (commit "Adding a gecko: Quick Add for everyone, a long form in sections (WP-3)"). "Add Gecko" opens Quick Add for any collection size; the first gecko keeps its guided flow, and "More details" still leads to the long form. The long form has six headed sections, Photos first, that fold; on a phone Photos and Identity start open, and a folded section holding an invalid field opens before the save. The Species select is gone (the record still carries "Crested Gecko"). One Morph group: a search box over the catalogue that forgives "lily" and "capuccino", chips, one free-text line, and "Browse all". The hatch date is one labelled row, and a full date pasted into Year fills all three. Edit on the record page opens the form over the page and returns to the record. The draft from D3 is described under WP-2. **Left out:** saving a hatch year alone. The form never saved one, and the row now says so; storing it needs `estimated_hatch_year` added to what `save_gecko_record` accepts, which is a migration. A Morph ID result on a collection that already has geckos still opens the long form. **A decision for Tennyson:** Quick Add with reminders on puts the gecko in the member's first feeding group, which a breeder with several groups now meets on every add (`docs/OWNER-STEPS.md`).

### WP-4. One log flow (M to L)

Findings: E1, E3, E4, E5, A7, C3.

Done when: the table in section E has "yes" in every cell for the one-tap log; `/BatchHusbandry` and the Weigh-in button open it; 20 ungrouped geckos can be marked fed in 2 taps and weighed with 20 entries and 1 Save; Field Mode offers "Next" after each save; offline tests still pass.

### WP-5. The record and the passport (M)

Findings: G1, G2, G3, G5. Serves the plan's passport numbers.

Done when: from My Geckos, a passport can be made in 3 taps with no scrolling (open gecko, Share, Make a passport); the passport and QR card open inside the app; a gecko marked For Sale shows the passport line; `detail-record.e2e.js` and `transfer-continuation.e2e.js` pass.

**Shipped 11 November 2026** (commit "Gecko record: Share in the top bar, passport opens in the app (WP-5)"). Share is in the record's top bar (`src/components/gecko/record/RecordShare.jsx`): Make a passport or View passport, QR card, Copy link, and Transfer to a new owner. View passport and QR card open in the same tab, and the passport page has a Back link to the record. A gecko marked For Sale with no passport shows the offer under its name. Both places say before the tap that a passport makes the record public (G5). The jump links are one row that scrolls sideways on a phone. **Not built, on purpose:** the wide hero photo in G1. The small photo is a decision of plan item E3 24 ("parents and value above the fold"), noted in the component, and the one-row jump links serve the same aim. A browser test covers the three-tap passport.

### WP-6. Breeding (M)

Findings: H5, J4 (pairs), F1, and the hand-off below.

- "Plan this pairing" in `src/pages/PairingPlanner.jsx:650` opens the new-plan dialog with sire and dam filled in (today it opens the Breeding page and the member picks both again).
- The three planners become tabs; old addresses redirect.
- The pair limit is checked when the dialog opens.

Done when: a pairing chosen in the planner needs no re-picking; `/PairingPlanner`, `/ProjectManager` and `/BreedingSeason` land on the right tab; a Free member at the pair limit sees the notice before any field.

**Shipped 13 November 2026** (commit "Breeding: the planners are tabs, and a chosen pairing carries over (WP-6)"). Breeding has six tabs: Plans, Hatchery, Pairing ideas, Season, Genetics, Archive (`src/components/breeding/breedingTabs.js`). `/PairingPlanner` and `/BreedingSeason` forward to their tabs and keep any query. "Plan this pairing" opens the new-plan dialog with the sire and dam filled in. The pair limit is checked when the dialog opens. Quick eggs have Undo; deleting a plan asks in the styled dialog. **Different from the list above:** `/ProjectManager` (the Season Planner) stays a page of its own, linked from the Season tab with a way back, because it is a task planner with its own dialogs and not a view of the pairings.

### WP-7. Morph ID (M)

Findings: I1 to I4, H2.

Done when: at 390 by 844 the upload control is fully on the first screen for a signed-in member with a scan left; a result can be saved to an existing gecko; the gecko record offers "Identify by photo"; the Morph ID tests pass and no caution text has been deleted, only moved.

**Shipped 12 November 2026** (commit "Morph ID: upload first, and save a result to a gecko you already have (WP-7)"). The uploader comes first, under one line ("Morph ID reads what is visible. A photo cannot prove a gene.") that unfolds the four cautions; the full cautions show again beside the result, and no caution text was removed. A result can be saved to a gecko the member already has (`SaveToGeckoDialog.jsx`): the suggested traits are offered unticked and are added to the gecko's morph tags. The gecko record has "Identify by photo" (`/Recognition?gecko=<id>`), and saving returns to the record. A member with no scan left sees the uploader disabled with the date the next one arrives. The consent notice sits under the button, which reads "Allow and identify"; nothing is sent before the member agrees.

### WP-8. Home, menu and names (M). Needs decisions 2, 3, 5, 6, 7.

Findings: C1, C2, C4, C5, H1, H3, H4, H6, H7, H8.

Done when: every page in the names table shows its one name in the menu, the title and the quick search; the quick search hides breeder pages in Keeper mode; one function decides the home screen for every entry; `navItems.derived.test.js` passes with the new list; the redirects are in `scripts/build-vercel-json.mjs`.

### WP-9. Settings (M)

Findings: J7, F5, J3 (name field).

Done when: Settings has five tabs; no "Save changes" bar; reminders are one table; a display name can be changed there; a deep link such as `/Settings#id-logic` still lands on the right control.

**Shipped 13 November 2026** (commit "Settings in five tabs, saving as you go (WP-9)"). Five tabs: Account, Look, Reminders, Breeder profile, Data and privacy. All 28 old links into Settings still open the right tab at the right control. Everything saves as it changes, with a "Saved" tick beside the control and "Try again" on a failure; each save sends only the field that changed. Reminders are one table with an Email column and a Push column. The display name can be changed on Account, where "Send feedback" and Log out also sit. Favorite Pages is hidden; its code and the saved favourites are kept. All 74 settings are still there.

### WP-10. Visual tightening (M to L, can be done page by page)

Findings: K1 to K10. Order: My Geckos, Today, the record, Morph ID, Breeding, then the rest.

Done when: the gauges in section 10 meet their targets for the pages touched; a test holds each count so it cannot rise.

### WP-11. Feel (M; the native parts wait for an iPhone build)

Findings: L1 to L5. New dependencies allowed here only: `@capacitor/haptics`, `@capacitor/keyboard`.

Done when: tab changes cross-fade and do nothing under reduced motion; the five writes update the screen before the server answers and roll back on failure (tests); pressed states exist on buttons and cards. Tennyson checks haptics, pull to refresh and the keyboard on a phone.

### WP-12. Sign-up and first run (M). Needs decision 4.

Findings: J1, J2, J3, G4.

- Tennyson's step, if decision 4 is yes: Supabase, Authentication, Email Templates, "Confirm signup": add the 6-digit code (`{{ .Token }}`) above the link. https://supabase.com/dashboard/project/mmuglfphhwlaluyfyxsp/auth/templates
- The "check your email" screen gains a code box; the link keeps working.
- The role question moves into the first-gecko card.

Done when: a new member can sign up, confirm and add a gecko without leaving the tab (`member-flow.e2e.js` extended); no pop-up appears in the first 10 seconds of a new account; the claim page accepts a code.

**Shipped 11 November 2026** (commit "Sign-up by 6-digit code, and the first-run question on the page (WP-12)"). The "Check your email" screen takes the 6-digit code (`handleVerifyCode` in `src/components/auth/LoginPortal.jsx`); the link still works; a sign-in refused for an unconfirmed email offers "Enter the code". The keeper-or-breeder question is the first panel of the first-gecko card and a slim card above the list for members who have geckos and never answered (`src/components/onboarding/RoleQuestion.jsx`); the pop-up and its timer are gone, and the 24-step tour no longer opens by itself (the automatic half of H8). **Waiting on Tennyson:** the email shows no code until the template has one (`docs/OWNER-STEPS.md`, step A3). **Not built, on purpose:** J3 (an optional display name): the name was made required on purpose in an earlier audit so members do not appear as "Geck Inspect member", and falling back to part of the email address would show part of it to other members. The second half of G4 (the animal's photo on the claim page before sign-up): the transfer contract deliberately shows a signed-out visitor nothing about the animal (`docs/planning/qr-transfer-security-2026-10-17.md`). The buyer's path is still shorter: sign up, type the code, accept.

### WP-13. Plan limits (S to M)

Findings: J4, J5, J6, I2.

Done when: every limit is shown before the member does the work; checkout returns to the page it started from; one component renders every limit notice.

**Shipped 12 and 13 November 2026**, in part. The spreadsheet import says before anything is imported how many rows the plan has room for (`src/components/my-geckos/csv/importPreview.js`). After paying, the Membership page offers one button back to the page where the limit stopped the member (`src/components/subscription/upgradeReturn.js`); no headline, plan card or price changed, because the paywall test is running. The pair limit is checked when the new-plan dialog opens (WP-6). Morph ID shows the date the next free identification arrives (WP-7). **Still to do:** J6, one component for every limit notice.

### Also shipped on 11 November 2026 (small fixes outside the three packages)

Commit "Small fixes from the experience review: saves that answer, no lost work".

- **E2:** Weigh-in mode saves each weight on its own and clears its row as it goes, so a retry after a failure sends only the ones that failed. (Part of WP-2 and WP-4.)
- **D3:** the long gecko form asks "Discard your changes?" before closing if anything was changed. The saved draft that survives a closed form is still to do. (Part of WP-2 and WP-3.)
- **D5, F1, F2:** saving a gecko from the long form, creating a breeding plan and the quick egg buttons now say what happened, and a failed quick egg save is shown. Undo for quick eggs is still to do. (Part of WP-2.)
- **B7:** phone tab labels are 11 pixels. (Part of WP-1.)
- **C3:** the Dashboard's "Log care" opens the Log sheet (in WP-0).
- The `scrollbar-none` class used by three chip rows was never defined; it is now.
- The weekly growth report no longer writes a prompt to draft a blog post.

Left alone although small, because each needs a decision or a real phone: B1 (the glass bottom bar's legibility is part of the liquid glass design, decision 39), H4 (hiding breeder pages from a keeper's quick search also removes their way to find them), K7 (the endless animations).

## 10. How to tell it worked

**Numbers the plan already tracks** (Admin, Weekly scoreboard): the day-one first-gecko rate (0 of 3 on 31 October), passports issued (4), weekly active breeders (1). WP-12 should move the first, WP-5 the second, WP-4 the third. With this few members, read them over four weeks, not one.

**Taps for the main jobs** (phone, from opening the app):

| Job | Today | Target |
|---|---|---|
| Log a due feeding | 2 | 2 |
| Feed 20 ungrouped geckos | about 32 | 2 |
| Weigh 20 geckos | 10 Saves plus about 40 taps in Field Mode | 20 entries, 1 Save |
| Add a second gecko | about 25 controls on screen | 6 |
| Make a passport | 3 taps and a long scroll | 3 taps, no scroll |
| Run Morph ID | 2 to 3 taps, then scroll past cautions | 1 tap, upload on the first screen |
| Record a pairing picked in the planner | pick both parents twice | pick once |
| New buyer accepts a transfer | 4 screens and an email link | 1 screen and a code |

**Code gauges** (run from the repo root; baselines from this review):

| Gauge | Command | Now | Target |
|---|---|---|---|
| 10 pixel text | `grep -rn "text-\[10px\]" src --include=*.jsx \| wc -l` | 289 | under 40 |
| 11 pixel text | `grep -rn "text-\[11px\]" src --include=*.jsx \| wc -l` | 294 | under 80 |
| Browser pop-ups | `grep -rnE "[^.[:alnum:]_](confirm\|alert\|prompt)[(]" src --include=*.jsx \| grep -v __tests__ \| wc -l` | 26 (11 member-facing); 25 and 10 after 11 November | 0 member-facing |
| Spinners | `grep -rn "<Loader2" src --include=*.jsx \| wc -l` | 274 | under 120 |
| Pages using the shared header | `grep -rln "PageHeader" src/pages \| wc -l` | 33 of 86 | every app page |
| Optimistic saves | `grep -rn "useMutation" src \| wc -l` | 0 | 5 or more |
| Purple in app screens | `grep -rnE "(bg\|text\|border)-(purple\|violet)-" src --include=*.jsx \| wc -l` | 120 | under 30 |

**Screens.** Re-run `experience-review-2026-11/capture.cjs` (instructions are at the top of the file) and compare with the eight images in that folder.

**Owner checks on a real iPhone**, after the next build: the bottom bar's legibility over a photo grid, the keyboard over the weight field, pull to refresh, haptics, the launch colour.

## 11. What not to do

- Do not redesign the look. The dark, themed surface works; the job is consistency.
- Do not add pages, a light mode, new themes, new badges or new games.
- Do not delete retired features or their tables.
- Do not change the landing page or theme defaults while the homepage test runs.
- Do not spend a session polishing a page that one member opened this month. Fold it into its parent.
- Do not let this document become the plan. Part E of `comprehensive-review-2026-10-14.md` is still the plan, and its Day 30 rule comes first.
