import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssetService } from '../src/server/assets/assetService.mjs'

const input = { workspaceId: '00000000-0000-4000-8000-000000000001', idempotencyKey: 'save-1', archive: { id: 'npc-1', name: 'Vex', summary: 'Doctor' }, prompt: { prompt: 'portrait', negativePrompt: '', provider: 'volcengine', modelId: 'seedream' }, sourceUrl: 'https://example.com/a.png', provider: 'volcengine', modelId: 'seedream' }

const harness = (usage = { imageCount: 0, byteCount: 0 }) => {
  const records = []
  const deleted = []
  const db = {
    ensureWorkspace: async () => {}, upsertArchive: async () => {},
    findByIdempotencyKey: async () => null,
    insertPrompt: async () => ({ id: 'prompt-1' }),
    insertImageWithQuota: async (record) => { records.push(record); return { record, usage: { imageCount: usage.imageCount + 1, byteCount: usage.byteCount + record.byteSize } } },
    getWorkspaceUsage: async () => usage,
    listArchives: async () => [], getArchiveDetail: async () => null,
    findImageAsset: async () => null, deleteImageRecord: async () => {}, listExpiredImages: async () => []
  }
  const service = createAssetService({ db, source: async () => ({ bytes: new Uint8Array([1, 2, 3]), contentType: 'image/png', byteSize: 3 }), blob: { putImage: async (pathname) => ({ url: `https://blob/${pathname}`, pathname }), deleteImage: async (value) => deleted.push(value) }, now: () => new Date('2026-09-30T00:00:00Z'), uuid: () => 'image-1' })
  return { service, records, deleted, db }
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

test('maps atomic quota rejection and removes an orphan after database failure', async () => {
  const { service, db, deleted } = harness()
  db.insertImageWithQuota = async () => { throw Object.assign(new Error('quota'), { code: 'QUOTA_COUNT_EXCEEDED' }) }
  await assert.rejects(() => service.saveGeneratedImage(input), { code: 'QUOTA_COUNT_EXCEEDED' })
  assert.equal(deleted.length, 1)
})

test('marks usage near either quota at eighty percent', async () => {
  const { service } = harness({ imageCount: 15, byteCount: 10 })
  const result = await service.saveGeneratedImage(input)
  assert.equal(result.nearLimit, true)
})
