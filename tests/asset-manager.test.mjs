import test from 'node:test'
import assert from 'node:assert/strict'
import { createDatabase } from '../src/persistence/database.mjs'
import { saveAsset, createAssetVersion, listAssetVersions } from '../src/services/assets/assetManager.mjs'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'

function setup() { const file = `data/test-asset-manager-${randomUUID()}.sqlite`; return { file, db: createDatabase(file) } }

test('asset manager saves an asset and starts version one', () => {
  const { file, db } = setup()
  try { const asset = saveAsset(db, { asset_id: 'asset-1', project_id: 'project-1', source_id: 'npc-1', type: 'character', status: 'ready', payload: { url: 'https://example.test/a.png' } }); assert.equal(asset.asset_id, 'asset-1'); assert.equal(asset.version, 1); assert.equal(listAssetVersions(db, 'asset-1').length, 1) } finally { db.close(); rmSync(file, { force: true }); rmSync(`${file}-shm`, { force: true }); rmSync(`${file}-wal`, { force: true }) }
})

test('asset manager increments versions without overwriting old versions', () => {
  const { file, db } = setup()
  try { saveAsset(db, { asset_id: 'asset-2', project_id: 'project-1', type: 'scene', status: 'ready', payload: { url: 'v1' } }); const version = createAssetVersion(db, 'asset-2', { prompt: 'v2 prompt', url: 'v2', provider: 'openai', model: 'gpt-image-1', status: 'ready' }); assert.equal(version.version, 2); assert.deepEqual(listAssetVersions(db, 'asset-2').map((item) => item.version), [1, 2]) } finally { db.close(); rmSync(file, { force: true }); rmSync(`${file}-shm`, { force: true }); rmSync(`${file}-wal`, { force: true }) }
})
