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

test('world client methods preserve workspace identity and encode archive ids', async () => {
  const requests = []
  const fetchImpl = async (url, init) => {
    requests.push({ url, init })
    const data = init?.method === 'DELETE' ? { deleted: true, detachedCharacterCount: 1 } : url.includes('worldId=') ? { id: 'world / 1', name: '世界', profile: {} } : { id: 'world / 1', name: '世界', profile: {} }
    return new Response(JSON.stringify({ ok: true, data }), { headers: { 'content-type': 'application/json' } })
  }
  const api = createAssetApi({ workspaceId: 'w1', fetchImpl })
  assert.equal((await api.getWorld('world / 1')).id, 'world / 1')
  await api.saveWorld({ id: 'world / 1', name: '世界', profile: {} })
  assert.equal((await api.deleteWorld('world / 1')).detachedCharacterCount, 1)
  assert.equal(requests[0].url, '/api/assets/archive?worldId=world%20%2F%201')
  assert.deepEqual(JSON.parse(requests[1].init.body), { world: { id: 'world / 1', name: '世界', profile: {} } })
  assert.deepEqual(JSON.parse(requests[2].init.body), { worldId: 'world / 1' })
  assert.ok(requests.every(({ init }) => init.headers['X-Workspace-Id'] === 'w1'))
})
