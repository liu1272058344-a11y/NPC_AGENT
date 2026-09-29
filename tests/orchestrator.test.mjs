import test from 'node:test'
import assert from 'node:assert/strict'
import { PipelineController, listAgents } from '../src/orchestrator/pipelineController.mjs'

test('orchestrator registers the complete content pipeline', async () => {
  assert.deepEqual(listAgents().map((agent) => agent.name), ['game_agent', 'world_agent', 'character_agent', 'visual_agent', 'prompt_optimizer', 'asset_agent'])
  const controller = new PipelineController({ pipelineRunner: async () => ({ project: { name: 'Test' }, visual: { visual_prompt: 'test' } }) })
  const result = await controller.run({ requirement: 'dark fantasy boss', style: 'dark' })
  assert.equal(result.status, 'success')
  assert.equal(result.schema_version, '0.2')
  assert.equal(result.project.name, 'Test')
  assert.equal(result.steps.filter((step) => step.status === 'completed').length, 6)
})

test('orchestrator returns a structured failure for unknown agents', async () => {
  const result = await new PipelineController({ pipelineRunner: async () => ({}) }).run({ requirement: 'test', steps: ['missing_agent'] })
  assert.equal(result.status, 'failed')
  assert.equal(result.errors[0].code, 'PIPELINE_FAILED')
})
