# 游戏内容分类生成与资产库实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户选择角色、地图、场景或道具后生成内容，并按世界、类别和条目保存设计、Prompt 与图片历史。

**Architecture:** 共享类别模块定义字段和校验；现有生成服务接收显式类别与条目标识。Neon 档案表兼容扩展为通用内容条目，React 使用独立编辑、筛选和详情组件。图片继续存入 Blob。

**Tech Stack:** React、TypeScript、Node ES modules、Zod、Neon PostgreSQL、Vercel Blob。

**Spec:** `docs/superpowers/specs/2026-10-01-game-content-categories-design.md`

## Global Constraints

- 新建类别仅为 character、map、scene、prop；legacy 的 unknown 只用于待分类资产。
- 非角色生成不要求 NPC；世界背景可选。
- 世界、条目和生成记录使用稳定 ID，同名和改名不改变关联。
- 模型、原始用户要求、图片质量和既有审查流程保持；不增加限速或付费服务。
- 迁移保留旧数据，成功前不清除本地原件，重复执行不新增副本。
- 旧 API 继续可读；所有新读写沿用内测认证和工作区边界。
- 按需运行真实模型验收；自动化验证不得调用付费模型或生产数据写入。

## Review Focus

- 切换类别时迟到的生成结果只能更新原条目；任务 5 覆盖。
- 同名世界和条目不得混合记录，历史 Prompt 不随条目改名而改写；任务 2、3 覆盖。
- 重复保存与迁移重试不得产生副本或丢失本地原件；任务 3、4 覆盖。
- 地图、场景、道具不得继承当前 NPC 的必填要求；任务 1、5 覆盖。
- 旧档案缺失类别、图片到期或数据库读取失败时，仍能区分待分类、无图片和加载失败；任务 4、6 覆盖。

## Task 1: 类别契约和专用生成

**Files:** 新建 `src/content/categories.mjs`、`src/content/categories.d.mts`、`src/server/contentGeneration.mjs`、`tests/content-generation.test.mjs`；修改 `src/server/contracts.mjs`、`src/server/npcWorkflow.mjs`、`src/types/npc.ts`、`src/agent/npcCreator.ts`、`api/npc.ts`、`server.mjs`。

**Interfaces:** `contentCategories` 描述四类字段；`validateContentRequest(input)` 返回含 category、itemId、name、requirements、world 的合法请求；`generateContent(input, dependencies)` 返回 `{ itemId, category, design, asset }`。design 含名称、摘要和类别专用字段；asset 保留现有完整 Prompt 字段。现有无类别请求走兼容路径。

- [ ] 先补四类请求和响应测试：地图无需 NPC；非法类别在模型调用前拒绝；输出类别冲突被拒绝；用户原文、模型和画幅传递正确。
- [ ] 运行 `node --test tests/content-generation.test.mjs`，确认新增行为尚缺失。
- [ ] 实现类别定义、严格结果校验与专用 Prompt 指令，在 Vercel 和本地服务接入同一模块。专用字段按规格表定义；反向提示词允许空值。
- [ ] 运行新增测试和现有生成测试，通过后提交 `feat: add categorized game content generation`。

## Task 2: 世界与条目持久化

**Files:** 新建 `db/migrations/003_content_categories.sql`、`tests/content-database.test.mjs`；修改 `src/server/assets/database.mjs`、`src/server/assets/types.d.mts`。

**Interfaces:** 世界记录 `{ id, name, profile }`；档案新增 category、worldId、tags、relatedIds、updatedAt。`upsertWorld(workspaceId, world)`、`updateArchiveMetadata(workspaceId, id, patch)`。现有 `upsertArchive`、`listArchives`、`getArchiveDetail` 返回新增字段。

- [ ] 测试同名不同 ID、世界改名、跨工作区引用拒绝、缺失关联条目、旧记录默认类别和重复迁移。
- [ ] 运行 `node --test tests/content-database.test.mjs`，确认预期失败。
- [ ] 编写可重复迁移：创建 workspace-scoped 世界表；给档案和 Prompt 添加兼容字段及索引。保留 npc_archives 物理表名；只回填能够确定的旧类别。
- [ ] 实现参数化 SQL 与工作区约束，世界改名只更新世界记录，不改写生成快照。
- [ ] 运行数据库相关测试，通过后提交 `feat: persist categorized content archives`。

## Task 3: 设计、Prompt 和图片历史

**Files:** 修改 `src/server/assets/assetService.mjs`、`src/server/assets/http.mjs`、`api/assets/archive.ts`、`src/agent/assetApi.mjs`、`src/agent/assetApi.d.mts`；新建 `tests/content-archive.test.mjs`。

**Interfaces:** `saveRemoteArchive({ archive, prompts })` 支持通用设计与不可变 Prompt 快照；新请求 ID 创建新记录，同一请求 ID 重试返回既有记录。图片沿用 `promptRecordId` 精确关联。PATCH archive 只允许更新名称、摘要、类别、标签、世界和关联条目。

