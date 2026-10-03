import test from 'node:test'
import assert from 'node:assert/strict'
import { handlePipelineRequest } from '../src/server/pipelineHttp.mjs'

const success = {
  status: 'SUCCESS',
  project: { project_id: 'p1', name: '测试项目', genre: '', style: '', world: {}, characters: [], assets: [] },
  visual: { visual_prompt: 'prompt', negative_prompt: '', style_tags: [], camera: '', lighting: '' }
}

test('pipeline HTTP contract accepts POST and returns controller output without caching', async () => {
  const calls = []
  const result = await handlePipelineRequest(
    { method: 'POST', body: { requirement: '做一个游戏', style: 'dark', assetType: 'character' } },
    { run: async (input) => { calls.push(input); return success } }
  )
  assert.deepEqual(calls, [{ requirement: '做一个游戏', style: 'dark', assetType: 'character' }])
  assert.equal(result.status, 200)
  assert.equal(result.headers['Cache-Control'], 'no-store')
  assert.equal(result.body.project.name, '测试项目')
})

test('pipeline HTTP contract rejects unsupported methods and invalid input', async () => {
  const controller = { run: async () => success }
  assert.deepEqual(await handlePipelineRequest({ method: 'GET' }, controller), {
    status: 405,
    headers: { 'Cache-Control': 'no-store', Allow: 'POST' },
    body: { code: 'METHOD_NOT_ALLOWED', message: '仅支持 POST 请求。', retryable: false }
  })
  const invalid = await handlePipelineRequest({ method: 'POST', body: { requirement: ' ' } }, controller)
  assert.equal(invalid.status, 400)
  assert.equal(invalid.body.code, 'INVALID_REQUEST')
})

test('pipeline HTTP contract maps a failed controller envelope to an error status', async () => {
  const result = await handlePipelineRequest(
    { method: 'POST', body: { requirement: '做一个游戏' } },
    { run: async () => ({ status: 'FAILED', error: { code: 'PIPELINE_FAILED', message: '生成器离线' } }) }
  )
  assert.equal(result.status, 502)
  assert.deepEqual(result.body, { code: 'PIPELINE_FAILED', message: '生成器离线', retryable: true })
})
