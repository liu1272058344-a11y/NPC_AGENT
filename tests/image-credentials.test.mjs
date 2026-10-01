import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveImageCredentials } from '../src/server/imageCredentials.mjs'

test('rejects external destinations before selecting server secrets', () => {
  for (const endpoint of ['https://attacker.example', 'https://api.openai.com.attacker.example/v1', 'http://api.openai.com/v1', 'https://api.openai.com/v1?forward=1']) {
    assert.throws(() => resolveImageCredentials({ endpoint }, { OPENAI_API_KEY: 'server-secret' }), { statusCode: 400 })
  }
})
test('never sends an OpenAI server key to Volcengine', () => {
  assert.throws(() => resolveImageCredentials({ provider: 'volcengine' }, { OPENAI_API_KEY: 'server-secret' }), { statusCode: 400 })
  assert.equal(resolveImageCredentials({ provider: 'volcengine', apiKey: 'user-key' }, {}).endpoint, 'https://ark.cn-beijing.volces.com')
})
