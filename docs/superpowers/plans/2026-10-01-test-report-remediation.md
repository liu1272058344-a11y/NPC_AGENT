# NPC Forge Test Report Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the reproducible product defects from `D:/软件/qq/NPC-Forge-Agent-v2-测试报告.md` that remain in the current repository, while clearly separating deployment-only configuration from code fixes.

**Architecture:** Keep Vercel handlers thin and move behavior into testable modules under `src/server` or `src/agent`. Preserve the existing encrypted credential-session design, stable error envelopes, and remote asset service. Fix each user-visible path with a regression test before production changes.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Node.js test runner, Zod, Vercel Functions

**Spec:** `D:/软件/qq/NPC-Forge-Agent-v2-测试报告.md`

## Global Constraints

- Never expose API keys, provider payloads, environment-variable names, or reviewer metadata in public responses.
- Successful and failed AI responses must use `Cache-Control: no-store`.
- Existing encrypted HttpOnly BYOK credential sessions remain the only browser-to-server credential mechanism.
- Asset persistence remains optional infrastructure; missing `DATABASE_URL` or `BLOB_READ_WRITE_TOKEN` must produce an actionable unavailable state.
- Every production behavior change starts with a failing Node test and ends with the full test/build/lint verification.

## Review Focus

- Empty or non-JSON Pipeline responses must become a visible, actionable error instead of a parsing exception.
- A vague world request must return a clarification response without entering the private review loop.
- Repeated clicks during asset generation must not start another request and must visibly show progress.
- Provider-produced asset type variants must map to a stable product enum without losing the original prompt content.
- Missing asset infrastructure must not look like an empty library or an application crash.

---

### Task 1: Deployable Pipeline Endpoint and Visible Failure State

**Files:**
- Create: `api/pipeline.ts`
- Modify: `src/agent/pipeline.ts`
- Modify: `src/App.tsx`
- Test: `tests/pipeline-api.test.mjs`
- Test: `tests/pipeline-client.test.mjs`

**Interfaces:**
- Consumes: `PipelineController.run({ requirement, style, assetType })` and the existing success/failure envelope.
- Produces: `POST /api/pipeline` with JSON success/error responses; `runPipeline()` throws a readable error for JSON, text, and empty failures.

- [ ] **Step 1: Write failing API and client tests** for POST success, non-POST 405, controller failure status, empty response, and non-JSON response.
- [ ] **Step 2: Run the two focused test files and verify the expected failures.**
- [ ] **Step 3: Add the Vercel handler and robust response parser.**
- [ ] **Step 4: Add a Pipeline-specific error state rendered inside Game Design, with a retry action.**
- [ ] **Step 5: Run focused tests, then the full Node suite and build.**

### Task 2: Long-Running Asset Generation Feedback and Honest Archive Copy

**Files:**
- Modify: `src/App.tsx`
- Create: `src/agent/generationView.mjs`
- Create: `src/agent/generationView.d.mts`
- Test: `tests/generation-view.test.mjs`

**Interfaces:**
- Produces: a pure view-state helper for the asset generation button and archive status copy.

- [ ] **Step 1: Write failing tests** proving the button reads `生成中…`, is disabled while active, and a locally stored NPC is labelled `已保存到当前浏览器`.
- [ ] **Step 2: Run the focused test and verify it fails because the helper does not exist.**
- [ ] **Step 3: Add `assetGenerating` state and wire the tested view state into the Visual Production button.**
- [ ] **Step 4: Replace the misleading character status chip with the tested local-storage copy.**
- [ ] **Step 5: Run the focused test, full suite, and build.**

### Task 3: Reachable Clarification Responses and Correct Validation Status

**Files:**
- Modify: `src/server/npcWorkflow.mjs`
- Modify: `src/server/contracts.mjs`
- Modify: `api/npc.ts`
- Test: `tests/server-workflow.test.mjs`
- Test: `tests/server-contracts.test.mjs`

**Interfaces:**
- Produces: world and NPC clarification envelopes that pass through unchanged; local/schema validation failures use 422; request IDs appear in successful responses when supplied.

- [ ] **Step 1: Write failing workflow tests** for world clarification, malformed finalized world output returning 422, and success request-id echo.
- [ ] **Step 2: Run focused tests and verify each fails for the intended contract gap.**
- [ ] **Step 3: Parse clarification before finalized-world validation and classify schema mismatches as 422.**
- [ ] **Step 4: Add request-id echo at the HTTP boundary without putting transport fields into domain schemas.**
- [ ] **Step 5: Run focused tests, full suite, and build.**

### Task 4: Stable Asset Type Vocabulary

**Files:**
- Create: `src/server/assetType.mjs`
- Modify: `src/server/npcWorkflow.mjs`
- Modify: `api/npc.ts`
- Test: `tests/asset-type.test.mjs`

**Interfaces:**
- Produces: `normalizeAssetType(value: string): string` mapping known Chinese/English variants to the closed labels `NPC立绘`, `角色三视图`, `表情动作表`, `角色道具`, `场景概念图`, `地点设定图`, `道具物件`, `UI图标`, with `其他美术资源` as the fallback.

- [ ] **Step 1: Write table-driven failing tests** for the variants recorded in the report.
- [ ] **Step 2: Run the focused test and verify the missing normalizer failure.**
- [ ] **Step 3: Implement the normalizer and apply it only after a complete asset response validates.**
- [ ] **Step 4: Run focused tests, full suite, and build.**

### Task 5: Deployment Readiness and Remaining Infrastructure Risks

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Create: `src/server/readiness.mjs`
- Create: `api/health.ts`
- Test: `tests/readiness.test.mjs`

**Interfaces:**
- Produces: a non-secret readiness response that reports whether asset persistence and credential encryption are configured, without returning values or environment-variable names.

- [ ] **Step 1: Write failing readiness tests** for configured and unconfigured environments and secret redaction.
- [ ] **Step 2: Run the focused test and verify the missing readiness module failure.**
- [ ] **Step 3: Add the readiness module/route and document required deployment settings.**
- [ ] **Step 4: Make the Asset Library unavailable state point to deployment configuration without exposing internal names.**
- [ ] **Step 5: Run focused tests, the full suite, build, and lint; record any pre-existing lint warnings.**

## Deferred Architectural Work

- Cross-instance `requestId` idempotency needs a shared low-latency store and a retention policy; an in-memory Vercel cache would provide false guarantees and will not be presented as a complete fix.
- Signed anonymous workspace authorization requires a migration design for existing browser UUID workspaces. It should be implemented as a separate security change so existing archives are not orphaned.
- Streaming output is an enhancement, not required to close the reported broken paths once loading and error feedback are present.
- Actual asset-library availability and provider-key validity require deployment/account configuration and cannot be proven from repository-only tests.


