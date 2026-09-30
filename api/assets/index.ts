import { createDefaultAssetService, handleAssetRequest, sendResult } from '../../src/server/assets/http.mjs'

export default async function handler(req: any, res: any) {
  const service = await createDefaultAssetService().catch((error) => ({ __error: error })) as any
  if (service.__error) return sendResult(res, { status: service.__error.statusCode || 503, body: { ok: false, error: { code: service.__error.code || 'ASSET_STORAGE_UNAVAILABLE', message: service.__error.message } } })
  return sendResult(res, await handleAssetRequest({ method: req.method, headers: req.headers, query: req.query || {} }, service))
}
