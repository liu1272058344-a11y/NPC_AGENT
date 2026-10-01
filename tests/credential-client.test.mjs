import test from 'node:test'
import assert from 'node:assert/strict'
import { loadCredentialStatus, saveCredential } from '../src/agent/credentials.mjs'

test('credential save rejects empty keys instead of reporting success', async () => {
  let called = false
  await assert.rejects(() => saveCredential('volcengine', '   ', async () => { called = true }), /请输入 API Key/)
  assert.equal(called, false)
})

test('credential save and status use the protected session endpoint', async () => {
  let saved
  const fetchImpl = async (url, init) => {
    if (init?.method === 'POST') { saved = { url, init }; return new Response(JSON.stringify({ ok: true }), { status: 200 }) }
    return new Response(JSON.stringify({ ok: true, providers: ['volcengine'] }), { status: 200 })
  }
  await saveCredential('volcengine', 'private-key', fetchImpl)
  assert.equal(saved.url, '/api/credentials')
  assert.deepEqual(JSON.parse(saved.init.body), { provider: 'volcengine', key: 'private-key' })
  assert.deepEqual(await loadCredentialStatus(fetchImpl), ['volcengine'])
})
