# 工作室简化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 内容设计在前，统一图片工作台原样接收 Prompt，让用户编辑后直接生成图片。

**Architecture:** 将 ContentWorkspace 限定为设计与档案，将 ContentImageEditor 接入独立 ImageWorkspace。App 通过统一交接状态连接上游与图片页，服饰扩展现有内容契约，世界观复用现有世界编辑器。

**Tech Stack:** React、TypeScript、Node ESM、Zod、现有资产 API、node:test。

**Spec:** ../specs/2026-10-03-studio-simplification-design.md

## Global Constraints

- 基线 master d6ba53b；执行时创建隔离工作树，不修改其他聊天工作树。
- “角色工作室”改为“游戏内容工作室”；移除“美术生产”独立导航。
- 图片工作台不出现内容分类、草稿选择、条目设计或设计 Prompt 生成。
- 一键交接原样传递 Prompt，不追加风格、服装、装备、构图或翻译。
- 保留旧数据、额度和鉴权；不推送、不部署。参考即梦输入布局，不引入参考图、画布或批量生成。

## Review Focus

- 重复进入图片页不得重新消费旧交接覆盖用户编辑（任务2、4）。
- 新交接发生时有未提交文本或未保存图片，取消后保留原状态（任务2、3）。
- 旧 NPC 只有叙事字段，不能用固定服饰模板冒充视觉 Prompt（任务4）。
- 来源档案已失效，输入和图片仍保留，可以改为独立保存（任务3）。
- 旧草稿缺字段或未命名，有内容可以恢复，空白项不污染主要选择列表（任务5）。

### Task 1: 服饰类别和持久化兼容

**Files:** src/content/categories.mjs、categories.d.mts；src/server/contentGeneration.mjs；src/components/CreationWorkspace.tsx；tests/content-clothing.test.mjs、tests/content-archive.test.mjs。
**Interfaces:** ContentCategory 新增 'clothing'；contentCategories.clothing 字段为 purpose、wearer、structure、materials、palette、presentation。世界观保留 'world'，不混入普通内容生成 API。

- [ ] 写失败测试：assert.equal(categoryLabel('clothing'),'服饰')；分类识别显式 clothing；generateContent({category:'clothing',...}) schema 接受服饰字段、没有强制人物字段；档案保存重读和列表筛选保持类别及稳定 ID。
- [ ] 运行 node --test tests/content-clothing.test.mjs tests/content-archive.test.mjs，确认新增断言失败。
- [ ] 扩展类别、类型、校验文案与世界交接选项；服饰 focus 明确适用对象可以非人或无人展示。检查现有 JSONB 类别索引，无需约束迁移时不引入空迁移。
- [ ] 运行上述测试及 content-migration、content-generation 测试，通过后定向提交。

### Task 2: 统一 Prompt 交接与保护状态

**Files:** 新增 src/content/studioHandoff.mjs、.d.mts；tests/studio-handoff.test.mjs。
**Interfaces:** createStudioHandoff({prompt,negativePrompt?,source?,target?},idFactory?): StudioHandoff，包含 id、原文、source、target；receiveStudioHandoff(state,incoming,decision?): {state,needsDecision}。state 含 consumedId、pending、prompt、negativePrompt、source、target、dirty、hasUnsavedImage；decision 为 replace 或 cancel。

- [ ] 写失败测试：assert.equal(createStudioHandoff({prompt:'  古树\n水彩  '}).prompt,'  古树\n水彩  ')；拒绝纯空白；同 consumedId 不改已编辑 prompt；dirty 或 hasUnsavedImage 返回 needsDecision；cancel 保持原文字和图像标记；replace 消费新 id。
- [ ] 运行 node --test tests/studio-handoff.test.mjs，确认接口缺失导致失败。
- [ ] 实现原文交接和一次消费状态；不访问模型、不自动追加任何提示词，不修改现有图片快照接口。
- [ ] 运行测试通过后定向提交。

### Task 3: 独立简洁图片工作台

**Files:** 新增 src/components/ImageWorkspace.tsx；修改 ContentImageEditor.tsx、src/App.css；tests/content-image-operation.test.mjs、tests/content-image-request.test.mjs。
**Interfaces:** ImageWorkspace({handoff,onHandoffConsumed,provider,model,endpoint}) 持有页面会话与已有保存目标；ContentImageEditor 使用任务2的交接状态、现有 captureImageRequest 和 imageSavePayload；图片请求与来源快照接口保持兼容。

