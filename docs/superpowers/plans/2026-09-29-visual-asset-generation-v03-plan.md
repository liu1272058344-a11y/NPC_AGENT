# Visual Asset Generation v0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不修改 Character Agent 的前提下，打通 Character JSON 到图片生成和资产版本保存的最小可用链路。

**Architecture:** Visual Agent 和 Prompt Engine 只处理结构化数据；Image Service 负责 Provider 选择和错误归一化；Asset Manager 负责 SQLite 持久化。现有 `/api/image` 保留，新业务接口通过统一服务层调用 Provider。

**Tech Stack:** Node.js 24、SQLite `node:sqlite`、React/TypeScript、现有 Vite 工具链、Node test runner。

**Spec:** `docs/superpowers/specs/2026-09-29-visual-asset-generation-v03-design.md`

## Global Constraints

- 不修改 Character Agent 的输入、输出和审核逻辑。
- Agent 不得直接调用模型 HTTP 接口。
- 现有 `/api/npc`、`/api/pipeline`、`/api/image` 必须保持兼容。
- Provider 首期支持 OpenAI-compatible 图片接口，并保留 Flux、Stable Diffusion 适配边界。
- 每个任务完成后运行对应测试；最终必须通过全部测试和生产构建。

## Review Focus

- Character JSON 缺少视觉字段时，必须返回稳定的 `INVALID_VISUAL_ASSET`。
- Prompt 缺少环境、镜头或风格时，Critic 必须指出具体字段。
- Provider 返回空图片或错误响应时，不得写入资产记录。
- 同一资产创建新版本时，版本号必须递增且不能覆盖旧版本。
- 旧 API 和旧页面行为不能回归。

---

### Task 1: VisualAsset and AssetVersion schemas

**Files:**
- Create: `src/schemas/visualAsset.mjs`
- Create: `src/schemas/assetVersion.mjs`
- Test: `tests/visual-asset-schema.test.mjs`

**Interfaces:**
- `createVisualAsset(input) -> VisualAsset`
- `createAssetVersion(input) -> AssetVersion`
- `validateVisualAsset(input) -> { success, data?, error? }`

- [ ] Write failing tests for complete objects, required fields, and invalid status.
- [ ] Implement minimal constructors and validators with stable field names.
- [ ] Run `node --test tests/visual-asset-schema.test.mjs`.
- [ ] Commit `feat: add visual asset schemas`.

### Task 2: Visual Agent and Prompt Engine

**Files:**
- Create: `src/agents/visualAgent.mjs`
- Create: `src/prompt/promptBuilder.mjs`
- Create: `src/prompt/promptCritic.mjs`
- Create: `src/prompt/promptOptimizer.mjs`
- Test: `tests/visual-prompt-engine.test.mjs`

**Interfaces:**
- `buildVisualAsset(character) -> VisualAsset`
- `buildPrompt(visualAsset) -> PromptPackage`
- `criticPrompt(promptPackage) -> { valid, issues }`
- `optimizePrompt(promptPackage, critique) -> PromptPackage`

- [ ] Add tests proving Character fields are copied into Subject, Appearance, Costume, Weapon, Environment, Lighting, Camera, and Art Style.
- [ ] Add tests for missing-field critique and deterministic optimization.
- [ ] Implement pure functions only; no `fetch`, provider, or model dependency.
- [ ] Run focused tests and commit `feat: add visual prompt engine`.

### Task 3: Image Service and Provider adapters

**Files:**
- Create: `src/services/image/providers/openaiProvider.mjs`
- Create: `src/services/image/providers/fluxProvider.mjs`
- Create: `src/services/image/providers/stableDiffusionProvider.mjs`
- Modify: `src/services/image/imageService.mjs`
- Test: `tests/visual-image-service.test.mjs`

**Interfaces:**
- `generateImage({ prompt, negativePrompt, provider, model, size, apiKey }) -> { url, provider, model, size }`
- Provider adapter: `generate({ prompt, negativePrompt, model, size, apiKey })`

- [ ] Add tests for provider selection, OpenAI-compatible request shape, empty response, and unknown provider.
- [ ] Implement provider registry with OpenAI-compatible provider first; Flux and Stable Diffusion return a clear unsupported-provider error until configured.
- [ ] Keep existing `generateImage` call shape compatible with `/api/image`.
- [ ] Run all image tests and commit `feat: unify image provider service`.

### Task 4: Visual asset generation API

**Files:**
- Modify: `server.mjs`
- Create: `src/server/visualAssetWorkflow.mjs`
- Test: `tests/visual-asset-api.test.mjs`

**Interfaces:**
- `POST /api/visual-assets/generate` accepts `{ character, provider?, model?, size?, apiKey? }`.
- Success returns `{ visualAsset, prompt, image }`.
- Failure returns `{ code, message }` with HTTP 400/502 as appropriate.

- [ ] Add tests for valid Character JSON, invalid input, and provider failure.
- [ ] Implement workflow: Visual Agent → Prompt Builder → Critic → Optimizer → Image Service.
- [ ] Reuse existing CORS and error response conventions.
- [ ] Run focused API tests and commit `feat: add visual asset generation api`.

### Task 5: Asset Manager and versions

**Files:**
- Create: `src/services/assets/assetManager.mjs`
- Modify: `src/persistence/database.mjs`
- Modify: `server.mjs`
- Test: `tests/asset-manager.test.mjs`

**Interfaces:**
- `saveAsset(input) -> Asset`
- `createAssetVersion(assetId, input) -> AssetVersion`
- `listAssetVersions(assetId) -> AssetVersion[]`

- [ ] Add tests for save, version increment, retrieval, and persistence failure.
- [ ] Extend existing tables/queries without breaking current `listStoredAssets` behavior.
- [ ] Add `/api/assets`, `/api/assets/:assetId/versions`, and `/api/assets/:assetId/versions` GET routes.
- [ ] Run persistence tests and commit `feat: add asset manager versioning`.

### Task 6: Visual Production frontend

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Create or modify: `src/agent/image.ts`
- Test: `tests/frontend-visual-production.test.mjs`

- [ ] Add tests for character selection, generation request shape, save action, and version refresh.
- [ ] Add Visual Production sections for character state, prompt package, generation result, save, and versions.
- [ ] Reuse current navigation, cards, buttons, and dark tool UI.
- [ ] Run frontend tests and `npm run build`.
- [ ] Commit `feat: complete visual production ui`.

### Task 7: Full verification and GitHub sync

- [ ] Run `node --test`, `npm run build`, and `git diff --check`.
- [ ] Confirm Character Agent and existing API tests remain green.
- [ ] Push all commits to `origin/master`.
- [ ] Report changed files, test results, API usage, and next provider integration work.
