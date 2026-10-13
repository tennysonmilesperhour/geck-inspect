# Member website builder

My Store contains the visual website editor. Choose a template, then customize
colors, heading font, hero layout and image crop, spacing, site width, card
corners and gallery columns. Brand controls edit the business name, tagline,
logo, announcement and contact button. Hero, logo and custom-section images
can be uploaded through the existing account media upload helper.

Sections can be renamed, reordered and hidden. Members can add up to eight
text/image sections. Collection, public pairings and an open waitlist use the
member's existing records; purchase reviews remain verified platform records.
Only public, non-archived animals and pairings are loaded on visitor pages.

The preview uses the same `StorefrontWebsite` renderer as the public breeder
page and legacy store fallback. It shows actual selected public animals.
Verified reviews and trust data load on the public page. Preview controls
never navigate away or send inquiries. Design undo/redo retains 30 edits;
content fields use the existing store form. Save store persists the design
along with content. The publish switch retains its existing behavior. Draft
store links do not redirect to the published breeder page.

## Storage and compatibility

The versioned design is JSON in a single `_website` reserved entry inside
`breeder_store_pages.external_links`. Existing `_theme`, `_show_available`
and `_waitlist_id` entries remain compatible. Readers also accept the `geck:`
URL carrier when the `value` property was dropped by an older editor.
Reserved entries never appear in the external-link editor or visitor links.
No schema migration, new dependency or executable member HTML/CSS is needed.

`storeWebsite.js` validates allowed layouts and fonts, limits section counts
and string lengths, bounds numeric settings, and rejects unsafe URL schemes.
Uploaded images use the same MIME, resizing, authentication, storage path and
quota checks as other account photos. Changing a design during an upload does
not overwrite newer edits. Upload errors retain the current image.

## Validation

Tests cover legacy/invalid settings, round-trip persistence, unsafe URLs,
section order and visibility, saved public content, expired waitlists, the
actual My Store save/reload and failed-save behavior, and upload success/error
including concurrent edits. Browser fixture checks cover templates, undo/redo,
custom sections, reorder/hide, branding, persisted settings and responsive
preview/public layouts. Fixture saves do not modify real member records.
