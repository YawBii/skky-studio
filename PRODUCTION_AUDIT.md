# yawB production audit

This branch contains minimal production-audit hardening for the Lovable/TanStack Start app.

## Verification commands

Run these before merging:

```bash
npm install
npm run build
npm run lint
npm run typecheck
```

`package.json` now exposes `npm run typecheck` as a first-class check and `npm run check` as the combined build/lint/typecheck gate.

## Current production-readiness notes

The app structure is valid and includes `src/`, `package.json`, `tsconfig.json`, `vite.config.ts`, and `wrangler.jsonc`. The current service layer intentionally returns demo data while production integrations are wired. The highest-priority integrations to replace before a real production launch are:

1. `src/services/auth.ts` — Supabase Auth.
2. `src/services/github.ts` — GitHub repository import, PR creation, and repo metadata.
3. `src/services/vercel.ts` and `src/services/deploy.ts` — deployment orchestration and real logs.
4. `src/services/supabase.ts` and `src/services/cloud.ts` — Supabase management, database, auth, secrets, functions, and logs.
5. `src/services/billing.ts` — Stripe subscriptions and customer portal.
6. `src/services/ai.ts` — Lovable/OpenAI-compatible AI gateway.

## Fix included

`src/services/github.ts#importProject` no longer throws an unconditional runtime error. It now validates and normalizes GitHub repo input and returns a typed imported project placeholder, so UI flows can proceed without crashing while the real GitHub integration is wired.
