# Internal Beta Cost Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict the deployed product to shared-password internal testers and enforce project-wide, no-extra-service cost guardrails before cost-bearing work begins.

**Architecture:** A signed HttpOnly beta session protects every business API and gates the React application. A Neon-backed atomic counter enforces only a daily project action cap, while the asset transaction also enforces project-wide image and byte limits; there is no request-frequency throttling. An admin session exposes aggregate usage to a settings card without revealing secrets or tester content.

**Tech Stack:** React 19, TypeScript/ES modules, Vercel Functions, Neon PostgreSQL, Vercel Blob, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-01-internal-beta-cost-guardrails-design.md`

## Global Constraints

- Do not add a paid service or a new runtime dependency.
- Defaults are 200 project images, 1 GiB project bytes, and 30 daily cost actions; all are environment-overridable.
- Production fails closed when beta auth or quota configuration is missing.
- Cron authentication remains independent through `CRON_SECRET`.
- Cost quota is reserved before upstream model calls, source image downloads, or Blob writes.
- Existing 20-image/100-MB workspace limits and 30-day retention remain in effect.
- Do not rate-limit login, per-minute requests, or concurrency, and do not alter prompts, models, review rounds, image parameters, resolution, compression, or generation quality.

## Review Focus

- Forged, expired, malformed, or wrong-role cookies must never authorize a request; Task 1 tests each case.
- Concurrent reservations at the last remaining daily or asset slot must admit only the allowed count; Tasks 2 and 3 test database query contracts and service behavior.
- A source server that omits `Content-Length`, redirects repeatedly, or streams beyond the limit must be aborted before Blob upload; Task 3 tests each case.
- Missing production configuration or unavailable Neon must fail closed before any upstream call; Tasks 1, 2, and 4 test these paths.
- Cost guards must pass the original prompt, model, review settings, and image options through unchanged; Task 4 tests reference identity and exact payload equality.

---

### Task 1: Signed internal-beta sessions and API authorization

**Files:**
- Create: `src/server/internalBeta/session.mjs`
- Create: `src/server/internalBeta/http.mjs`
- Create: `api/internal-beta/session.ts`
- Test: `tests/internal-beta-session.test.mjs`
- Test: `tests/internal-beta-http.test.mjs`
- Modify: `.env.example`

**Interfaces:**
- Produces: `createBetaSession(role, env, now?)`, `readBetaSession(request, env, now?)`, `requireBetaSession(request, env, role?)`, and `handleBetaSessionRequest(request, env, options?)`.
- Session result is `{ authenticated: boolean, role: 'tester' | 'admin' | null }`; authorization errors carry the stable spec codes.

- [ ] **Step 1: Write failing session tests** for valid tester/admin cookies, tampering, expiry, malformed values, and missing production configuration.
- [ ] **Step 2: Run `node --test tests/internal-beta-session.test.mjs`** and verify failure because the session module does not exist.
- [ ] **Step 3: Implement the signed session helper** with HMAC-SHA256, timing-safe verification, a random session id, four-hour expiry, and secure cookie attributes.
- [ ] **Step 4: Run the session tests** and verify they pass.
- [ ] **Step 5: Write failing HTTP tests** for login success, wrong password, logout, status, admin role, method rejection, and redacted responses.
- [ ] **Step 6: Run `node --test tests/internal-beta-http.test.mjs`** and verify expected behavior failures.
- [ ] **Step 7: Implement the session handler and Vercel route**, comparing passwords in constant time and never returning either configured password.
- [ ] **Step 8: Document the five new environment variables in `.env.example`** without real secrets.
- [ ] **Step 9: Run both Task 1 test files** and verify all pass.
- [ ] **Step 10: Commit** with `feat: add signed internal beta sessions`.

### Task 2: Atomic daily quota accounting

**Files:**
- Create: `db/migrations/002_internal_beta_guardrails.sql`
- Create: `src/server/internalBeta/usage.mjs`
- Test: `tests/internal-beta-usage.test.mjs`
- Modify: `src/server/assets/database.mjs`
- Modify: `tests/asset-database.test.mjs`

**Interfaces:**
- Consumes: authenticated session id and role from Task 1.
- Produces: `createInternalBetaUsageStore(query, env, now?)` with `reserveDailyAction(kind)` and `getProjectUsage()`.
- Quota failures throw errors with the stable 429 codes in the spec.

- [ ] **Step 1: Write failing usage-store tests** for defaults, environment overrides, daily limit 30, UTC day rollover, concurrent last-slot reservations, and database errors.
- [ ] **Step 2: Run `node --test tests/internal-beta-usage.test.mjs`** and verify failure because the usage module does not exist.
- [ ] **Step 3: Add the idempotent SQL migration** for daily counters with an expiry index; do not store login attempts, IP addresses, or per-minute counters.
- [ ] **Step 4: Implement the usage store** using single-statement upserts or transactional advisory locks so a reservation is atomic.
- [ ] **Step 5: Run the usage tests** and verify they pass.
- [ ] **Step 6: Extend asset database tests first** to require global image/byte totals in the asset reservation transaction, including two concurrent last-slot attempts.
- [ ] **Step 7: Run `node --test tests/asset-database.test.mjs`** and verify the new assertions fail.
- [ ] **Step 8: Extend `saveImageWithQuota`** so workspace and project limits are evaluated in the same locked transaction.
- [ ] **Step 9: Run both Task 2 test files** and verify all pass.
- [ ] **Step 10: Commit** with `feat: add atomic internal beta quotas`.

### Task 3: Protect assets and bound external image ingestion

**Files:**
- Modify: `src/server/assets/config.mjs`
- Modify: `src/server/assets/sourceImage.mjs`
- Modify: `src/server/assets/assetService.mjs`
- Modify: `src/server/assets/http.mjs`
- Modify: `api/assets/**/*.ts`
- Test: `tests/asset-source-image.test.mjs`
- Test: `tests/asset-service.test.mjs`
- Test: `tests/remote-asset-api.test.mjs`

**Interfaces:**
- Consumes: `requireBetaSession` from Task 1, `reserveDailyAction('asset-import')` from Task 2, and project limit values.
- Produces: asset HTTP handlers that reject unauthenticated requests before service creation and source fetch, and quota-aware usage responses.

- [ ] **Step 1: Write failing source-image tests** for non-HTTPS URLs, redirect overflow, timeout, declared oversize, streamed oversize, and an allowed bounded image.
- [ ] **Step 2: Run `node --test tests/asset-source-image.test.mjs`** and verify the new cases fail.
- [ ] **Step 3: Implement bounded streaming source fetch** with an abort controller and no Blob write on rejection.
- [ ] **Step 4: Run source-image tests** and verify they pass.
- [ ] **Step 5: Write failing service and HTTP tests** proving auth and daily/project quota checks happen before source fetch and Blob write, while read/delete remain available at quota.
- [ ] **Step 6: Run the Task 3 service/API tests** and verify the expected failures.
- [ ] **Step 7: Wire session authorization and quota reservations** through all asset routes and pass global limits to the database transaction.
- [ ] **Step 8: Run the Task 3 tests** and verify all pass.
- [ ] **Step 9: Commit** with `feat: guard internal beta asset costs`.

### Task 4: Protect generation and credential APIs before upstream work

**Files:**
- Modify: `api/npc.ts`
- Modify: `api/image.ts`
- Modify: `api/pipeline.ts`
- Modify: `api/credentials.ts`
- Modify: `api/health.ts`
- Modify: `server.mjs`
- Test: `tests/internal-beta-api-guard.test.mjs`
- Modify: `tests/visual-image-service.test.mjs`
- Modify: `tests/pipeline-api.test.mjs`

**Interfaces:**
- Consumes: `requireBetaSession` and `reserveDailyAction(kind)`.
- Produces: a shared `guardCostRequest(request, kind, dependencies?)` path used before any LLM/image request; credential and health endpoints require a valid beta session but do not spend daily quota.

- [ ] **Step 1: Write failing guard tests** proving unauthenticated, daily-limited, missing-config, and database-failure requests never invoke injected upstream functions, while allowed requests pass the exact prompt, model, review rounds, and image options through unchanged.
- [ ] **Step 2: Run `node --test tests/internal-beta-api-guard.test.mjs`** and verify failure because API guards are absent.
- [ ] **Step 3: Implement the shared guard and apply it to Vercel routes and the local server**, excluding only beta login and authenticated cron.
- [ ] **Step 4: Add route-specific tests** for NPC, image, pipeline, credentials, and health authorization.
- [ ] **Step 5: Run the Task 4 tests** and verify they pass.
- [ ] **Step 6: Commit** with `feat: protect cost bearing beta APIs`.

### Task 5: Login gate and administrator usage panel

**Files:**
- Create: `src/agent/internalBetaApi.mjs`
- Create: `src/agent/internalBetaApi.d.mts`
- Create: `src/components/InternalBetaGate.tsx`
- Create: `src/components/InternalBetaUsage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Test: `tests/internal-beta-client.test.mjs`
- Test: `tests/internal-beta-view.test.mjs`

