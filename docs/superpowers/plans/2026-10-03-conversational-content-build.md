# 对话式构建与档案归类 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 合并游戏设定与世界构建，用持续 AI 对话生成游戏内容及 Prompt，并以清晰的档案、图片和草稿视图整理成果。

**Architecture:** 对话会话状态和生成契约独立于 UI；GameContentBuilder 组合世界对话与内容对话、结果预览和现有 Pipeline。ArchiveBrowser 复用既有资产服务，对内容/图片/草稿提供一致视图，详情使用分区切换；App 只处理导航和统一生图交接。

**Tech Stack:** React、TypeScript、Node ESM、Zod、现有 JSONB 资产元数据、node:test。

**Spec:** ../specs/2026-10-03-conversational-content-build-design.md

## Global Constraints

- 执行基线 master e9f563d 后的计划提交；创建独立 codex/ 分支工作树，不修改其他聊天工作树或未跟踪 tmp/。
- 游戏设定和世界构建合并为“游戏内容构建”；工作室只整理成果，不重复出现长表单。
- 连续对话一轮最多询问 2—3 个关键问题；建议标为 AI 建议，不伪造已确认资料或旧对话。
- 无需先填名称开始对话，保存档案仍要求非空名称；角色不默认限定为人类。
- 文生图原文交接、稳定 ID、不可变历史、存储额度、鉴权和图片期限保持兼容。
- 旧 Pipeline、世界、NPC、内容草稿、Prompt 和图片仍可读取。不推送、不部署，不新增自动删除或批量生成。

## Review Focus

- 失败重试不能重复追加用户消息，旧请求不能写进另一会话（任务2）。
- 当前世界被删除或读取失败，不能把缓存世界当最新事实，也不能把原关系改写为独立（任务2/4/6）。
- 同名记录和未知旧类型不能被合并或自动分类；图片素材不能成为重复存储（任务5/6）。
- 旧 NPC 没有 design.fields 或对话记录，仍需显示原字段且不伪造消息（任务2/6）。
- 世界与内容切换、导航离开及刷新后会话可恢复；部分生成结果不替换已确认字段（任务1/2/4）。

### Task 1: 内容对话契约和修订语义

**Files:** src/server/contentGeneration.mjs、src/server/npcWorkflow.mjs、src/agent/npcCreator.ts；tests/content-conversation.test.mjs、tests/content-generation.test.mjs、tests/world-schema-validator.test.mjs。
**Interfaces:** generateContent 接收 messages?:{role:'user'|'assistant',content:string}[]、currentDesign?、currentAsset?、intent?:'create'|'revise'、requirements 兼容字段、name?；响应保留现有字段，增加 assistantMessage?:string、suggestions?:string[]。无历史旧调用沿用 requirements；两者均无有效用户内容才拒绝。当前档案名称可以缺省，结果 design.name 必须非空。

- [ ] 写失败测试：未命名但有用户消息的请求有效；LLM 接收到两轮真实历史；修订 instructions 包含完整当前设计并要求保留未改内容；原单次请求仍有效；空消息/伪造 role 拒绝；返回澄清问题及可选答案、完整结果附说明，两种 schema 均保持 category。
- [ ] 运行 node --test tests/content-conversation.test.mjs tests/content-generation.test.mjs，确认新增行为失败。
- [ ] 实现消息白名单与非空校验，限制 schema 支持字段；转发真实历史而非拼成单段 requirements。说明可缺省时由客户端以真实结果摘要展示，不要求旧模型必须返回新增字段。instructions 指定关键澄清、允许用户请求建议并明确标注、世界继承、非人角色、保留确认资料。world workflow 引导加入玩法用途和视觉方向，不破坏旧七字段校验。
- [ ] 运行该组及 npc workflow 相关现有测试、npm run build，通过后定向提交。

### Task 2: 可恢复会话与档案适配

**Files:** 创建 src/content/conversationSession.mjs、.d.mts、src/content/conversationApi.mjs、.d.mts；tests/conversation-session.test.mjs、tests/conversation-api.test.mjs；src/content/archiveState.mjs、.d.mts。
**Interfaces:** ConversationSession 含 id、kind:'world'|ContentCategory、worldId、worldSnapshot?、messages:{id,role,content}[]、input、name、revision、design?、asset?、context?、status:'draft'|'saved'|'dirty'、pendingRequest?、error?；beginConversationTurn(session,text,requestId) 保留唯一用户消息；completeConversationTurn(session,requestId,result) 仅应用对应请求；failConversationTurn 保留消息和结果；retryConversationTurn 复用失败消息；sessionFromArchive(detail) 不编造历史；conversationArchivePayload(session) 保留原字段、会话元数据、Prompt 快照。

