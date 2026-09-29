# AI Game Content Pipeline v0.3 Visual Asset Generation Design

## Goal

在不修改现有 Character Agent 的前提下，建立从 Character JSON 到可持久化视觉资产的统一生成链路。

## Architecture

Visual Agent 只负责把角色结构化数据转换为 `VisualAsset`。Prompt Engine 负责构建、评审和优化提示词。Image Service 负责统一调度 Provider，Agent 不直接调用模型。Asset Manager 负责保存生成结果、提示词和版本记录，并通过现有 Asset Library 查询接口提供给前端。

## Data Flow

```text
Character JSON
  -> Visual Agent
  -> VisualAsset
  -> Prompt Builder
  -> Prompt Critic
  -> Prompt Optimizer
  -> Image Service
  -> Image Provider
  -> Asset Manager
  -> AssetVersion / Asset Library
```

## Scope

- 保留现有 Character Agent、NPC 接口和 Pipeline 接口。
- 新增 `VisualAsset`、`AssetVersion` 结构化数据。
- 新增可独立测试的 Visual Agent 和 Prompt Engine。
- 统一图片生成 Service/Provider 边界。
- Visual Production 页面支持生成、保存和版本管理。
- Provider 首期兼容 OpenAI-compatible 图片接口，并为 Flux、Stable Diffusion 保留适配器接口。

## Contracts

### VisualAsset

必须包含 `visual_asset_id`、`source_character_id`、`subject`、`appearance`、`costume`、`weapon`、`environment`、`lighting`、`camera`、`art_style`、`prompt`、`negative_prompt`、`status`。

### AssetVersion

必须包含 `asset_id`、`version`、`prompt`、`provider`、`model`、`url`、`created_at`、`status`。

### Service Boundary

```js
generateImage({ prompt, negativePrompt, provider, model, size })
```

Image Service 负责参数校验、Provider 选择和统一错误格式；Provider 负责具体 HTTP 调用。Visual Agent、Prompt Engine 和 Asset Manager 不得直接调用模型 HTTP 接口。

## API Additions

```text
POST /api/visual-assets/generate
POST /api/assets
POST /api/assets/:assetId/versions
GET  /api/assets?projectId=...
GET  /api/assets/:assetId/versions
```

现有 `/api/npc`、`/api/pipeline`、`/api/image` 接口保持兼容。

## Error Handling

- `INVALID_VISUAL_ASSET`: Character JSON 缺少视觉生成所需字段。
- `PROMPT_INVALID`: Prompt Critic 判定必要信息缺失。
- `IMAGE_PROVIDER_ERROR`: Provider 请求失败或返回空图片。
- `ASSET_PERSISTENCE_ERROR`: 资产或版本保存失败。

所有错误返回稳定的 `code` 和可展示的 `message`，不暴露 Provider 原始响应。

## Frontend Behavior

Visual Production 页面增加：

- 当前角色和视觉状态选择。
- Prompt 分段预览和编辑。
- Prompt Critic 结果。
- 生成图片、保存资产、创建版本。
- 已保存版本列表和版本切换。

保持现有深色游戏开发工具视觉语言，并复用现有按钮、卡片、导航和状态组件。

## Non-Goals

- 不重写 Character Agent。
- 不在 v0.3 中实现视频或 3D 生成。
- 不绑定单一模型供应商。
- 不删除现有页面或接口。

## Verification

- Schema 测试覆盖完整对象和缺失字段。
- Prompt Engine 测试覆盖构建、缺字段评审和优化结果。
- Image Service 测试覆盖 Provider 选择、空响应和错误归一化。
- Asset Manager 测试覆盖保存、版本递增和查询。
- 前端构建和现有全部测试必须继续通过。
