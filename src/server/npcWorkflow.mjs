import { assetResultSchema, npcResultSchema, worldResultSchema } from './contracts.mjs'
import { GatewayError } from './errors.mjs'
import { requestStructured as defaultRequestStructured } from './llmGateway.mjs'

const worldJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, world: { type: 'object' } }, required: ['status'], additionalProperties: false }
const npcJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, npc: { type: 'object' } }, required: ['status'], additionalProperties: false }
const assetJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, asset: { type: 'object' } }, required: ['status'], additionalProperties: false }
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
  const result = await requestStructured({ provider: input.provider, key: input.key, model: input.model, messages: input.messages, instructions: input.instructions || `NPC Forge ${phase} generation`, schema: phase === 'asset' ? assetJsonSchema : phase === 'npc' ? npcJsonSchema : worldJsonSchema, signal: input.signal, requestId: input.requestId })
  if (phase === 'asset') return parseAsset(result)
  if (phase === 'npc') return parseNpc(result)
  return parseWorld(result)
}

