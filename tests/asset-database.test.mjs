import test from 'node:test'
import assert from 'node:assert/strict'
import { ASSET_LIMITS, expiresAtFrom } from '../src/server/assets/config.mjs'
import { createAssetDatabase, createNeonQueryAdapter } from '../src/server/assets/database.mjs'
import { readFile } from 'node:fs/promises'

test('remote asset limits include workspace and project hard ceilings', () => {
  assert.deepEqual(ASSET_LIMITS, { maxImages: 20, maxBytes: 100 * 1024 * 1024, projectMaxImages: 200, projectMaxBytes: 1024 * 1024 * 1024, retentionDays: 30, warningRatio: 0.8, maxSourceBytes: 20 * 1024 * 1024, sourceTimeoutMs: 15000 })
  assert.equal(expiresAtFrom(new Date('2026-09-30T00:00:00Z')), '2026-10-30T00:00:00.000Z')
})

test('database queries always include workspace ownership', async () => {
  const calls = []
  const db = createAssetDatabase(async (text, values = []) => { calls.push({ text, values }); return { rows: [], rowCount: 0 } })
  await db.listArchives('workspace-1')
  await db.findImageAsset('workspace-1', 'image-1')
  assert.equal(calls.length, 2)
  assert.ok(calls.every((call) => /workspace_id/.test(call.text)))
  assert.ok(calls.every((call) => call.values.includes('workspace-1')))
})

test('database exposes an atomic quota reservation transaction', async () => {
  const calls = []
  const db = createAssetDatabase(async (text, values = []) => { calls.push({ text, values }); return { rows: [{ image_count: '1', byte_count: '2048' }], rowCount: 1 } })
  const result = await db.reserveUsage('workspace-1')
  assert.deepEqual(result, { imageCount: 1, byteCount: 2048 })
  assert.match(calls[0].text, /FOR UPDATE/)
})

test('archive and prompt identities are isolated by workspace', async () => {
  const schema = await readFile(new URL('../db/migrations/001_remote_asset_library.sql', import.meta.url), 'utf8')
  assert.match(schema, /PRIMARY KEY \(workspace_id, id\)/)
  assert.match(schema, /FOREIGN KEY \(workspace_id, archive_id\)/)
})

test('normalizes the Neon array result and groups archives by the composite key', async () => {
  const query = createNeonQueryAdapter({ query: async () => [{ id: 'a1' }] })
  assert.deepEqual(await query('SELECT 1', []), { rows: [{ id: 'a1' }], rowCount: 1 })
  const calls = []
  const db = createAssetDatabase(async (text) => { calls.push(text); return { rows: [], rowCount: 0 } })
  await db.listArchives('w1')
  assert.match(calls[0], /GROUP BY a\.workspace_id, a\.id/)
})

test('reserves and releases quota with atomic workspace counters', async () => {
  const calls = []
  const db = createAssetDatabase(async (text) => { calls.push(text); return { rows: [{ image_count: 2, byte_count: 300 }], rowCount: 1 } })
  assert.deepEqual(await db.reserveQuota('w1', 100, { maxImages: 20, maxBytes: 104857600 }), { imageCount: 2, byteCount: 300 })
  await db.releaseQuota('w1', 100)
  assert.match(calls[0], /UPDATE workspaces/)
  assert.match(calls[0], /internal_beta_project_usage/)
  assert.match(calls[0], /project_images < \$5/)
  assert.match(calls[0], /project_bytes\+\$2 <= \$6/)
  assert.match(calls[1], /internal_beta_project_usage/)
})

test('deleting an image releases both workspace and project usage', async () => {
  const calls = []
  const db = createAssetDatabase(async (text, values) => { calls.push({ text, values }); return { rows: [], rowCount: 1 } })
  await db.deleteImageRecord('w1', 'image-1')
  assert.match(calls[0].text, /internal_beta_project_usage/)
  assert.match(calls[0].text, /SUM\(byte_size\)/)
  assert.deepEqual(calls[0].values, ['w1', 'image-1'])
})
