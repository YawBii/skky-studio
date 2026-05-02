# yawB Monster Mode

Monster Mode is the command-first builder path for yawB.

The product rule is simple:

> The user should describe what they want. yawB should infer the product, design, routes, backend, integrations, and quality gates without forcing template selection.

## Current foundation

This branch adds the first internal contracts for that behavior:

- `src/services/monster-blueprint.ts` defines the production blueprint yawB should create before generation.
- `src/services/monster-director.ts` turns a user command into app type, design mode, routes, Supabase backend plan, integrations, workflows, and acceptance tests.
- `src/services/monster-backend-generator.ts` turns a Monster Blueprint into Supabase migration SQL, backend docs, and blueprint JSON artifacts.
- `src/services/monster-quality-gates.ts` defines the proof gates yawB must pass before it can declare a build done.
- `src/services/monster-director.test.ts` locks in the command-first behavior with tests.
- `src/services/monster-backend-generator.test.ts` locks in backend artifact generation and RLS expectations.

## Product standard

At worst, yawB should feel like Lovable:

1. User enters a command.
2. yawB makes a beautiful first version.
3. User iterates through chat.
4. Preview updates quickly.

But yawB should beat Lovable by being more serious after the first impression:

1. Generate a structured blueprint.
2. Generate real frontend structure.
3. Generate Supabase schema and RLS plan.
4. Commit generated files to GitHub.
5. Configure Vercel/Supabase where connected.
6. Run typecheck, lint, build, and tests.
7. Repair failures.
8. Show proof before saying done.

## Non-negotiable rule

Do not declare done from generation alone.

Done means:

```text
build, verify, prove, then declare done
```

## Backend generation contract

Monster Backend v1 produces:

- `supabase/migrations/monster_<app>_initial.sql`
- `docs/generated/<app>_monster_backend.md`
- `docs/generated/<app>_monster_blueprint.json`

The migration enables row level security for generated tables and emits policy drafts from the blueprint. These policies are intentionally conservative first drafts: they are meant to be verified by the Supabase/RLS job before production promotion.

## Next wiring steps

1. Call `createMonsterBlueprint()` inside `ai.generate_changes` before `monsterGenerate()`.
2. Pass `blueprint.design.mode` as the default `designMode` when the user did not manually override design.
3. Call `generateMonsterBackendFiles()` and persist those files alongside generated frontend files.
4. Persist the blueprint and Monster Proof report into job output so the UI can show proof.
5. Hide the Design Angle selector from the first-run happy path; keep it as advanced regeneration override.
6. Implement real provider actions for GitHub commit, Supabase migration/RLS verification, and Vercel deployment.
7. Feed build/typecheck/lint/test results into `MonsterProofReport`.
