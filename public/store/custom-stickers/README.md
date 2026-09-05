# Custom sticker example images

`moonlight.webp` and `bat-geck.webp` are Tennyson's own printed reference
cards (the Geckomon set), trimmed to the card edge and encoded as WebP at
720 px wide. `src/lib/store/stickerExamples.js` points at these paths, and
`CustomStickerStudio` falls back to rendering each example from its stored
design spec if an image ever fails to load.

These are temporary layout references. The customer-facing page labels them
as placeholders while the builder moves to original styling and user-owned
photos without third-party characters, logos, card trade dress, or copyright
text. Do not treat either image as final production artwork.

To replace one: export the card at 1080 px wide, trim to the card edge,
then `cwebp -q 84 -m 6 in.png -o moonlight.webp`.
