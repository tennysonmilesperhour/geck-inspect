# Mobile UI/UX audit, 2026-09-10

Scope: the authenticated app shell (`src/Layout.jsx`) and the ~57 pages
registered in `src/pages.config.js`, reviewed at 390x844 (iPhone 14
class) in guest mode with Playwright screenshots plus a code inventory of
every page header, tab bar, button recipe, and card recipe. Public
marketing pages (Home, blog, About, Contact, Terms) were out of scope.

The brief: no rubber-band overscroll anywhere, and a first-time-user
read of whether pages, buttons, tabs, and options are organized the same
way from page to page.

## 1. Rubber-band overscroll (fixed)

Root cause was structural, not one bad page. The shell is a fixed
`h-screen` frame whose content scrolls in an inner div, while
`html/body` are `height: 100%` with `overflow-x: hidden`. On iOS
`100vh` is taller than `100%` (Safari's toolbar), so the body itself
gained a few dozen pixels of scroll. Every swipe that reached the end
of the inner scroller chained into that body scroll and bounced the
whole frame, header and bottom nav included. Dialogs, sheets, the
drawer, and select lists each bounced on their own edges as well.

What changed:

- `html, body { overscroll-behavior: none }` (`src/index.css`).
- Shell height is `100dvh` (`h-dvh` with `h-screen` fallback in
  `Layout.jsx`, `min-height: 100dvh` in `layout-theme.css`), so the
  body no longer has phantom scroll.
- One global rule sets `overscroll-behavior-y: none` on every element
  carrying a Tailwind vertical overflow utility, Radix scroll/select/
  menu/popover viewports, `[role=dialog]`, `[role=listbox]`,
  `[role=menu]`, and `overscroll-behavior-x: none` on horizontal
  strips only, so a vertical swipe that starts on a tab strip still
  scrolls the page.
- The main scroller, dialogs, sheets, the drawer and its body lock,
  and `.custom-scrollbar` all use `none` rather than `contain`.
- `min-h-screen` inside the shell resolves to the scroll area
  (`.app-main-scroll > .min-h-screen { min-height: 100% }`). 45 pages
  set `min-h-screen`; each was adding ~120px of empty scroll below its
  content on phones.

Verified in Chromium at 390x844: `overscroll-behavior` reads `none` on
html, body, the main scroller and open dialogs; shell height equals
`innerHeight`; `body.scrollHeight` equals the viewport. The iOS bounce
itself cannot be reproduced in headless Chromium, so the remaining
check is a real device: the rule set here is what WebKit maps to
`UIScrollView.bounces = false` (Safari 16+).

Native shell note: the Capacitor iOS wrapper inherits this through the
WKWebView. If any bounce remains there, the next lever is native
(`scrollView.bounces = false` in the iOS project), not CSS.

## 2. Shell and floating UI (fixed)

- Mobile drawer stacked below the bottom nav pills (both `z-40`) and
  its 25% tint let page text bleed through. Now `z-50`, 90% backdrop,
  50% dimmed overlay, and it announces itself as a modal
  (`role=dialog`, `data-state`) so floating UI hides while it is open.
- Guest demo notice, feeding alerts, update toast, and the MorphMarket
  staging bar sat on top of the bottom nav. They clear it on phones.
  Notices also hide behind any open dialog instead of floating over
  it.
- Feedback side tab covered body text at 390px. Icon-only below `md`.
- Main scroller paints `bg-slate-950` so the phone-only bottom padding
  matches the page instead of exposing the shell gradient as a green
  band.
- Push-notification banner no longer shows for guests (no account to
  subscribe).

## 3. Consistency findings and what was normalized

### Page headers

Inventory found no shared page header. Titles used seven sizes
(`text-lg` to `text-6xl`), two orderings of the same wrapper classes,
and action rows that sometimes stacked at `md`, sometimes at `sm`,
sometimes never.

House pattern, now applied where pages diverged:

- Wrapper `min-h-screen bg-slate-950 p-4 md:p-8`, inner `max-w-*
  mx-auto`.
- Title `h1 text-2xl md:text-4xl font-bold text-slate-100`, optional
  leading icon, one-line muted subtitle.
- Action row wraps (`flex flex-wrap gap-2`); the primary action is a
  default `Button`, secondary actions are `variant="outline"`.

Fixed: bare `text-4xl`/`text-5xl` titles on BreedingPairs, Gallery,
Training, MyGeckos, OtherReptiles, Messages, LikedGeckos,
CommunityConnect, TrainModel, Forum; non-wrapping action rows on
Messages, MarketplaceSalesStats, BreedingROI, BreedingLoans,
GeckoDetail, BreederConsultant, MarketplaceSell, and the MyGeckos
header buttons that ran off the right edge; `p-6`/`px-6` gutters on
Portfolio, Membership, MarketPricing, BreedingROI, GeckAnswers,
Pedigree, QualityScale; hero/body left-edge mismatch on MorphGuide,
CareGuide, ProjectLineDetail.

### Tabs

Four incompatible `TabsList` shapes coexisted (equal-flex pill bar,
`grid-cols-N`, bare `inline-flex`, one `overflow-x-auto`), with active
states in emerald, slate, orange, pink, blue, and an inline sage.

Fixed: `src/components/ui/tabs.jsx` renders the house pill bar by
default (dark slate strip, equal-width triggers, emerald active state)
and scrolls instead of clipping. The seven `grid-cols-N` bars and the
two `bg-muted` fallbacks use it.

### Buttons

Four emerald ramps were used for the same primary action, and the
default `Button` variant was an emerald-to-green gradient. Because
`emerald-*` re-tints with the user's accent and `green-*` does not, the
default button rendered as a two-colour smear on every non-emerald
accent (blizzard is the default).

Fixed: default variant is flat themed `bg-emerald-600 hover:bg-emerald-500`.

### Cards and dialogs

Three parallel card systems (`.gecko-card`, shadcn `Card` with eight
slate skins, ~100 raw `bg-slate-*` divs). 31 cards still rendered
white (`bg-white/80 border-sage-200`) on the always-dark theme:
TrainModel, MyListings, ProfileSettings, ShareProfile, recognition and
training components, MorphGuideSubmission. Three pages used a sage-to-
earth gradient background.

Fixed: white cards are `bg-slate-900 border-slate-700`; the gradient
pages are `bg-slate-950`; Card padding is `1rem` on phones and
`1.5rem` from `md` via a zero-specificity rule keyed on
`data-card-part` so page overrides still win; `DialogContent` defaults
to the `bg-slate-900 border-slate-700` surface that 35 of 48 dialogs
already set by hand.

### Logged-out states

Five pages each hand-rolled a different wall ("Access Denied", "Login
Required", "Please log in to view...") with no button and no side
padding on phones. They share `SignInRequired` now, with Sign in and
Create account actions.

## 4. Remaining backlog (not changed in this pass)

Ordered by how much a first-time visitor notices them.

1. **Second design system on the P1-P8 feature pages.** AnimalPassport,
   BatchHusbandry, GeckAnswers, PassportQR, BreedingROI, BreedingLoans,
   MarketPricing, ClaimAnimal, PrintableWorksheets use an inline `C`
   palette (hex slate values, DM Sans / DM Serif) instead of Tailwind
   tokens. They are dark now, but they do not re-tint with the theme
   and their type, buttons, and cards share nothing with the rest of
   the app. Converting them is a page-by-page rewrite.
2. **Section membership.** Manage vs Discover placement is uneven
   (ImageImport, PrintableWorksheets, GeneticCalculatorTool under
   Discover; LikedGeckos under Manage). Worth a pass with the sidebar
   grouping in `src/lib/navItems.js`.
3. **Card system.** `.gecko-card` (dashboard/home only), shadcn `Card`
   with `border-slate-700` vs `-800` and `bg-slate-900` vs `/60` vs
   `/50` skins, and raw `bg-slate-*` divs should collapse to one
   surface token. Mechanical but touches ~300 sites.
4. **Secondary emerald ramps.** `bg-emerald-700 hover:bg-emerald-800`
   (public hero CTAs) and `hover:bg-emerald-700` (21 sites) still
   differ from the default. Non-emerald primaries remain on
   BreedingPairs (pink), ImageImport (violet/teal),
   MorphGuideSubmission (sage/earth).
5. **Touch targets.** `size="sm"` (`h-8`, 32px) is the most-used Button
   size; nothing but the header actions meets 44px.
6. **Pages with no title.** Marketplace (tabs only) and Membership
   (centered paragraph) have no `h1`; AdminPanel and Pedigree use
   `text-xl`/`text-lg`.
7. **Wide grids without a phone breakpoint.** BreedingROI form
   (`grid-cols-5`), MarketplaceSalesStats (`grid-cols-[1fr_1fr_auto]`),
   GeneticsGuide definition rows (`grid-cols-[200px_1fr]`), Promote's
   two 200px selects in one row.
8. **QualityScale** renders the public logo header and footer inside
   the authenticated shell (second header).
9. **FieldMode** escapes the shell with `fixed inset-0` and its own
   bottom bar over the section nav; intentional for a hands-busy mode,
   but its exit affordance should be reviewed on a device.

## 5. How to re-run the phone pass

```
pnpm dev --port 5173
# in a scratch dir with playwright installed:
node shoot.mjs Dashboard,MyGeckos,... shots
```

The script in the session scratchpad sets the guest-mode session flag,
loads each route at 390x844, screenshots the top and one viewport
down, and lists any element whose box crosses the right edge without
an ancestor that clips it. Keep it out of the repo; it is a diagnostic,
not a test.
