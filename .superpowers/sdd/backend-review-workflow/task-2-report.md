# Task 2 report — Backend worldbuilding review loop

## Delivered

- Added `runReviewedGeneration` to run world draft generation, a private structured review, and up to two revision passes.
- Passed the generated draft into the reviewer request so review criteria are applied to the actual draft and original user messages remain available for intent alignment.
- Added world review criteria for completeness, coherence, originality, playable conflict, and intent alignment.
- Kept review prompts, score, issues, suggestions, and revision count inside the backend. Public responses are filtered to the existing creator statuses and world payload.
- Added deterministic Node tests for rejected-draft revision feedback and approved-first-pass call counts.
- Wired Vercel's `api/npc.ts` messages endpoint through the same world review loop; hosted requests now receive the reviewed workflow instead of the legacy direct generation path.
- Restored bounded DeepSeek parse retries (three attempts) in the local server adapter so malformed or truncated provider output remains recoverable.

## Verification

- `node --test tests/server-review-loop.test.mjs` — 2 passed.
- `npx tsc -b` — passed.
- `npx vite build` — passed.
- `node --check server.mjs` — passed.
- Hosted route path is covered by TypeScript compilation; provider calls remain mocked in focused loop tests.

## Known limitations

The helper currently enables the `world` phase only. Task 3 can supply the NPC-specific reviewer schema and criteria through the same helper while preserving the public response boundary.
