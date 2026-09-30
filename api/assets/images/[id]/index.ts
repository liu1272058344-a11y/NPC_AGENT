import { createDefaultAssetService, handleAssetRequest, sendResult } from '../../../../src/server/assets/http.mjs'

export default async function handler(req: any, res: any) {
  try {
    const service = await createDefaultAssetService()
    return sendResult(res, await handleAssetRequest({ method: req.method, action: 'image', id: String(req.query?.id || ''), headers: req.headers }, service))
  } catch (error: any) { return sendResult(res, { status: error?.statusCode || 503, body: { ok: false, error: { code: error?.code || 'ASSET_STORAGE_UNAVAILABLE', message: error?.message || '资产服务暂时不可用。' } } }) }
}
