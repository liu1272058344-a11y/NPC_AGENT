# React + TypeScript + Vite

## Remote image asset storage

Generated images are persisted in Vercel Blob and indexed in Neon Postgres. Each anonymous browser workspace may keep up to 20 images or 100 MB. Images expire 30 days after saving and the daily Vercel Cron removes expired objects.

Configure `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, and `CREDENTIAL_SESSION_SECRET` from `.env.example`, then apply the SQL files in `db/migrations` to Neon in numeric order before deployment. Migration `003_content_categories.sql` adds worlds plus immutable Prompt/design snapshots for character, map, scene, and prop assets. The browser stores only small identifiers and editable draft text; image bytes and Base64 data are never stored in localStorage.

After deployment, request `GET /api/health`. A ready deployment returns HTTP 200 with all service statuses set to `ready`; an incomplete deployment returns HTTP 503 and identifies only the unavailable capability. The response never includes environment-variable names, connection strings, tokens, or other secret values.

The asset library requires both the database migration and Blob storage. If either dependency is absent, the UI reports that deployment configuration is incomplete instead of presenting the library as empty.

The production smoke check must cover save, refresh/list, archive tabs, zoom, download, delete, quota rejection, and one authorized cleanup request.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
# 内测访问与免费额度保护

生产部署默认采用应用层内测口令保护。部署前必须在 Vercel 配置以下环境变量：

- `INTERNAL_BETA_PASSWORD`：普通测试者共用口令，至少 12 位随机字符。
- `INTERNAL_BETA_ADMIN_PASSWORD`：独立管理员口令，至少 12 位且不得与测试口令相同。
- `INTERNAL_BETA_SESSION_SECRET`：至少 32 位的随机会话签名密钥。
- `INTERNAL_BETA_MAX_IMAGES`：项目图片硬上限，默认 `200`。
- `INTERNAL_BETA_MAX_BYTES`：项目 Blob 字节硬上限，默认 `1073741824`（1 GiB）。
- `INTERNAL_BETA_DAILY_ACTIONS`：全项目每日成本操作熔断值，默认 `30`。

首次部署前在 Neon 按编号依次执行 `db/migrations/001_remote_asset_library.sql`、`002_internal_beta_guardrails.sql` 和 `003_content_categories.sql`。未应用迁移时，相关写入或成本操作会失败关闭，不会绕过额度继续调用上游服务。

该机制不限制每分钟请求数或并发数，也不会改写 Prompt、切换模型、减少审查轮次、降低图片分辨率或压缩图片。达到每日或存储硬上限后，会直接拒绝新的成本操作；读取、下载和删除仍可继续。

管理员登录后可在页面右下角查看应用内总用量。平台级用量仍应定期在 Vercel Usage 和 Neon 控制台检查。轮换口令时更新对应环境变量并重新部署；轮换 `INTERNAL_BETA_SESSION_SECRET` 会立即使全部旧会话失效。

## 对话式游戏内容构建

游戏设定与世界构建合并为“游戏内容构建”。先描述游戏想法，或在“设计内容”中选择世界观、角色、地图、场景、道具、服饰，与 AI 对话生成设计及视觉 Prompt。角色支持动物、植物、石头、机械等实体。无需先命名或手写提示词；AI 提问或建议名称，保存前可修改。

每项设计保留独立会话、世界归属、真实消息与设计版本。失败保留输入和结果，重试不重复消息；改变失败输入后应发送新的需求。旧 NPC 的背景、目标、人格和行为资料保留并用于续写，不伪造历史对话。世界资料读取失败时标明不可用，不以旧快照冒充当前设定。

桌面对话与结果预览并排，窄屏顺序显示；文本控件统一深色。字段、标签、视觉覆盖、反向提示词折叠在详细资料中。一键完整 Pipeline 是次要入口，原输出进入同一设计目录。

## 档案与自由生图

游戏内容工作室和资产库复用档案浏览器。内容档案分世界观、角色、地图、场景、道具、服饰，支持世界、搜索与生产状态筛选；图片素材按图片 ID 展示，手写图片标为独立图片；不明确类型的旧记录进入待整理。草稿只显示有实际内容的未保存会话，已保存记录的本地修改明确标注，空白旧草稿不自动删除。

档案详情分设计资料、Prompt 版本和图片。管理档案提供重命名、分类、世界关联、标签和关联内容；旧字段与版本保留稳定 ID。选择历史 Prompt 可以编辑该版本或直接用于生图。

“一键用于文生图”原样带入所选文本。用户可以删改或完全手写，选择模型与尺寸后生成；不自动追加风格或重新分类。图片保存实际请求、参数与来源快照，后续修改输入不会改变上一张图记录。图片可独立保存或明确关联档案，来源删除时不能通过旧交接自动恢复已删档案。


## Google Gemini 4 Argon（文本与 NPC 设计）

在本地 `.env.local` 或 Vercel 项目的服务端环境变量中配置：

```dotenv
GEMINI_API_KEY=你的_Google_AI_Studio_API_Key
GEMINI_MODEL=gemini-4-argon
```

重启本地后端或重新部署后，在“API 设置 → 连接模式”选择 **Google Gemini**。
无需在浏览器填写 Gemini Key；浏览器仅提交 provider、model 和对话内容。
不要使用 `VITE_GEMINI_API_KEY`，不要提交 `.env.local`。服务端不会采用请求中的 Gemini apiKey/key。
保留现有 DeepSeek/OpenAI 的默认选择、个人凭据和图片生成方式。
Gemini 用于游戏内容构建、世界观、NPC 及美术提示词文本生成，不提供图片生成。

适配使用原生 REST：
`POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`，
认证头 `x-goog-api-key`。消息转换为 `contents[].parts[].text`，助手角色使用 `model`，
系统指令使用 `systemInstruction`；JSON Schema 放在 `generationConfig.responseJsonSchema`，
并指定 `responseMimeType=application/json`。只读取 `candidates[0].content.parts` 中的非 thought 文本，
保留现有业务字段校验。拒绝安全拦截、截断和异常响应；连接错误与无效 JSON 最多尝试两次，429 不自动重试。
Gemini 每次调用超时为 60 秒，输出上限 32768 tokens（含 thinking），thinking level 为 MEDIUM。
如任务触及上限，返回错误，不把不完整结果保存为成功。

官方也支持 `streamGenerateContent`（SSE）；本次沿用项目非流式 JSON 契约，等完整响应后再校验。
所用模型和配额必须对当前 Google 项目可用；缺失 Key 时返回配置错误。

验证（在项目根目录执行）：

```powershell
node --test tests/*.test.mjs
npm run build
node --env-file=.env.local scripts/smoke-gemini.mjs
```

前两项无需调用真实模型。最后一项会发送一次真实请求并产生 Google API 费用，
只输出通过/失败及安全错误码，不打印 Key 或生成内容。需 Node 24，网络能访问 Google API，
且 Gemini Key 对目标模型有权限。线上还应登录内测页面，选择 Gemini，创建一个世界观，
确认返回结果可编辑与保存；错误时原有输入应保留。

官方资料（2026-10-22 核对）：
[模型说明](https://ai.google.dev/gemini-api/docs/models/gemini-4-argon)、
[REST 请求/响应与流式接口](https://ai.google.dev/api/generate-content)、
[结构化输出](https://ai.google.dev/gemini-api/docs/structured-output)。
