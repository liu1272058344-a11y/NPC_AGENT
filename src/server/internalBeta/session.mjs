import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'internal_beta_session'
const MAX_AGE_SECONDS = 4 * 60 * 60

const config = (env) => {
  const secret = String(env.INTERNAL_BETA_SESSION_SECRET || '')
  const testerPassword = String(env.INTERNAL_BETA_PASSWORD || '')
  const adminPassword = String(env.INTERNAL_BETA_ADMIN_PASSWORD || '')
  const configured = secret.length >= 32 && testerPassword.length >= 12 && adminPassword.length >= 12
  return { secret, testerPassword, adminPassword, configured }
}

const isLocalBypass = (env) => !env.VERCEL && env.NODE_ENV !== 'production'
const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url')
const equal = (left, right) => {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}
const fail = (code, statusCode, message) => Object.assign(new Error(message), { code, statusCode })

export const betaConfig = (env = process.env) => config(env)

export function createBetaSession(role, env = process.env, now = new Date()) {
  const value = config(env)
  if (!value.configured) throw fail('INTERNAL_BETA_NOT_CONFIGURED', 503, '内测访问尚未配置。')
  if (role !== 'tester' && role !== 'admin') throw new TypeError('Invalid beta session role')
  const sessionId = randomUUID()
  const payload = encode({ role, sessionId, exp: now.getTime() + MAX_AGE_SECONDS * 1000 })
  const token = `${payload}.${sign(payload, value.secret)}`
  return { sessionId, cookie: `${COOKIE_NAME}=${token}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Strict` }
}

export function readBetaSession(request, env = process.env, now = new Date()) {
  const value = config(env)
  if (isLocalBypass(env) && !value.configured) return { authenticated: true, role: 'admin', sessionId: 'local-development' }
  if (!value.configured) return { authenticated: false, role: null, sessionId: null, configurationError: true }
  const cookie = String(request?.headers?.cookie || request?.headers?.Cookie || '')
  const raw = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1)
  if (!raw) return { authenticated: false, role: null, sessionId: null }
  try {
    const [payload, signature, extra] = raw.split('.')
    if (!payload || !signature || extra || !equal(signature, sign(payload, value.secret))) throw new Error('invalid')
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!['tester', 'admin'].includes(parsed.role) || typeof parsed.sessionId !== 'string' || parsed.exp <= now.getTime()) throw new Error('invalid')
    return { authenticated: true, role: parsed.role, sessionId: parsed.sessionId }
  } catch {
    return { authenticated: false, role: null, sessionId: null }
  }
}

export function requireBetaSession(request, env = process.env, requiredRole = 'tester', now = new Date()) {
  const session = readBetaSession(request, env, now)
  if (session.configurationError) throw fail('INTERNAL_BETA_NOT_CONFIGURED', 503, '内测访问尚未配置。')
  if (!session.authenticated) throw fail('INTERNAL_BETA_AUTH_REQUIRED', 401, '请输入内测口令。')
  if (requiredRole === 'admin' && session.role !== 'admin') throw fail('INTERNAL_BETA_ADMIN_REQUIRED', 403, '需要管理员权限。')
  return session
}

export const clearBetaSessionCookie = () => `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`
export const passwordMatches = (candidate, expected) => equal(candidate, expected)
