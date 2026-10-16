# Source artwork (not deployed)

Full-size drawings that the site does not serve directly. Files in `public/` are deployed to every visitor's reach; these are only the inputs for smaller files that are.

`morph-guide/ink-studies-v3/` holds the Morph Guide's pattern-study drawings (a plain side and top view of a crested gecko, plus one drawing per trait: cream, pin, tiger, spots) and `provenance.json` (how they were made and checked). After changing any of them, run:

```
node scripts/precompute-trait-layers.mjs
```

It writes the small layers the Morph Guide shows to `public/morph-guide/trait-layers-v1/` and the spot boxes to `src/components/morphguide/traitLayers.generated.js`. Commit both. If the pictures change, bump the folder name in the script (`trait-layers-v2`) so browsers do not keep the old ones.
