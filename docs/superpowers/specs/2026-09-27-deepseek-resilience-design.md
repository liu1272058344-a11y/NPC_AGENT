# NPC Forge DeepSeek 调用链韧性设计

## 目标

在保留 NPC Forge 现有世界观、NPC、内部质量评审和美术资源规划功能及 UI 的前提下，重构模型调用边界，系统性解决 DeepSeek 空响应、截断或非法 JSON、错误状态、无差别重试、重复提交和旧响应覆盖新状态的问题。

本次改造不把 provider 故障伪装成业务成功，不用默认内容修补模型缺失字段，也不进行与调用可靠性无关的 UI 或产品重构。

## 当前调用链与根因

项目目前有三套并行实现：

1. `src/agent/npcCreator.ts` 从浏览器直连 DeepSeek/OpenAI，或调用后端。
2. `server.mjs` 为本地开发提供 DeepSeek/OpenAI 调用和生成—评审—修订循环。
3. `api/npc.ts` 为托管环境提供一套独立的 OpenAI 调用和相似但不相同的业务验证。

“模型返回了无效的创建状态”来自 `src/agent/npcCreator.ts` 的 `sanitizeCreatorReply`。该错误不是根因，而是所有缺少合法 `status` 的对象最终汇合到的兜底错误。其上游可能是空 content、错误响应体、被猜测性修复的截断 JSON、错误阶段输出或缺字段结果。

当前实现的具体问题：

- 三套调用路径的 prompt、schema、重试、模型参数和错误处理不一致。
- Chat Completions 响应没有检查 `finish_reason`，无法区分正常结束、token 截断和内容过滤。
- 空内容、非法 JSON 和 HTTP 故障被混入普通异常，前端只能显示笼统文案。
- 截断 JSON 会被追加括号尝试修复，可能产生表面可解析但语义残缺的对象。
- 浏览器直连没有超时或取消，对不可恢复错误也会重试。
- 本地后端不会重试 429/5xx，但空内容可能触发多次无退避请求。
- 模型生成的 `status` 被直接用于业务状态切换。
- React 状态更新不能提供同步互斥；没有 request ID，旧响应可以覆盖新状态。
- 世界观和 NPC 的默认值补全可能掩盖无效成功结果。

## 方案选择

采用唯一服务端 LLM Gateway。浏览器只调用 NPC Forge API，不再解析 provider 原始响应。Gateway 是所有 DeepSeek/OpenAI 请求的唯一入口，本地 Node 服务和托管函数复用同一实现。

未采用以下方案：

- 分别强化三套现有实现：改动较小，但重复逻辑会继续漂移。
- 只切换 DeepSeek Responses API：能改善结构化输出，却不能解决前端竞态、错误分类和重复后端实现。

## 目标架构

调用链如下：

```text
React UI
  -> NPC Forge API client（请求锁、取消、requestId）
  -> /api/npc（本地或托管入口）
  -> 请求与业务阶段校验
  -> 生成/评审工作流
  -> 唯一 LLM Gateway
  -> DeepSeek Responses / Chat Completions 兼容适配器，或 OpenAI adapter
  -> provider 状态检查
  -> 严格 JSON 解析
  -> Zod schema 校验
  -> 领域结果
  -> 应用状态转换
  -> 稳定公开响应
```

本地 `server.mjs` 和托管 `api/npc.ts` 只负责 HTTP 适配、配置读取和调用共享服务，不再各自实现 provider 解析或业务校验。

## 模块边界

### 共享 schema

使用 Zod 定义并导出以下领域结构：

- `WorldProfile`
- `NpcProfile`
- `ArtAssetPrompt`
- `ClarificationResult`
- 世界观、NPC、美术生成结果
- 内部评审结果
- API 请求与公开响应

schema 负责结构、非空字符串、数组最小长度和 discriminated union 校验。模型输出缺字段、空字段或阶段不匹配时返回 schema 错误，不填默认值。

用于 provider structured output 的 JSON Schema 从同一领域定义生成，避免运行时验证和请求 schema 漂移。

### LLM Gateway

Gateway 接收 provider、model、instructions、messages、JSON Schema、请求 signal 和诊断上下文，返回已验证前的结构化候选值，或抛出类型化错误。

Gateway 负责：

- provider 请求格式适配；
- 请求超时和调用方取消；
- HTTP 状态和 provider 结束状态检查；
- 输出文本提取；
- 空内容检测；
- 严格 JSON 解析；
- 可恢复错误的有限重试；
- 开发环境脱敏日志。

Gateway 不负责世界观/NPC 状态转换，也不生成 UI 文案。

### 生成与评审工作流

现有生成—内部评审—最多两次修订的产品行为保留。每次生成、评审和修订调用都经过 Gateway 和对应 schema。

模型输出不再拥有最终应用状态：

- 世界观请求中，通过 `ClarificationResult` 校验则由程序映射为 `needs_clarification + world`；通过完整世界观 schema 则映射为 `world_ready + world`。
- NPC 请求中，通过 clarification schema 则由程序映射为 `needs_clarification + npc`；通过完整 NPC schema 则映射为 `complete + npc`。
- 美术请求只有完整资源 schema 能映射为 `complete + asset`。

因此模型即使输出错误 `status`，也不能直接改变应用阶段。

## DeepSeek 协议策略

优先使用 DeepSeek 当前 Responses API 的 `json_schema` structured output，并检查顶层 `status`：

