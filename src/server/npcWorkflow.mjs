import { assetResultSchema, npcResultSchema } from './contracts.mjs'
import { GatewayError } from './errors.mjs'
import { generateStructured as defaultRequestStructured } from '../services/llm/llmService.mjs'
import { validateWorldSchema } from './worldSchemaValidator.mjs'
import { normalizeAssetType } from './assetType.mjs'
import { generateContent } from './contentGeneration.mjs'

const worldJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, missingFields: { type: 'array', items: { type: 'string' } }, world: { type: 'object', properties: { name: { type: 'string' }, genre: { type: 'string' }, era: { type: 'string' }, atmosphere: { type: 'string' }, coreRule: { type: 'string' }, centralConflict: { type: 'string' }, summary: { type: 'string' }, visualDirection: { type: 'string' } }, required: ['name', 'genre', 'era', 'atmosphere', 'coreRule', 'centralConflict', 'summary'], additionalProperties: false } }, required: ['status', 'phase'], additionalProperties: false }
const npcJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, npc: { type: 'object' } }, required: ['status'], additionalProperties: false }
const assetJsonSchema = { type: 'object', properties: { status: { type: 'string' }, phase: { type: 'string' }, asset: { type: 'object' } }, required: ['status'], additionalProperties: false }
const instructionsFor = (phase, world, contentProfile) => phase === 'world'
  ? '你是游戏内容构建 Agent，先帮助用户确定游戏玩法用途，再结合玩法构建世界规则和视觉方向。用户让你建议时明确标为 AI 建议，不冒充已确认事实。只返回合法 JSON，不要 Markdown、解释或额外文字。若用户没有提供足够的游戏类型、时代背景、整体氛围、核心规则或主要冲突，返回 {"status":"needs_clarification","phase":"world","question":"一次合并询问2-3个最关键问题","options":["3-5个可选方向"],"missingFields":["缺失字段"]}。信息充分时返回 {"status":"world_ready","phase":"world","world":{"name":"","genre":"","era":"","atmosphere":"","coreRule":"","centralConflict":"","summary":""}}，world 七个基础字段必须是非空字符串。若用户提供画风、色彩、材质、生态视觉或视觉禁忌，用 visualDirection 保存；未确定时可省略。'
  : phase === 'npc'
    ? `你是 NPC Forge NPC 设计 Agent。只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。${world ? `严格遵守已确认世界观：${JSON.stringify(world)}。` : '这是独立角色，不属于任何已保存世界观；只依据用户提供的信息设计，不要虚构世界档案关联。'}信息不足时返回 {"status":"needs_clarification","phase":"npc","question":"问题","options":["选项"]}；信息充分时返回 {"status":"complete","phase":"npc","npc":{"id":"","name":"","role":"","world":"","function":"","summary":"","background":"","goal":"","speechStyle":"","sourcePrompt":"","personality":["至少一项"],"behaviorRules":["至少一项"]}}。所有字符串非空，NPC 必须自动命名。`
    : `你是 NPC Forge 美术资源 Agent。只返回一个合法 JSON 对象，不要 Markdown、解释或额外文字。严格依据用户选择的游戏内容档案拆解提示词，不得凭空替换设定。已确认世界观兼容字段：${JSON.stringify(world)}。当前内容档案：${JSON.stringify(contentProfile)}。如果档案包含 world，引用其 genre、era、atmosphere、coreRule、centralConflict；如果包含 npc，引用其 name、role、world、function、personality、background、speechStyle；如果同时存在，必须让场景与角色保持一致；如果有 notes，视为用户提供的外部事实。返回 {"status":"complete","phase":"asset","asset":{"type":"","style":"","objects":["至少一项"],"composition":"","palette":"","lighting":"","details":["至少一项"],"format":"","aspectRatio":"","promptZh":"","promptEn":"","negativePrompt":""}}。所有字段非空。`
