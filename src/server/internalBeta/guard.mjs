import { requireBetaSession } from './session.mjs'
import { createInternalBetaUsageStore } from './usage.mjs'
import { createNeonQueryAdapter } from '../assets/database.mjs'

export async function createDefaultInternalBetaUsageStore(env = process.env) {
  if (!env.DATABASE_URL) throw Object.assign(new Error('内测用量数据库尚未配置。'), { code: 'INTERNAL_BETA_NOT_CONFIGURED', statusCode: 503 })
  const { neon } = await import('@neondatabase/serverless')
  return createInternalBetaUsageStore(createNeonQueryAdapter(neon(env.DATABASE_URL, { fullResults: true })), env)
}

export async function guardBetaRequest(request, { env = process.env, role = 'tester', costKind, createStore = createDefaultInternalBetaUsageStore } = {}) {
  const session = requireBetaSession(request, env, role)
  if (costKind && session.sessionId !== 'local-development') {
    const store = await createStore(env)
    await store.reserveDailyAction(costKind, { unlimited: session.role === 'admin' })
  }
  return session
}

export const betaErrorResponse = (error) => ({ status: Number(error?.statusCode) || 500, body: { ok: false, error: { code: error?.code || 'INTERNAL_BETA_ERROR', message: error?.message || '内测访问暂时不可用。' } } })

export async function guardVercelRequest(req, res, options = {}) {
  try { return await guardBetaRequest(req, options) }
  catch (error) {
    const result = betaErrorResponse(error)
    res.setHeader('Cache-Control', 'no-store')
    res.status(result.status).json(result.body)
    return null
  }
}
