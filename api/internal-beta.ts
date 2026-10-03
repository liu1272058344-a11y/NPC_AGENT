import { handleBetaSessionRequest, sendBetaResult } from '../src/server/internalBeta/http.mjs'
import { createDefaultInternalBetaUsageStore, guardVercelRequest } from '../src/server/internalBeta/guard.mjs'

export default async function handler(req: any, res: any) {
  const action = String(req.query?.action || '')
  if (action === 'session') return sendBetaResult(res, await handleBetaSessionRequest({ method: req.method, headers: req.headers, body: req.body || {} }))
  if (action !== 'usage') return res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: '接口不存在。' } })
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 GET 请求。' } })
  if (!await guardVercelRequest(req, res, { role: 'admin' })) return
  try {
    const usage = await (await createDefaultInternalBetaUsageStore()).getProjectUsage()
    return res.status(200).json({ ok: true, usage })
  } catch (error: any) {
    return res.status(Number(error?.statusCode) || 503).json({ ok: false, error: { code: error?.code || 'USAGE_UNAVAILABLE', message: error?.message || '用量暂时不可用。' } })
  }
}