- `completed`：继续提取 output text。
- `incomplete` 且原因为 `max_output_tokens`：分类为输出截断。
- `incomplete` 且原因为 `content_filter`：分类为内容过滤。
- `failed`：使用 provider error 分类。
- 缺少输出文本：分类为空响应。

对于仍使用仅支持 Chat Completions 的配置，保留明确的兼容适配器：使用 `json_object`，检查 `finish_reason`，且仍执行严格 JSON 和 Zod 校验。`finish_reason=length` 和 `content_filter` 不进入普通 JSON 解析流程。

不会用追加括号、删除尾部内容或默认字段的方式修复截断输出。

## 错误模型

服务端使用稳定错误码，至少包含：

- `PROVIDER_EMPTY_RESPONSE`
- `PROVIDER_INVALID_JSON`
- `PROVIDER_SCHEMA_MISMATCH`
- `PROVIDER_OUTPUT_TRUNCATED`
- `PROVIDER_CONTENT_FILTERED`
- `PROVIDER_RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_TIMEOUT`
- `REQUEST_ABORTED`
- `INVALID_REQUEST`
- `CONFIGURATION_ERROR`
- `INTERNAL_ERROR`

公开错误响应包含 `code`、适合用户显示的 `message`、`retryable` 和 `requestId`。provider 原始正文、API key、Authorization header、完整 prompt 和完整用户内容不返回前端。

HTTP 映射遵循：输入错误为 400，取消为 499（运行环境不支持时使用 408），超时为 504，provider 限流为 429，provider 故障为 502/503，其余内部错误为 500。

## 重试、超时与取消

每次 provider 调用最多 3 次总尝试，即首次调用加最多 2 次重试。

仅以下错误可自动重试：

- HTTP 429；
- HTTP 500、502、503、504；
- 网络连接失败；
- 请求超时；
- provider 返回空内容。

非法请求、认证失败、内容过滤、输出截断、非法 JSON、schema 不匹配和业务校验失败不自动重试。

退避采用指数增长加 jitter，并允许测试注入 sleep/random，确保测试快速且确定。服务端为每次 provider 尝试设置明确超时；客户端取消通过 signal 传播到后端允许的边界。取消后不得启动新重试。

## 前端并发与状态

NPC 创建和美术资源生成分别维护当前请求：

- 点击处理函数在发起请求前用 ref 同步加锁，防止 React 状态尚未提交时的重复点击。
- 新的显式请求会取消同一流程的旧请求。
- 每个请求带唯一 request ID；只有当前 ID 的响应可以更新 state、localStorage、错误或 loading。
- `finally` 仅能清理属于自身 request ID 的 loading 状态。
- 按钮在请求中禁用；重试按钮也遵守相同互斥规则。
- 组件卸载时取消活动请求。

前端只消费稳定 API 响应。`normalizeWorld` 和 `normalizeNPC` 不再给新响应补默认字段；服务端验证通过的数据可做无损 trim，但缺字段必须失败。旧 localStorage 数据可独立做兼容读取，不能影响新生成结果的严格性。

## 开发诊断日志

仅开发环境记录结构化诊断事件：

- request ID；
- provider、model、业务阶段和调用类型；
- 尝试序号、耗时、HTTP 状态、provider finish/status；
- 输出字符数；
- 规范化错误码和是否重试。

日志不包含 API key、Authorization header、完整 prompt、完整模型输出或完整用户消息。生产环境默认不输出这些诊断信息。

## 测试策略

先写失败测试，再实现对应行为。测试至少覆盖：

- 正常 JSON 和正常 structured output；
- 空字符串、空白、`null` content 和缺失 output；
- 非法 JSON、截断 JSON、缺字段和空字段；
- Chat Completions 的 `finish_reason=length`、`content_filter`；
- Responses API 的 `incomplete`、`failed`；
- 429、500、503、网络失败和 timeout；
- 可恢复错误在后续尝试成功；
- 三次总尝试后失败；
- 不可恢复错误不重试；
- 调用方取消后不重试；
- 模型 status 不控制最终应用状态；
- 前端重复点击只产生一个有效请求；
- 旧响应不能覆盖新请求状态；
- NPC、世界观和美术资源流程保持现有公开契约；
- 开发日志不泄露密钥和完整内容。

最终运行项目测试、typecheck/build、lint，并单独执行 Node 语法检查。若 lint 存在改造前就有的警告，也应在结果中明确区分；本次触及文件中的新增警告必须清零。

## 兼容性和迁移

- 保留现有 UI 页面、阶段流程、内部评审和修订次数。
- API 设置 UI 保留 provider/model/key 的测试能力，但请求统一发往 NPC Forge 后端；临时用户 key 只随当前 HTTPS 请求传递，不写入服务器、不进入日志。
- 本地默认仍读取 `.env.local`；托管环境读取平台环境变量。
- 后端必须拒绝未知 provider 和与 provider 不兼容的 model，不做静默模型替换。
- 现有公开成功响应形状保持兼容；错误响应升级为结构化错误。

## 非目标与剩余风险

本次不改变 NPC Forge 的产品文案、视觉设计、质量评审标准或新增业务功能。

架构改造不能消除 DeepSeek 自身的限流、服务中断、内容过滤或偶发空响应。它能保证这些故障被正确识别、只在安全条件下有限重试、不会污染业务状态，也不会以成功结果呈现给用户。
