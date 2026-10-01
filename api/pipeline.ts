import { handlePipelineRequest } from '../src/server/pipelineHttp.mjs'
import { runDeployPipeline } from '../src/server/deployPipeline.mjs'

const controller = { run: runDeployPipeline }

export default async function handler(req: any, res: any) {
  const result = await handlePipelineRequest({ method: req.method, body: req.body || {} }, controller)
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value)
  return res.status(result.status).json(result.body)
}
