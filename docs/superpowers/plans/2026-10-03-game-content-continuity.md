# 游戏内容连续性实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有分类内容工作台上贯通世界、内容设计、美术和图片，并明确草稿命名与自由生图。

**Architecture:** 沿用现有世界/档案 API 与四类内容条目，将上下文继承、草稿状态和图片请求快照抽为独立模块。Prompt 和图片保存不可变来源快照，用户可以跳过 Prompt 工程。

**Tech Stack:** React 19、TypeScript、Node ESM、Zod、node:test、现有 Neon/Blob 存储。

**Spec:** docs/superpowers/specs/2026-10-03-game-content-continuity-design.md

## Global Constraints
- 用户可以直接输入或修改图片提示词，无须经过系统 Prompt 工程。
- 角色可以是人、动物、植物、石头或机械。
- 空白编辑状态按类型显示“新地图（未保存）”等标签。
- 修改名称不改变 ID、图片关系和历史。
- 此改动不含部署、不改变已有存储配额。
- 不以默认人物经历或装备填补未知字段，不静默覆盖已确认事实。

## 已定位基线
截图界面位于 D:/软件/codex/.codex/worktrees/test-report-remediation/AI_NPC_AGENT，HEAD c16b453；主目录 master 缺少 ContentWorkspace。目标为这套已存在的流程，实施时从 c16b453 创建隔离工作树，携带本规格和计划；不修改其他聊天的工作树，不合并其他未跟踪资料。基线现有 name 输入绑定 update，生成时禁用；已有直接输入生图入口和按条目保存图片机制，需改进和验证而非重写。

## Review Focus
- 旧档案无实体类别或版本：可读取且不虚构数据（任务1）。
- 用户切换条目时有未保存修改：可保留、放弃或取消（任务3）。
- 世界读取失败或被删除：明确来源不可用，仍可自由生图（任务2、5）。
- 生图期间编辑 Prompt 或切换条目：图片保存原请求快照（任务5）。
- 保存超时后重试：不产生重复版本或错误成功提示（任务4、5）。

## 文件边界
保留 src/content/categories.mjs、src/server/contentGeneration.mjs、src/components/ContentWorkspace.tsx 与现有 API。新增 src/content/context.mjs 负责上下文，src/content/draftState.mjs 负责名称与切换，src/content/imageRequest.mjs 负责请求快照；均附 .d.mts 声明。新增 src/components/ContentImageEditor.tsx 作为可独立进入的生图编辑器；现有 App.tsx 只负责导航与世界交接。版本元数据沿用档案 profile 和 prompt snapshot，实施前核对 API 白名单，必要时增量迁移，不另建并行资产库。

### Task 1: 类型契约与旧数据兼容
Files: src/content/categories.mjs、src/types/npc.ts、src/server/contracts.mjs、src/server/worldSchemaValidator.mjs、schemas/json/world.schema.json；创建 src/content/profile.mjs、src/content/profile.d.mts；tests/content-profile.test.mjs。
Interfaces: normalizeContentProfile(value: unknown): ContentProfile；ContentProfile 包含 id/category/name/worldId/revision/entityKind?/fields/visualBrief/fieldStatus/relatedIds；revision 从1开始，旧实体类别未确定。WorldProfile 保留旧七字段，增添可选 id/revision/visualDirection。
- [ ] 写失败测试：旧 NPC 保持 ID、背景和历史；未知类别不变成人；树无需服装/语言/武器；旧七字段 world 可解析；视觉方向透过客户端和服务器校验不被丢弃。
- [ ] 运行 node --test tests/content-profile.test.mjs，确认缺少新接口导致失败。
- [ ] 实现归一化、类型和白名单兼容，更新 categories 将“外观与服装”改为“外形与视觉特征”，增加实体类别与表达方式，按适用性允许省略字段。
- [ ] 运行上述测试及 node --test tests/world-schema-validator.test.mjs tests/content-migration.test.mjs，全部通过后定向提交。

### Task 2: 上下文继承及针对性生成
Files: 创建 src/content/context.mjs 和 .d.mts；修改 src/server/contentGeneration.mjs、src/server/npcWorkflow.mjs、src/agents/visualAgent.mjs、src/agent/npcCreator.ts；tests/content-context.test.mjs、tests/content-generation.test.mjs。
Interfaces: buildContentContext({world,item,overrides}): {source,confirmed,pending,conflicts}；isPromptStale(snapshot,world,item): boolean。source 保存世界及条目 ID/revision；覆盖优先但保留冲突记录。
- [ ] 写失败测试：四种类别继承世界视觉约束与条目用途；树、石头、动物不被默认装备化；未知字段进入 pending；明确覆盖产生 conflicts；世界缺失返回来源不可用；版本变化使旧 Prompt 过期。
- [ ] 运行 node --test tests/content-context.test.mjs tests/content-generation.test.mjs，确认新增断言失败。
- [ ] 实现上下文接口并接入生成请求；请求缺关键信息时只返回针对性澄清，未适用字段可省略；保留旧调用兼容。移除 visualAgent 人形默认补全，禁止把背景直接当外形。
- [ ] 运行该组及 node --test tests/visual-prompt-engine.test.mjs，通过后定向提交。