- [ ] 测试单条目多次生成、重试幂等、改名不变更历史、图片关联正确、删除图片保留设计和 Prompt、跨工作区修改拒绝。
- [ ] 运行 `node --test tests/content-archive.test.mjs`，确认预期失败。
- [ ] 实现服务与客户端扩展，保留现有 API 响应兼容字段，确保所有写入错误保留可重试信息。
- [ ] 运行资产服务与客户端测试，通过后提交 `feat: link content prompt and image history`。

## Task 4: 旧资产迁移与分类

**Files:** 修改 `src/agent/assetMigration.mjs`、`src/agent/assetMigration.d.mts`；新建 `src/content/legacyClassification.mjs`、`tests/content-migration.test.mjs`。

**Interfaces:** `classifyLegacyAsset(record)` 返回四类或 unknown；迁移沿用 `migrateLocalAssetRecords(storage, api)`，新增按工作区保存的迁移完成标记与待整理数量。

- [ ] 测试明确 NPC、地图、场景、道具及无法判断的记录；重跑不重复；部分失败保留原件；更换工作区不误用完成标记。
- [ ] 运行 `node --test tests/content-migration.test.mjs`，确认预期失败。
- [ ] 实现稳定迁移 ID，服务器确认后记录成功。旧混合档案保留关联并标记待整理，允许用户手动分类。
- [ ] 运行新旧迁移测试，通过后提交 `feat: migrate legacy assets into content categories`。

## Task 5: 分类编辑和生成入口

**Files:** 新建 `src/components/ContentStudio.tsx`、`src/components/ContentCategoryPicker.tsx`、`src/agent/contentDrafts.mjs`、`src/agent/contentDrafts.d.mts`、`tests/content-drafts.test.mjs`；修改 `src/App.tsx`、`src/App.css`。

**Interfaces:** 草稿按 itemId 保存 category、worldId、design、asset、images 和生成状态。`applyGenerationResult(state, request, result)` 按发起时 itemId 与 requestId 更新；类别切换不复用其他条目结果。

- [ ] 测试四类草稿切换、多角色共存、迟到响应、取消、重复点击和保存失败后保留内容。
- [ ] 运行 `node --test tests/content-drafts.test.mjs`，确认预期失败。
- [ ] 接入类别选择、专用字段、可选世界和新建/继续条目。世界确认后显示类别入口。独立生图也指定类别和条目；生成图片携带原 Prompt 关联。
- [ ] 将当前 NPC 保存为独立条目，创建下一个角色前保留已完成角色；资产保存失败不得显示成功。
- [ ] 运行草稿和客户端测试及 `npm run build`，通过后提交 `feat: add category-first content studio`。

## Task 6: 分类资产库与条目详情

**Files:** 新建 `src/components/ContentLibrary.tsx`、`src/components/ContentItemDetail.tsx`、`tests/content-library.test.mjs`；修改 `src/agent/assetLibraryView.mjs`、`src/agent/assetLibraryView.d.mts`、`src/components/ArchiveDetail.tsx`、`src/App.tsx`、`src/App.css`。

**Interfaces:** `buildContentLibrary(archives, filters)` 返回条目、类别统计和状态；filters 包含 worldId、category、query、status。状态由真实记录数量导出。详情支持 metadata 编辑与设计/Prompt/图片历史。

- [ ] 测试跨世界筛选、四类计数、独立素材、待分类、名称/摘要/标签搜索、最近更新排序、图片到期后的设计保留及错误与空库区分。
- [ ] 运行 `node --test tests/content-library.test.mjs`，确认预期失败。
- [ ] 实现筛选、状态和详情组件；封面与记录数量从远程数据取得。历史图片显示对应 Prompt，允许重用该 Prompt 创建新版本。
- [ ] 接入编辑类别、世界与关联条目；删除确认明确范围。旧本地数据迁移成功后避免在列表重复展示。
- [ ] 运行相关测试与构建，通过后提交 `feat: organize assets by world category and item`。

## Task 7: 回归与交付

**Files:** 更新 `README.md`、`AI_EXECUTION_CHECKLIST.txt`。

- [ ] 记录迁移顺序、兼容行为、四类使用方法、地图交付边界及回滚注意事项。
- [ ] 运行 `node --test tests/*.test.mjs`、`npm run build`、`npm run lint` 和 `git diff --check`；记录失败与已有警告。
- [ ] 用本地可控响应检查四类页面、切换条目、保存失败及历史详情；检查窄屏布局。生产数据库迁移和真实模型验收单独标记状态。
- [ ] 对照规格检查完整差异，修复会造成内容丢失、跨类别污染或错误关联的问题。
- [ ] 提交 `docs: document categorized content workflow`；交付变更与验证结果，生产迁移和部署保留为明确的后续操作。
