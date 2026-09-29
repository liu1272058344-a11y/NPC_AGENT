import test from 'node:test'
import assert from 'node:assert/strict'
import { generateImage } from '../src/services/image/imageService.mjs'

test('image service selects the OpenAI-compatible provider', async () => {
  const originalFetch = globalThis.fetch
  let request
  globalThis.fetch = async (url, init) => { request = { url, init }; return new Response(JSON.stringify({ data: [{ url: 'https://example.test/v.png' }] }), { status: 200 }) }
  try {
    const result = await generateImage({ prompt: 'knight', apiKey: 'key', provider: 'openai', model: 'gpt-image-1' })
    assert.equal(result.provider, 'openai')
    assert.equal(result.url, 'https://example.test/v.png')
    assert.match(request.url, /images\/generations$/)
  } finally { globalThis.fetch = originalFetch }
})

test('image service normalizes empty provider responses', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
  try { await assert.rejects(() => generateImage({ prompt: 'knight', apiKey: 'key', provider: 'openai' }), { code: 'IMAGE_PROVIDER_ERROR' }) } finally { globalThis.fetch = originalFetch }
})

test('image service rejects unknown providers explicitly', async () => {
  await assert.rejects(() => generateImage({ prompt: 'knight', apiKey: 'key', provider: 'unknown' }), { code: 'IMAGE_PROVIDER_ERROR' })
})