### Task 3: 草稿名称、切换和保存反馈
Files: 创建 src/content/draftState.mjs 和 .d.mts；修改 src/components/ContentWorkspace.tsx、src/components/ContentItemDetail.tsx；tests/content-draft-state.test.mjs。
Interfaces: draftLabel(draft): string；transitionDraft(state,{action,targetId,decision?}): {state,needsDecision}；validateDraftName(name): {valid,message}。空白 map 标签为“新地图（未保存）”，空白其他类别依标签替换。
- [ ] 写失败测试：输入名称立即更新标签；空白名称无法保存且内容保留；重命名保持 ID 和关联；未保存切换返回 needsDecision，取消保持当前条目，保留不丢修改，放弃还原最近保存快照。
- [ ] 运行 node --test tests/content-draft-state.test.mjs，确认失败。
- [ ] 实现草稿状态接口，接入可见命名说明、保存校验、已保存条目重命名入口及切换对话框；生成禁用时明确说明“生成中，完成后可修改”。本地草稿缓存不等同于已保存档案。
- [ ] 运行测试并通过浏览器验证新建、命名、保存、刷新、重命名与三种切换决策，定向提交。

### Task 4: 世界构建交接、简报与版本持久化
Files: src/App.tsx、src/components/WorldFieldsEditor.tsx、src/components/ContentWorkspace.tsx、src/components/ContentItemDetail.tsx、src/agent/assetApi.mjs 和 .d.mts、src/server/assets/http.mjs、src/server/assets/assetService.mjs、src/server/assets/database.mjs；tests/content-handoff.test.mjs、tests/content-archive.test.mjs。
Interfaces: 世界确认后导航传入 {category,worldId,itemId?}；saveRemoteArchive 接收 profile.revision、visualBrief、fieldStatus，prompt.snapshot 保存任务2 source/confirmed 以及 mode（generated/edited/manual）。已保存 Prompt ID 代表不可变版本；重试同 ID 同文本幂等，同 ID 不同文本拒绝而非覆盖。
- [ ] 写失败测试：世界确认后可选择任一类别且带世界 ID；简报可保存并重载；无关或待完善字段不被编造；修改世界标记旧 Prompt 但原文不变；同版本保存重试不重复；API 完整保存版本元数据。
- [ ] 运行 node --test tests/content-handoff.test.mjs tests/content-archive.test.mjs，确认失败。
- [ ] 实现世界视觉方向编辑、四类交接、简报编辑与继承来源展示；使用既有 JSON 字段持久化，若白名单或索引不支持则添加明确的增量迁移并测试。旧记录来源仅在可证明时补齐；在数据库层保持版本不可变和幂等。
- [ ] 运行该组及 node --test tests/world-character-navigation.test.mjs tests/creation-image-handoff.test.mjs tests/asset-database.test.mjs，全部通过后定向提交。

### Task 5: 自由生图与不可变请求快照
Files: 创建 src/content/imageRequest.mjs 和 .d.mts、src/components/ContentImageEditor.tsx；修改 src/components/ContentWorkspace.tsx、src/App.tsx；tests/content-image-request.test.mjs。
Interfaces: captureImageRequest({prompt,negativePrompt,provider,model,parameters,source,mode}): ImageRequestSnapshot；快照含 requestId 和实际文本，mode 为 generated/edited/manual。生图成功对象 {image,requestSnapshot}；保存必须使用其快照而非当前输入状态。
- [ ] 写失败测试：纯手写不需要世界/条目/asset；提交不追加系统风格；编辑带入 Prompt 记为 edited；输入变更、模型切换和条目切换不改变已生成图片快照；纯手写默认独立，用户可主动关联；保存失败保留图片及文本；同 requestId 重试幂等。
- [ ] 运行 node --test tests/content-image-request.test.mjs，确认失败。
- [ ] 实现独立生图编辑器，在图片工作台显著提供“自由输入”“从内容条目带入”；创建条目仅在用户选择关联保存时需要。调用现有 generateImage，沿用支持的模型参数；保存关联由用户明确选择，来源失效提示不阻断生成。解除生成与 name/requirements/结构化 asset 的强制依赖。
- [ ] 运行该组及 node --test tests/image-service.test.mjs tests/content-archive.test.mjs；浏览器验证中文手写输入、编辑 Prompt、生图后再编辑、独立及关联保存、失败重试，定向提交。

### Task 6: 整体验证与交付
Files: README.md、上述各模块；不修改部署配置和存储配额。
- [ ] 运行 node --test tests/*.test.mjs、npm run build、npm run lint，记录真实结果；如基线已有失败先核对归属，不宣称全绿。
- [ ] 验证同一世界下角色（动物/树/石头）、地图、场景、道具从设计到图片与刷新回溯；验证世界版本更新、生成失败、存储失败、旧数据读取。
- [ ] 按规格八项验收逐项核对；检查用户文本未被偷偷改写，历史未覆盖，命名和状态清楚。
- [ ] 更新使用说明，提交文档，交付变更、验证结果与限制；不自动部署或合并其他聊天分支。

## 自审记录
规格各节已分别映射到任务1—5；兼容覆盖任务1/4，失败反馈覆盖任务3/5，五类 Review Focus 都有对应测试。隔离基线已定位，但运行部署是否对应相同提交仍须实施时核对。各模块接口统一，逐任务按测试失败、实现、通过和提交顺序执行。

## 实施结果（2026-10-03）

任务 1—5 的实现已完成，任务 6 的本地自动检查及关键浏览器流程已验证。上方清单保留原计划，不把真实模型和生产存储的未执行检查标为完成。具体结果与范围见 ../content-continuity-validation.md。没有部署或合并其他聊天分支。
