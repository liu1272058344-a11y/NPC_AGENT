import { runPipeline } from '../server/pipelineBridge.mjs'
import { failedResult, successResult } from '../schemas/agentResult.mjs'
import { createRunContext, recordStep } from './runContext.mjs'
import { getAgent, listAgents, registerAgent } from './agentRegistry.mjs'

registerAgent('game_agent', async (input) => input)
registerAgent('world_agent', async (input) => input)
registerAgent('character_agent', async (input) => input)
registerAgent('visual_agent', async (input) => input)
registerAgent('prompt_optimizer', async (input) => input)
registerAgent('asset_agent', async (input) => input)

export class PipelineController {
  constructor({ pipelineRunner = runPipeline } = {}) { this.pipelineRunner = pipelineRunner }

  async run(input = {}) {
    const context = createRunContext(input)
    if (!String(input.requirement || '').trim()) return failedResult(context.run_id, 'pipeline_controller', { code: 'INVALID_REQUEST', message: 'requirement is required' })
    const steps = input.steps || ['game_agent', 'world_agent', 'character_agent', 'visual_agent', 'prompt_optimizer', 'asset_agent']
    try {
      for (const step of steps) { if (!getAgent(step)) throw new Error(`Unknown pipeline agent: ${step}`); recordStep(context, step, 'started') }
      const output = await this.pipelineRunner({ requirement: input.requirement, style: input.style || '', assetType: input.assetType || 'character' }, input.options || {})
      for (const step of steps) recordStep(context, step, 'completed')
      return { ...output, ...successResult(context.run_id, 'pipeline_controller', output), run_id: context.run_id, schema_version: context.schema_version, steps: context.steps }
    } catch (error) {
      recordStep(context, 'pipeline_controller', 'failed', { message: error instanceof Error ? error.message : String(error) })
      return { ...failedResult(context.run_id, 'pipeline_controller', { code: 'PIPELINE_FAILED', message: error instanceof Error ? error.message : String(error) }), run_id: context.run_id, schema_version: context.schema_version, steps: context.steps }
    }
  }
}

export { listAgents }
