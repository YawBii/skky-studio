# yawB Monster Mode

Monster Mode is the command-first builder path for yawB.

The product rule is simple:

> The user should describe what they want. yawB should infer the product, design, routes, backend, integrations, and quality gates without forcing template selection.

## Current foundation

This branch adds the first internal contracts for that behavior:

- `src/services/monster-blueprint.ts` defines the production blueprint yawB should create before generation.
- `src/services/monster-director.ts` turns a user command into app type, design mode, routes, Supabase backend plan, integrations, workflows, and acceptance tests.
- `src/services/monster-quality-gates.ts` defines the proof gates yawB must pass before it can declare a build done.
- `src/services/monster-director.test.ts` locks in the command-first behavior with tests.

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

## Next wiring steps

1. Call `createMonsterBlueprint()` inside `ai.generate_changes` before `monsterGenerate()`.
2. Pass `blueprint.design.mode` as the default `designMode` when the user did not manually override design.
3. Persist the blueprint into job output so the UI can show Monster Proof.
4. Hide the Design Angle selector from the first-run happy path; keep it as advanced regeneration override.
5. Implement real provider actions for GitHub commit, Supabase migration/RLS verification, and Vercel deployment.
6. Feed build/typecheck/lint/test results into `MonsterProofReport`.
