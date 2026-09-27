import assert from 'node:assert/strict'
import test from 'node:test'
import { requestStructured } from '../src/server/llmGateway.mjs'

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const options = (fetchImpl, extra = {}) => ({ provider: 'deepseek', model: 'deepseek-chat', messages: [{ role: 'user', content: 'hello' }], instructions: 'return json', schema: { type: 'object' }, fetchImpl, sleep: async () => {}, random: () => 0, timeoutMs: 100, ...extra })

test('parses a completed DeepSeek chat JSON response', async () => {
  const value = await requestStructured(options(async () => response({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] })))
  assert.deepEqual(value, { ok: true })
})

test('cleans markdown JSON and repairs invalid JSON with a bounded retry', async () => {
  let attempts = 0
  const logs = []
  const value = await requestStructured(options(async (_url, init) => {
    attempts += 1
    const request = JSON.parse(init.body)
    assert.deepEqual(request.response_format, { type: 'json_object' })
    if (attempts === 1) return response({ choices: [{ message: { content: '```json\n{"ok":\n```' }, finish_reason: 'stop' }], usage: { total_tokens: 7 } })
    assert.match(request.messages[0].content, /修复/)
    return response({ choices: [{ message: { content: '```json\n{"ok":true}\n```' }, finish_reason: 'stop' }], usage: { total_tokens: 9 } })
  }, { logger: (entry) => logs.push(entry) }))
  assert.deepEqual(value, { ok: true })
  assert.equal(attempts, 2)
  assert.equal(logs[0].finishReason, 'stop')
  assert.equal(logs[0].usage.total_tokens, 7)
  assert.equal(logs[0].rawResponse.includes('{"ok":'), true)
  assert.deepEqual(logs.find((entry) => entry.parsedJson)?.parsedJson, { ok: true })
})

test('classifies empty, truncated, and filtered output without an unbounded retry', async () => {
  for (const body of [
    { choices: [{ message: { content: '' }, finish_reason: 'stop' }] },
    { choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'length' }] },
    { choices: [{ message: { content: '' }, finish_reason: 'content_filter' }] }
  ]) {
    await assert.rejects(requestStructured(options(async () => response(body))), (error) => ['EMPTY_RESPONSE', 'API_ERROR'].includes(error.code))
  }
})

test('stops invalid JSON repair after three total provider calls', async () => {
  let attempts = 0
  await assert.rejects(requestStructured(options(async () => {
    attempts += 1
    return response({ choices: [{ message: { content: '{bad json' }, finish_reason: 'stop' }] })
  })), (error) => error.code === 'INVALID_SCHEMA')
  assert.equal(attempts, 3)
})

test('retries 429 and succeeds on the next attempt, but does not retry 400', async () => {
  let attempts = 0
  const value = await requestStructured(options(async () => { attempts += 1; return attempts === 1 ? response({ error: { message: 'busy' } }, 429) : response({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] }) }))
  assert.deepEqual(value, { ok: true }); assert.equal(attempts, 2)
  attempts = 0
  await assert.rejects(requestStructured(options(async () => { attempts += 1; return response({ error: { message: 'bad request' } }, 400) })), (error) => error.code === 'API_ERROR')
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