- [ ] 补充失败测试：实际 Prompt 空白与非空判定、生成中禁止保存、保存中禁止生成；失效 target 不能误绑定其他档案，切换独立后允许保存；现有请求快照保留生成原文。
- [ ] 运行 content-image-operation、content-image-request、studio-handoff 测试确认新增行为失败。
- [ ] 实现大文本输入和紧凑模型/尺寸/生成操作，反向提示词折叠，图片结果与保存区域独立。带入来源默认关联、手写默认独立；保存归属只在结果区域。新交接显示“继续编辑当前内容”或“使用新提示词”，取消不丢原图。App 保持该组件会话跨导航存活，退出登录时遵循现有鉴权生命周期。
- [ ] 定向测试、npm run build；浏览器确认无分类/草稿/新建表单，纯手写可生成，保存失败可重试，原文保存正确，再提交。

### Task 4: 导航合并与上游一键交接

**Files:** src/App.tsx、src/components/CreationWorkspace.tsx、src/components/ContentWorkspace.tsx、src/agent/creationImageHandoff.mjs、.d.mts；tests/creation-image-handoff.test.mjs、tests/studio-navigation.test.mjs。
**Interfaces:** App 的 openImageWorkspace(handoff:StudioHandoff) 统一导航；ContentWorkspace 新增 onUseForImage(handoff)；上游 world/legacy NPC 无 Prompt 时转游戏内容工作室的显式设计步骤，已有 Prompt 使用 createStudioHandoff。world 档案编辑继续路由 World Builder。

- [ ] 写失败测试：navLabels 不含独立美术生产且角色入口为游戏内容工作室；源视觉 Prompt 原文直传；旧 NPC 无视觉 Prompt 返回待设计状态，无固定服饰模板；世界视觉方向仍进入上游生成上下文；游戏设定 pipelineResult.visual.visual_prompt 原文可交接。
- [ ] 运行 creation-image-handoff、studio-navigation 测试，确认现有模板/导航断言失败。
- [ ] App 图片页独立渲染 ImageWorkspace；旧 Visual Production 内部导航映射设计工作室，移除重复图片表单。世界、内容条目、游戏设定结果、资产库 Prompt 的按钮均通过统一交接。上游显示生成步骤，不在点击交接后再次分类或生成提示词。
- [ ] 定向测试及 build；浏览器逐来源确认按钮直达已填文本，再定向提交。

### Task 5: 游戏内容工作室与旧草稿恢复

**Files:** src/components/ContentWorkspace.tsx、ContentItemDetail.tsx；新增 src/content/draftCatalog.mjs、.d.mts；tests/content-draft-catalog.test.mjs。
**Interfaces:** draftCatalog(drafts): {named, recoverable}，named 含非空名称，recoverable 含未命名但具有 requirements/fields/asset/design 的项；空白未命名草稿保留存储但不展示。ContentWorkspace mode 收窄为 studio|library，新增世界观入口复用 onCreateWorld/onEditCreationArchive。

- [ ] 写失败测试：未命名空白项不在 named/recoverable；有需求旧草稿在 recoverable；命名后在 named，ID 不变；类别选择不调用 create，新建动作才创建 ID。
- [ ] 运行 content-draft-catalog、content-draft-state 测试，确认缺失目录策略导致失败。
- [ ] 工作室提供角色、地图、场景、道具、服饰及世界观入口；切类别只切视图，明确新建才产生草稿；已有档案列表和可展开恢复草稿入口。从旧角色查看入口进入可编辑内容工作室，旧叙事资料保留；缺 Prompt 的世界/角色进入对应上游生成步骤。保留未保存切换保护。
- [ ] 定向测试及旧档案恢复测试，浏览器确认没有一串未命名草稿、不丢旧资料，然后提交。

### Task 6: 整体回归、审查与说明

**Files:** README.md、docs/superpowers/studio-simplification-validation.md；必要的上述模块修复。

- [ ] 运行 node --test --test-concurrency=1 tests/*.test.mjs、npm run build、npm run lint、git diff --check，记录真实结果与警告。
- [ ] 浏览器验证六类入口、上游 Prompt 交接、纯手写、编辑后生成、取消新交接、独立/来源保存、失效来源、刷新、生成/保存失败；模拟服务明确标记，不调用付费服务来替代本地验证。
- [ ] 进行一次独立整体代码审查，处理有依据的问题，复跑受影响测试。
- [ ] 更新 README 和验证范围，提交；按收尾技能提供本地合并/PR/保留分支选项，等待用户选择，不部署。

## 自审

规格导航与职责映射任务1/4/5，图片简化映射任务3，交接与编辑保护映射任务2/4，兼容和保存映射任务1/3/5，验收映射任务6。接口统一使用 StudioHandoff，保存沿用现有 ImageArchiveTarget 与快照；不新增资产服务。五项 Review Focus 均有测试或浏览器步骤。

## 执行方式

沿用此前本会话的原生执行方式：主 agent 逐任务实现，最后一次独立审查；不按任务派遣多个实现者。计划待用户审阅后执行。
