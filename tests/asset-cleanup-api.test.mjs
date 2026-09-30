import test from 'node:test'
import assert from 'node:assert/strict'
import { handleCleanupRequest } from '../src/server/assets/cleanupHttp.mjs'

test('cron cleanup requires the configured bearer secret', async () => {
  const service = { cleanupExpiredImages: async () => ({ deleted: 0, failed: 0 }) }
  assert.equal((await handleCleanupRequest({ headers: {} }, service, 'secret')).status, 401)
  assert.equal((await handleCleanupRequest({ headers: { authorization: 'Bearer wrong' } }, service, 'secret')).status, 401)
})

test('cron cleanup returns an idempotent batch result', async () => {
  const service = { cleanupExpiredImages: async ({ batchSize }) => ({ deleted: batchSize === 100 ? 2 : 0, failed: 1 }) }
  const result = await handleCleanupRequest({ headers: { authorization: 'Bearer secret' } }, service, 'secret')
  assert.deepEqual(result, { status: 200, body: { ok: true, data: { deleted: 2, failed: 1 } } })
})

test('cleanup tolerates a blob that was already removed', async () => {
  const removed = []
  const { createAssetService } = await import('../src/server/assets/assetService.mjs')
  const service = createAssetService({ db: { listExpiredImages: async () => [{ id: 'i1', workspace_id: 'w1', blob_url: 'gone' }], deleteImageRecord: async (_w, id) => removed.push(id) }, blob: { deleteImage: async () => { throw Object.assign(new Error('missing'), { statusCode: 404 }) } } })
  assert.deepEqual(await service.cleanupExpiredImages(), { deleted: 1, failed: 0 })
  assert.deepEqual(removed, ['i1'])
})
