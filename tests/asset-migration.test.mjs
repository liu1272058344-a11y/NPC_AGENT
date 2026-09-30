import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateLocalAssetRecords } from '../src/agent/assetMigration.mjs'

const storageWith = (images) => { const values = new Map([['npc-forge-image-library', JSON.stringify(images)], ['npc-forge-current-npc', JSON.stringify({ id: 'npc-1', name: 'Vex', summary: 'Doctor' })]]); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values } }
const image = { id: 'old-1', url: 'https://example.com/a.png', prompt: 'portrait', negativePrompt: '', model: 'seedream', type: 'NPC立绘', sourceId: 'npc-1' }

test('migrates a recoverable image with a deterministic key and clears completed local data', async () => {
  const storage = storageWith([image])
  const calls = []
  const result = await migrateLocalAssetRecords(storage, { saveRemoteImage: async (value) => { calls.push(value); return {} } })
  assert.equal(calls[0].idempotencyKey, 'legacy:old-1')
  assert.equal(storage.getItem('npc-forge-image-library'), null)
  assert.deepEqual(result, { migrated: 1, expired: 0, pending: 0 })
})

test('classifies expired sources but retains records after transient failure', async () => {
  const expiredStorage = storageWith([image])
  const expired = await migrateLocalAssetRecords(expiredStorage, { saveRemoteImage: async () => { throw Object.assign(new Error('expired'), { code: 'SOURCE_EXPIRED' }) } })
  assert.deepEqual(expired, { migrated: 0, expired: 1, pending: 0 })
  assert.equal(expiredStorage.getItem('npc-forge-image-library'), null)
  const retryStorage = storageWith([image])
  const pending = await migrateLocalAssetRecords(retryStorage, { saveRemoteImage: async () => { throw new Error('offline') } })
  assert.equal(pending.pending, 1)
  assert.ok(retryStorage.getItem('npc-forge-image-library'))
})
