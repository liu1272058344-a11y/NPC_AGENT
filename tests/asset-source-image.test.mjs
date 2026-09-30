import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchSourceImage, validatePublicImageUrl } from '../src/server/assets/sourceImage.mjs'

const publicDns = async () => ['93.184.216.34']

test('rejects credentials and private image source destinations', async () => {
  const blocked = ['http://user:pass@example.com/a.png', 'http://127.0.0.1/a.png', 'http://10.0.0.1/a.png', 'http://169.254.169.254/latest', 'http://[::1]/a.png']
  for (const value of blocked) await assert.rejects(() => validatePublicImageUrl(new URL(value), publicDns), { code: 'UNSAFE_SOURCE_URL' })
  await assert.rejects(() => validatePublicImageUrl(new URL('https://example.com/a.png'), async () => ['192.168.1.4']), { code: 'UNSAFE_SOURCE_URL' })
})

test('accepts a bounded public image response', async () => {
  const result = await fetchSourceImage('https://example.com/a.png', { resolveHost: publicDns, fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }) })
  assert.equal(result.contentType, 'image/png')
  assert.equal(result.byteSize, 3)
})

test('rejects non-images, oversized bodies, and private redirects', async () => {
  await assert.rejects(() => fetchSourceImage('https://example.com/a', { resolveHost: publicDns, fetchImpl: async () => new Response('text', { headers: { 'content-type': 'text/plain' } }) }), { code: 'INVALID_IMAGE_TYPE' })
  await assert.rejects(() => fetchSourceImage('https://example.com/a', { maxBytes: 2, resolveHost: publicDns, fetchImpl: async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }) }), { code: 'SOURCE_TOO_LARGE' })
  await assert.rejects(() => fetchSourceImage('https://example.com/a', { resolveHost: publicDns, fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/a.png' } }) }), { code: 'UNSAFE_SOURCE_URL' })
})
