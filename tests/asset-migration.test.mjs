import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateLocalAssetRecords } from '../src/agent/assetMigration.mjs'

const storageWith = (images) => { const values = new Map([['npc-forge-image-library', JSON.stringify(images)], ['npc-forge-current-npc', JSON.stringify({ id: 'npc-1', name: 'Vex', summary: 'Doctor' })]]); return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key), values } }
const image = { id: 'old-1', url: 'https://example.com/a.png', prompt: 'portrait', negativePrompt: '', model: 'seedream', type: 'NPC立绘', sourceId: 'npc-1' }

test('migrates a recoverable image with a deterministic key and clears completed local data', async () => {
  const storage = storageWith([image])
  const calls = []
  const result = await migrateLocalAssetRecords(storage, { saveRemoteArchive: async () => {}, saveRemoteImage: async (value) => { calls.push(value); return {} } })
  assert.equal(calls[0].idempotencyKey, 'legacy:old-1')
  assert.equal(storage.getItem('npc-forge-image-library'), null)
  assert.deepEqual(result, { migrated: 1, expired: 0, pending: 0, migratedArchives: 1 })
})

test('classifies expired sources but retains records after transient failure', async () => {
  const expiredStorage = storageWith([image])
  const expired = await migrateLocalAssetRecords(expiredStorage, { saveRemoteArchive: async () => {}, saveRemoteImage: async () => { throw Object.assign(new Error('expired'), { code: 'SOURCE_EXPIRED' }) } })
  assert.deepEqual(expired, { migrated: 0, expired: 1, pending: 0, migratedArchives: 1 })
  assert.equal(expiredStorage.getItem('npc-forge-image-library'), null)
  const retryStorage = storageWith([image])
  const pending = await migrateLocalAssetRecords(retryStorage, { saveRemoteArchive: async () => {}, saveRemoteImage: async () => { throw new Error('offline') } })
  assert.equal(pending.pending, 1)
  assert.ok(retryStorage.getItem('npc-forge-image-library'))
})

test('migrates NPC and prompt records even when no legacy images exist', async () => {
  const storage = storageWith([])
  storage.setItem('npc-forge-asset-library', JSON.stringify([{ type: 'NPC立绘', promptEn: 'portrait', negativePrompt: 'blur' }]))
  const calls = []
  const result = await migrateLocalAssetRecords(storage, { saveRemoteArchive: async (value) => calls.push(value), saveRemoteImage: async () => ({}) })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].archive.id, 'npc-1')
  assert.equal(calls[0].prompts[0].prompt, 'portrait')
  assert.equal(result.migratedArchives, 1)
})

test('retains a legacy image on rate limits and server outages', async () => {
  for (const code of ['SOURCE_RATE_LIMITED', 'SOURCE_UNAVAILABLE']) {
    const storage = storageWith([image])
    const result = await migrateLocalAssetRecords(storage, { saveRemoteArchive: async () => {}, saveRemoteImage: async () => { throw Object.assign(new Error(code), { code }) } })
    assert.equal(result.pending, 1)
    assert.ok(storage.getItem('npc-forge-image-library'))
  }
})
