# First impression review, 5 October 2026

A newcomer's path through Geck Inspect, reviewed as a product designer and conversion copywriter would: the landing page, the pricing page, sign-up, the first-run question and tour, and the empty Dashboard and My Geckos. Every screen was captured with Playwright at 390 x 844 (phone) and 1440 x 900 (laptop) before and after the changes. The screenshots are in [first-impression-2026-10/](first-impression-2026-10/) (25 files, numbered in the order a newcomer meets them).

How the screenshots were made, so they can be repeated: the local dev server with the production Supabase URL and public key in an uncommitted `.env.local`. The sandbox cannot reach Supabase or any image host, so the signed-in screens use a mocked brand new Free account with no geckos (every database call answered as empty), the landing page's live stats strip does not render, and logos or photos served from other domains show as broken. None of that is how production looks; the layout, copy and flow are.

Facts used in this review (production, 5 October): 56 accounts with a login, 349 geckos, 27 breeding plans (the landing page's live stats strip shows these three), 9,359 priced crested gecko listings behind the value estimates (`geck_data.listings` rows that `trait_value_table()` reads), 0 approved testimonials, and one paying member on each of Keeper, Breeder and Enterprise.

## 1. Findings, ranked by effect on sign-ups and revenue

1. **Breeders met a 24-step tour before their first gecko.** Choosing "I breed them" (or "A bit of both") in the first-run question opened the sidebar tour, 24 steps long, while keepers went straight to the photo-first quick add. Breeders are the paying audience and the ones the landing page speaks to, so the most valuable new members had the slowest path to first value. ([09 before](first-impression-2026-10/09-after-choosing-breeder-desktop-before.jpg)) **Fixed.**
2. **The landing page has no real product screenshot.** The product tour slideshow is wired up but no screenshot was ever committed, so it renders nothing. The only "product" a visitor sees is three hand-built example cards. This is the biggest remaining gap in proof. **Proposal 3.1** (needs Tennyson, because the sandbox cannot load the demo photos).
3. **The tour probed nine missing images on every landing visit.** Production rewrites any unknown path to the app HTML, so each probe downloaded a page and failed. **Fixed.**
4. **The pricing page said "Most Popular" on Keeper.** One member pays for Keeper, one for Breeder and one for Enterprise, so the claim was not true. **Fixed** ("Best for most keepers").
5. **The Enterprise card showed "$99.99 / month, billed monthly, starting today"** on a plan marked Coming soon with a disabled button. The 29 September audit listed this as fixed, but the price came back with the real Stripe prices. A visible price that cannot be bought reads as either broken or a bait anchor. Its waitlist code path was unreachable because the button was disabled. **Fixed:** "Coming soon", no billing line, and a working "Join the waitlist" button that opens the support form.
6. **"Get Started Free" and every plan button sent signed-out visitors to the Sign In form**, not Create Account. A newcomer who picked a plan landed on a form for people who already have an account. **Fixed** (`/AuthPortal?mode=signup`).
7. **The landing nav's brightest button was "Sign In".** The page had two filled buttons on screen competing for the same visitor, and the returning-member action was the louder one. On a phone the hero's "Create free account" sat at the very bottom of the first screen. ([01 before](first-impression-2026-10/01-home-hero-mobile-before.jpg)) **Fixed:** quiet "Sign in" link, one filled "Start free" button, and a shorter hero so the sign-up button is well inside the first phone screen.
8. **The free hooks were buried.** The genetics calculator (no account) and Morph ID (first one free) are the two lowest-friction ways to feel the product, but the calculator was the first of eight equal tiles near the bottom and Morph ID was a small underlined link in the hero's fine print. **Fixed:** two cards right under the hero.
9. **Empty states did not teach the fastest start.** The empty Dashboard repeated "No geckos logged yet" twice and offered the Morph Guide and Care Guide as next steps, while showing My Store and Preview profile buttons that lead to empty pages. My Geckos offered one button and no mention of importing a spreadsheet, which is how most breeders arrive. The quick add's success screen never showed the payoff the landing page promises ("see what it's worth"). **Fixed** (section 2).
10. **The pricing FAQ existed only as hidden structured data.** Four questions were in the page's JSON-LD with no visible copy, which Google's guidelines do not allow and which helped no visitor. **Fixed:** visible FAQ from one shared list (plus an export question).

Smaller findings:

- **Sign-up had no reason to sign up.** The form's heading was just "Geck Inspect", the logo did not link home, and there was no reminder of what the free account includes. **Fixed.**
- **Logo weight and breakage.** The sign-in page, pricing page and every public page using the shared shell loaded the 600 px, 170 KB logo from an absolute `https://geckinspect.com/logo.png` to show it at 32 to 64 px, which also breaks on preview deployments. **Fixed:** the 8 KB `/logo-96.png` from the same origin (new `APP_LOGO_ICON_URL`).
- **Hero background weight.** The forest photo sits under a 65% black tint and an 80% opacity, so its fine detail never shows, yet a laptop downloaded 202 KB and a 3x phone also 202 KB for it. **Fixed** (section 2).
- **No "who built this".** The founder story on /About is good, specific and true, but the landing page only said "by a breeder who keeps them". **Fixed:** a short founder block linking to the full story.
- **The final call to action led with jargon.** "Boot up your geckOS." does not say what happens next. **Fixed:** "Start with one gecko."
- **Logos had alt text next to the same visible name**, so screen readers read "Geck Inspect Geck Inspect". **Fixed** on the landing header and footer, the public shell and sign-in.
- **The support email on the pricing page is a Gmail address** (`morphiclabsdata@gmail.com`). For a product asking for card details this costs trust. The domain already sends mail through Resend. **Proposal 3.5.**
- **Body copy is tinted by the theme.** The `slate` scale is remapped to the active accent (blue in the default theme), so long paragraphs on the landing and pricing pages read as blue on near-black rather than neutral gray. Headings and white text pass contrast; the long blue paragraphs are harder to read than they need to be. **Proposal 3.4.**
- **The footer still links to /blog.** Blog work is shelved, so this was left alone; it is an existing page, not a new one.
- **What is already right and was kept:** the headline "Price right. Pair smart. Sell with proof." is distinctive; the three business sections use real numbers from real listings with dated captions; the comparison table is honest; the live stats and testimonials hide themselves below a credibility floor (testimonials stay hidden, there are none yet); the photo-first quick add is short; the trust strip covers privacy, export and phones.

## 2. What changed and why

**Landing page (`src/pages/Home.jsx`)**

- Nav: "Sign in" is now a quiet text link; one filled "Start free" button (hidden on phones, where the hero button is close). Signed-in visitors see "Dashboard".
- Hero: eyebrow "Built only for crested geckos" (the identity in four words). One-line value proposition: "Records, genetics and real market prices for crested gecko breeders and keepers, in one app." The supporting line is cut from four sentences to one. The demo button is demoted to a text-style "Or look around the demo collection" so there is one primary action. The fine print became three ticked risk reducers, each true in code: "Free for up to 10 geckos" (`src/lib/tierLimits.js`), "No credit card", "Export your records any time".
- New free-hook cards under the hero: "Run a pairing in the genetics calculator" (No account needed, with a Lilly White het Axanthic x Sable example) and "Ask Morph ID what your gecko is" (First one free).
- New "Who builds it" block, written only from the founder story on /About, linking to /About and /Contact.
- Final call to action: "Start with one gecko. A photo and a name is enough to begin. Add its morph and Geck Inspect shows what it's worth." (The quick add and the value card both work that way.)
- Logos: width and height set, empty alt where the name is printed beside them, footer logo lazy.

**Performance**

- Hero background re-encoded from the 2400 px master with a light blur (sigma 1.2, invisible under the tint) and a 1200 px step added to the `srcset` and to the prerender preload (`scripts/prerender.mjs`). A 1440 px laptop now gets the 1600 file at 107 KB (was 202 KB); a 390 px phone at 3x now gets the 1200 file at 63 KB (was the 1600 file at 202 KB); 800 px is 29 KB (was 59 KB); 2400 px is 228 KB (was 427 KB). This is the landing page's LCP image, so the saving lands directly on load time.
- The product tour now requests only slides marked `shipped: true` in `src/data/product-tour.js` (none yet), so a landing visit no longer makes nine wasted requests. `public/screenshots/README.md` explains the flag.
- Sign-in, pricing and public pages use the 8 KB same-origin logo.

**Pricing (`src/pages/Membership.jsx`)**

- Header: "Start free with up to 10 geckos. Upgrade when your collection or your breeding outgrows it, from $2.99 a month." The trial and cancel line moved under it.
- "Most Popular" became "Best for most keepers", and it no longer stacks on top of "Current plan".
- Enterprise: "Coming soon" in place of the price, "Not on sale yet. Join the waitlist and we will tell you first.", and an enabled "Join the waitlist" button (the existing handler scrolls to the support form).
- Free and paid plan buttons send signed-out visitors to the Create Account form. The Free button says "Create free account" for them.
- Visible FAQ ("Questions about plans") built from the same `MEMBERSHIP_FAQS` list as the structured data, with a new export question.

**Sign-up (`src/components/auth/LoginPortal.jsx`)**

- The logo links home. The heading says what the form is for: "Create your free account" or "Welcome back". Sign-up shows three true reasons: up to 10 geckos free with no card, value estimates from real crested gecko listings, the first AI Morph ID free. Tighter spacing on phones keeps the submit button on the first screen.

**Onboarding and first run**

- `src/Layout.jsx`: every role choice now goes straight to adding the first gecko (`/MyGeckos?add=1`, which opens the photo-first quick add on an empty collection). The tour is still one click away under App Tutorial in the sidebar.
- `src/components/tutorial/OnboardingRolePrompt.jsx`: says what happens next ("Next you add your first gecko: a photo and a name is enough") and tells breeders a spreadsheet can be imported.
- `src/components/my-geckos/QuickAddGecko.jsx`: "Already keep a spreadsheet? Import it instead" on the first add, which swaps to the CSV importer. After saving a gecko with a morph, the first button is "See what <name> is worth", which opens its record where the value card reads the morph (`MarketValueCard`).
- `src/pages/Dashboard.jsx`: for a signed-in member with a confirmed empty collection, the hero drops My Collection, My Store and Preview profile, and the first-gecko card reads "Add your first gecko, it takes about a minute" with three actions: Add your first gecko, Import a spreadsheet (`/MyGeckos?import=1`, new), Identify a morph free.
- `src/pages/MyGeckos.jsx` and `src/components/shared/EmptyState.jsx`: the empty state explains the shortest start and the value-estimate payoff, adds "Import a spreadsheet (CSV)" as a second button with a hint, and `?import=1` opens the importer. `EmptyState` gained optional `secondaryAction` and `hint` props (the 16 other uses are unchanged).

Checks: `pnpm lint` clean, 1,288 unit tests pass, `vite build` succeeds.

## 3. Proposals (not built)

**3.1 Real product screenshots in the hero (highest impact, about an hour for Tennyson).** The slideshow is ready; it needs images. Capture on production in the demo collection (or a real collection with permission) at 1600 x 1000, dark theme, sidebar collapsed, the demo tour card closed: My Geckos grid with photos, a gecko record with the value card and weight chart, the Portfolio, the calculator with a Lilly White x Axanthic het result, and a Breeding plan with eggs. Save as WebP (`cwebp -q 70`), commit to `public/screenshots/`, and set `shipped: true` on each slide. Then move the tour into the hero's right half on laptops (split layout: copy left, product right), which is the single strongest proof a landing page can show. The sandbox attempt failed because demo photos come from Wikimedia and Picsum, which it cannot reach.

**3.2 A 60-second "first value" path that ends on a number.** After the quick add saves a gecko with a morph, show the estimate inside the success screen itself (the trait table is already cached by `loadTraitValueIndex`) instead of one tap away. A line like "Mango is worth about $X, typical range $Y to $Z", with the real numbers, is the moment a newcomer decides the app is for them.

**3.3 Pricing anchoring and plan fit.** Put a one-line "who it is for" under each price with the numbers that decide it (Free: up to 10 geckos and 1 pair; Keeper: up to 50 and 5 pairs; Breeder: unlimited, waitlists, MorphMarket file) and collapse the long Free list to its first six lines with "show all". The Free card is currently the longest card on the page, which visually argues for staying free. Consider showing the yearly price as a monthly equivalent ($2.50 and $5 a month, billed yearly) on the Annual tab.

**3.4 Neutral body text on marketing pages.** Keep the accent for headings, links and buttons, but render long paragraphs on the landing, pricing and sign-up pages in a neutral light gray (a `text-gecko-body` token or similar), regardless of the member's theme. This is a design-system change, so it is a proposal rather than an edit here.

**3.5 A domain support address.** Replace `morphiclabsdata@gmail.com` in `src/lib/supportContact.js` with `support@geckinspect.com` (a Resend inbound route or a forwarding alias), so the pricing page, Contact and Privacy show the product's own domain.

**3.6 One real quote as soon as there is one.** The testimonials section waits for three approved quotes. Ask the three paying members and the most active free members for one sentence each with permission to use their name and breeding brand. Until then, keep it hidden; do not invent any.

**3.7 Measure the funnel this review is about.** PostHog already records `landing_cta_clicked` (now with `free_hook`, `nav` signup and `also_included` targets), `onboarding_role_selected`, `first_gecko_added` and `checkout_started`. Build one funnel: landing view, sign-up click, account created, first gecko, second session in 7 days. With 20 new logins a month and 7 members adding a gecko, the first-gecko step is where to watch whether the breeder change in finding 1 worked.
