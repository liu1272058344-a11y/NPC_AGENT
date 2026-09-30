import { createDefaultAssetService, sendResult } from '../../src/server/assets/http.mjs'
import { handleCleanupRequest } from '../../src/server/assets/cleanupHttp.mjs'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '仅支持定时清理请求。' } })
  try { return sendResult(res, await handleCleanupRequest({ headers: req.headers }, await createDefaultAssetService())) }
  catch (error: any) { return res.status(error?.statusCode || 503).json({ ok: false, error: { code: error?.code || 'ASSET_STORAGE_UNAVAILABLE', message: error?.message || '资产服务暂时不可用。' } }) }
}