const revisionInstructions = (input, phase) => {
  const base=instructionsFor(phase,input.world,input.contentProfile)
  if (input.intent === 'revise') {
    const current=phase === 'world' ? input.currentWorld : input.currentNpc
    return `${base}\n这是对同一档案的修订。当前${phase === 'world' ? '世界观' : '角色'}完整内容：${JSON.stringify(current || null)}。按照用户本轮要求修改，未被要求修改的字段必须保留。不得切换内容类型。`
  }
  if (input.intent === 'regenerate') return `${base}\n这是对同一档案的重新生成，允许重写全部内容，但档案身份由系统保留。不得切换内容类型。`
  return base
}
const publicClarification = (value, phase) => ({ status: 'needs_clarification', phase, ...(typeof value.question === 'string' && value.question.trim() ? { question: value.question.trim() } : {}), ...(Array.isArray(value.options) ? { options: value.options.map(String).map((item) => item.trim()).filter(Boolean) } : {}), ...(Array.isArray(value.missingFields) ? { missingFields: value.missingFields.map(String).map((item) => item.trim()).filter(Boolean) } : {}) })
const parseWorld = (value) => { if (value?.status === 'needs_clarification') return publicClarification(value, 'world'); const result = validateWorldSchema(value?.world || value); if (result.status === 'SUCCESS') return { status: 'world_ready', phase: 'world', world: result.world }; throw new GatewayError('INVALID_SCHEMA', result.message, { statusCode: 422, providerPayload: result }) }
const parseNpc = (value) => {
  const complete = npcResultSchema.safeParse({ status: 'complete', phase: 'npc', npc: value?.npc })
  if (complete.success) return complete.data
  if (value?.question || Array.isArray(value?.options) || value?.status === 'needs_clarification') return publicClarification(value, 'npc')
  throw new GatewayError('PROVIDER_SCHEMA_MISMATCH', 'NPC 结果不符合要求。', { statusCode: 422 })
}
const parseAsset = (value) => {
  const complete = assetResultSchema.safeParse({ status: 'complete', phase: 'asset', asset: value?.asset || value })
  if (!complete.success) throw new GatewayError('PROVIDER_SCHEMA_MISMATCH', '美术资源结果不符合要求。', { statusCode: 422 })
  return { ...complete.data, asset: { ...complete.data.asset, type: normalizeAssetType(complete.data.asset.type) } }
}

export async function runNpcRequest(input, dependencies = {}) {
  if (input.phase === 'content') {
    if (!input.key && !dependencies.requestStructured) throw new GatewayError('CONFIGURATION_ERROR', '模型 API key 未配置。', { statusCode: 503 })
    return generateContent({ ...input.contentProfile, ...input, requirements:input.contentProfile?.requirements, category:input.contentProfile?.category, itemId:input.contentProfile?.itemId, name:input.contentProfile?.name, design:input.contentProfile?.design }, dependencies)
  }
  const requestStructured = dependencies.requestStructured || defaultRequestStructured
  if (!Array.isArray(input.messages) || input.messages.length === 0) throw new GatewayError('INVALID_REQUEST', 'messages is required', { statusCode: 400 })
  if (!input.key) throw new GatewayError('CONFIGURATION_ERROR', '模型 API key 未配置。', { statusCode: 503 })
  const phase = input.phase || 'world'
  if (phase === 'asset' && (!input.contentProfile || typeof input.contentProfile !== 'object' || (!input.contentProfile.world && !input.contentProfile.npc && !input.contentProfile.notes))) throw new GatewayError('INVALID_REQUEST', '美术资源生成需要至少一个世界观、角色或外部素材。', { statusCode: 400 })
  const result = await requestStructured({ provider: input.provider, key: input.key, model: input.model, messages: input.messages, instructions: input.instructions || revisionInstructions(input,phase), schema: phase === 'asset' ? assetJsonSchema : phase === 'npc' ? npcJsonSchema : worldJsonSchema, signal: input.signal, requestId: input.requestId, logger: dependencies.logger || ((entry) => console.debug('[NPC Forge LLM]', JSON.stringify(entry))) })
  if (phase === 'asset') return parseAsset(result)
  if (phase === 'npc') { const parsed=parseNpc(result); return parsed.npc && input.currentNpc?.id ? {...parsed,npc:{...parsed.npc,id:input.currentNpc.id}} : parsed }
  const parsed=parseWorld(result)
  return parsed.world && input.currentWorld?.id ? {...parsed,world:{...parsed.world,id:input.currentWorld.id}} : parsed
}
