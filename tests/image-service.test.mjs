import test from 'node:test'
import assert from 'node:assert/strict'
import { generateImage } from '../src/server/imageService.mjs'

test('image service sends prompt to OpenAI-compatible image endpoint', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ data: [{ url: 'https://example.test/image.png' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
  try {
    const result = await generateImage({ prompt: 'dark fantasy knight', apiKey: 'test-key' })
    assert.equal(result.url, 'https://example.test/image.png')
    assert.equal(request.url, 'https://api.openai.com/v1/images/generations')
    assert.match(request.init.body, /dark fantasy knight/)
  } finally { globalThis.fetch = originalFetch }
})
