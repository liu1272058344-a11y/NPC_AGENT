import assert from 'node:assert/strict'
import test from 'node:test'
import { requestStructured } from '../src/server/llmGateway.mjs'

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const options = (fetchImpl, extra = {}) => ({ provider: 'deepseek', model: 'deepseek-chat', messages: [{ role: 'user', content: 'hello' }], instructions: 'return json', schema: { type: 'object' }, fetchImpl, sleep: async () => {}, random: () => 0, timeoutMs: 100, ...extra })

test('parses a completed DeepSeek chat JSON response', async () => {
  const value = await requestStructured(options(async () => response({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] })))
  assert.deepEqual(value, { ok: true })
})

test('classifies empty, invalid, truncated, and filtered output without repairing it', async () => {
  for (const body of [
    { choices: [{ message: { content: '' }, finish_reason: 'stop' }] },
    { choices: [{ message: { content: '{"ok":' }, finish_reason: 'stop' }] },
    { choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'length' }] },
    { choices: [{ message: { content: '' }, finish_reason: 'content_filter' }] }
  ]) {
    await assert.rejects(requestStructured(options(async () => response(body))), (error) => ['PROVIDER_EMPTY_RESPONSE', 'PROVIDER_INVALID_JSON', 'PROVIDER_OUTPUT_TRUNCATED', 'PROVIDER_CONTENT_FILTERED'].includes(error.code))
  }
})

test('retries 429 and succeeds on the next attempt, but does not retry 400', async () => {
  let attempts = 0
  const value = await requestStructured(options(async () => { attempts += 1; return attempts === 1 ? response({ error: { message: 'busy' } }, 429) : response({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] }) }))
  assert.deepEqual(value, { ok: true }); assert.equal(attempts, 2)
  attempts = 0
  await assert.rejects(requestStructured(options(async () => { attempts += 1; return response({ error: { message: 'bad request' } }, 400) })), (error) => error.code === 'INTERNAL_ERROR')
  assert.equal(attempts, 1)
})

test('stops after three total attempts and respects cancellation', async () => {
  let attempts = 0
  await assert.rejects(requestStructured(options(async () => { attempts += 1; return response({ error: { message: 'down' } }, 503) })), (error) => error.code === 'PROVIDER_UNAVAILABLE')
  assert.equal(attempts, 3)
  const controller = new AbortController(); controller.abort()
  attempts = 0
  await assert.rejects(requestStructured(options(async () => { attempts += 1; return response({ choices: [{ message: { content: '' }, finish_reason: 'stop' }] }) }, { signal: controller.signal })), (error) => error.code === 'REQUEST_ABORTED')
  assert.equal(attempts, 0)
})
