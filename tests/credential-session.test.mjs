import test from 'node:test'
import assert from 'node:assert/strict'
import { credentialCookie, sessionCredential, requireSameOrigin } from '../src/server/credentialSession.mjs'

test('encrypted HttpOnly credentials roundtrip but reject tampering and cross-provider reuse', () => {
  process.env.CREDENTIAL_SESSION_SECRET = 'ab'.repeat(32)
  const cookie = credentialCookie('deepseek', 'test-private-key')
  assert.equal(cookie.includes('test-private-key'), false)
  assert.match(cookie, /HttpOnly; Secure; SameSite=Strict/)
  const pair = cookie.split(';')[0]
  assert.equal(sessionCredential({ headers: { cookie: pair } }, 'deepseek'), 'test-private-key')
  assert.throws(() => sessionCredential({ headers: { cookie: pair.replace('deepseek', 'openai') } }, 'openai'))
  const [name, token] = pair.split('=')
  assert.throws(() => sessionCredential({ headers: { cookie: `${name}=${token.slice(0, 20)}XX${token.slice(22)}` } }, 'deepseek'))
  const now = Date.now; Date.now = () => now() + 5 * 60 * 60 * 1000
  try { assert.throws(() => sessionCredential({ headers: { cookie: pair } }, 'deepseek')) } finally { Date.now = now }
})
test('missing credentials never fall back to platform keys and cross-site requests fail', () => {
  process.env.OPENAI_API_KEY = 'platform-test-key'
  assert.throws(() => sessionCredential({ headers: {} }, 'openai'), { statusCode: 401 })
  assert.throws(() => requireSameOrigin({ headers: { host: 'app.example', origin: 'https://attacker.example' } }), { statusCode: 403 })
  assert.doesNotThrow(() => requireSameOrigin({ headers: { host: 'app.example', origin: 'https://app.example' } }))
})
