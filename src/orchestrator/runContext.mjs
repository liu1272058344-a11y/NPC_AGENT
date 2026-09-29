import { randomUUID } from 'node:crypto'

export function createRunContext(input = {}) {
  return { run_id: input.runId || randomUUID(), schema_version: '0.2', requirement: input.requirement || '', style: input.style || '', steps: [], started_at: new Date().toISOString() }
}

export function recordStep(context, agent, status, details = {}) {
  context.steps.push({ agent, status, at: new Date().toISOString(), ...details })
  return context
}
