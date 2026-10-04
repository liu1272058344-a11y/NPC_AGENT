import { createDefaultAssetService, handleAssetRequest, sendResult } from '../../../src/server/assets/http.mjs'
import { guardVercelRequest } from '../../../src/server/internalBeta/guard.mjs'

export default async function handler(req: any, res: any) {
  const session = await guardVercelRequest(req, res, { costKind: req.method === 'POST' ? 'asset-import' : undefined })
  if (!session) return
  try {
    const service = await createDefaultAssetService()
    return sendResult(res, await handleAssetRequest({ method: req.method, action: 'images', headers: req.headers, body: req.body || {}, session }, service))
  } catch (error: any) { return sendResult(res, { status: error?.statusCode || 503, body: { ok: false, error: { code: error?.code || 'ASSET_STORAGE_UNAVAILABLE', message: error?.message || '资产服务暂时不可用。' } } }) }
}
