import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssetApi, getWorkspaceId, assetErrorMessage } from '../src/agent/assetApi.mjs'

test('creates and reuses only an anonymous workspace id locally', () => {
  const values = new Map()
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) }
  const first = getWorkspaceId(storage, () => '00000000-0000-4000-8000-000000000001')
  assert.equal(getWorkspaceId(storage), first)
  assert.deepEqual([...values.keys()], ['npc-forge-workspace-id'])
})

test('sends the workspace header and parses successful envelopes', async () => {
  const requests = []
  const api = createAssetApi({ workspaceId: 'w1', fetchImpl: async (url, init) => { requests.push({ url, init }); return new Response(JSON.stringify({ ok: true, data: { archives: [] } }), { headers: { 'content-type': 'application/json' } }) } })
  assert.deepEqual(await api.listRemoteAssets(), { archives: [] })
  assert.equal(requests[0].init.headers['X-Workspace-Id'], 'w1')
})

test('maps quota and database failures to actionable Chinese copy', () => {
  assert.match(assetErrorMessage('QUOTA_COUNT_EXCEEDED'), /20/)
  assert.match(assetErrorMessage('QUOTA_BYTES_EXCEEDED'), /100 MB/)
  assert.match(assetErrorMessage('ASSET_STORAGE_UNAVAILABLE'), /重试/)
  assert.match(assetErrorMessage('STALE_WORKSPACE'), /工作区/)
})
