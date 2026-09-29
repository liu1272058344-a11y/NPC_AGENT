import test from 'node:test'
import assert from 'node:assert/strict'
import { exportAsset, generateStructured, generateVideo } from '../src/services/index.mjs'
import { listProviders } from '../src/services/llm/providerRegistry.mjs'

test('service layer exposes registered text providers and multimodal interfaces', async () => {
  assert.deepEqual(listProviders(), ['deepseek', 'openai'])
  await assert.rejects(generateStructured({ provider: 'unknown', key: 'k', model: 'x', messages: [], schema: {} }), /Unsupported LLM provider/)
  assert.equal((await generateVideo({ prompt: 'test' })).status, 'queued')
  assert.equal(exportAsset({ asset_id: 'A1' }).status, 'ready')
})
