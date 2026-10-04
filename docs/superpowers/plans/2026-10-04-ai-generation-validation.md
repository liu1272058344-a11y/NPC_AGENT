# AI 生成修复验证记录

2026-10-04；基线 f23575d。完整排查见同目录 `2026-10-04-ai-generation-repair.md`。

## 验证结果

- `node --test --test-concurrency=1 tests/*.test.mjs`：264 通过，0 失败。
- `npm run build`：通过；包含现有 `tsc -b` 类型检查和 Vite 构建。
- `npm run lint`：通过，0 错误，8 条既有警告；不修改无关 UI 模块消除警告。
- `git diff --check`：通过。
- 项目没有独立 test/typecheck npm script；沿用既有 Node 原生测试，不安装测试框架。
- 首次并行全套测试出现一次共享 SQLite `database is locked`（orchestrator unknown-agent 测试）；沿用项目既有串行运行约定后通过，不修改数据库实现。

## 场景与证据

| 场景 | 证据 |
| --- | --- |
| 角色请求 ID/类别与正确模块归属 | ai-generation-regressions + content-generation + 浏览器 |
| 地图不继承上次角色类别 | 快照回归 + 浏览器 |
| A/B 快速切换保持类别/世界/输入快照 | snapshot 回归 + 浏览器 |
| A 慢 B 快，旧响应不覆盖 B | 会话回归 + 浏览器（A/B 两档案独立） |
| 空字符串 | EMPTY_RESPONSE，一次重试后成功/最终失败 |
| 错误字段路径/异常嵌套 | INVALID_MODEL_RESPONSE；不误报空响应或网络错误 |
| malformed JSON | llm-gateway INVALID_JSON，两次上限 |
| 缺字段/空白名称/空白摘要 | INVALID_SCHEMA，脱敏 issues 保留具体路径 |
| 正确内容、不同中文 category 元数据 | 类别由程序补充，内容依旧经过严格专用 schema |
| 专用字段属于其他类别 | 严格拒绝，包括额外 null 字段 |
| timeout | PROVIDER_TIMEOUT，独立错误类型 |
| 主动 AbortController | REQUEST_ABORTED，无空内容报错 |
| 429 JSON/HTML/纯文本 | PROVIDER_RATE_LIMITED，不自动重试 |
| 字段重试失败→成功/两次都失败 | 同一业务上下文、共享两次调用预算 |
| 同一帧连续提交 | 浏览器表单同步提交两次，只发出一条请求 |
| 第二次生成 | 浏览器更新同一设计，无跨档案串线 |
| 空响应后的 UI | 专门提示，保留上次成功的设计 |
| OpenAI strict schema | object root、所有属性 required、可选值 nullable、max_completion_tokens；必需 null 与未知键不补内容、不抹除 |

浏览器验收用临时隔离的 Edge headless 浏览器。前端 Vite、runNpcRequest、generateContent、llmGateway、Zod 校验均为真实代码；HTTP 模型响应采用本地 fixture，不调用付费模型、不读写生产数据库。

## 独立审查

- 只读独立 reviewer 检查完整修改，无 Critical。
- Important：非 JSON HTTP 429 被误分类；写失败测试后修复并验证。
- 另修正 malformed Responses envelope 类型检查、旧请求元数据回写保护。
- 自检发现 nullable optional 适配可能删除未知 null 键；失败测试复现后限制清理为已声明的可选字段，严格拒绝其他类别键。
- 尚未进行真实付费模型调用；官方 provider 对配置模型的实际接受情况与偶发输出概率需要生产日志持续确认。无本次历史线上 raw response，不能宣称某一次报错必然由某个原因触发。

## 发布

按 AGENTS 授权推送 master 后，沿用 GitHub → Vercel 生产部署，核对 deployment 的 githubCommitSha 和线上资源 hash；部署证据在最终报告中记录。
