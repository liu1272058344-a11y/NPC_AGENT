const schema = { type: 'object', properties: { worldOptions: { type: 'array', items: { type: 'string' } }, roleOptions: { type: 'array', items: { type: 'string' } }, functionOptions: { type: 'array', items: { type: 'string' } }, personalityOptions: { type: 'array', items: { type: 'string' } } }, required: ['worldOptions', 'roleOptions', 'functionOptions', 'personalityOptions'], additionalProperties: false }
export interface ReviewResult { approved: boolean; issues: string[]; suggestions: string[]; score?: number }
export const normalizeReviewResult = (value: Partial<ReviewResult> | null | undefined): ReviewResult => {
  const source = value && typeof value === 'object' ? value : {}
  const strings = (entry: unknown) => Array.isArray(entry) ? entry.map(String).filter(Boolean) : entry == null ? [] : [String(entry)]
  const score = typeof source.score === 'number' && Number.isFinite(source.score) ? source.score : undefined
  return { approved: source.approved === true, issues: strings(source.issues), suggestions: strings(source.suggestions), ...(score === undefined ? {} : { score }) }
}
export const parseJsonOutput = (value: unknown): unknown => { const text = String(value ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(); if (!text) throw new Error('模型没有返回内容，请点击重试。'); try { return JSON.parse(text) } catch { const start = text.indexOf('{'); if (start < 0) throw new Error('模型返回内容不完整，请点击重试。'); let depth = 0; let quoted = false; let escaped = false; for (let index = start; index < text.length; index += 1) { const char = text[index]; if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false } else if (char === '"') quoted = true; else if (char === '{') depth += 1; else if (char === '}') { depth -= 1; if (depth === 0) { try { return JSON.parse(text.slice(start, index + 1)) } catch { break } } } } const candidate = text.slice(start).replace(/,\s*$/, ''); for (const suffix of ['}', ']}', '}}', ']}']) { try { return JSON.parse(candidate + suffix) } catch { /* truncated output */ } } throw new Error('模型返回内容不完整，请点击重试。') } }
export const parseReviewResult = (value: string): ReviewResult => normalizeReviewResult(parseJsonOutput(value) as Partial<ReviewResult>)
export const MAX_REVISIONS = 2
const worldFields = ['name', 'genre', 'era', 'atmosphere', 'coreRule', 'centralConflict', 'summary'] as const
const worldReplySchema = { type: 'object', properties: { status: { type: 'string', enum: ['needs_clarification', 'world_ready'] }, phase: { type: 'string', enum: ['world'] }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, missingFields: { type: 'array', items: { type: 'string' } }, world: { type: 'object', properties: Object.fromEntries(worldFields.map((field) => [field, { type: 'string' }])), required: [...worldFields], additionalProperties: false } }, required: ['status'], additionalProperties: false }
const reviewSchema = { type: 'object', properties: { approved: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } }, suggestions: { type: 'array', items: { type: 'string' } }, score: { type: 'number' } }, required: ['approved', 'issues', 'suggestions'], additionalProperties: false }
const worldPrompt = '你是 NPC Creator Agent 的世界观构思阶段。只输出合法 JSON。信息不足时返回 status=needs_clarification、phase=world、question 和 options；信息充分时返回 status=world_ready、phase=world 和完整 world。world 必须包含 name、genre、era、atmosphere、coreRule、centralConflict、summary。不要生成 NPC。'
const reviewPrompt = '你是后台世界观质量评审 Agent。只输出合法 JSON。检查完整性、内部一致性、独特性、可用于游戏的核心冲突，以及与用户原始意图的一致性。任何一项不足都返回 approved=false，并给出具体 issues 和 suggestions；通过时 approved=true 且两数组为空。'
const publicWorldReply = (value: any) => { const reply: any = { status: value?.status }; for (const key of ['phase', 'question', 'options', 'missingFields', 'world']) if (value?.[key] !== undefined) reply[key] = value[key]; return reply }
const validWorld = (value: any) => { if (value?.status === 'needs_clarification') return publicWorldReply(value); if (value?.status !== 'world_ready' || value?.phase !== 'world' || !value.world || worldFields.some((field) => typeof value.world[field] !== 'string' || !value.world[field].trim())) throw new Error('世界观生成结果不完整，请点击重试。'); return { status: 'world_ready', phase: 'world', world: Object.fromEntries(worldFields.map((field) => [field, value.world[field].trim()])) } }
const feedback = (review: ReviewResult) => [...review.issues, ...review.suggestions].join('；') || '请补充缺失信息，并让世界观更具体、更适合玩法。'
const revisionContent = (draft: any, review: ReviewResult) => `上一版世界观草案：${JSON.stringify(draft)}。后台评审意见：${feedback(review)}。请修订并只返回完整的 status=world_ready、phase=world 和 world JSON。`
const openAIRequest = async ({ messages, model, system, schema, kind, draft }: { messages: any[]; model: string; system: string; schema: any; kind?: string; draft?: unknown }) => {
  const inputMessages = kind === 'review' ? [...messages, { role: 'user', content: `请评审下面的世界观草案。用户原始对话保留在前面的消息中。只输出评审 JSON。\n世界观草案：${JSON.stringify(draft)}` }] : messages
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, store: false, input: [{ role: 'system', content: system }, ...inputMessages], text: { format: { type: 'json_schema', name: schema === reviewSchema ? 'world_review' : 'world_reply', strict: true, schema } } }) })
  if (!response.ok) throw new Error('OpenAI request failed')
  const body = await response.json(); return parseJsonOutput(body.output_text || '') as any
}
/** Backend-only world review loop for the Vercel endpoint. Review data is never returned. */
export const runReviewedWorldGeneration = async ({ messages, model, request = openAIRequest }: { messages: any[]; model: string; request?: typeof openAIRequest }) => {
  const original = Array.isArray(messages) ? messages : []; let generation = [...original]
  for (let revision = 0; revision <= MAX_REVISIONS; revision += 1) {
    const draft = validWorld(await request({ kind: 'generation', messages: generation, model, system: worldPrompt, schema: worldReplySchema } as any)); if (draft.status === 'needs_clarification') return draft
    const review = normalizeReviewResult(await request({ kind: 'review', messages: original, draft: draft.world, model, system: reviewPrompt, schema: reviewSchema } as any)); if (review.approved) return draft
    if (revision >= MAX_REVISIONS) throw new Error('世界观草案未通过内部质量检查，请点击重试。')
    generation = [...original, { role: 'user', content: revisionContent(draft.world, review) }]
  }
  throw new Error('世界观草案未通过内部质量检查，请点击重试。')
}
const publicReply = (value: unknown, action: unknown) => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  if (action === 'analyze') {
    const draft: Record<string, unknown> = {}
    for (const key of ['worldOptions', 'roleOptions', 'functionOptions', 'personalityOptions']) if (source[key] !== undefined) draft[key] = source[key]
    return draft
  }
  const npc: Record<string, unknown> = {}
  for (const key of ['id', 'name', 'role', 'world', 'function', 'personality', 'summary', 'goal', 'speechStyle', 'background', 'behaviorRules', 'sourcePrompt']) if (source[key] !== undefined) npc[key] = source[key]
  if (!npc.name) throw new Error('模型没有返回有效 NPC。')
  return { status: 'complete', phase: 'npc', npc }
}
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const body = req.body || {}
  if (Array.isArray(body.messages)) {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
    try {
      const result = await runReviewedWorldGeneration({ messages: body.messages, model: body.model || process.env.OPENAI_MODEL || 'gpt-5' })
      return res.status(200).json(result)
    } catch (error) {
      return res.status(502).json({ error: error instanceof Error ? error.message : '模型请求失败，请点击重试。' })
    }
  }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
  const { action, description, draft, model } = req.body || {}
  const prompt = action === 'analyze' ? `拆解用户的NPC需求，给出每个字段3个可选项。用户描述：${description}` : `根据用户描述和已选择字段，输出完整NPC JSON。用户描述：${description}；选择：${JSON.stringify(draft)}`
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model || process.env.OPENAI_MODEL || 'gpt-5', input: [{ role: 'system', content: '你是 NPC Creator Agent，只输出合法 JSON，不要解释。' }, { role: 'user', content: prompt }], text: { format: { type: 'json_schema', name: action === 'analyze' ? 'npc_draft' : 'npc_profile', strict: true, schema: action === 'analyze' ? schema : { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, world: { type: 'string' }, function: { type: 'string' }, personality: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' }, goal: { type: 'string' }, speechStyle: { type: 'string' }, background: { type: 'string' }, sourcePrompt: { type: 'string' } }, required: ['id', 'name', 'role', 'world', 'function', 'personality', 'summary', 'goal', 'speechStyle', 'background', 'sourcePrompt'], additionalProperties: false } } } }) })
  if (!response.ok) return res.status(502).json({ error: 'OpenAI request failed' })
  const body = await response.json(); try { return res.status(200).json(publicReply(parseJsonOutput(body.output_text), action)) } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : '模型返回内容不完整，请点击重试。' }) }
}
