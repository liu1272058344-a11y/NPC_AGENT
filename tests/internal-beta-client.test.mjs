import test from 'node:test'
import assert from 'node:assert/strict'
import { createInternalBetaApi } from '../src/agent/internalBetaApi.mjs'

test('client includes cookies and never persists the password', async () => {
  const calls = []
  const api = createInternalBetaApi(async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ ok: true, authenticated: true, role: 'tester' }) } })
  assert.deepEqual(await api.login('secret-value'), { authenticated: true, role: 'tester' })
  assert.equal(calls[0].init.credentials, 'include')
  assert.deepEqual(JSON.parse(calls[0].init.body), { password: 'secret-value' })
  assert.equal(Object.keys(api).some((key) => String(api[key]).includes('secret-value')), false)
})

test('client exposes stable server errors', async () => {
  const api = createInternalBetaApi(async () => ({ ok: false, status: 429, json: async () => ({ error: { code: 'DAILY_COST_LIMIT_REACHED', message: '今日额度已用完' } }) }))
  await assert.rejects(api.usage(), { code: 'DAILY_COST_LIMIT_REACHED', message: '今日额度已用完' })
})
