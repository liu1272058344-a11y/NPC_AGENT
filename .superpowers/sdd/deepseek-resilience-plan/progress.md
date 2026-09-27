# SDD ledger — plan: docs/superpowers/plans/2026-09-27-deepseek-resilience-plan.md

Pre-flight: shared interfaces checked. Task 1 produces shared contracts/errors consumed by Tasks 2–5; Task 2 gateway is consumed by Task 3 workflow; Task 3 public backend contract is consumed by Tasks 4–5. No interface conflicts found.

Ruling: execute in the existing `master` checkout — the user explicitly authorized Native execution against the current NPC Forge project, and creating a separate checkout would not modify the requested current project.

Task 1: Ruling: runtime contracts use `.mjs` plus `.d.ts` rather than importing `.ts` directly — Node's native test runner cannot load TypeScript without a new runtime loader, while the declarations preserve TypeScript consumers; cost if wrong: type declarations could drift and require a later typed wrapper.

Task 1: complete (tests: `node --test tests/server-contracts.test.mjs` → 2/2 pass; commit follows)

Task 2: complete (tests: `node --test tests/llm-gateway.test.mjs` → 4/4 pass; commit follows)

Task 3: complete (tests: `node --test tests/server-workflow.test.mjs tests/server-review-loop.test.mjs tests/server-npc-review-loop.test.mjs` → 7/7 pass; commit follows)

Task 4: complete (tests: `node --test tests/frontend-request-shape.test.mjs` → 7/7 pass; commit follows)

Task 5: complete (tests: `node --test tests/frontend-concurrency.test.mjs tests/frontend-request-shape.test.mjs` → 9/9 pass; `npm run build` pass; commit follows)

Task 6: complete (tests: `node --test tests/*.test.mjs` → 23/23 pass; `npm run lint` pass with 2 pre-existing unused-parameter warnings; `npm run build` pass; `node --check server.mjs` pass; `git diff --check` pass)

Final review: self-review (no subagent tool). Review focus checked: provider status/finish handling, bounded retry, public error redaction, backend endpoint routing, request cancellation, stale response suppression. One deferred architectural minor remains: legacy review helper code in `server.mjs` and `api/npc.ts` is retained for existing direct unit tests but production handlers now route through `npcWorkflow.mjs`.
