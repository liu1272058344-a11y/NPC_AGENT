import { deploymentReadiness } from '../src/server/readiness.mjs'
import { guardVercelRequest } from '../src/server/internalBeta/guard.mjs'

export default async function handler(req: any, res: any) {
  if (!await guardVercelRequest(req, res)) return
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET 请求。' })
  }
  const result = deploymentReadiness(process.env)
  return res.status(result.ok ? 200 : 503).json(result)
}
