import { assetResultSchema, npcResultSchema, worldResultSchema } from './contracts.mjs'
import { GatewayError } from './errors.mjs'
import { requestStructured as defaultRequestStructured } from './llmGateway.mjs'

const worldJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, world: { type: 'object' } }, required: ['status'], additionalProperties: false }
const npcJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, npc: { type: 'object' } }, required: ['status'], additionalProperties: false }
const assetJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, asset: { type: 'object' } }, required: ['status'], additionalProperties: false }
const instructionsFor = (phase, world) => phase === 'world'
  ? '你是 NPC Forge 世界观构思 Agent。只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。信息不足时返回 {"status":"needs_clarification","phase":"world","question":"问题","options":["选项"]}；信息充分时返回 {"status":"world_ready","phase":"world","world":{"name":"","genre":"","era":"","atmosphere":"","coreRule":"","centralConflict":"","summary":""}}。world 的所有字段都必须是非空字符串。'
  : phase === 'npc'
    ? `你是 NPC Forge NPC 设计 Agent。只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。严格遵守已确认世界观：${JSON.stringify(world)}。信息不足时返回 {"status":"needs_clarification","phase":"npc","question":"问题","options":["选项"]}；信息充分时返回 {"status":"complete","phase":"npc","npc":{"id":"","name":"","role":"","world":"","function":"","summary":"","background":"","goal":"","speechStyle":"","sourcePrompt":"","personality":["至少一项"],"behaviorRules":["至少一项"]}}。所有字符串非空，NPC 必须自动命名。`
    : `你是 NPC Forge 美术资源 Agent。只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。根据已确认世界观 ${JSON.stringify(world)} 和用户需求返回 {"status":"complete","phase":"asset","asset":{"type":"","style":"","objects":["至少一项"],"composition":"","palette":"","lighting":"","details":["至少一项"],"format":"","aspectRatio":"","promptZh":"","promptEn":"","negativePrompt":""}}。所有字段非空。`
const publicClarification = (value, phase) => ({ status: 'needs_clarification', phase, ...(typeof value.question === 'string' && value.question.trim() ? { question: value.question.trim() } : {}), ...(Array.isArray(value.options) ? { options: value.options.map(String).map((item) => item.trim()).filter(Boolean) } : {}), ...(Array.isArray(value.missingFields) ? { missingFields: value.missingFields.map(String).map((item) => item.trim()).filter(Boolean) } : {}) })
const parseWorld = (value) => {
  const complete = worldResultSchema.safeParse({ status: 'world_ready', phase: 'world', world: value?.world })
  if (complete.success) return complete.data
  if (value?.question || Array.isArray(value?.options) || value?.status === 'needs_clarification') return publicClarification(value, 'world')
  throw new GatewayError('PROVIDER_SCHEMA_MISMATCH', '世界观结果不符合要求。', { statusCode: 502 })
}
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
  const result = await requestStructured({ provider: input.provider, key: input.key, model: input.model, messages: input.messages, instructions: input.instructions || instructionsFor(phase, input.world), schema: phase === 'asset' ? assetJsonSchema : phase === 'npc' ? npcJsonSchema : worldJsonSchema, signal: input.signal, requestId: input.requestId })
  if (phase === 'asset') return parseAsset(result)
  if (phase === 'npc') return parseNpc(result)
  return parseWorld(result)
}
