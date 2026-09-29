import test from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { createDatabase, listStoredAssets, savePipelineResult } from '../src/persistence/database.mjs'

test('persistence stores projects, assets and agent runs', () => {
  const file = `data/test-${Date.now()}.sqlite`
  const db = createDatabase(file)
  const result = savePipelineResult(db, { run_id: 'run-test', status: 'success', project: { project_id: 'P1', name: 'Test', genre: 'fantasy', style: 'dark', world: { name: 'World' }, characters: [{ character_id: 'C1' }], assets: [{ asset_id: 'A1', source_id: 'C1', type: 'character', status: 'draft', version: 1, prompt: 'test' }] } })
  assert.equal(result.assetCount, 1)
  assert.equal(listStoredAssets(db, 'P1')[0].asset_id, 'A1')
  db.close(); rmSync(file, { force: true }); rmSync(`${file}-shm`, { force: true }); rmSync(`${file}-wal`, { force: true })
})
