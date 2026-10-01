import { handleBetaSessionRequest, sendBetaResult } from '../../src/server/internalBeta/http.mjs'

export default async function handler(req: any, res: any) {
  return sendBetaResult(res, await handleBetaSessionRequest({ method: req.method, headers: req.headers, body: req.body || {} }))
}
