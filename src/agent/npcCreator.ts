import type { ArtAssetPrompt, GameContentProfile, NPC, ReviewResult, WorldProfile } from '../types/npc'
export type { ReviewResult } from '../types/npc'
export interface AgentMessage { role: 'user' | 'assistant'; content: string }
export interface CreatorReply { status: 'needs_clarification' | 'world_ready' | 'complete'; phase?: 'world' | 'npc'; question?: string; options?: string[]; missingFields?: string[]; world?: WorldProfile; npc?: NPC }
export interface CreateNPCOptions { phase?: 'world' | 'npc'; world?: WorldProfile; intent?: 'create' | 'revise' | 'regenerate'; currentWorld?: WorldProfile; currentNpc?: NPC; signal?: AbortSignal; requestId?: string }
export interface CreateAssetOptions { world?: WorldProfile; contentProfile: GameContentProfile; signal?: AbortSignal; requestId?: string }

export interface AgentConfig { endpoint: string; model: string; provider: 'backend' | 'deepseek' | 'openai'; apiKey: string }
let config: AgentConfig = { endpoint: 'https://api.deepseek.com', model: 'deepseek-chat', provider: 'deepseek', apiKey: '' }
export const setAgentConfig = (next: Partial<AgentConfig>) => { config = { ...config, ...next } }
const gatewayEndpoint = () => '/api/npc'
const parseJsonCandidate = (value: string): unknown => {
  const cleaned = String(value ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  if (!cleaned) throw new Error('模型返回的内容为空，请点击重试。')
  try { return JSON.parse(cleaned) } catch {
    const start = cleaned.indexOf('{')
    if (start >= 0) {
      let depth = 0; let quoted = false; let escaped = false
      for (let index = start; index < cleaned.length; index += 1) {
        const char = cleaned[index]
        if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; continue }
        if (char === '"') quoted = true
        else if (char === '{') depth += 1
        else if (char === '}') { depth -= 1; if (depth === 0) { try { return JSON.parse(cleaned.slice(start, index + 1)) } catch { break } } }
      }
      // Providers occasionally stop after emitting a complete scalar field.
      const candidate = cleaned.slice(start).replace(/,\s*$/, '')
      // Close common truncated array/object combinations. This intentionally
      // stays bounded so malformed output becomes a controlled error.
      for (const suffix of [ '}', ']}', ']}', '}}', ']} }'.replace(' ', '') ]) {
        try { return JSON.parse(candidate + suffix) } catch { /* keep repairing */ }
      }
    }
    throw new Error('模型返回的内容不是有效 JSON，请点击重试。')
  }
}
const asStrings = (value: unknown) => Array.isArray(value) ? value.map(String).filter(Boolean) : value == null ? [] : [String(value)]
export const normalizeReviewResult = (value: Partial<ReviewResult> | null | undefined): ReviewResult => {
  const issues = asStrings(value?.issues)
  const suggestions = asStrings(value?.suggestions)
  const score = typeof value?.score === 'number' && Number.isFinite(value.score) ? value.score : undefined
  return { approved: value?.approved === true, issues, suggestions, ...(score === undefined ? {} : { score }) }
}
export const parseReviewResult = (value: string): ReviewResult => normalizeReviewResult(parseJsonCandidate(value) as Partial<ReviewResult>)
const parseCreatorJson = (value: string): CreatorReply => parseJsonCandidate(value) as CreatorReply

const worldFields: Array<keyof WorldProfile> = ['name', 'genre', 'era', 'atmosphere', 'coreRule', 'centralConflict', 'summary']
const npcFields: Array<keyof NPC> = ['id', 'name', 'role', 'world', 'function', 'summary', 'goal', 'speechStyle', 'background', 'behaviorRules', 'sourcePrompt', 'personality']
const npcStringFields: Array<keyof NPC> = ['id', 'name', 'role', 'world', 'function', 'summary', 'goal', 'speechStyle', 'background', 'sourcePrompt']
const assetFields: Array<keyof ArtAssetPrompt> = ['type', 'style', 'composition', 'palette', 'lighting', 'format', 'aspectRatio', 'promptZh', 'promptEn', 'negativePrompt']
const publicStringList = (value: unknown): string[] | undefined => Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : undefined
const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
export const hasConfirmedWorld = (value: unknown): value is WorldProfile => !!value && typeof value === 'object' && worldFields.every((field) => hasText((value as Record<string, unknown>)[field]))

/**
 * Keep the browser contract deliberately smaller than the backend response.
 * Internal reviewer fields must never become React state, even if a provider
 * accidentally includes them in an otherwise valid response.
 */
