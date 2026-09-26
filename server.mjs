import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

if (existsSync('.env.local')) for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '') }

export const MAX_REVISIONS = 2
const npcSchema = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, world: { type: 'string' }, function: { type: 'string' }, summary: { type: 'string' }, background: { type: 'string' }, goal: { type: 'string' }, speechStyle: { type: 'string' }, sourcePrompt: { type: 'string' }, personality: { type: 'array', items: { type: 'string' } }, behaviorRules: { type: 'array', items: { type: 'string' } } }, required: ['id', 'name', 'role', 'world', 'function', 'summary', 'background', 'goal', 'speechStyle', 'sourcePrompt', 'personality', 'behaviorRules'], additionalProperties: false }
const worldSchema = { type: 'object', properties: { name: { type: 'string' }, genre: { type: 'string' }, era: { type: 'string' }, atmosphere: { type: 'string' }, coreRule: { type: 'string' }, centralConflict: { type: 'string' }, summary: { type: 'string' } }, required: ['name', 'genre', 'era', 'atmosphere', 'coreRule', 'centralConflict', 'summary'], additionalProperties: false }
const replySchema = { type: 'object', properties: { status: { type: 'string', enum: ['needs_clarification', 'world_ready', 'complete'] }, phase: { type: 'string', enum: ['world', 'npc'] }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, missingFields: { type: 'array', items: { type: 'string' } }, world: worldSchema, npc: npcSchema }, required: ['status'], additionalProperties: false }
const reviewSchema = { type: 'object', properties: { approved: { type: 'boolean' }, issues: { type: 'array', items: { type: 'string' } }, suggestions: { type: 'array', items: { type: 'string' } }, score: { type: 'number' } }, required: ['approved', 'issues', 'suggestions'], additionalProperties: false }
const send = (res, status, body) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Content-Type' }).end(JSON.stringify(body))
const prompt = '你是 NPC Creator Agent，必须执行两阶段工作流。第一阶段“世界观构思”：先检查 genre 类型、era 时代背景、atmosphere 整体氛围、coreRule 核心规则、centralConflict 主要冲突。信息不足时每轮只问一个最重要问题，返回 status=needs_clarification、phase=world、question 和 3-5 个 options；信息充分后返回 status=world_ready、phase=world 和 world，world 必须包含 name、genre、era、atmosphere、coreRule、centralConflict、summary。此时禁止生成 npc。只有用户明确说确认世界观或进入 NPC 设计阶段，才进入第二阶段。第二阶段检查 function NPC用途、relationship 玩家关系、goal 核心目标、conflict 角色冲突；不足时返回 status=needs_clarification、phase=npc；充分后返回 status=complete、phase=npc 和 npc。NPC 必须根据世界观自动命名，background 包含过去经历、当前处境和与玩家相遇原因，personality 与 behaviorRules 各至少3项。不得返回空字段、待定、Markdown 或额外文字，只返回合法 JSON。'
const worldReviewPrompt = '你是后台世界观质量评审 Agent。只输出合法 JSON，不要解释。检查世界观的完整性、内部一致性、独特性、可用于游戏的核心冲突，以及与用户原始意图的一致性。若有任何一项不足，approved 必须为 false，并在 issues 和 suggestions 中给出具体、可执行的修改意见。通过时 approved 为 true，issues 和 suggestions 使用空数组。输出格式：{"approved":true,"issues":[],"suggestions":[],"score":0}。'

