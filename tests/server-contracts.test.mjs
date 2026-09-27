import assert from 'node:assert/strict'
import test from 'node:test'

const contracts = await import('../src/server/contracts.mjs')
const errors = await import('../src/server/errors.mjs')

test('domain schemas accept complete and clarification results only when required fields are present', () => {
  assert.equal(contracts.worldResultSchema.safeParse({ status: 'world_ready', phase: 'world', world: {
    name: '灰烬边城', genre: '末日废土', era: '灾变后', atmosphere: '危险', coreRule: '配给', centralConflict: '争夺物资', summary: '幸存者寻找秩序'
  }}).success, true)
  assert.equal(contracts.worldResultSchema.safeParse({ status: 'world_ready', phase: 'world', world: { name: '不完整' } }).success, false)
  assert.equal(contracts.npcResultSchema.safeParse({ status: 'complete', phase: 'npc', npc: { name: '不完整' } }).success, false)
})

test('public errors expose a stable code and never include provider payloads', () => {
  const error = new errors.GatewayError('PROVIDER_EMPTY_RESPONSE', '模型没有返回内容。', { retryable: true, statusCode: 502, providerPayload: 'secret raw response' })
  assert.deepEqual(errors.toPublicError(error, 'req-1'), { code: 'PROVIDER_EMPTY_RESPONSE', message: '模型没有返回内容。', retryable: true, requestId: 'req-1' })
})
