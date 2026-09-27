# DeepSeek Gateway Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native) or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Replace the duplicated DeepSeek/OpenAI request paths with one typed, timeout-aware gateway and protect NPC Forge from invalid provider output and concurrent UI requests.

**Architecture:** Shared runtime modules own schemas, provider adapters, error taxonomy, retries, and generation workflows. Local and hosted HTTP handlers become thin adapters. The React client calls one backend contract and uses abort/request IDs to prevent duplicate and stale updates.

**Tech Stack:** TypeScript, Node.js ESM, React 19, Zod, native `fetch`, Node test runner, Vite, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-27-deepseek-resilience-design.md`

## Global Constraints

- Preserve existing NPC Forge pages, prompts, review loop, revision limit, and successful response shapes.
- Browser requests must go through NPC Forge API; provider keys and raw provider payloads never enter logs or public responses.
- Provider calls use at most 3 total attempts and retry only 429, 5xx, network/timeout, or empty output.
- Truncated, filtered, invalid-JSON, schema-invalid, and business-invalid results are never repaired or silently defaulted.
- Every production behavior change is preceded by a failing test.

## Review Focus

- DeepSeek Responses `incomplete` and Chat Completions `finish_reason=length` must be classified as truncation, not parsed.
- A provider `content_filter` result must not retry or become a success.
- A user cancellation must stop retries and leave the current UI state intact.
- Two synchronous clicks must produce one request even before React rerenders.
- A slower old response must not overwrite the latest request.

### Task 1: Add shared runtime dependencies and domain contracts

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/server/contracts.ts`
- Create: `src/server/errors.ts`
- Test: `tests/server-contracts.test.mjs`

**Interfaces:**
- `createDomainSchemas()` exports Zod schemas and JSON Schema equivalents for world, NPC, asset, clarification, review, and public API results.
- `GatewayError` exposes `code`, `retryable`, `statusCode`, and safe `message`.

- [ ] Write failing tests for complete/clarification results, missing fields, empty arrays, public error serialization, and provider error classification.
- [ ] Run `node --test tests/server-contracts.test.mjs` and verify failure because modules do not exist.
- [ ] Add Zod and implement the schemas/error taxonomy without defaulting invalid values.
- [ ] Run the focused test and verify it passes.
- [ ] Commit `feat: add shared gateway contracts`.

### Task 2: Implement the provider gateway

**Files:**
- Create: `src/server/llmGateway.ts`
- Create: `src/server/llmGateway.mjs` (Node-local runtime bridge if required by the ESM server)
- Test: `tests/llm-gateway.test.mjs`

**Interfaces:**
- `requestStructured(options: GatewayRequest): Promise<unknown>` accepts provider/model/messages/instructions/schema/signal/requestId and injectable clock/sleep/random/fetch dependencies.
- Supports DeepSeek Responses `json_schema`, Chat Completions `json_object`, and OpenAI Responses formats.

- [ ] Write failing tests for successful JSON, empty/null output, invalid/truncated JSON, response `incomplete`, `failed`, finish reasons, 429/500/503, timeout, cancellation, retry success, retry exhaustion, and no-retry errors.
- [ ] Run focused tests and verify expected missing gateway failures.
- [ ] Implement status/finish inspection, strict parsing, bounded 3-attempt exponential backoff with jitter, timeout/AbortSignal propagation, and redacted diagnostics.
- [ ] Run focused tests and verify all gateway cases pass.
- [ ] Commit `feat: add resilient structured-output gateway`.

### Task 3: Consolidate generation and review workflows

**Files:**
- Create: `src/server/npcWorkflow.ts`
- Modify: `server.mjs`
- Modify: `api/npc.ts`
- Test: `tests/server-workflow.test.mjs`

**Interfaces:**
- `runNpcRequest(input, dependencies?)` returns only validated public domain results.
- Local and hosted handlers call the same workflow and gateway; neither parses provider payloads directly.

- [ ] Write failing tests for world clarification, world-ready, NPC clarification, complete NPC, asset success, malformed model statuses, and review/revision preservation.
- [ ] Run focused tests and verify they fail against duplicated handlers.
- [ ] Implement shared workflow, schema-derived provider formats, request validation, request IDs, and safe public error mapping.
- [ ] Remove direct provider parsing and duplicated review logic from both handlers.
- [ ] Run focused tests plus `node --check server.mjs` and verify all pass.
- [ ] Commit `refactor: route generation through shared workflow`.

### Task 4: Route the browser through the backend contract

**Files:**
- Modify: `src/agent/npcCreator.ts`
- Test: `tests/frontend-request-shape.test.mjs`

**Interfaces:**
- `createNPC` and `createAsset` call the configured NPC Forge endpoint only and consume the public response/error contract.
- Direct provider response parsing and browser-side provider retries are removed.

- [ ] Add failing tests for structured errors, no raw provider payload leakage, no direct `/chat/completions` URL, and strict rejection of invalid finalized payloads.
- [ ] Run focused tests and verify failure.
- [ ] Implement backend request serialization, stable error parsing, and strict non-defaulting response sanitization.
- [ ] Run focused tests and verify pass.
- [ ] Commit `refactor: use backend gateway from client`.

### Task 5: Add frontend cancellation and race protection

**Files:**
- Modify: `src/App.tsx`
- Test: `tests/frontend-concurrency.test.mjs`

**Interfaces:**
- NPC and asset actions use synchronous refs/locks, `AbortController`, monotonic request IDs, and request-owned cleanup.

- [ ] Write failing tests for synchronous duplicate submission, old response suppression, cancellation, and loading cleanup after stale completion.
- [ ] Run focused tests and verify failure.
- [ ] Implement guarded request helpers and wire NPC, retry, confirm-world, and asset buttons without changing UI layout.
- [ ] Run focused tests and verify pass.
- [ ] Commit `fix: prevent duplicate and stale agent requests`.

### Task 6: Full verification and cleanup

**Files:**
- Modify: any touched files needed to remove new lint/type issues
- Test: existing `tests/*.test.mjs` plus all new tests

- [ ] Run `node --test tests/*.test.mjs`.
- [ ] Run `npm run lint`, `npm run build`, and `node --check server.mjs`.
- [ ] Confirm no new lint warnings, no secret/raw prompt logging, and no direct provider calls remain in `src/`.
- [ ] Review `git diff --check` and `git status`.
- [ ] Commit `test: verify deepseek gateway resilience` if verification-only changes are needed.

## Execution Notes

Tasks are intentionally sequential because the shared contracts define the gateway and workflow interfaces consumed by later tasks. Keep each red-green-refactor cycle small; do not modify production code before its focused test has failed for the intended reason.