**Interfaces:**
- Consumes: Task 1 session endpoints and Task 2 admin usage payload.
- Produces: `createInternalBetaApi(fetchImpl?)`, login/logout/status methods, a top-level gate, and an admin-only usage card with 70/90/100 percent states.

- [ ] **Step 1: Write failing client tests** for credentials-included requests, stable public errors, 401 logout behavior, and admin-only usage loading.
- [ ] **Step 2: Run `node --test tests/internal-beta-client.test.mjs`** and verify failure because the client does not exist.
- [ ] **Step 3: Implement the browser client** without persisting passwords or session tokens.
- [ ] **Step 4: Run client tests** and verify they pass.
- [ ] **Step 5: Write failing view contract tests** for logged-out gating, loading/error states, tester/admin differences, logout, and 70/90/100 percent copy.
- [ ] **Step 6: Run `node --test tests/internal-beta-view.test.mjs`** and verify the new assertions fail.
- [ ] **Step 7: Implement the gate and usage components**, integrate them at the root of `App`, and add responsive styles matching the existing UI.
- [ ] **Step 8: Run Task 5 tests and `npm run build`** and verify both pass.
- [ ] **Step 9: Commit** with `feat: add internal beta access gate`.

### Task 6: Full verification and operating documentation

**Files:**
- Modify: `README.md`
- Modify: `AI_EXECUTION_CHECKLIST.txt`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: deployment setup, safe default limits, migration command, manual access checks, dashboard monitoring steps, and rollback instructions.

- [ ] **Step 1: Add operating documentation** for all required environment variables, applying migration 002, rotating both passwords, checking Vercel/Neon usage, and the failure-closed behavior.
- [ ] **Step 2: Run `node --test tests/*.test.mjs`** and verify the complete JavaScript suite passes.
- [ ] **Step 3: Run `python -m unittest tests/pipeline_test.py`** and verify the Python suite passes.
- [ ] **Step 4: Run `npm run build`** and verify TypeScript and Vite build succeed.
- [ ] **Step 5: Run `npm run lint`** and record any remaining pre-existing warnings separately from new errors.
- [ ] **Step 6: Inspect `git diff --check` and `git status --short`** and verify only intended files remain.
- [ ] **Step 7: Commit** with `docs: add internal beta operations guide`.
