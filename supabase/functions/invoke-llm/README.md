# invoke-llm edge function

Server-side proxy to Anthropic's Messages API. It exists so admin and
content tooling can call an LLM without ever putting `ANTHROPIC_API_KEY`
in the browser bundle. This `index.ts` is the source of the function
that is already deployed to the project (slug `invoke-llm`); it was
committed here so the function can be reviewed, diffed, and redeployed
from the repo instead of living only on Supabase.

## Callers

The client wrapper is `src/lib/invokeLlm.js` (`InvokeLLM({ prompt,
response_json_schema, model, max_tokens })`). Through it, the function
backs:

- `src/lib/blog-api.js` (blog draft generation)
- `src/pages/TrainModel.jsx`
- `src/pages/BreederConsultant.jsx`
- `src/components/admin/MassMessaging.jsx`
- `src/components/admin/ChangeLogManager.jsx`
- `src/api/integrations.js` / `src/integrations/Core.js`

If this function is lost or drifts from this file, every one of those AI
surfaces breaks, which is why it is version-controlled here.

## Contract

Input (POST JSON):

```json
{ "prompt": "string", "response_json_schema": { }, "model": "string", "max_tokens": 1500 }
```

Output (JSON):

- With `response_json_schema`: `{ "json": {...}, "text": "...", "raw": {...} }`
- Without a schema: `{ "text": "...", "raw": {...} }`
- On failure: `{ "error": "..." }` with a 4xx/5xx status.

The default model is `claude-haiku-4-5-20251001` and the default
`max_tokens` is 1500; callers override either via the request body.

## Secrets

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxx
```

## Deploy

The function is deployed with JWT verification ON (`verify_jwt=true`),
so a valid Supabase session is required to call it. Deploy WITHOUT the
`--no-verify-jwt` flag to keep that behavior:

```bash
supabase functions deploy invoke-llm
```

## Hardening notes (not yet implemented)

`verify_jwt=true` stops anonymous callers, but any signed-in user can
currently reach the function, so the Anthropic key is only as protected
as the surfaces that call it. Two follow-ups worth doing before this is
exposed to non-admin flows:

1. Check the caller's admin role (or a per-feature entitlement) inside
   the function, rejecting non-admins with 403, for the admin-only tools
   (mass messaging, changelog, blog generation).
2. Add a simple per-user daily call cap backed by a Postgres counter so
   a compromised session cannot drain the Anthropic budget.