export const parseJsonOutput = (text) => { const cleaned = String(text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(); if (!cleaned) throw new Error('Model output was empty'); try { return JSON.parse(cleaned) } catch { const start = cleaned.indexOf('{'); if (start < 0) throw new Error('Model output was not valid JSON'); let depth = 0; let quoted = false; let escaped = false; for (let index = start; index < cleaned.length; index += 1) { const char = cleaned[index]; if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false } else if (char === '"') quoted = true; else if (char === '{') depth += 1; else if (char === '}') { depth -= 1; if (depth === 0) { try { return JSON.parse(cleaned.slice(start, index + 1)) } catch { break } } } } const candidate = cleaned.slice(start).replace(/,\s*$/, ''); for (const suffix of ['}', ']}', '}}']) { try { return JSON.parse(candidate + suffix) } catch { /* bounded repair */ } } throw new Error('Model output was not valid JSON') } }
export const normalizeReviewResult = (value = {}) => { const source = value && typeof value === 'object' ? value : {}; const strings = (entry) => Array.isArray(entry) ? entry.map(String).filter(Boolean) : entry == null ? [] : [String(entry)]; const score = Number.isFinite(source.score) ? Number(source.score) : undefined; return { approved: source.approved === true, issues: strings(source.issues), suggestions: strings(source.suggestions), ...(score === undefined ? {} : { score }) } }
export const parseReviewResult = (text) => normalizeReviewResult(parseJsonOutput(text))
export const publicReply = (value) => { const allowed = new Set(['needs_clarification', 'world_ready', 'complete']); if (!allowed.has(value?.status)) throw new Error('Model returned an unsupported public status'); const reply = { status: value.status }; for (const key of ['phase', 'question', 'options', 'missingFields', 'world', 'npc']) if (value[key] !== undefined) reply[key] = value[key]; return reply }

const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0
const validateWorldReply = (value) => { if (value?.status === 'needs_clarification') return publicReply(value); if (value?.status !== 'world_ready' || value?.phase !== 'world' || !value.world || typeof value.world !== 'object') throw new Error('World generation returned an invalid phase result'); const fields = ['name', 'genre', 'era', 'atmosphere', 'coreRule', 'centralConflict', 'summary']; if (fields.some((field) => !nonEmpty(value.world[field]))) throw new Error('World generation returned an incomplete world'); return { status: 'world_ready', phase: 'world', world: Object.fromEntries(fields.map((field) => [field, String(value.world[field]).trim()])) } }
const reviewFeedback = (review) => [...review.issues, ...review.suggestions].filter(Boolean).join('；') || '请补充缺失信息，并让世界观更具体、更适合玩法。'
const revisionMessage = (draft, review) => `这是上一版世界观草案（仅供内部修订）：${JSON.stringify(draft)}。后台质量评审指出：${reviewFeedback(review)}。请根据这些意见修订世界观，保留用户原始意图，只返回完整的 status=world_ready、phase=world 和 world JSON；不要生成 NPC，不要解释。`
const providerOutput = (provider, payload) => provider === 'deepseek' ? payload.choices?.[0]?.message?.content : payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text

const reviewMessages = (messages, draft) => [
  ...(Array.isArray(messages) ? messages : []),
  {
    role: 'user',
    content: `请评审下面的世界观草案。用户原始对话保留在前面的消息中。只输出评审 JSON。\n世界观草案：${JSON.stringify(draft)}`
  }
]

