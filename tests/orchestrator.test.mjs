import test from 'node:test'
import assert from 'node:assert/strict'
import { unlinkSync } from 'node:fs'
import { PipelineController, listAgents } from '../src/orchestrator/pipelineController.mjs'
import { createDatabase } from '../src/persistence/database.mjs'

test('orchestrator registers the complete content pipeline', async () => {
  assert.deepEqual(listAgents().map((agent) => agent.name), ['game_agent', 'world_agent', 'character_agent', 'visual_agent', 'prompt_optimizer', 'asset_agent'])
  const file = `data/orchestrator-${Date.now()}.sqlite`
  const controller = new PipelineController({ db: createDatabase(file), pipelineRunner: async () => ({ project: { project_id: 'P-test', name: 'Test', genre: '', style: '', world: null, characters: [], assets: [] }, visual: { visual_prompt: 'test' } }) })
  const result = await controller.run({ requirement: 'dark fantasy boss', style: 'dark' })
  assert.equal(result.status, 'success')
  assert.equal(result.schema_version, '0.2')
  assert.equal(result.project.name, 'Test')
  assert.equal(result.steps.filter((step) => step.status === 'completed').length, 6)
  controller.db.close(); unlinkSync(file)
})

test('orchestrator returns a structured failure for unknown agents', async () => {
  const result = await new PipelineController({ pipelineRunner: async () => ({}) }).run({ requirement: 'test', steps: ['missing_agent'] })
  assert.equal(result.status, 'failed')
  assert.equal(result.errors[0].code, 'PIPELINE_FAILED')
})
