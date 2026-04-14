# Geck Inspect Global Design System

Paste this block into every Claude Code prompt you write.

---

## Brand Identity

- **Name:** Geck Inspect
- **Tone:** Professional, science-forward, trusted — like a Bloomberg terminal built specifically for gecko breeders. Not cutesy. Not gamified. A serious tool for people who treat this as a real business.

### Typography

| Role | Font | Source |
|------|------|--------|
| Headings, page titles, animal names, feature headers | **DM Serif Display** | Google Fonts |
| All UI text: labels, inputs, stats, body copy, table data | **DM Sans** | Google Fonts |

### Color Palette

Exact hex values — use these everywhere, no substitutions.

| Name | Hex | Usage |
|------|-----|-------|
| Forest deep | `#1A2E1A` | Primary dark bg, nav, footers |
| Moss mid | `#2D4A2D` | Secondary surfaces, card headers |
| Sage accent | `#4E7C4E` | Interactive elements, links, active states, CTAs |
| Pale sage | `#E8F0E8` | Light surfaces, card backgrounds, table zebra |
| Warm white | `#F7F9F4` | Page background |
| Ember gold | `#C4860A` | Highlights, premium badges, positive trends, investment grade |
| Ember light | `#FDF3E0` | Gold badge backgrounds |
| Alert red | `#C0392B` | Errors, destructive actions, negative trends |
| Slate text | `#3D4A3D` | Primary body text |
| Muted text | `#6B7B6B` | Secondary labels, captions, helper text |

---

## Layout Principles

- **Cards:** `border-radius: 12px`, `border: 1px solid rgba(78,124,78,0.15)`, white or pale-sage bg, `padding: 24px`
- **Section headings:** DM Serif Display 22px, Forest deep
- **Stat numbers:** DM Sans 32px weight 600, Slate text
- **Stat labels:** DM Sans 12px uppercase `letter-spacing: 0.08em`, Muted text
- **Data tables:** Pale sage zebra on odd rows, 1px borders, DM Sans 14px

### Status Badges

Shape: `border-radius: 999px`, 12px font, `padding: 4px 10px`

| Status | Background | Text |
|--------|-----------|------|
| Owned / Active | `#E8F0E8` | `#1A2E1A` |
| For Sale | `#FDF3E0` | `#633806` |
| Sold / Completed | `#6B7B6B` | `#ffffff` |
| Transferred | `#D3D1C7` | `#3D4A3D` |
| On Loan | `#E6F1FB` | `#0C447C` |
| Cancelled | `#FCEBEB` | `#791F1F` |

### Empty States

- Centered gecko silhouette SVG
- 16px muted message
- One clear CTA button

### Responsive

- Mobile-first: all grids collapse to single column below 640px

---

## Interaction Standards

- **Forms:** Real-time inline validation, never `alert()` dialogs
- **Saves:** Optimistic update first, confirm with server silently
- **Loading:** Skeleton screens, not spinners
- **Destructive actions** (delete, transfer, end loan): Confirmation dialog requiring the animal's name to be typed before proceeding
- **Transitions:** 200ms ease-out on all state changes
- **Tooltips:** On any abbreviated stat or icon — never assume the user knows what it means