export const requestModel = async ({ provider, key, model, messages, system, schema, kind, draft }) => {
  const isDeepSeek = provider === 'deepseek'
  const inputMessages = kind === 'review' ? reviewMessages(messages, draft) : (Array.isArray(messages) ? messages : [])
  let lastError
  for (let attempt = 0; attempt < (isDeepSeek ? 3 : 1); attempt += 1) {
    const retrySystem = attempt === 0 ? system : `${system} 再检查一次：只返回一个完整 JSON 对象，不要 Markdown、解释或空白。`
    const response = isDeepSeek ? await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: retrySystem }, ...inputMessages], response_format: { type: 'json_object' }, max_tokens: 2500, stream: false }) }) : await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, store: false, input: [{ role: 'system', content: retrySystem }, ...inputMessages], text: { format: { type: 'json_schema', name: schema === reviewSchema ? 'npc_creator_review' : 'npc_creator_reply', strict: true, schema } } }) })
    const raw = await response.text(); let payload
    try { payload = JSON.parse(raw) } catch { lastError = new Error(`${provider} returned a non-JSON response`); continue }
    if (!response.ok) throw new Error(payload.error?.message || `${provider} request failed`)
    const output = providerOutput(provider, payload)
    try { if (!output) throw new Error(`${provider} returned an empty response`); return parseJsonOutput(output) } catch (error) { lastError = error }
  }
  if (isDeepSeek) {
    const compactContext = inputMessages.map((message) => `${message.role === 'user' ? '用户' : 'Agent'}：${message.content}`).join('\n')
    const compact = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: `${system} 当前对话如下，请继续完成当前步骤。只返回一个完整 JSON。` }, { role: 'user', content: compactContext }], response_format: { type: 'json_object' }, max_tokens: 2500, stream: false }) })
    const compactRaw = await compact.text()
    try {
      const compactPayload = JSON.parse(compactRaw)
      if (!compact.ok) throw new Error(compactPayload.error?.message || 'deepseek request failed')
      const compactOutput = providerOutput(provider, compactPayload)
      if (!compactOutput) throw new Error('deepseek returned an empty response')
      return parseJsonOutput(compactOutput)
    } catch (error) { lastError = error }
  }
  throw lastError || new Error(`${provider} request failed`)
}

/** Internal generation -> review -> bounded revision loop. Review details never leave this function. */
export const runReviewedGeneration = async ({ phase, messages, model, provider, key, request = requestModel }) => {
  if (phase !== 'world') throw new Error(`Unsupported review phase: ${phase}`)
  const originalMessages = Array.isArray(messages) ? messages : []; let generationMessages = [...originalMessages]
  for (let revision = 0; revision <= MAX_REVISIONS; revision += 1) {
    const generated = await request({ kind: 'generation', phase, model, provider, key, messages: generationMessages, system: prompt, schema: replySchema }); const draft = validateWorldReply(generated); if (draft.status === 'needs_clarification') return draft
    const reviewValue = await request({ kind: 'review', phase, model, provider, key, messages: originalMessages, draft: draft.world, system: worldReviewPrompt, schema: reviewSchema }); const review = normalizeReviewResult(reviewValue); if (review.approved) return draft
    if (revision >= MAX_REVISIONS) throw new Error('世界观草案未通过内部质量检查，请点击重试。')
    generationMessages = [...originalMessages, { role: 'user', content: revisionMessage(draft.world, review) }]
  }
  throw new Error('世界观草案未通过内部质量检查，请点击重试。')
}

export const handleRequest = async ({ messages, model, provider = (process.env.AI_PROVIDER || 'openai').toLowerCase(), key = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY }) => { if (!Array.isArray(messages) || !messages.length) throw Object.assign(new Error('messages is required'), { statusCode: 400 }); if (!key) throw Object.assign(new Error(`${provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENAI_API_KEY'} is missing in .env.local`), { statusCode: 503 }); const selectedModel = provider === 'deepseek' ? (typeof model === 'string' && model.startsWith('deepseek') ? model : process.env.DEEPSEEK_MODEL || 'deepseek-chat') : model || process.env.OPENAI_MODEL || 'gpt-5'; return runReviewedGeneration({ phase: 'world', messages, model: selectedModel, provider, key }) }
export const startServer = (port = 8787) => createServer(async (req, res) => { if (req.method === 'OPTIONS') return send(res, 204, {}); if (req.method !== 'POST' || req.url !== '/api/npc') return send(res, 404, { error: 'Not found' }); let raw = ''; for await (const chunk of req) raw += chunk; try { const result = await handleRequest(JSON.parse(raw)); return send(res, 200, publicReply(result)) } catch (error) { return send(res, error?.statusCode || 500, { error: error instanceof Error ? error.message : 'Unexpected server error' }) } }).listen(port, () => console.log(`NPC Creator API listening at http://localhost:${port}`))
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startServer()
