# Geck Inspect design system

Rewritten from the code on 15 October 2026 (plan item E2 21 of `docs/planning/comprehensive-review-2026-10-14.md`). This is the one design document. It describes what ships, and the files below are the source of truth. If this page and the code disagree, the code wins and this page gets fixed.

| What | Where |
|---|---|
| Colour tokens for every theme and accent | `src/index.css` (`:root[data-theme="..."]` and `:root[data-secondary="..."]`) |
| How Tailwind classes read those tokens | `tailwind.config.js` |
| The theme list, defaults and saving a member's choice | `src/lib/ThemeContext.jsx` |
| The first-paint theme script and font loading | `index.html` |
| App shell, glass bars, landing font | `src/styles/layout-theme.css`, `src/Layout.jsx` |
| Shared components | `src/components/ui/*` (buttons, cards, tabs, dialogs), `src/components/shared/PageHeader.jsx`, `src/components/shared/EmptyState.jsx` |

Superseded documents, kept for history only: the light sage palette with DM Serif Display and DM Sans that this file used to specify (never shipped; in git history before 15 October 2026), the charcoal and cream palette in decision 5 of `docs/DECISIONS.md` and in the old section 8.4 of `docs/CONTEXT.md` (never shipped), and the "DESIGN SYSTEM" lines inside the P1 to P8 feature specs in `docs/specs/`. Do not paste any of those into a prompt.

## 1. The look in one paragraph

Geck Inspect is dark only. The page is a near-black surface tinted by the member's chosen theme, cards sit one step lighter with a thin border, text is light, and one accent colour marks actions and selection. There is no light mode (`index.html` always adds the `dark` class and sets `color-scheme: dark`). The tone is a serious tool for people who breed animals as a business: not cute, not gamified.

## 2. Themes and accents

A member picks two things in Settings, and both are saved to the browser and to their profile (`profiles.ui_theme`, `profiles.ui_secondary`) so they follow the member across devices:

- **Theme** (`data-theme` on `<html>`): backgrounds, surfaces, borders, the neutral text scale and the brand scale.
- **Accent colour** (`data-secondary` on `<html>`): the `emerald-*` scale, which is what primary buttons, links, active tabs and highlights use.

The six ids are shared by both settings. The ids are stored, so never rename one; the labels can change freely.

| Id | Label | Swatch | Page background (also the iPhone status bar) |
|---|---|---|---|
| `normal` | Emerald | `#2fb574` | `#0a1913` |
| `tangerine` | Tangerine | `#ea8206` | `#160d09` |
| `halloween-mask` | Eclipse | `#e53e1a` | `#170b08` |
| `blizzard` | Blizzard | `#38a7f2` | `#0a0f19` |
| `lavender` | Lavender | `#c084fc` | `#160d1c` |
| `super-hypo` | Hypo | `#e0b308` | `#161109` |

The default for a new visitor is `blizzard` for both (`DEFAULT_THEME` and `DEFAULT_SECONDARY` in `ThemeContext.jsx`, and the same default in the `index.html` script, which must be kept in sync). The script in `index.html` applies the saved choice before any CSS loads, so there is no flash of the wrong colours.

## 3. Colour tokens

Every colour is an HSL triplet in a CSS variable, so Tailwind's opacity syntax works (`bg-slate-900/50`). Tokens come in five groups:

