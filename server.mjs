import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'

if (existsSync('.env.local')) for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) { const match = line.match(/^([^#=]+)=(.*)$/); if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '') }
const npcSchema = { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, role: { type: 'string' }, world: { type: 'string' }, function: { type: 'string' }, summary: { type: 'string' }, background: { type: 'string' }, goal: { type: 'string' }, speechStyle: { type: 'string' }, sourcePrompt: { type: 'string' }, personality: { type: 'array', items: { type: 'string' } }, behaviorRules: { type: 'array', items: { type: 'string' } } }, required: ['id', 'name', 'role', 'world', 'function', 'summary', 'background', 'goal', 'speechStyle', 'sourcePrompt', 'personality', 'behaviorRules'], additionalProperties: false }
const worldSchema = { type: 'object', properties: { name: { type: 'string' }, genre: { type: 'string' }, era: { type: 'string' }, atmosphere: { type: 'string' }, coreRule: { type: 'string' }, centralConflict: { type: 'string' }, summary: { type: 'string' } }, required: ['name', 'genre', 'era', 'atmosphere', 'coreRule', 'centralConflict', 'summary'], additionalProperties: false }
const replySchema = { type: 'object', properties: { status: { type: 'string', enum: ['needs_clarification', 'world_ready', 'complete'] }, phase: { type: 'string', enum: ['world', 'npc'] }, question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, missingFields: { type: 'array', items: { type: 'string' } }, world: worldSchema, npc: npcSchema }, required: ['status'], additionalProperties: false }
const send = (res, status, body) => res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Headers': 'Content-Type' }).end(JSON.stringify(body))
const prompt = '你是 NPC Creator Agent，必须执行两阶段工作流。第一阶段“世界观构思”：先检查 genre 类型、era 时代背景、atmosphere 整体氛围、coreRule 核心规则、centralConflict 主要冲突。信息不足时每轮只问一个最重要问题，返回 status=needs_clarification、phase=world、question 和 3-5 个 options；信息充分后返回 status=world_ready、phase=world 和 world，world 必须包含 name、genre、era、atmosphere、coreRule、centralConflict、summary。此时禁止生成 npc。只有用户明确说确认世界观或进入 NPC 设计阶段，才进入第二阶段。第二阶段检查 function NPC用途、relationship 玩家关系、goal 核心目标、conflict 角色冲突；不足时返回 needs_clarification、phase=npc；充分后返回 status=complete、phase=npc 和 npc。NPC 必须根据世界观自动命名，background 包含过去经历、当前处境和与玩家相遇原因，personality 与 behaviorRules 各至少3项。不得返回空字段、待定、Markdown 或额外文字，只返回合法 JSON。'
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
    if (parsed.status === 'complete' && parsed.npc) { const npc = parsed.npc; if (!npc.name || /未命名|unnamed/i.test(String(npc.name))) npc.name = /末日|废土|幸存/.test(JSON.stringify(messages)) ? '灰烬药师' : '暮光行者'; npc.role ||= '关键角色'; npc.world ||= '游戏世界'; npc.function ||= '剧情引导'; npc.summary ||= `一名生活在${npc.world}中的${npc.role}，会通过任务和选择影响玩家。`; npc.background ||= `在${npc.world}中，${npc.role}经历了改变命运的事件，因此与玩家相遇并卷入当前冲突。`; npc.goal ||= '完成自己的使命'; npc.speechStyle ||= '根据经历谨慎、具体地表达'; npc.personality = Array.isArray(npc.personality) ? npc.personality.filter(Boolean) : npc.personality ? [String(npc.personality)] : ['谨慎', '坚韧', '重情']; npc.behaviorRules = Array.isArray(npc.behaviorRules) ? npc.behaviorRules.filter(Boolean) : npc.behaviorRules ? [String(npc.behaviorRules)] : ['保持角色设定一致', '根据玩家选择改变信任度', '在关键时刻遵守核心目标'] }
    return send(res, 200, parsed)
  } catch (error) { return send(res, 500, { error: error instanceof Error ? error.message : 'Unexpected server error' }) }
}).listen(8787, () => console.log('NPC Creator API listening at http://localhost:8787'))
