export const SCHEMA_VERSION = '0.2'
export function successResult(runId, agent, data) { return { schema_version: SCHEMA_VERSION, run_id: runId, agent, status: 'success', data, errors: [] } }
export function failedResult(runId, agent, error) { return { schema_version: SCHEMA_VERSION, run_id: runId, agent, status: 'failed', data: {}, errors: [error] } }
export function isAgentResult(value) { const item = value && typeof value === 'object' ? value : null; return !!item && item.schema_version === SCHEMA_VERSION && typeof item.run_id === 'string' && typeof item.agent === 'string' && ['success', 'needs_input', 'queued', 'failed'].includes(String(item.status)) && !!item.data && typeof item.data === 'object' && Array.isArray(item.errors) }
