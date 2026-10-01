import { credentialCookie, credentialProviders, requireSameOrigin, sessionCredential } from '../src/server/credentialSession.mjs'

export default function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET') {
    const providers = credentialProviders.filter((provider) => { try { sessionCredential(req, provider); return true } catch { return false } })
    return res.status(200).json({ ok: true, providers })
  }
  if (req.method !== 'POST') return res.status(405).json({ message: 'POST only' })
  try {
    requireSameOrigin(req)
    res.setHeader('Set-Cookie', credentialCookie(req.body?.provider, req.body?.key))
    return res.status(200).json({ ok: true })
  } catch (error: any) { return res.status(error?.statusCode || 500).json({ message: error?.statusCode ? error.message : '凭据保存失败。' }) }
}
