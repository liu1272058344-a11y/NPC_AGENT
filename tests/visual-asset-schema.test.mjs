import test from 'node:test'
import assert from 'node:assert/strict'
import { createVisualAsset, validateVisualAsset } from '../src/schemas/visualAsset.mjs'
import { createAssetVersion } from '../src/schemas/assetVersion.mjs'

const visualInput = {
  visual_asset_id: 'va-1', source_character_id: 'npc-1', subject: '维克斯', appearance: '银灰短发',
  costume: '旧军装', weapon: '折叠长枪', environment: '雾港码头', lighting: '冷色逆光',
  camera: '中景侧面', art_style: 'dark fantasy concept art', prompt: 'subject...', negative_prompt: 'blurry', status: 'draft'
}

test('creates a complete VisualAsset with stable fields', () => {
  const asset = createVisualAsset(visualInput)
  assert.equal(asset.visual_asset_id, 'va-1')
  assert.equal(asset.status, 'draft')
  assert.equal(validateVisualAsset(asset).success, true)
})

test('rejects VisualAsset with missing visual fields or invalid status', () => {
  const result = validateVisualAsset({ ...visualInput, environment: '', status: 'unknown' })
  assert.equal(result.success, false)
})

test('creates an AssetVersion with explicit version metadata', () => {
  const version = createAssetVersion({ asset_id: 'asset-1', version: 2, prompt: 'prompt', provider: 'openai', model: 'gpt-image-1', url: 'https://example.test/a.png', created_at: '2026-09-29T00:00:00.000Z', status: 'ready' })
  assert.deepEqual(version, { asset_id: 'asset-1', version: 2, prompt: 'prompt', provider: 'openai', model: 'gpt-image-1', url: 'https://example.test/a.png', created_at: '2026-09-29T00:00:00.000Z', status: 'ready' })
})