1. **Semantic tokens** (shadcn names): `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1` to `--chart-5`, and the `--sidebar-*` set. Each theme redefines all of them. Use them through `bg-background`, `text-muted-foreground`, `border-border` and so on.
2. **`slate-*` and `gray-*`** (50 lightest to 950 darkest, Tailwind's usual direction). Both are remapped to the same per-theme variables, so neutral greys carry the theme's hue. `slate-950` is the page, `slate-900` the card, `slate-700` the hairline border, `slate-100` to `slate-300` body text, `slate-400` and `slate-500` muted text.
3. **`sage-*`** (the brand scale, inverted: 50 is the darkest, 900 the lightest), redefined per theme.
4. **`emerald-*`** (50 to 950), driven by the accent setting. With the `normal` accent it equals Tailwind's stock emerald. About 1,900 class names use it, so changing the accent re-tints them all without touching components.
5. **Fixed colours**: `earth-*` stays orange in every theme (alerts, breeder perks, hatchling badges), and Tailwind's own `green-*`, `red-*` and `amber-*` keep their meaning (success, error, warning) whatever the accent.

The `--gi-*` variables at the end of `src/index.css` (a "P1 design system" with forest, sage and ember hex values) are not used by any component. They are left over from the spec this document replaces. Do not use them in new code.

## 4. Type

| Use | Font | Where it is set |
|---|---|---|
| The app, everywhere | Inter | `body` in `src/index.css`, `.app-container-outline` in `layout-theme.css` |
| The public landing page | Montserrat | `.landing-font` in `layout-theme.css` |
| The "Geck Inspect" wordmark only | Righteous | inline in `src/Layout.jsx`, the store layout and sticker previews |

All three load from Google Fonts in `index.html` with a non-blocking swap. One component, `src/components/passport/OwnershipChain.jsx`, still names DM Serif Display, which is not loaded, so it falls back to the browser's serif. Do not add new fonts.

## 5. Shape, spacing and touch

- **Corners:** about 8% less rounded than Tailwind's defaults (`--radius: 0.46rem`; overrides in `tailwind.config.js`). `rounded-full` is unchanged for pills and avatars.
- **Page padding:** `p-4 md:p-8` on app pages (43 page files use it).
- **Cards:** one surface: `rounded-xl border border-slate-700 bg-slate-900` (`src/components/ui/card.jsx`). Card padding is 1.5rem, 1rem on phones (`[data-card-part]` rules in `src/index.css`). Pass a class only for a real variant such as an amber warning.
- **Tap targets:** the `touch:` variant applies only on touch screens, and buttons grow to a 44 px minimum there (`touch:min-h-11` in `button.jsx`). For a small control that cannot grow, add `touch-hit` (an invisible 44 px hit area).
- **Phone frame:** a glass header floats over the page and a glass bottom bar sits above the home indicator (decision 39). Their sizes are the `--top-bar-h` and `--bottom-bar-h` variables in `src/index.css`.

## 6. Components to reuse

- **Page header:** `src/components/shared/PageHeader.jsx` (icon, title, one-line description, settings gear, actions with the primary action last). Used by 33 app pages. New app pages use it.
- **Buttons:** `src/components/ui/button.jsx`. `default` is flat accent (`bg-emerald-600`, white text); `outline` is a dark accent-tinted outline; also `secondary`, `ghost`, `destructive` and `link`.
- **Tabs:** `src/components/ui/tabs.jsx`, the house tab bar (dark strip, hairline border, scrolls sideways on phones instead of clipping).
- **Empty states:** `src/components/shared/EmptyState.jsx`. One primary action, an optional second (for example "Import a spreadsheet" beside "Add your first gecko"), an optional hint line.
- **Dialogs:** use the Radix dialog in `src/components/ui/dialog.jsx`. A hand-built full-screen overlay must spread `useModalOverlay(onClose)` (`src/hooks/useModalOverlay.js`) for Escape, focus and `role="dialog"`, so floating notices hide behind it.
- **Icons:** lucide-react only.

## 7. Behaviour standards

These carried over from the old document. They are the standard for new work; the 14 October review (sections B4 and B6) found places where existing pages fall short, for example hand-built overlays without Escape or focus handling.

- Inline form validation, never `alert()`.
- Skeletons for loading lists (`CardGridSkeleton`), not bare spinners.
- A confirmation dialog for destructive actions (delete, transfer, end a loan).
- Animations respect the operating system's reduced-motion setting (`@media (prefers-reduced-motion: reduce)` in `src/index.css`, and `src/lib/reducedMotion.js`).
- Tooltips on abbreviated stats and icon-only buttons; every icon-only button has an accessible name.
- Phone first: grids collapse to one column on small screens, and nothing scrolls sideways except tab strips and tables built to.

## 8. Known problems (from the 14 October review, section B4)

Recorded here so nobody mistakes them for the intended design. Fixes are proposed in the review; none is part of this document change.

- **Contrast on the default theme.** Because `slate-*` re-tints with the theme, muted paragraphs on Blizzard render mid-blue on near-black, and in-text links can sit at about 1.3 to 1.6 to 1 against surrounding text. The review recommends Emerald as the default, a neutral body-text token that does not re-tint, `slate-500` one step lighter on dark surfaces and underlined in-text links.
- **Colours that ignore the theme.** The header and sidebar tint stay emerald, the logo is copper, and some pages add their own accent (a purple calculator button, an amber Enterprise card, a green gradient on the Dashboard stat tiles), so one screen can show four accent colours.
- **No solid fallback for the glass bars** where `backdrop-filter` is not supported (older Android web views). A `@supports` fallback is recommended.
- **Placeholder letters instead of drawings** for 28 of 36 morphs on the Morph Guide index.

## 9. Rules for new UI

1. Use the semantic tokens and the `slate`, `emerald` and fixed scales above. No raw hex colours in components.
2. Use the shared components in section 6 before writing a new one.
3. Never rename a theme id, and keep `index.html` and `ThemeContext.jsx` in step when adding or changing a theme.
4. Check new text against the default theme for contrast (4.5 to 1 for body text, 3 to 1 for large text and links next to text).
5. Copy follows CLAUDE.md: no em dashes, plain words, specific crested gecko terms.
