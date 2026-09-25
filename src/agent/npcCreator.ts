import type { NPC } from '../types/npc'
export interface AgentMessage { role: 'user' | 'assistant'; content: string }
export interface CreatorReply { status: 'needs_clarification' | 'complete'; question?: string; options?: string[]; missingFields?: string[]; npc?: NPC }

export interface AgentConfig { endpoint: string; model: string; provider: 'backend' | 'deepseek' | 'openai'; apiKey: string }
let config: AgentConfig = { endpoint: 'http://localhost:8787/api/npc', model: 'deepseek-chat', provider: 'backend', apiKey: '' }
export const setAgentConfig = (next: Partial<AgentConfig>) => { config = { ...config, ...next } }

export async function createNPC(messages: AgentMessage[]): Promise<CreatorReply> {
  const direct = config.provider !== 'backend'
  const endpoint = direct ? `${config.endpoint.replace(/\/$/, '')}/chat/completions` : config.endpoint
  const request = direct ? { model: config.model, messages: [{ role: 'system', content: '你是 NPC Creator Agent。通过多轮对话澄清游戏类型、风格、NPC用途、玩家关系、核心目标和角色冲突。信息不足时返回 JSON：{"status":"needs_clarification","question":"","options":[]}；完整时返回 JSON：{"status":"complete","npc":{}}。只返回 JSON。' }, ...messages], response_format: { type: 'json_object' }, stream: false } : { messages, model: config.model }
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(direct ? { Authorization: `Bearer ${config.apiKey}` } : {}) }, body: JSON.stringify(request) })
  const raw = await response.text()
  let body: any
  try { body = JSON.parse(raw) } catch { throw new Error(raw || `Backend returned an empty response (${response.status})`) }
  if (!response.ok) throw new Error(body.error || 'NPC Creator Agent request failed')
  if (direct) { const text = body.choices?.[0]?.message?.content || '{}'; const cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim(); return JSON.parse(cleaned) as CreatorReply }
  return body as CreatorReply
}
