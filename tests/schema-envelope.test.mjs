import test from 'node:test'
import assert from 'node:assert/strict'
import { failedResult, isAgentResult, successResult } from '../src/schemas/agentResult.mjs'

test('agent result envelope is versioned and validates its public shape', () => {
  const result = successResult('run-1', 'world_agent', { name: 'Ash City' })
  assert.equal(result.schema_version, '0.2')
  assert.equal(isAgentResult(result), true)
  assert.equal(failedResult('run-2', 'visual_agent', { code: 'INVALID_SCHEMA', message: 'bad' }).status, 'failed')
  assert.equal(isAgentResult({ status: 'success' }), false)
})
