# Task 3 report — Backend NPC review loop

## Delivered

- Extended the private `runReviewedGeneration` helper to support `phase: 'npc'` with a required, validated `WorldProfile` context.
- Added NPC-specific generation and review prompts covering automatic naming, concrete background, role and gameplay function, goals, conflict, personality, player relationship, behavior rules, world consistency, and user intent.
- Added strict NPC response validation and public-field filtering. NPC reviewer issues, suggestions, score, and revision count remain backend-only.
- Added the same bounded maximum-two-revision loop to the hosted `api/npc.ts` endpoint. Requests with `phase: 'npc'` and `world` use the reviewed path; legacy `analyze` and direct-provider browser behavior remain unchanged.
- Added deterministic fixtures for approved first pass, rejected background revision, and world-context consistency.

## Verification

- `node --test tests/server-review-loop.test.mjs tests/server-npc-review-loop.test.mjs` — 5 passed.
- `npx tsc -b` — passed.
- `npx vite build` — passed.
- `node --check server.mjs` — passed.
- Commit: `f536ed2 feat: review npc drafts in backend`.

## Integration note

The backend accepts the NPC phase explicitly as `{ phase: 'npc', world, messages }`. The existing frontend still sends its original `{ messages }` payload, so Task 4 must add the phase and confirmed world context when the user confirms the world card. Browser direct-provider mode continues to call the provider directly and therefore does not execute backend review agents.
