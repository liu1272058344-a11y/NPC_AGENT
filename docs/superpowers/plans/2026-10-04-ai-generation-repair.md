# AI 生成链路排查与修复

目标：类别与数据归属由程序确定，修复响应提取、结构校验、请求快照和生命周期；保留现有 UI、类别名称、供应商、数据库与依赖。

用户已要求直接实施，故方案确认后连续执行，不另设批准环节。

## 修改前的链路与证据

| 检查项 | 现有实现 |
| --- | --- |
| 入口 | `GameContentBuilder.tsx` 的 `send`，`ContentConversation.tsx` 表单发送 |
| 当前设计 | App 的 `selected`，`sessions[selected]`；档案身份为 session.id |
| 设计内容 | session.kind，稳定 ID：world / character / map / scene / prop / clothing；unknown 是旧档案待分类状态 |
| 来源世界 | session.worldId；session.worldSnapshot；界面从 worlds/localWorld 解析 liveWorld |
| 输入与历史 | session.input / session.messages；不同设计分别保存，没有跨类别共用 messages |
| 请求函数与地址 | requestConversationTurn → POST /api/npc；非 server action |
| 原始 payload | phase/provider/model/messages/intent/requestId/world/currentWorld；内容阶段含 contentProfile(category/itemId/name/revision/worldId/design/currentDesign/currentAsset/visualBrief/overrides/intent) |
| 后端 | 本地 routeLocalApi 与 Vercel 共用 api/npc.ts → runNpcRequest → generateContent |
| Prompt | contentGeneration.mjs 根据 contentCategories 的字段、focus、当前设计、世界、上下文构造；历史只含 user/assistant；system 指令禁止切换类型 |
| 模型/API | 原生 fetch，无模型 SDK。默认 DeepSeek deepseek-chat；OpenAI UI 默认 gpt-5。网关普通模型调用 Chat Completions，指定 DeepSeek 新模型调用 Responses |
| 原始响应读取 | llmGateway.mjs：response.text → JSON.parse HTTP body → jsonText；旧 API 分支只读取 output_text |
| 内容解析 | cleanJsonText → JSON.parse；旧 parseJsonOutput 另有截断补括号逻辑 |
| schema/category 校验 | contentGeneration.mjs complete/clarification Zod 联合；category 必须 z.literal(input.category)，design.fields 的键来自该类别配置 |
| 必需字段 | complete：design.name/summary/fields；asset.type/style/objects/composition/palette/lighting/details/format/aspectRatio/promptZh/promptEn/negativePrompt。objects/details 至少一项；negativePrompt 可空。专用 design.fields 可选。clarification：status/question，其余说明与选项可选 |
| 空内容报错 | 网关提取的文本 trim 后为空；旧 API 的 parseJsonOutput 同样在 trim 后为空时报错。不是网络、JSON、schema 错误共用的 catch |
| 类别/字段报错 | 整个联合 schema safeParse 失败，未区分类别 ID、缺字段、非法额外键等具体原因 |
| 流式输出 | 无，Chat 设置 stream:false；Responses 无 stream 参数，读取完整 HTTP 响应 |
| AbortController | UI requests Map 与网关每次调用 timeout controller；卸载取消。取消未与前端友好错误独立处理 |
| 并发 | 不同设计允许并发；同设计 pendingRequest 禁用 UI，但 React 更新前可重复触发，Map 未作为同步锁 |
| 旧结果回写 | completeConversationTurn/failConversationTurn 按 session.pendingRequest.id 保护；缺返回 requestId 校验。正常切换不同设计后不会写入另一档案 |
| 类别字符串 | 主链路一直使用稳定英文 ID，未发现中文 label equality。已有 contentCategories 配置供 dropdown/validator/schema/renderer 共用，无需新建另一份配置 |

## 已证实的缺陷与证据边界

- Responses 主网关只取第一段 output_text；旧 API 只取顶层 output_text。多段输出或标准嵌套结构可被误判为空/非法 JSON。
- 模型再次声明 category，会因缺失或 label 返回而拒绝有效内容；联合校验隐藏字段原因。name/summary 原校验未 trim，空白可通过。
- 同步重复点击存在窗口；请求返回 ID 未校验；点击后重新读取来源世界的远端版本破坏提交时快照。
- OpenAI 主网关使用 JSON mode 与旧 max_tokens 参数；严格 schema 路径有根 anyOf/可选属性，需转成 provider 支持的 object root 和 nullable optional 属性。
- 网关重试最多三次，空响应完全不重试，schema 校验在重试范围之外。
- 尚无本次线上原始响应日志证明某次偶发错误的唯一原因。DeepSeek 官方明确记录 JSON mode 可能偶发空内容；因此在修复提取路径后仍需一次有限重试与日志。

## 最小实施方案与验证

1. 写失败回归测试：模型类别不作为归属、字段路径、Responses 多段/拒绝、空响应有限重试、返回 ID。
2. 内容 schema 移除 category；保留类别专用键与原必需字段，空白文本拒绝；程序补 category/itemId/requestId。旧 category 元数据仅丢弃，不跳过内容校验。
3. 网关统一读取真实响应，区分 EMPTY_RESPONSE/INVALID_JSON/INVALID_SCHEMA/INVALID_MODEL_RESPONSE/MODEL_REFUSAL；OpenAI 对封闭 schema 使用官方 json_schema，nullable optional 清理不触及必需字段。验证纳入同一个两次调用预算。429、400、权限及取消不自动重试。
4. 深拷贝提交会话与世界；请求携带 selectedCategoryId/designId/sourceWorldId；同步 Map 锁、响应 ID 强制核对、旧响应忽略、卸载取消。
5. 记录脱敏 request/model/status/finishReason/长度/时间/schema 路径；不记录 key、原始内容、完整 Prompt、用户消息。
6. 既有 Node 原生测试串行执行（此前已有 SQLite 共享文件测试约定）；npm run lint；npm run build 自带 tsc -b。不存在独立 npm test/typecheck script，不新增工具链。
7. 浏览器 fixture 验证真实前端+真实网关/校验：角色、地图、快速切换、乱序、同步双提交、再次生成、空响应错误；不调用付费模型或写生产数据。
8. 独立审查、修复重大问题、完整复验；按 AGENTS 约定推送 master，由 GitHub→Vercel 发布，核对提交与线上 bundle。

## 文档依据

- https://api-docs.deepseek.com/guides/json_mode/
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://github.com/openai/openai-python/blob/main/src/openai/resources/chat/completions/completions.py
