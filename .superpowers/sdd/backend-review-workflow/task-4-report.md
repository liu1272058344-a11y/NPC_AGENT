# Task 4 report — frontend integration without review leakage

## Changes

- Added an explicit frontend request context (`phase` and, for NPC creation, the confirmed `WorldProfile`) to the existing backend `/api/npc` request.
- Updated the world confirmation action to pass the accepted world profile with `phase: "npc"`, so the backend NPC review loop is used after the transition.
- Kept direct DeepSeek/OpenAI mode on its existing provider request shape and retained the local backend mode.
- Added a browser-side public response filter that keeps only the supported creation statuses, world/NPC fields, and clarification fields. Reviewer scores, issues, suggestions, and other unknown fields are discarded before React state receives the result.
- Added deterministic request-shape and filtering tests using a fixture that intentionally contains reviewer metadata.

## Verification

- `npx tsc -b` passed.
- `npx vite build` passed.
- `node --test tests/frontend-request-shape.test.mjs` passed (2 tests).
- `node --check server.mjs` passed.

## Notes

The UI still renders only the existing conversation, world card, NPC card, clarification choices, and controlled error messages. No review labels, scores, issues, suggestions, prompts, or revision counts are added to UI state or components.
