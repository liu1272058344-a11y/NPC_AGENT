import test from 'node:test'
import assert from 'node:assert/strict'
import { createBetaSession, readBetaSession, requireBetaSession } from '../src/server/internalBeta/session.mjs'

const env = { VERCEL: '1', INTERNAL_BETA_PASSWORD: 'tester-secret', INTERNAL_BETA_ADMIN_PASSWORD: 'admin-secret', INTERNAL_BETA_SESSION_SECRET: 'a-very-long-session-signing-secret-value' }
const now = new Date('2026-10-01T08:00:00.000Z')

test('signed tester session authorizes tester access without exposing password', () => {
  const session = createBetaSession('tester', env, now)
  assert.match(session.cookie, /HttpOnly/)
  assert.match(session.cookie, /Secure/)
  assert.match(session.cookie, /SameSite=Strict/)
  assert.doesNotMatch(session.cookie, /tester-secret/)
  const request = { headers: { cookie: session.cookie.split(';')[0] } }
  assert.deepEqual(readBetaSession(request, env, now), { authenticated: true, role: 'tester', sessionId: session.sessionId })
  assert.equal(requireBetaSession(request, env, 'tester', now).role, 'tester')
})

test('admin session authorizes admin access while tester session does not', () => {
  const admin = createBetaSession('admin', env, now)
  const tester = createBetaSession('tester', env, now)
  assert.equal(requireBetaSession({ headers: { cookie: admin.cookie } }, env, 'admin', now).role, 'admin')
  assert.throws(() => requireBetaSession({ headers: { cookie: tester.cookie } }, env, 'admin', now), { code: 'INTERNAL_BETA_ADMIN_REQUIRED', statusCode: 403 })
})

test('tampered and expired sessions are rejected', () => {
  const session = createBetaSession('tester', env, now)
  const token = session.cookie.match(/internal_beta_session=([^;]+)/)[1]
  assert.equal(readBetaSession({ headers: { cookie: `internal_beta_session=${token}x` } }, env, now).authenticated, false)
  const later = new Date(now.getTime() + 4 * 60 * 60 * 1000 + 1)
  assert.equal(readBetaSession({ headers: { cookie: `internal_beta_session=${token}` } }, env, later).authenticated, false)
})

test('production configuration fails closed', () => {
  assert.throws(() => requireBetaSession({ headers: {} }, { VERCEL: '1' }, 'tester', now), { code: 'INTERNAL_BETA_NOT_CONFIGURED', statusCode: 503 })
})

test('local development without beta variables uses an explicit dev session', () => {
  assert.deepEqual(requireBetaSession({ headers: {} }, { NODE_ENV: 'development' }, 'tester', now), { authenticated: true, role: 'admin', sessionId: 'local-development' })
})
