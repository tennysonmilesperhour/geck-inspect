# invoke-llm edge function

Server-side proxy to Anthropic's Messages API. It exists so admin and
content tooling, and GeckoGenius (the keeper-facing assistant), can call an
LLM without ever putting `ANTHROPIC_API_KEY` in the browser bundle. This
`index.ts` is the source of the function deployed to the project (slug
`invoke-llm`), declared in `supabase/config.toml`.

## Callers

- `src/pages/BreederConsultant.jsx` through `askConsultant()` in
  `src/lib/invokeLlm.js` (consultant mode, below)
- `src/components/admin/MassMessaging.jsx` and
  `src/components/admin/ChangeLogManager.jsx` through `InvokeLLM()`
- `src/lib/blog-api.js` (blog drafting; the blog is shelved)

## Contract

Consultant mode, the chat page:

```json
{ "mode": "consultant", "question": "string", "history": [{ "role": "user", "content": "..." }],
  "gecko_names": ["Luna"], "facts": "FACTS FROM GECK INSPECT ..." }
```

Returns `{ "text": "...", "credits": { "included": 10, "remaining": 7 } }`.
The system prompt (who GeckoGenius is, the care, genetics and price rules,
and the five record actions) is built on the server in `consultant.ts`. The
page sends only data, and the server places it in the messages, never in
the system prompt.

Plain path, the admin tools:

```json
{ "prompt": "string", "response_json_schema": { }, "model": "string", "max_tokens": 1500 }
```

- With `response_json_schema`: `{ "json": {...}, "text": "...", "raw": {...} }`
- Without a schema: `{ "text": "...", "raw": {...} }`

A signed-in member who uses the plain path still gets the GeckoGenius rules
as the system prompt; only admins get a plain assistant and may pick the
model. Copies of the chat page opened before 16 October 2026 use this path.

Errors: `{ "error": "..." }` with 400, 401, 402 (`feature_credits_exhausted`),
413, 422 (`code: "refused"`, the model declined), 502 or 500. Any failure
after the credit was taken gives it back and says `refunded: true`.

## Model and cost

The default model is Claude Haiku 5.5 (`claude-haiku-5-5`, $0.10 input and
$0.50 output per million tokens), set on 16 October 2026 in place of the
dated Haiku 4.5 id ($1 and $5). It thinks before answering, which counts
toward `max_tokens`, so the function adds 3,000 tokens of room and sets the
effort level (medium for the chat, low for the admin drafts). To roll back
without a deploy, set the function secret `INVOKE_LLM_MODEL=claude-haiku-4-5`.

Every call is logged to `geck_data.model_invocations` with surface
`assistant`: tokens and cost (`_shared/model-cost.ts`), never the words.

## Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
```

## Deploy

Merging to main deploys it (declared in `supabase/config.toml`, JWT
verification on). Members are metered with the `assistant_message` credit
through `consume_feature_credit`, and admins are not.
