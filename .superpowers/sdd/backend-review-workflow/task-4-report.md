# Task 4 report — frontend integration without review leakage

## Changes

- Added an explicit frontend request context (`phase` and, for NPC creation, the confirmed `WorldProfile`) to the existing backend `/api/npc` request.
- Updated the world confirmation action to pass the accepted world profile with `phase: "npc"`, so the backend NPC review loop is used after the transition.
- Kept direct DeepSeek/OpenAI mode on its existing provider request shape and retained the local backend mode.
- Added a browser-side public response filter that keeps only the supported creation statuses, world/NPC fields, and clarification fields. Reviewer scores, issues, suggestions, and other unknown fields are discarded before React state receives the result.
- Added deterministic request-shape and filtering tests using a fixture that intentionally contains reviewer metadata.
- Added phase-specific completeness checks so partial `world_ready` or `complete` payloads become controlled retry errors instead of being filled with UI defaults and rendered as finished output.
- Trimmed all public string arrays before filtering, preventing whitespace-only personality or behavior entries from passing completion validation.
- Fixed the hosted `api/npc.ts` handler's duplicate `body` declaration so the serverless route can be transpiled and imported successfully.

## Verification

- `npx tsc -b` passed.
- `npx vite build` passed.
- `node --test tests/frontend-request-shape.test.mjs` passed (3 tests, including partial-final-response rejection).
- Full focused suite passed: 8 tests across frontend and backend review-loop fixtures.
- Hosted route transpile/import smoke test passed for `api/npc.ts`.
- `node --check server.mjs` passed.

## Notes

The UI still renders only the existing conversation, world card, NPC card, clarification choices, and controlled error messages. No review labels, scores, issues, suggestions, prompts, or revision counts are added to UI state or components.
