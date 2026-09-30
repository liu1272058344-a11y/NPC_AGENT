import test from 'node:test'
import assert from 'node:assert/strict'
import { downloadFilename, handleAssetRequest } from '../src/server/assets/http.mjs'

const workspaceId = '00000000-0000-4000-8000-000000000001'
const service = { listArchiveSummaries: async () => ({ archives: [], usage: { imageCount: 0, byteCount: 0 } }), getArchiveDetail: async (_w, id) => id === 'a1' ? { archive: { id }, prompts: [], images: [] } : null, saveGeneratedImage: async (body) => ({ asset: { id: 'i1', ...body }, usage: {}, nearLimit: false }), deleteImage: async () => ({ deleted: true }) }

test('requires a valid workspace UUID', async () => {
  assert.equal((await handleAssetRequest({ method: 'GET', headers: {} }, service)).body.error.code, 'INVALID_WORKSPACE')
  assert.equal((await handleAssetRequest({ method: 'GET', headers: { 'x-workspace-id': 'bad' } }, service)).status, 400)
})

test('lists archives and opens one archive', async () => {
  const list = await handleAssetRequest({ method: 'GET', headers: { 'x-workspace-id': workspaceId }, query: {} }, service)
  assert.equal(list.status, 200)
  assert.equal(list.body.ok, true)
  const detail = await handleAssetRequest({ method: 'GET', headers: { 'x-workspace-id': workspaceId }, query: { archiveId: 'a1' } }, service)
  assert.equal(detail.body.data.archive.id, 'a1')
})

test('saves and deletes images through stable envelopes', async () => {
  const saved = await handleAssetRequest({ method: 'POST', action: 'images', headers: { 'x-workspace-id': workspaceId }, body: { sourceUrl: 'https://example.com/a.png' } }, service)
  assert.equal(saved.body.data.asset.id, 'i1')
  const deleted = await handleAssetRequest({ method: 'DELETE', action: 'image', id: 'i1', headers: { 'x-workspace-id': workspaceId } }, service)
  assert.deepEqual(deleted.body, { ok: true, data: { deleted: true } })
})

test('maps service errors to the public error envelope', async () => {
  const failing = { ...service, listArchiveSummaries: async () => { throw Object.assign(new Error('数据库离线'), { code: 'ASSET_STORAGE_UNAVAILABLE', statusCode: 503 }) } }
  const result = await handleAssetRequest({ method: 'GET', headers: { 'x-workspace-id': workspaceId } }, failing)
  assert.deepEqual(result, { status: 503, body: { ok: false, error: { code: 'ASSET_STORAGE_UNAVAILABLE', message: '数据库离线' } } })
})

test('download filename includes archive and generation time safely', () => {
  assert.equal(downloadFilename({ archive_name: 'Vex / 医师', created_at: '2026-09-30T12:34:56Z', content_type: 'image/png' }), 'Vex-医师-20260930-123456.png')
})
