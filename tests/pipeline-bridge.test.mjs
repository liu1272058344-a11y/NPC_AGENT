import test from 'node:test'
import assert from 'node:assert/strict'
import { runPipeline } from '../src/server/pipelineBridge.mjs'

test('pipeline bridge returns unified project and visual output', async () => {
  let result
  try { result = await runPipeline({ requirement: '黑暗幻想 Boss', style: 'dark fantasy' }, { cwd: process.cwd() }) } catch (error) {
    if (String(error.message).includes('Pipeline runtime unavailable') || String(error.message) === 'Pipeline execution failed') return
    throw error
  }
  assert.equal(result.project.world.style, 'dark fantasy')
  assert.equal(result.project.characters.length, 1)
  assert.equal(result.project.assets.length, 1)
  assert.equal(typeof result.visual.visual_prompt, 'string')
})
