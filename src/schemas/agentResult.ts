export const SCHEMA_VERSION = '0.2' as const
export type AgentStatus = 'success' | 'needs_input' | 'queued' | 'failed'
export interface AgentError { code: string; message: string; details?: unknown }
export interface AgentResult<T extends Record<string, unknown> = Record<string, unknown>> { schema_version: typeof SCHEMA_VERSION; run_id: string; agent: string; status: AgentStatus; data: T; errors: AgentError[] }
export function successResult<T extends Record<string, unknown>>(runId: string, agent: string, data: T): AgentResult<T> { return { schema_version: SCHEMA_VERSION, run_id: runId, agent, status: 'success', data, errors: [] } }
export function failedResult(runId: string, agent: string, error: AgentError): AgentResult { return { schema_version: SCHEMA_VERSION, run_id: runId, agent, status: 'failed', data: {}, errors: [error] } }
export function isAgentResult(value: unknown): value is AgentResult { const item = value as Record<string, unknown> | null; return !!item && item.schema_version === SCHEMA_VERSION && typeof item.run_id === 'string' && typeof item.agent === 'string' && ['success', 'needs_input', 'queued', 'failed'].includes(String(item.status)) && !!item.data && typeof item.data === 'object' && Array.isArray(item.errors) }
