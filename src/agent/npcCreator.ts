import type { NPC, WorldProfile } from '../types/npc'
export interface AgentMessage { role: 'user' | 'assistant'; content: string }
export interface CreatorReply { status: 'needs_clarification' | 'world_ready' | 'complete'; phase?: 'world' | 'npc'; question?: string; options?: string[]; missingFields?: string[]; world?: WorldProfile; npc?: NPC }

export interface AgentConfig { endpoint: string; model: string; provider: 'backend' | 'deepseek' | 'openai'; apiKey: string }
let config: AgentConfig = { endpoint: 'https://api.deepseek.com', model: 'deepseek-chat', provider: 'deepseek', apiKey: '' }
export const setAgentConfig = (next: Partial<AgentConfig>) => { config = { ...config, ...next } }
const parseCreatorJson = (value: string): CreatorReply => {
  const cleaned = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(cleaned) as CreatorReply } catch {
    const start = cleaned.indexOf('{')
    const end = cleaned.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try { return JSON.parse(cleaned.slice(start, end + 1)) as CreatorReply } catch { /* handled below */ }
    }
    throw new Error('模型返回的内容不是有效 JSON，请点击重试。')
  }
}

export async function createNPC(messages: AgentMessage[]): Promise<CreatorReply> {
  const direct = config.provider !== 'backend'
  const endpoint = direct ? `${config.endpoint.replace(/\/$/, '')}/chat/completions` : config.endpoint
  const request = direct ? { model: config.model, messages: [{ role: 'system', content: '你是 NPC Creator Agent，工作流分为两阶段。第一阶段先构思世界观，补齐类型、时代、氛围、核心规则、主要冲突；不足时返回 {"status":"needs_clarification","phase":"world","question":"","options":[]}，充分后返回 {"status":"world_ready","phase":"world","world":{"name":"世界名称","genre":"类型","era":"时代背景","atmosphere":"氛围","coreRule":"核心规则","centralConflict":"主要冲突","summary":"完整世界概述"}}。只有当用户明确说“确认世界观”或“进入 NPC 设计阶段”后，才开始澄清 NPC 用途、玩家关系、目标和角色冲突；信息不足返回 needs_clarification 且 phase=npc，完整后返回 {"status":"complete","phase":"npc","npc":{...}}。NPC 必须自动命名，背景包含过去经历、当前处境及与玩家相遇原因，性格和行为规则各至少3项。只返回合法 JSON。' }, ...messages], response_format: { type: 'json_object' }, stream: false } : { messages, model: config.model }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(direct ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify(request) })
  const raw = await response.text()
  let body: any
  try { body = JSON.parse(raw) } catch { throw new Error(raw || `Backend returned an empty response (${response.status})`) }
  if (!response.ok) throw new Error(body.error || 'NPC Creator Agent request failed')
  if (direct) { const text = body.choices?.[0]?.message?.content || '{}'; return parseCreatorJson(String(text)) }
  return body as CreatorReply
}
