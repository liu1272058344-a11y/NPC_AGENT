import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env.local')) for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '') }
const npcSchema = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, world: { type: 'string' }, function: { type: 'string' }, summary: { type: 'string' }, background: { type: 'string' }, goal: { type: 'string' }, speechStyle: { type: 'string' }, sourcePrompt: { type: 'string' }, personality: { type: 'array', items: { type: 'string' } }, behaviorRules: { type: 'array', items: { type: 'string' } } }, required: ['id', 'name', 'role', 'world', 'function', 'summary', 'background', 'goal', 'speechStyle', 'sourcePrompt', 'personality', 'behaviorRules'], additionalProperties: false }
const replySchema = { type: 'object', properties: { status: { type: 'string', enum: ['needs_clarification', 'complete'] }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, missingFields: { type: 'array', items: { type: 'string' } }, npc: npcSchema }, required: ['status'], additionalProperties: false }
const send = (res, status, body) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Content-Type' }).end(JSON.stringify(body))
const prompt = '你是 NPC Creator Agent。你要通过多轮对话帮助用户创建游戏 NPC，而不是立即猜完所有内容。检查以下六项：gameType 游戏类型、style 游戏整体风格、function NPC用途、relationship 玩家与NPC关系、goal 角色核心目标、conflict 角色冲突。每轮先判断信息是否足够。若不足，只提出一个最重要、具体、易回答的问题，并返回 status=needs_clarification、missingFields 和 3-5 个简短 options 选项；options 必须针对当前问题。如果选项无法覆盖用户意图，页面会允许用户自由输入。不要重复用户已经回答的信息，不要一次问多个问题。若六项已经足够，返回 status=complete 和 npc。必须返回 JSON 对象，不能返回空白，不能返回 Markdown。示例：{"status":"needs_clarification","question":"这个 NPC 与玩家是什么关系？","options":["导师","敌对者","商人"]}。最终 npc 必须包含完整 summary、background、goal、function、personality、speechStyle、behaviorRules。'
const parseJsonOutput = (text) => { const cleaned = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(); try { return JSON.parse(cleaned) } catch { const start = cleaned.indexOf('{'); if (start < 0) throw new Error('Model output was not valid JSON'); let depth = 0; let quoted = false; let escaped = false; for (let index = start; index < cleaned.length; index += 1) { const char = cleaned[index]; if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false } else if (char === '"') quoted = true; else if (char === '{') depth += 1; else if (char === '}') { depth -= 1; if (depth === 0) return JSON.parse(cleaned.slice(start, index + 1)) } } throw new Error('Model output was not valid JSON') } }

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  if (req.method !== 'POST' || req.url !== '/api/npc') return send(res, 404, { error: 'Not found' })
  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    const { messages, model } = JSON.parse(raw)
    if (!Array.isArray(messages) || !messages.length) return send(res, 400, { error: 'messages is required' })
    const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
    const key = provider === 'deepseek' ? process.env.DEEPSEEK_API_KEY : process.env.OPENAI_API_KEY
    if (!key) return send(res, 503, { error: `${provider === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'OPENAI_API_KEY'} is missing in .env.local` })
    const selectedModel = provider === 'deepseek' ? (typeof model === 'string' && model.startsWith('deepseek') ? model : process.env.DEEPSEEK_MODEL || 'deepseek-chat') : model || process.env.OPENAI_MODEL || 'gpt-5'
    const api = provider === 'deepseek'
      ? await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: prompt }, ...messages], response_format: { type: 'json_object' }, max_tokens: 2000, stream: false }) })
      : await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selectedModel, store: false, input: [{ role: 'system', content: prompt }, ...messages], text: { format: { type: 'json_schema', name: 'npc_creator_reply', strict: true, schema: replySchema } } }) })
    const rawPayload = await api.text()
    let payload
    try { payload = JSON.parse(rawPayload) } catch { return send(res, 502, { error: `OpenAI returned non-JSON response: ${rawPayload.slice(0, 300)}` }) }
    if (!api.ok) return send(res, 502, { error: payload.error?.message || 'OpenAI request failed' })
    let outputText = provider === 'deepseek' ? payload.choices?.[0]?.message?.content : payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text
    let parsed
    try { if (!outputText) throw new Error('empty'); parsed = parseJsonOutput(outputText) } catch {
      if (provider !== 'deepseek') return send(res, 502, { error: `${provider} structured output was not valid JSON` })
      let retryPayload
      for (let attempt = 0; attempt < 3 && !parsed; attempt += 1) {
        const retry = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: `${prompt} 再强调一次：只返回一个完整 JSON 对象，不要空白，不要 Markdown。` }, ...messages], max_tokens: 2500, stream: false }) })
        retryPayload = await retry.json()
        outputText = retryPayload.choices?.[0]?.message?.content
        try { parsed = parseJsonOutput(outputText) } catch { /* retry */ }
      }
      if (!parsed) {
        const compactContext = messages.map((message) => `${message.role === 'user' ? '用户' : 'Agent'}：${message.content}`).join('\n')
        const compactRetry = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selectedModel, messages: [{ role: 'system', content: `${prompt} 当前对话如下，请继续完成下一步。只返回 JSON。` }, { role: 'user', content: compactContext }], response_format: { type: 'json_object' }, max_tokens: 2000, stream: false }) })
        const compactPayload = await compactRetry.json()
        outputText = compactPayload.choices?.[0]?.message?.content
        try { parsed = parseJsonOutput(outputText) } catch { /* handled below */ }
      }
      if (!parsed) return send(res, 502, { error: retryPayload?.error?.message || 'DeepSeek 暂时没有返回有效结果，请点击发送重新尝试。' })
    }
    if (parsed.status === 'complete' && parsed.npc) { parsed.npc.name ||= '未命名幸存者'; parsed.npc.role ||= '幸存者同伴'; parsed.npc.world ||= '末日废土'; parsed.npc.function ||= '生存引导'; parsed.npc.summary ||= '一名在末日环境中帮助玩家生存的 NPC。'; parsed.npc.personality ||= ['谨慎', '坚韧']; parsed.npc.behaviorRules ||= ['优先保护玩家', '资源不足时保持克制'] }
    return send(res, 200, parsed)
  } catch (error) { return send(res, 500, { error: error instanceof Error ? error.message : 'Unexpected server error' }) }
}).listen(8787, () => console.log('NPC Creator API listening at http://localhost:8787'))
