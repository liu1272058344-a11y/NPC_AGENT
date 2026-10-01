import { createDefaultAssetService, handleAssetRequest, sendResult } from '../../src/server/assets/http.mjs'
import { guardVercelRequest } from '../../src/server/internalBeta/guard.mjs'

export default async function handler(req: any, res: any) {
  if (!await guardVercelRequest(req, res)) return
  const service = await createDefaultAssetService().catch((error) => ({ __error: error })) as any
  if (service.__error) return sendResult(res, { status: service.__error.statusCode || 503, body: { ok: false, error: { code: service.__error.code || 'ASSET_STORAGE_UNAVAILABLE', message: service.__error.message } } })
  return sendResult(res, await handleAssetRequest({ method: req.method, headers: req.headers, query: req.query || {} }, service))
}
