/**
 * yawB service layer — typed integration surface.
 *
 * Every function returns demo data today. Codex (or any engineer) wires
 * real implementations by replacing the function body. Public signatures,
 * argument names, and return types should NOT be changed lightly — UI
 * components depend on them.
 *
 * Wiring guide for Codex:
 *  - github.ts    → @octokit/rest or GitHub REST/GraphQL
 *  - vercel.ts    → Vercel REST API (https://vercel.com/docs/rest-api)
 *  - supabase.ts  → Supabase Management API + project SDK
 *  - cloud.ts     → Lovable Cloud / Supabase admin client
 *  - ai.ts        → Lovable AI Gateway / OpenAI-compatible
 *  - auth.ts      → Supabase Auth (browser client)
 *  - billing.ts   → Stripe REST API
 *  - team.ts      → workspace members table
 *  - health.ts    → orchestrates the above into a single report
 *  - deploy.ts    → orchestrates github → vercel pipelines
 */

export * as github from "./github";
export * as vercel from "./vercel";
export * as supabaseSvc from "./supabase";
export * as cloud from "./cloud";
export * as ai from "./ai";
export * as authSvc from "./auth";
export * as billing from "./billing";
export * as team from "./team";
export * as health from "./health";
export * as deploy from "./deploy";
export * as connectors from "./connectors";
export * as versions from "./versions";
export * as domains from "./domains";