- [ ] 写失败测试：两次重试只有一条用户消息；失败保留 input 和 asset；旧 requestId 不改结果；同名不同 ID 分开；保存/恢复消息与来源；旧 NPC 的背景/人格/目标进入资料而 messages 为空；旧草稿有 requirements/asset 可恢复、空白隐藏；缺失世界保留 worldId 和 unavailable 状态。
- [ ] 运行 node --test tests/conversation-session.test.mjs tests/conversation-api.test.mjs tests/content-resume.test.mjs，确认接口缺失失败。
- [ ] 实现纯状态辅助模块与同源 API 适配，沿用请求 guard/AbortSignal；存储键 npc-forge-conversation-sessions-v1，读取清除运行中标记但保留失败重试信息。旧草稿只读适配，使用原 ID；只有用户续写才存新会话。不把旧来源缓存替代真实 world list。
- [ ] 运行上述及 content-draft-state、content-image-request 测试，通过后定向提交。

### Task 3: 对话与结果预览 UI

**Files:** 创建 src/components/ContentConversation.tsx、src/components/ContentResultPreview.tsx；修改 src/App.css；任务2测试补充结果适配断言。
**Interfaces:** ContentConversation({session,onSend,onRetry,onInputChange,onSuggestion,busy}) 渲染真实消息、选项和单输入区；ContentResultPreview({session,onEdit,onSave,onUseForImage}) 展示结果、详细资料与主操作。保存与生图使用当前 session ID/版本，中文/生图文本选择不更改历史版本。

- [ ] 补充失败测试：澄清/成功结果都能生成非 JSON 的可展示说明，用户输入仍原样；预览为空时无保存/生图动作；选择语言后交接 exact prompt，快照包含当前来源。
- [ ] 运行相关会话和交接测试观察失败。
- [ ] 实现 AI/用户消息、可选答案及“让 AI 建议”明确输入；输入框底部、发送与重试互斥，失败可恢复。结果仅在生成后出现，默认摘要与当前 Prompt；字段/标签/反向词/继承来源折叠，编辑通过版本更新辅助接口。统一深色控件、焦点状态、留白，桌面双区、窄屏单列，操作区换行。
- [ ] 定向测试和 build；浏览器检查无名称前置、无空 Prompt 表单、问题/回答/修订可连续进行，再提交。

### Task 4: 统一游戏内容构建与导航

**Files:** 创建 src/components/GameContentBuilder.tsx；修改 src/App.tsx、src/content/studioNavigation.mjs、.d.mts、src/components/CreationWorkspace.tsx；tests/studio-navigation.test.mjs、tests/builder-navigation.test.mjs。
**Interfaces:** resolveStudioPage 将 Game Design 和 World Builder 映射同一 builder；导航 World Builder label 为“游戏内容构建”，不再单列 Game Design。GameContentBuilder 持有会话目录、当前世界、类型菜单和 Pipeline 次要入口，接收 initialArchive/initialSessionId，提供 onUseForImage(StudioHandoff)、onWorldChange、onArchiveSaved。

- [ ] 写失败测试：主导航只有一个构建入口，旧两个 ID 都可访问；世界选择内容后直接进入指定 kind 会话并带 stable worldId；Pipeline 结果可转预览和原文交接，不能与对话同时重复启动请求；离开/返回会话保留消息和未保存结果。
- [ ] 运行 builder-navigation、studio-navigation、world-character-navigation 测试确认失败。
- [ ] 统一构建页：世界与玩法对话复用现有 world workflow，具体五类内容使用任务1/2接口；集中设计菜单替换成排类型按钮。旧 NPC 打开为角色会话并保留原资料；旧 CreationWorkspace 限于兼容字段编辑，不再作为独立主流程。App 删除或迁移已不可达的重复旧游戏设定/美术/图片 JSX，避免留两套生成入口。Pipeline 显式按钮保留，使用既有 runPipeline，一次请求后导入结果，不自动生成第二次。
- [ ] 定向测试及 build；浏览器验证世界/玩法对话、五类选择、切换保护、刷新恢复和一键交接，再提交。

### Task 5: 档案目录的归类与图片视图

