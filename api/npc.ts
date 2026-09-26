export interface ReviewResult { approved: boolean; issues: string[]; suggestions: string[]; score?: number }
export const normalizeReviewResult = (value: Partial<ReviewResult> | null | undefined): ReviewResult => {
  const source = value && typeof value === 'object' ? value : {}
  const strings = (entry: unknown) => Array.isArray(entry) ? entry.map(String).filter(Boolean) : entry == null ? [] : [String(entry)]
  const score = typeof source.score === 'number' && Number.isFinite(source.score) ? source.score : undefined
  return { approved: source.approved === true, issues: strings(source.issues), suggestions: strings(source.suggestions), ...(score === undefined ? {} : { score }) }
}
export const parseJsonOutput = (value: unknown): unknown => { const text = String(value ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(); if (!text) throw new Error('模型没有返回内容，请点击重试。'); try { return JSON.parse(text) } catch { const start = text.indexOf('{'); if (start < 0) throw new Error('模型返回内容不完整，请点击重试。'); let depth = 0; let quoted = false; let escaped = false; for (let index = start; index < text.length; index += 1) { const char = text[index]; if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false } else if (char === '"') quoted = true; else if (char === '{') depth += 1; else if (char === '}') { depth -= 1; if (depth === 0) { try { return JSON.parse(text.slice(start, index + 1)) } catch { break } } } } const candidate = text.slice(start).replace(/,\s*$/, ''); for (const suffix of ['}', ']}', '}}', ']}']) { try { return JSON.parse(candidate + suffix) } catch { /* truncated output */ } } throw new Error('模型返回内容不完整，请点击重试。') } }
export const parseReviewResult = (value: string): ReviewResult => normalizeReviewResult(parseJsonOutput(value) as Partial<ReviewResult>)
const publicReply = (value: unknown) => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const allowed = new Set(['needs_clarification', 'world_ready', 'complete'])
  if (typeof source.status !== 'string' || !allowed.has(source.status)) throw new Error('模型返回了不支持的公开状态。')
  const reply: Record<string, unknown> = { status: source.status }
  for (const key of ['phase', 'question', 'options', 'missingFields', 'world', 'npc']) if (source[key] !== undefined) reply[key] = source[key]
  return reply
}
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is not configured' })
  const { action, description, draft, model } = req.body || {}
  const prompt = action === 'analyze' ? `拆解用户的NPC需求，给出每个字段3个可选项。用户描述：${description}` : `根据用户描述和已选择字段，输出完整NPC JSON。用户描述：${description}；选择：${JSON.stringify(draft)}`
  const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model || process.env.OPENAI_MODEL || 'gpt-5', input: [{ role: 'system', content: '你是 NPC Creator Agent，只输出合法 JSON，不要解释。' }, { role: 'user', content: prompt }], text: { format: { type: 'json_schema', name: action === 'analyze' ? 'npc_draft' : 'npc_profile', strict: true, schema: action === 'analyze' ? schema : { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, world: { type: 'string' }, function: { type: 'string' }, personality: { type: 'array', items: { type: 'string' } }, summary: { type: 'string' }, goal: { type: 'string' }, speechStyle: { type: 'string' }, background: { type: 'string' }, sourcePrompt: { type: 'string' } }, required: ['id', 'name', 'role', 'world', 'function', 'personality', 'summary', 'goal', 'speechStyle', 'background', 'sourcePrompt'], additionalProperties: false } } } }) })
  if (!response.ok) return res.status(502).json({ error: 'OpenAI request failed' })
  const body = await response.json(); try { return res.status(200).json(publicReply(parseJsonOutput(body.output_text))) } catch (error) { return res.status(502).json({ error: error instanceof Error ? error.message : '模型返回内容不完整，请点击重试。' }) }
}
