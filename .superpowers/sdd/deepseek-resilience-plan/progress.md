# SDD ledger — plan: docs/superpowers/plans/2026-09-27-deepseek-resilience-plan.md

Pre-flight: shared interfaces checked. Task 1 produces shared contracts/errors consumed by Tasks 2–5; Task 2 gateway is consumed by Task 3 workflow; Task 3 public backend contract is consumed by Tasks 4–5. No interface conflicts found.

Ruling: execute in the existing `master` checkout — the user explicitly authorized Native execution against the current NPC Forge project, and creating a separate checkout would not modify the requested current project.

Task 1: Ruling: runtime contracts use `.mjs` plus `.d.ts` rather than importing `.ts` directly — Node's native test runner cannot load TypeScript without a new runtime loader, while the declarations preserve TypeScript consumers; cost if wrong: type declarations could drift and require a later typed wrapper.

Task 1: complete (tests: `node --test tests/server-contracts.test.mjs` → 2/2 pass; commit follows)

Task 2: complete (tests: `node --test tests/llm-gateway.test.mjs` → 4/4 pass; commit follows)