**Files:** 创建 src/content/archiveCatalog.mjs、.d.mts；src/agent/contentLibrary.mjs、.d.mts；创建 src/components/ArchiveBrowser.tsx；tests/archive-catalog.test.mjs；src/agent/assetApi.mjs、.d.mts 如需要追加只读图片目录。
**Interfaces:** buildArchiveCatalog({worlds,archives,sessions},filters) 返回 content、independent、unorganized、drafts、counts；getArchiveImages(api,archiveIds) 使用现有 getRemoteArchive 获取图片并按 image.id 去重，可分批并隔离失败；filters 包含 view:'content'|'images'|'drafts'、category、worldId、status、query。图片卡片保留 archiveId/promptRecordId。

- [ ] 写失败测试：六类计数随世界筛选一致；独立手写图片根据明确 origin/无内容设计进入 independent，未知旧记录进入 unorganized；同名 ID 不合并；草稿以摘要区分、空白排除；图片 ID 去重而非 archiveId；单个详情失败不丢其他已加载图片；筛选 unknown 不自动改变元数据。
- [ ] 运行 node --test tests/archive-catalog.test.mjs tests/content-library.test.mjs，确认新增断言失败。
- [ ] 实现纯目录与浏览器：三主视图“内容档案/图片素材/草稿”，世界与类型筛选集中，搜索/状态作为工具栏。内容卡片显示类型/世界/更新时间/状态；图片按单张显示来源与原请求入口，不额外保存记录。独立图片与待整理有清楚分组。草稿只读旧存储和新会话，保存后更新状态，继续打开指定会话。
- [ ] 定向测试、build；浏览器核对归类/搜索/空状态/部分失败及草稿恢复，通过后提交。

### Task 6: 档案详情与成果页集成

**Files:** src/components/ContentItemDetail.tsx、创建 src/components/WorldArchiveDetail.tsx、src/components/ContentWorkspace.tsx、src/App.tsx；src/content/archiveState.mjs、.d.mts；tests/archive-detail.test.mjs、tests/content-archive.test.mjs。
**Interfaces:** detailSections(detail) 返回 designFields、conversation、prompts、images、sourceStatus；旧 NPC 无 design.fields 时使用显式字段标签映射；WorldArchiveDetail({world,related,onContinue})；ArchiveBrowser 的 onContinue(id,kind) 导航对应 builder 会话，onUseForImage 沿用统一交接。

- [ ] 写失败测试：旧 NPC 背景、目标、人格、行为仍可见，历史 conversation 不虚构；世界详情含所有关联内容而非仅角色；来源失败不显示“暂不关联世界”；管理改类别/名称仍保留稳定 ID 与图片；历史 Prompt 按选定版本带入，不被最新覆盖。
- [ ] 运行 archive-detail、content-archive、content-resume 测试，确认失败。
- [ ] 实现设计资料/Prompt版本/图片三分区，详情管理折叠，删除远离主操作且沿用确认；世界档案可继续构建和查看关联内容。游戏内容工作室成为 ArchiveBrowser 成果视图，资产库显示相同组件完整视图，不再维护旧设计表单。继续设计交给任务4，图片交接沿用 snapshot。保持类型调整与图片管理现有 API。
- [ ] 定向测试、build；浏览器验证旧世界/NPC、历史 Prompt、独立图片、重命名与关联恢复，通过后提交。

### Task 7: 整体回归与交付

**Files:** README.md、docs/superpowers/conversational-content-validation.md；必要的上述模块修复。

- [ ] 运行 node --test --test-concurrency=1 tests/*.test.mjs、npm run build、npm run lint、git diff --check，确认真实输出。
- [ ] 本地模拟服务浏览器验证从一句游戏想法、世界确认、类型选择、澄清、多轮修订、建议、保存、归类、继续设计、刷新、手写/带入生图与保存失败恢复。旧数据用固定旧资料验证，桌面/窄屏检查按钮与输入布局。真实模型/生产存储未执行则明确记录。
- [ ] 按 executing-plans 做一次独立全分支审查；Critical/Important 修复补充先失败再通过的回归，Minor 记录，不反复派遣实现者。
- [ ] 更新说明、验证范围、计划状态和 ledger，定向提交；使用收尾技能等待本地合并/PR/保留分支选择，不自动发布。

## 自审与接口衔接

规格对话语义映射任务1/2，界面映射3/4，归类映射5，详情兼容映射6，验收映射7。任务1/2共享 messages/currentDesign/assistantMessage，任务2/3/4共享 ConversationSession，任务4/6共享 initialArchive 与统一 StudioHandoff，任务5/6共享目录与稳定 ID；签名一致。五项 Review Focus 均有归属测试和浏览器验证。图片视图复用读取，不新增重复存储；世界内容继承仍依真实可用世界数据。

## 执行方式

沿用原生执行：主 agent 逐任务实现，最后一次独立审查。计划待用户审阅后执行。
