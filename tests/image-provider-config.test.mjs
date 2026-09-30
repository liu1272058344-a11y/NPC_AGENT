import test from 'node:test'
import assert from 'node:assert/strict'
import { getImageProviderDefaults, resolveImageModelId } from '../src/agent/imageProviderConfig.mjs'

test('volcengine exposes the Seedream API model ID used by the request', () => {
  assert.deepEqual(getImageProviderDefaults('volcengine'), {
    endpoint: 'https://ark.cn-beijing.volces.com',
    modelId: 'doubao-seedream-5-0-flash-260915'
  })
})

test('volcengine replaces legacy display names and obsolete IDs with the API model ID', () => {
  assert.equal(resolveImageModelId('volcengine', 'Doubao-Seedream-5.0-flash-260915'), 'doubao-seedream-5-0-flash-260915')
  assert.equal(resolveImageModelId('volcengine', 'doubao-seedream-5-0-flash-250528'), 'doubao-seedream-5-0-flash-260915')
  assert.equal(resolveImageModelId('volcengine', 'ep-custom'), 'ep-custom')
})
