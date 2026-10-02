import { createDefaultAssetService, handleAssetRequest, sendResult } from '../../src/server/assets/http.mjs'
import { guardVercelRequest } from '../../src/server/internalBeta/guard.mjs'

export default async function handler(req: any, res: any) {
  if (!await guardVercelRequest(req, res)) return
  try { return sendResult(res, await handleAssetRequest({ method: req.method, action: 'archive', headers: req.headers, body: req.body || {}, query:req.query || {} }, await createDefaultAssetService())) }
  catch (error: any) { return res.status(error?.statusCode || 503).json({ ok: false, error: { code: error?.code || 'ASSET_STORAGE_UNAVAILABLE', message: error?.message || '资产服务暂时不可用。' } }) }
}
