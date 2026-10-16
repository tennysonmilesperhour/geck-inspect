# Source artwork (not deployed)

Full-size drawings that the site does not serve directly. Files in `public/` are deployed to every visitor's reach; these are only the inputs for smaller files that are.

`morph-guide/ink-studies-v3/` holds the Morph Guide's pattern-study drawings (a plain side and top view of a crested gecko, plus one drawing per trait: cream, pin, tiger, spots) and `provenance.json` (how they were made and checked). After changing any of them, run:

```
node scripts/precompute-trait-layers.mjs
```

It writes the layers the Morph Guide shows to `public/morph-guide/trait-layers-v1/` (1200 px wide) and the spot boxes and a fingerprint of each drawing to `src/components/morphguide/traitLayers.generated.js`. Commit both. `src/lib/__tests__/pigmentExtract.test.js` fails when a drawing here changes without a rebuild, or when drawings are put back in `public/morph-guide/ink-studies-v3/` (they would be deployed and never used). Once the site has served a set of layers, bump the folder name in the script (`trait-layers-v2`) when the pictures change, so browsers do not keep the old ones.
