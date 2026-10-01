import { PipelineController } from '../src/orchestrator/pipelineController.mjs'
import { handlePipelineRequest } from '../src/server/pipelineHttp.mjs'

const controller = new PipelineController()

export default async function handler(req: any, res: any) {
  const result = await handlePipelineRequest({ method: req.method, body: req.body || {} }, controller)
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value)
  return res.status(result.status).json(result.body)
}
