import { assetResultSchema, npcResultSchema } from './contracts.mjs'
import { GatewayError } from './errors.mjs'
import { requestStructured as defaultRequestStructured } from './llmGateway.mjs'
import { validateWorldSchema } from './worldSchemaValidator.mjs'

const worldJsonSchema = { type: 'object', properties: { name: { type: 'string' }, genre: { type: 'string' }, era: { type: 'string' }, atmosphere: { type: 'string' }, coreRule: { type: 'string' }, centralConflict: { type: 'string' }, summary: { type: 'string' } }, required: ['name', 'genre', 'era', 'atmosphere', 'coreRule', 'centralConflict', 'summary'], additionalProperties: false }
const npcJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, npc: { type: 'object' } }, required: ['status'], additionalProperties: false }
const assetJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, asset: { type: 'object' } }, required: ['status'], additionalProperties: false }
const instructionsFor = (phase, world, assetProfile) => phase === 'world'
  ? '你是 NPC Forge 世界观构思 Agent。只返回 world schema JSON，不要返回 status、state、phase 或 Markdown。字段必须是 name、genre、era、atmosphere、coreRule、centralConflict、summary，所有字段都必须是非空字符串。'
  : phase === 'npc'
    ? `你是 NPC Forge NPC 设计 Agent。只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。严格遵守已确认世界观：${JSON.stringify(world)}。信息不足时返回 {"status":"needs_clarification","phase":"npc","question":"问题","options":["选项"]}；信息充分时返回 {"status":"complete","phase":"npc","npc":{"id":"","name":"","role":"","world":"","function":"","summary":"","background":"","goal":"","speechStyle":"","sourcePrompt":"","personality":["至少一项"],"behaviorRules":["至少一项"]}}。所有字符串非空，NPC 必须自动命名。`
    : `你是 NPC Forge 美术资源 Agent。只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。你必须严格依据用户选择的档案拆解提示词，不得凭空替换角色、世界观或地点。已确认世界观：${JSON.stringify(world)}。当前选择的档案：${JSON.stringify(assetProfile)}。当档案 type 为 world 时，生成场景、地点、道具或 UI 资源，并引用档案中的 genre、era、atmosphere、coreRule、centralConflict；当 type 为 npc 时，生成角色立绘、三视图、表情动作或角色相关资源，并引用档案中的 name、role、world、function、personality、background、speechStyle。返回 {"status":"complete","phase":"asset","asset":{"type":"","style":"","objects":["至少一项"],"composition":"","palette":"","lighting":"","details":["至少一项"],"format":"","aspectRatio":"","promptZh":"","promptEn":"","negativePrompt":""}}。所有字段非空。`
const publicClarification = (value, phase) => ({ status: 'needs_clarification', phase, ...(typeof value.question === 'string' && value.question.trim() ? { question: value.question.trim() } : {}), ...(Array.isArray(value.options) ? { options: value.options.map(String).map((item) => item.trim()).filter(Boolean) } : {}), ...(Array.isArray(value.missingFields) ? { missingFields: value.missingFields.map(String).map((item) => item.trim()).filter(Boolean) } : {}) })
const parseWorld = (value) => { const result = validateWorldSchema(value?.world || value); if (result.status === 'SUCCESS') return { status: 'world_ready', phase: 'world', world: result.world }; throw new GatewayError('INVALID_SCHEMA', result.message, { statusCode: 502, providerPayload: result }) }
const parseNpc = (value) => {
  const complete = npcResultSchema.safeParse({ status: 'complete', phase: 'npc', npc: value?.npc })
  if (complete.success) return complete.data
  if (value?.question || Array.isArray(value?.options) || value?.status === 'needs_clarification') return publicClarification(value, 'npc')
  throw new GatewayError('PROVIDER_SCHEMA_MISMATCH', 'NPC 结果不符合要求。', { statusCode: 502 })
}
const parseAsset = (value) => {
  const complete = assetResultSchema.safeParse({ status: 'complete', phase: 'asset', asset: value?.asset || value })
  if (!complete.success) throw new GatewayError('PROVIDER_SCHEMA_MISMATCH', '美术资源结果不符合要求。', { statusCode: 502 })
  return complete.data
}

export async function runNpcRequest(input, dependencies = {}) {
  const requestStructured = dependencies.requestStructured || defaultRequestStructured
  if (!Array.isArray(input.messages) || input.messages.length === 0) throw new GatewayError('INVALID_REQUEST', 'messages is required', { statusCode: 400 })
  if (!input.key) throw new GatewayError('CONFIGURATION_ERROR', '模型 API key 未配置。', { statusCode: 503 })
  if (input.phase === 'npc' && (!input.world || typeof input.world !== 'object')) throw new GatewayError('INVALID_REQUEST', 'NPC 生成需要已确认的世界观。', { statusCode: 400 })
  const phase = input.phase || 'world'
  if (phase === 'asset' && (!input.assetProfile || typeof input.assetProfile !== 'object' || !input.assetProfile.type || !input.assetProfile.name || !input.assetProfile.content)) throw new GatewayError('INVALID_REQUEST', '美术资源生成需要先选择世界观或角色档案。', { statusCode: 400 })
  const result = await requestStructured({ provider: input.provider, key: input.key, model: input.model, messages: input.messages, instructions: input.instructions || instructionsFor(phase, input.world, input.assetProfile), schema: phase === 'asset' ? assetJsonSchema : phase === 'npc' ? npcJsonSchema : worldJsonSchema, signal: input.signal, requestId: input.requestId, logger: dependencies.logger || ((entry) => console.debug('[NPC Forge LLM]', JSON.stringify(entry))) })
  if (phase === 'asset') return parseAsset(result)
  if (phase === 'npc') return parseNpc(result)
  return parseWorld(result)
}
