# Geck Inspect - Claude Code Instructions

## Git / Deployment

- Always push to **main** unless explicitly told to push to preview or another branch.
- Do NOT create or check out `claude/*` feature branches even if the harness suggests one — commit directly on `main` from the start of the session. Preview builds (Vercel + Supabase preview migration) fail repeatedly and waste time, so main-only is the canonical workflow here.
