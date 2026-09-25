import type { NPC } from '../types/npc'
export interface AgentMessage { role: 'user' | 'assistant'; content: string }
export interface CreatorReply { status: 'needs_clarification' | 'complete'; question?: string; options?: string[]; missingFields?: string[]; npc?: NPC }

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
  const request = direct ? { model: config.model, messages: [{ role: 'system', content: '你是 NPC Creator Agent。通过多轮对话澄清游戏类型、风格、NPC用途、玩家关系、核心目标和角色冲突。信息不足时返回 JSON：{"status":"needs_clarification","question":"","options":[]}；完整时返回 JSON：{"status":"complete","npc":{"name":"有辨识度的中文名","summary":"具体概述","background":"包含过去经历、当前处境和与玩家相遇原因的完整背景","personality":["至少3项"],"behaviorRules":["至少3条"]}}。不要使用未命名 NPC、空背景或套话。只返回 JSON。' }, ...messages], response_format: { type: 'json_object' }, stream: false } : { messages, model: config.model }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(direct ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify(request) })
  const raw = await response.text()
  let body: any
  try { body = JSON.parse(raw) } catch { throw new Error(raw || `Backend returned an empty response (${response.status})`) }
  if (!response.ok) throw new Error(body.error || 'NPC Creator Agent request failed')
  if (direct) { const text = body.choices?.[0]?.message?.content || '{}'; return parseCreatorJson(String(text)) }
  return body as CreatorReply
}
