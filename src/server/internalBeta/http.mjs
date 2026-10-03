import { betaConfig, clearBetaSessionCookie, createBetaSession, passwordMatches, readBetaSession } from './session.mjs'

const response = (status, body, headers = {}) => ({ status, body, headers })

export async function handleBetaSessionRequest(request, env = process.env, { now = new Date() } = {}) {
  if (request.method === 'GET') {
    const session = readBetaSession(request, env, now)
    return response(200, { ok: true, authenticated: Boolean(session.authenticated), role: session.authenticated ? session.role : null })
  }
  if (request.method === 'DELETE') return response(200, { ok: true, authenticated: false, role: null }, { 'Set-Cookie': clearBetaSessionCookie() })
  if (request.method !== 'POST') return response(405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: '请求方法不受支持。' } }, { Allow: 'GET, POST, DELETE' })
  const value = betaConfig(env)
  if (!value.configured) return response(503, { ok: false, error: { code: 'INTERNAL_BETA_NOT_CONFIGURED', message: '内测访问尚未配置。' } })
  const candidate = String(request.body?.password || '')
  const role = passwordMatches(candidate, value.adminPassword) ? 'admin' : passwordMatches(candidate, value.testerPassword) ? 'tester' : null
  if (!role) return response(401, { ok: false, error: { code: 'INTERNAL_BETA_INVALID_PASSWORD', message: '内测口令不正确。' } })
  const session = createBetaSession(role, env, now)
  return response(200, { ok: true, authenticated: true, role }, { 'Set-Cookie': session.cookie })
}

export const sendBetaResult = (res, result) => {
  for (const [name, value] of Object.entries(result.headers || {})) res.setHeader(name, value)
  return res.status(result.status).json(result.body)
}
