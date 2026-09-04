# Custom sticker example images

Drop the two printed reference cards here so the store page shows the real
prints instead of the rendered fallback:

- `moonlight.png`, the Moonlight card (classic frame, yellow border)
- `bat-geck.png`, the Bat Geck card (full art, silver border)

`src/lib/store/stickerExamples.js` points at these paths. Until the files
exist, `CustomStickerStudio` renders each example from its stored design
spec through `StickerCardPreview`, so the page still explains every option.

Recommended: 1080px wide PNG, transparent or dark background, under 500 KB.
