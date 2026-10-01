import test from 'node:test'
import assert from 'node:assert/strict'
import { runVisualAssetGeneration } from '../src/server/visualAssetWorkflow.mjs'
import { startServer } from '../server.mjs'

const character = { character_id: 'npc-1', profile: { name: '维克斯', background: '港口医生' }, visual: { appearance: '银灰短发', costume: '旧军装', weapon: '长枪', environment: '雾港', lighting: '冷光', camera: '中景', art_style: 'dark fantasy' } }

test('visual asset workflow returns visual package, prompt and image', async () => {
  const imageService = async ({ prompt }) => ({ url: 'https://example.test/asset.png', provider: 'openai', model: 'gpt-image-1', size: '1024x1024', prompt })
  const result = await runVisualAssetGeneration({ character, imageService })
  assert.equal(result.visualAsset.subject, '维克斯')
  assert.match(result.prompt.prompt, /维克斯/)
  assert.equal(result.image.url, 'https://example.test/asset.png')
})

test('visual asset workflow rejects incomplete characters before image generation', async () => {
  await assert.rejects(() => runVisualAssetGeneration({ character: { profile: {} }, imageService: async () => ({}) }), { code: 'INVALID_VISUAL_ASSET' })
})

test('visual asset generation route rejects requests without same-origin credentials', async () => {
  const server = startServer(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const port = server.address().port
  try {
    const response = await fetch(`http://localhost:${port}/api/visual-assets/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character: { profile: {} } }) })
    assert.equal(response.status, 403)
    const body = await response.json()
    assert.equal(body.code, 'INTERNAL_ERROR')
  } finally { server.close() }
})
