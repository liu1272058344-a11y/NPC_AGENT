import test from 'node:test'
import assert from 'node:assert/strict'
import { downloadFilename, handleAssetRequest } from '../src/server/assets/http.mjs'

const workspaceId = '00000000-0000-4000-8000-000000000001'
const service = { listArchiveSummaries: async () => ({ archives: [], worlds: [], usage: { imageCount: 0, byteCount: 0 } }), getArchiveDetail: async (_w, id) => id === 'a1' ? { archive: { id }, prompts: [], images: [] } : null, getWorld: async (_w, id) => id === 'world-1' ? { id, name: '灰烬边城', profile: {} } : null, listWorlds: async () => [], saveWorld: async (_w, value) => value, deleteWorld: async () => ({ deleted: true, detachedCharacterCount: 2 }), saveGeneratedImage: async (body) => ({ asset: { id: 'i1', ...body }, usage: {}, nearLimit: false }), deleteImage: async () => ({ deleted: true }) }

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

test('gets, saves, lists, and deletes world archives through stable envelopes', async () => {
  const headers = { 'x-workspace-id': workspaceId }
  const detail = await handleAssetRequest({ action: 'archive', method: 'GET', headers, query: { worldId: 'world-1' } }, service)
  assert.equal(detail.body.data.id, 'world-1')
  const saved = await handleAssetRequest({ action: 'archive', method: 'POST', headers, body: { world: { id: 'world-1', name: '灰烬边城', profile: {} } } }, service)
  assert.equal(saved.body.data.name, '灰烬边城')
  const listed = await handleAssetRequest({ action: 'archive', method: 'GET', headers, query: { worlds: '1' } }, service)
  assert.deepEqual(listed.body.data, [])
  const deleted = await handleAssetRequest({ action: 'archive', method: 'DELETE', headers, body: { worldId: 'world-1' } }, service)
  assert.deepEqual(deleted.body.data, { deleted: true, detachedCharacterCount: 2 })
  const missing = await handleAssetRequest({ action: 'archive', method: 'GET', headers, query: { worldId: 'missing' } }, service)
  assert.equal(missing.status, 404)
})
