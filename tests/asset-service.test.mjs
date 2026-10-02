import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssetService } from '../src/server/assets/assetService.mjs'

const input = { workspaceId: '00000000-0000-4000-8000-000000000001', idempotencyKey: 'save-1', archive: { id: 'npc-1', name: 'Vex', summary: 'Doctor' }, prompt: { prompt: 'portrait', negativePrompt: '', provider: 'volcengine', modelId: 'seedream' }, sourceUrl: 'https://example.com/a.png', provider: 'volcengine', modelId: 'seedream' }

const harness = (usage = { imageCount: 0, byteCount: 0 }) => {
  const records = []
  const deleted = []
  const released = []
  const db = {
    ensureWorkspace: async () => {}, upsertArchive: async () => {},
    workspaceExists: async () => true,
    findByIdempotencyKey: async () => null,
    insertPrompt: async () => ({ id: 'prompt-1' }),
    reserveQuota: async (_workspaceId, byteSize) => ({ imageCount: usage.imageCount + 1, byteCount: usage.byteCount + byteSize }),
    releaseQuota: async (_workspaceId, byteSize) => released.push(byteSize),
    insertImageAsset: async (record) => { records.push(record); return record },
    getWorkspaceUsage: async () => usage,
    listArchives: async () => [], getArchiveDetail: async () => null,
    listWorlds: async () => [], findWorld: async () => null, upsertWorld: async (_workspaceId, world) => world, deleteWorld: async () => ({ deleted: true, detachedCharacterCount: 0 }),
    findImageAsset: async () => null, deleteImageRecord: async () => {}, listExpiredImages: async () => []
  }
  const service = createAssetService({ db, source: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png', byteSize: 3 }), blob: { putImage: async (pathname) => ({ url: `https://blob/${pathname}`, pathname }), deleteImage: async (value) => deleted.push(value) }, now: () => new Date('2026-09-30T00:00:00Z'), uuid: () => 'image-1' })
  return { service, records, deleted, released, db }
}

test('saves an image with a thirty day expiry and quota usage', async () => {
  const { service } = harness()
  const result = await service.saveGeneratedImage(input)
  assert.equal(result.asset.expiresAt, '2026-10-30T00:00:00.000Z')
  assert.equal(result.usage.imageCount, 1)
  assert.equal(result.nearLimit, false)
})

test('returns an existing record for the same idempotency key', async () => {
  const { service, db, records } = harness()
  db.findByIdempotencyKey = async () => ({ id: 'existing', byte_size: 10 })
  const result = await service.saveGeneratedImage(input)
  assert.equal(result.asset.id, 'existing')
  assert.equal(records.length, 0)
})

test('rejects atomic quota reservation before uploading a blob', async () => {
  const { service, db, deleted } = harness()
  db.reserveQuota = async () => { throw Object.assign(new Error('quota'), { code: 'QUOTA_COUNT_EXCEEDED' }) }
  await assert.rejects(() => service.saveGeneratedImage(input), { code: 'QUOTA_COUNT_EXCEEDED' })
  assert.equal(deleted.length, 0)
})

test('removes the blob and releases quota after database failure', async () => {
  const { service, db, deleted, released } = harness()
  db.insertImageAsset = async () => { throw new Error('database offline') }
  await assert.rejects(() => service.saveGeneratedImage(input), /database offline/)
  assert.equal(deleted.length, 1)
  assert.deepEqual(released, [3])
})

test('marks usage near either quota at eighty percent', async () => {
  const { service } = harness({ imageCount: 15, byteCount: 10 })
  const result = await service.saveGeneratedImage(input)
  assert.equal(result.nearLimit, true)
})

test('returns the winner of a concurrent duplicate save', async () => {
  const { service, db, deleted, released } = harness()
  let lookups = 0
  db.findByIdempotencyKey = async () => (++lookups === 1 ? null : { id: 'winner', byte_size: 3 })
  db.insertImageAsset = async () => { throw Object.assign(new Error('duplicate'), { code: '23505' }) }
  db.getWorkspaceUsage = async () => ({ imageCount: 1, byteCount: 3 })
  const result = await service.saveGeneratedImage(input)
  assert.equal(result.asset.id, 'winner')
  assert.equal(deleted.length, 1)
  assert.deepEqual(released, [3])
})

test('reports a stale workspace instead of recreating it while listing', async () => {
  const { service, db } = harness()
  db.workspaceExists = async () => false
  await assert.rejects(() => service.listArchiveSummaries(input.workspaceId), { code: 'STALE_WORKSPACE' })
})

test('world archives upsert by stable id while same-name ids remain distinct', async () => {
  const { service, db } = harness()
  const worlds = new Map()
  db.upsertWorld = async (_workspaceId, value) => { worlds.set(value.id, value); return { ...value, updated_at: '2026-10-02T00:00:00Z' } }
  db.listWorlds = async () => [...worlds.values()]
  await service.saveWorld('w', { id: 'world-1', name: '同名世界', profile: { summary: '第一版' } })
  await service.saveWorld('w', { id: 'world-1', name: '同名世界', profile: { summary: '第二版' } })
  await service.saveWorld('w', { id: 'world-2', name: '同名世界', profile: { summary: '另一个世界' } })
  assert.equal(worlds.size, 2)
  assert.equal(worlds.get('world-1').profile.summary, '第二版')
  assert.equal((await service.listWorlds('w')).length, 2)
})

test('character archive accepts a valid world link and legacy independent characters', async () => {
  const { service, db } = harness()
  const saved = []
  db.findWorld = async (_workspaceId, id) => id === 'world-1' ? { id, name: '灰烬边城', profile: { summary: '世界快照' } } : null
  db.upsertArchive = async (_workspaceId, archive) => { saved.push(archive); return archive }
  await service.saveArchive('w', { archive: { id: 'character-1', name: '林医生', profile: { category: 'character', worldId: 'world-1', world: { name: '灰烬边城' } } } })
  await service.saveArchive('w', { archive: { id: 'legacy-character', name: '旧角色', profile: { category: 'character', world: '旧世界' } } })
  assert.equal(saved.length, 2)
  await assert.rejects(() => service.saveArchive('w', { archive: { id: 'bad', name: '错误角色', profile: { category: 'character', worldId: 'missing' } } }), /所属世界不存在/)
})

test('world deletion is idempotent and reports detached characters', async () => {
  const { service, db } = harness()
  db.deleteWorld = async () => ({ deleted: true, detachedCharacterCount: 3 })
  assert.deepEqual(await service.deleteWorld('w', 'world-1'), { deleted: true, detachedCharacterCount: 3 })
  await assert.rejects(() => service.deleteWorld('w', ''), { statusCode: 400 })
})
