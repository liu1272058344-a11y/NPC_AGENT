import { deploymentReadiness } from '../src/server/readiness.mjs'

export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET 请求。' })
  }
  const result = deploymentReadiness(process.env)
  return res.status(result.ok ? 200 : 503).json(result)
}
