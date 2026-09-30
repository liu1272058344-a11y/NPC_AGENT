import test from 'node:test'
import assert from 'node:assert/strict'
import { createAssetService } from '../src/server/assets/assetService.mjs'
import { handleAssetRequest } from '../src/server/assets/http.mjs'

const workspaceId = '00000000-0000-4000-8000-000000000001'
test('archive deletion removes blobs before records and scopes all database actions', async () => {
  const events = []
  const service = createAssetService({ db: {
    getArchiveDetail: async (workspace, id) => { assert.equal(workspace, workspaceId); assert.equal(id, 'npc'); return { images: [{ id: 'image', blob_url: 'https://blob/image' }] } },
    deleteImageRecord: async (workspace, id) => { assert.equal(workspace, workspaceId); events.push(id) },
    deleteEmptyArchive: async (workspace, id) => { assert.equal(workspace, workspaceId); events.push(id) },
  }, blob: { deleteImage: async (url) => events.push(url) } })
  const response = await handleAssetRequest({ action: 'archive', method: 'DELETE', headers: { 'x-workspace-id': workspaceId }, body: { id: 'npc' } }, service)
  assert.equal(response.status, 200)
  assert.deepEqual(events, ['https://blob/image', 'image', 'npc'])
})
test('blob failure preserves database records so archive deletion can be retried', async () => {
  let deleted = false
  const service = createAssetService({ db: {
    getArchiveDetail: async () => ({ images: [{ id: 'image', blob_url: 'https://blob/image' }] }),
    deleteImageRecord: async () => { deleted = true }, deleteEmptyArchive: async () => { deleted = true },
  }, blob: { deleteImage: async () => { throw new Error('storage unavailable') } } })
  await assert.rejects(service.deleteArchive(workspaceId, 'npc'), /storage unavailable/)
  assert.equal(deleted, false)
})
test('repeated archive deletion succeeds and rejects an empty archive identifier', async () => {
  const service = createAssetService({ db: { getArchiveDetail: async () => null }, blob: {} })
  assert.deepEqual(await service.deleteArchive(workspaceId, 'gone'), { deleted: true })
  await assert.rejects(service.deleteArchive(workspaceId, ''), { statusCode: 400 })
})