export const sanitizeCreatorReply = (value: unknown): CreatorReply => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const status = source.status
  if (status !== 'needs_clarification' && status !== 'world_ready' && status !== 'complete') throw new Error('模型返回的数据结构无法识别。请检查 API 响应或稍后重试。')
  const reply: CreatorReply = { status }
  const publicReply = reply as unknown as Record<string, unknown>
  if (source.phase === 'world' || source.phase === 'npc') reply.phase = source.phase
  for (const key of ['question', 'options', 'missingFields'] as const) {
    if (typeof source[key] === 'string') publicReply[key] = source[key]
    else if (key !== 'question') {
      const values = publicStringList(source[key])
      if (values) publicReply[key] = values
    }
  }
  if (source.world && typeof source.world === 'object') {
    const candidate = source.world as Record<string, unknown>
    const world = {} as WorldProfile
    for (const field of worldFields) if (typeof candidate[field] === 'string') world[field] = candidate[field] as string
    if (typeof candidate.id === 'string') world.id = candidate.id
    if (typeof candidate.id === 'string') world.id = candidate.id
    if (typeof candidate.visualDirection === 'string') world.visualDirection = candidate.visualDirection
    if (typeof candidate.revision === 'number') world.revision = candidate.revision
    if (Object.keys(world).length > 0) reply.world = world
  }
  if (source.npc && typeof source.npc === 'object') {
    const candidate = source.npc as Record<string, unknown>
    const npc = {} as NPC
    for (const field of npcFields) {
      if (field === 'personality' || field === 'behaviorRules') {
        const values = publicStringList(candidate[field])
        if (values) npc[field] = values as never
      } else if (typeof candidate[field] === 'string') npc[field] = candidate[field] as never
    }
    if (Object.keys(npc).length > 0) reply.npc = npc
  }
  if (status === 'world_ready') {
    const candidate = reply.world
    if (!candidate || worldFields.some((field) => !hasText(candidate[field]))) throw new Error('世界观生成结果不完整，请点击重试。')
  }
  if (status === 'complete') {
    const candidate = reply.npc
    if (!candidate || npcStringFields.some((field) => !hasText(candidate[field])) || !Array.isArray(candidate.personality) || candidate.personality.length === 0 || !Array.isArray(candidate.behaviorRules) || candidate.behaviorRules.length === 0) throw new Error('NPC生成结果不完整，请点击重试。')
  }
  return reply
}

const sanitizeAsset = (value: unknown): ArtAssetPrompt => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const asset = {} as ArtAssetPrompt
  for (const field of assetFields) if (hasText(source[field])) (asset as any)[field] = String(source[field]).trim()
  for (const field of ['objects', 'details'] as const) (asset as any)[field] = publicStringList(source[field]) || []
  if (assetFields.some((field) => !hasText(asset[field])) || !asset.objects.length || !asset.details.length) throw new Error('美术资源拆解结果不完整，请点击重试。')
  return asset
}

export const buildAssetPromptText = (asset: ArtAssetPrompt): string => [
  `资源类型：${asset.type}`, `艺术风格：${asset.style}`, `核心物件：${asset.objects.join('、')}`,
  `构图视角：${asset.composition}`, `色彩：${asset.palette}`, `光照：${asset.lighting}`,
  `细节：${asset.details.join('、')}`, `格式：${asset.format}`, `比例：${asset.aspectRatio}`,
  `中文提示词：${asset.promptZh}`, `英文提示词：${asset.promptEn}`, `反向提示词：${asset.negativePrompt}`
].join('\n')

export async function createAsset(messages: AgentMessage[], options: CreateAssetOptions): Promise<{ status: 'complete'; phase: 'asset'; asset: ArtAssetPrompt }> {
  const direct = false
  const endpoint = gatewayEndpoint()
  const request = { messages, model: config.model, provider: config.provider === 'backend' ? undefined : config.provider, phase: 'asset', world: options.world, contentProfile: options.contentProfile }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(direct ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify({ ...request, requestId: options.requestId }), signal: options.signal })
  const raw = await response.text(); let body: any
  try { body = JSON.parse(raw) } catch { throw new Error(raw || `Backend returned an empty response (${response.status})`) }
  if (!response.ok) throw new Error(body.error || '美术资源生成失败，请点击重试。')
  const value = direct ? parseCreatorJson(String(body.choices?.[0]?.message?.content || '{}')) : body
  return { status: 'complete', phase: 'asset', asset: sanitizeAsset((value as any).asset || value) }
}

export async function createNPC(messages: AgentMessage[], options: CreateNPCOptions = {}): Promise<CreatorReply> {
  const direct = false
  const endpoint = gatewayEndpoint()
  const request = direct
    ? { model: config.model, messages: [{ role: 'system', content: '你是 AI Game Content Pipeline Agent（AI游戏内容生产智能体），工作流分为两阶段。第一阶段先构思世界观；信息不足时一次最多合并询问2-3个最关键问题，已有信息不要重复询问，并提供选择项；充分后返回完整 world。确认世界观后进入 NPC 阶段，一次最多合并询问2-3个缺失字段，优先询问用途、玩家关系、目标和冲突；信息完整后直接返回完整 npc。NPC 必须自动命名，background 包含过去经历、当前处境及与玩家相遇原因，personality 与 behaviorRules 各至少3项。只返回合法 JSON，绝不返回空内容。' }, ...messages], response_format: { type: 'json_object' }, stream: false }
    : { messages, model: config.model, provider: config.provider === 'backend' ? undefined : config.provider, phase: options.phase || 'world', intent: options.intent || 'create', ...(options.currentWorld ? { currentWorld: options.currentWorld } : {}), ...(options.currentNpc ? { currentNpc: options.currentNpc } : {}), ...(options.phase === 'npc' && options.world ? { world: options.world } : {}) }
  let lastError: unknown
  for (let attempt = 0; attempt < (direct ? 2 : 1); attempt += 1) {
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(direct ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify({ ...request, requestId: options.requestId }), signal: options.signal })
      const raw = await response.text(); let body: any
      try { body = JSON.parse(raw) } catch { throw new Error(raw || `Backend returned an empty response (${response.status})`) }
      if (!response.ok) throw new Error(body.message || body.error || 'AI Game Content Pipeline Agent request failed')
      if (direct) { const text = body.choices?.[0]?.message?.content || ''; if (!String(text).trim()) throw new Error('模型返回了空内容'); return sanitizeCreatorReply(parseCreatorJson(String(text))) }
      return sanitizeCreatorReply(body)
    } catch (error) { lastError = error }
  }
  throw lastError instanceof Error ? lastError : new Error('AI Game Content Pipeline Agent request failed')
}
