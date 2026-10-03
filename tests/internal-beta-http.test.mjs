import test from 'node:test'
import assert from 'node:assert/strict'
import { handleBetaSessionRequest } from '../src/server/internalBeta/http.mjs'

const env = { VERCEL: '1', INTERNAL_BETA_PASSWORD: 'tester-secret', INTERNAL_BETA_ADMIN_PASSWORD: 'admin-secret', INTERNAL_BETA_SESSION_SECRET: 'a-very-long-session-signing-secret-value' }

test('login accepts tester and admin passwords and returns only role', async () => {
  for (const [password, role] of [['tester-secret', 'tester'], ['admin-secret', 'admin']]) {
    const result = await handleBetaSessionRequest({ method: 'POST', body: { password } }, env)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { ok: true, authenticated: true, role })
    assert.match(result.headers['Set-Cookie'], /internal_beta_session=/)
    assert.doesNotMatch(JSON.stringify(result), /tester-secret|admin-secret/)
  }
})

test('wrong password is rejected and logout clears cookie', async () => {
  assert.equal((await handleBetaSessionRequest({ method: 'POST', body: { password: 'wrong' } }, env)).status, 401)
  const logout = await handleBetaSessionRequest({ method: 'DELETE' }, env)
  assert.equal(logout.status, 200)
  assert.match(logout.headers['Set-Cookie'], /Max-Age=0/)
})

test('status reports unauthenticated without revealing configuration', async () => {
  const result = await handleBetaSessionRequest({ method: 'GET', headers: {} }, env)
  assert.deepEqual(result.body, { ok: true, authenticated: false, role: null })
})

test('unsupported method is rejected', async () => {
  assert.equal((await handleBetaSessionRequest({ method: 'PUT' }, env)).status, 405)
})
