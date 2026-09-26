# Task 5 report — end-to-end verification and final review

## Verdict

Passed after fixing the hosted route syntax regression in commit `523b60e`.

## Automated verification

- `node --test tests/*.test.mjs` — 8 passed, 0 failed.
- `npx tsc -b` — passed.
- `npx vite build` — passed; production bundle emitted to `dist/`.
- `node --check server.mjs` — passed.
- `npx tsc --ignoreConfig --types node --target ES2022 --module ESNext --noEmit api/npc.ts` — passed. This direct route check was added because the repository `tsconfig` does not include `api/`.

## Deterministic end-to-end scenario

The fixture scenario `末日废土药房前的急救员` was exercised through the local backend review helper:

- World phase performed one generation and one private review, returning `world_ready` for `灰烬边城`.
- NPC phase received the confirmed world and performed one generation and one private review, returning `complete`.
- The NPC was automatically named `苏砾`.
- The background included past experience, current situation, and the reason the player meets the character.
- The result included a concrete goal, world conflict, personality, and behavior rules.
- Public output contained only the supported world/NPC fields; reviewer fields such as `review`, `approved`, `score`, `issues`, `suggestions`, and revision data were absent.

## Hosted route smoke test

`api/npc.ts` was transpiled and imported with TypeScript, then invoked with mocked OpenAI responses for both `phase: world` and `phase: npc`. Both requests completed with two provider calls (generation and review), and the returned NPC response contained no reviewer fields.

The initial smoke test found duplicate `const body` declarations in the Vercel handler. Commit `523b60e` renamed the later response binding to `parsedResponse`. The corrected route now imports and executes successfully.

## Frontend leakage check

`rg` over `dist/` and `src/App.tsx` found no reviewer-only terms. Internal review contracts and parsers remain in backend/adapter code, while the browser sanitizer strips unknown fields before React state receives a response. Existing frontend request-shape tests passed.

## Limitations

- Provider calls were mocked for deterministic verification; no external API key was used in this check.
- The hosted route smoke test verifies route control flow and response filtering, not OpenAI service availability or deployment environment variables.
- Direct provider mode intentionally bypasses backend review; the reviewed workflow applies when the frontend uses the backend endpoint.
