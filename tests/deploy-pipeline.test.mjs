import test from 'node:test'
import assert from 'node:assert/strict'
import { runDeployPipeline } from '../src/server/deployPipeline.mjs'

test('deploy pipeline produces the public project contract without a Python or filesystem runtime', async () => {
  const result = await runDeployPipeline({ requirement: '围绕记忆交易的叙事冒险', style: 'dark game production', assetType: 'character' })
  assert.equal(result.project.name, '围绕记忆交易的叙事冒险')
  assert.equal(result.project.style, 'dark game production')
  assert.equal(result.project.characters.length, 1)
  assert.equal(result.project.assets[0].type, 'character')
  assert.match(result.visual.visual_prompt, /围绕记忆交易的叙事冒险/)
})

test('deploy pipeline rejects an empty requirement', async () => {
  await assert.rejects(() => runDeployPipeline({ requirement: ' ' }), { message: 'requirement is required' })
})
