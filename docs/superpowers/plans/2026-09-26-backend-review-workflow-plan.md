# Backend Review Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有世界观 → NPC 创建流程中加入完全隐藏于后端的评审与最多两次自动修订，并保持前端只接收干净结果。

**Architecture:** 保留 `/api/npc` 作为唯一前端入口。后端先调用生成模型，再调用同一模型配置的评审提示词；评审不通过时把问题注入修订请求，最多循环两次，最终只返回 `needs_clarification`、`world_ready`、`complete` 或可重试错误。前端仅增加统一处理中状态，不渲染评审字段。

**Tech Stack:** Node.js HTTP server, Vercel serverless handler, TypeScript, React, DeepSeek/OpenAI Chat Completions/Responses API。

**Spec:** `docs/superpowers/specs/2026-09-26-agent-review-workflow-design.md`

## Global Constraints

- 评审完全在后端执行，前端不得展示评审 Agent、评分、问题、建议或修订次数。
- 世界观只有通过内部评审后才能返回 `world_ready`。
- NPC 只有通过内部评审后才能返回 `complete`。
- 每个阶段最多自动修订 2 次，失败时返回可重试错误，不返回低质量草稿。
- API Key 不写入项目代码或 localStorage。
- 现有本地后端模式和前端直连模式都必须保留。

## Review Focus

- 模型返回 Markdown、截断 JSON 或空响应：API 返回可读错误，不崩溃。
- 评审返回未知字段或缺少 `approved`：按评审失败处理并进入有限重试。
- 修订两次仍未通过：停止循环并返回重试错误，不展示草稿。
- 世界观阶段误返回 NPC：丢弃该结果并要求模型继续世界观阶段。
- NPC 阶段缺少世界观上下文：后端拒绝生成并返回流程错误。

---

### Task 1: Define internal review contracts and robust parsing

**Files:**
- Modify: `src/agent/npcCreator.ts`
- Modify: `src/types/npc.ts`
- Modify: `server.mjs`
- Modify: `api/npc.ts`

**Interfaces:**
- `ReviewResult = { approved: boolean; issues: string[]; suggestions: string[]; score?: number }`
- `reviewDraft(phase, draft, context): Promise<ReviewResult>` is an internal server-side operation; it is never exposed as a frontend action.
- Public response remains `CreatorReply` with only `needs_clarification`, `world_ready`, `complete`.

- [ ] **Step 1: Add failing contract tests or fixture assertions** for valid review JSON, missing approval, fenced JSON, and truncated JSON.
- [ ] **Step 2: Run the focused checks** and confirm they fail before the parser/contract exists.
- [ ] **Step 3: Implement shared normalization/parsing helpers** so malformed model output becomes a controlled error and review details remain internal.
- [ ] **Step 4: Run TypeScript and Node syntax checks** and confirm the contracts compile.
- [ ] **Step 5: Commit** `feat: define backend review contracts`.

### Task 2: Implement backend world-review loop

**Files:**
- Modify: `server.mjs`
- Modify: `api/npc.ts`

**Interfaces:**
- Internal `runReviewedGeneration({ phase: 'world', messages, model, provider })` returns a validated world result or a controlled error.
- The function performs generation → review → up to two revisions without returning intermediate drafts.

- [ ] **Step 1: Add a test fixture** where the first world draft misses the central conflict and the reviewer requests it; assert the second generation receives the review suggestion.
- [ ] **Step 2: Add a test fixture** where the reviewer approves the first world draft; assert only one generation and one review occur.
- [ ] **Step 3: Implement the hidden review prompt** with checks for completeness, coherence, originality, playable conflict, and user-intent alignment.
- [ ] **Step 4: Implement the bounded revision loop** and return `world_ready` only after approval.
- [ ] **Step 5: Run the focused backend tests** and commit `feat: review worldbuilding drafts in backend`.

### Task 3: Implement backend NPC-review loop

**Files:**
- Modify: `server.mjs`
- Modify: `api/npc.ts`

**Interfaces:**
- Internal `runReviewedGeneration({ phase: 'npc', messages, world, model, provider })` returns a validated NPC result or a controlled error.
- Review context includes the confirmed `WorldProfile` and user conversation.

- [ ] **Step 1: Add a fixture** where the NPC background lacks a player-meeting reason and assert the reviewer suggestion is injected into revision.
- [ ] **Step 2: Add a fixture** where the NPC is inconsistent with a world rule and assert revision receives the world constraint.
- [ ] **Step 3: Implement NPC review criteria** for world consistency, motivation, gameplay function, player relationship, concrete background, personality, and executable behavior rules.
- [ ] **Step 4: Implement the same maximum-two-revision loop** and return `complete` only after approval.
- [ ] **Step 5: Run focused tests and commit** `feat: review npc drafts in backend`.

### Task 4: Connect the existing frontend without exposing review internals

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/agent/npcCreator.ts`
- Modify: `src/App.css` only if the existing processing state needs styling.

**Interfaces:**
- Frontend sends the existing conversation/world payload only.
- Frontend handles backend `needs_clarification`, `world_ready`, `complete`, and controlled error responses.

- [ ] **Step 1: Add a UI behavior test/check** that the conversation displays only a generic processing state and no review score/issues/suggestions.
- [ ] **Step 2: Update request handling** to ignore unknown internal review fields and preserve current retry behavior.
- [ ] **Step 3: Verify the world card and NPC card render only after the backend response is finalized.
- [ ] **Step 4: Run the production build** and commit `feat: keep review workflow invisible in frontend`.

### Task 5: End-to-end verification and final review

**Files:**
- Test: `AI_EXECUTION_CHECKLIST.txt` scenario and manual API/browser checks.

- [ ] **Step 1: Run the full “末日废土药房前急救员” flow**: world questions → world result → confirmation → NPC questions → NPC result.
- [ ] **Step 2: Verify at least one forced review revision** changes the draft and that no review metadata appears in the response or UI.
- [ ] **Step 3: Verify malformed model JSON and exhausted revision loops** return retryable errors without React errors.
- [ ] **Step 4: Run `tsc -b`, `vite build`, `node --check server.mjs`, and `git status`.
- [ ] **Step 5: Request an independent code review** against this plan and fix Critical/Important findings before deployment.
- [ ] **Step 6: Commit final verification changes** and push to GitHub.
