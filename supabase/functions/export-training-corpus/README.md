# export-training-corpus

Streams the verified gecko-morph training corpus as newline-delimited JSON
(JSONL) — one sample per line, every label keyed to canonical taxonomy
ids. Plug it into Hugging Face Datasets, LLaMA-Factory, LoRA training on
Replicate/Modal, or anything else that reads JSONL.

## Auth

Requires a Supabase JWT whose profile has `role IN ('admin',
'expert_reviewer')`. The edge function checks the role via the service
role key, so promoting a user is the only way to grant access.

## Deploy

```bash
supabase functions deploy export-training-corpus
```

No extra secrets beyond the ones Supabase injects by default
(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`).

## Call

```bash
curl -H "Authorization: Bearer $SUPABASE_USER_JWT" \
  "$SUPABASE_URL/functions/v1/export-training-corpus?verified_only=true" \
  > corpus.jsonl
```

Query params:

| param             | default | notes                                           |
|-------------------|---------|-------------------------------------------------|
| `verified_only`   | `true`  | `false` to include unverified contributions     |
| `since`           | —       | ISO date, only rows created at/after            |
| `limit`           | —       | cap (useful for smoke tests); max 50 000        |

## Sample line

```json
{
  "id": "…",
  "image_url": "https://…",
  "labels": {
    "primary_morph": "extreme_harlequin",
    "genetic_traits": ["lily_white"],
    "secondary_traits": ["white_fringe","portholes"],
    "base_color": "dark_red",
    "pattern_intensity": "high",
    "white_amount": "high",
    "fired_state": "fired_up"
  },
  "context": {
    "age_estimate": "adult",
    "genetics": { "sire_morph": "…", "dam_morph": "…", "known_hets": ["axanthic_vca"] },
    "photo":    { "angle": "three_quarter", "lighting": "natural_daylight", "flags": ["sharp"] }
  },
  "provenance": {
    "source": "expert_owner",
    "contributor_confidence": 95,
    "ai_original": null,
    "reviewer_verdict": null,
    "taxonomy_version": "2026.04.17"
  },
  "verified": true,
  "created_date": "2026-04-17T…"
}
```

## ML hookup sketch

Quick Hugging Face Datasets loader:

```python
import datasets
ds = datasets.load_dataset("json", data_files="corpus.jsonl", split="train")
ds = ds.filter(lambda s: s["verified"])
```

For classification fine-tunes (e.g. Florence-2 or Qwen2.5-VL on Replicate):
map each sample to `{image_url, caption}` where caption is a natural-language
rendering of the labels so the VLM learns the taxonomy through language.
