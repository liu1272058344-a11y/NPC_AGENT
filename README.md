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

## 世界设定、美术生产与自由生图

世界构建可填写视觉方向，并直接进入角色、地图、场景或道具设计。美术生产会展示继承的世界设定与视觉方向；角色也可以是动物、植物、石头或机械，字段按实际适用性填写。视觉简报可以补充要求，明确覆盖继承风格时会显示冲突提示。

“暂不关联世界”表示这份内容目前没有绑定世界，可以用于先做素材、以后再关联；没有可用世界时提供创建入口。空白条目显示“新地图（未保存）”等状态，填写条目名称即可命名；已保存档案可重命名。切换有修改的草稿时可保留、放弃或取消。

文生图工作台支持直接手写提示词，也能带入并编辑内容条目的 Prompt。无需先命名条目或生成系统 Prompt，不自动追加风格。生成后可以独立保存图片，或者明确选择关联的内容档案。

图片历史记录实际提交的提示词、参数与来源快照。生成后继续修改输入框不会改变上一张图的记录；世界或内容版本变化会提示原 Prompt 来源已变化，重新生成需要主动操作。保存失败可保留结果并重试。

## 简化后的工作室流程

游戏内容工作室统一设计角色、地图、场景、道具和服饰；世界观入口复用世界构建。分类、设计资料与视觉 Prompt 在上游完成，文生图工作台不再显示分类、草稿选择或新建条目表单。“美术生产”不再是单独入口。

完成视觉 Prompt 后点击“一键用于文生图”，原文会直接填入统一的图片工作台。可删改，也可完全手写，选择模型与尺寸后生成。旧世界或 NPC 只有叙事资料时，先点击“设计视觉 Prompt”完成视觉设计，避免固定模板自动加入服饰或装备。

工作台会保留当前会话的输入和结果。新交接遇到编辑内容或未保存图片时，可继续当前内容或使用新提示词。保存默认沿用带入来源；纯手写默认独立。来源不可用时仍可生成，并改为独立保存。旧未命名草稿中的实际内容可从“恢复旧草稿”入口找回，空白草稿不出现在主要选择列表。
