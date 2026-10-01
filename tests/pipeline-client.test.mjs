import test from 'node:test'
import assert from 'node:assert/strict'
import { parsePipelineResponse } from '../src/agent/pipelineResponse.mjs'

test('pipeline client parses a successful JSON result', async () => {
  const payload = { project: { name: '测试项目' }, visual: { visual_prompt: 'prompt' } }
  assert.deepEqual(await parsePipelineResponse(new Response(JSON.stringify(payload), { status: 200 })), payload)
})

test('pipeline client turns JSON, text, and empty failures into actionable errors', async () => {
  await assert.rejects(
    () => parsePipelineResponse(new Response(JSON.stringify({ message: '服务未配置' }), { status: 503 })),
    { message: '服务未配置' }
  )
  await assert.rejects(
    () => parsePipelineResponse(new Response('upstream failed', { status: 502, headers: { 'Content-Type': 'text/plain' } })),
    { message: 'upstream failed' }
  )
  await assert.rejects(
    () => parsePipelineResponse(new Response(null, { status: 504 })),
    { message: 'Pipeline 执行失败（HTTP 504）' }
  )
})

test('pipeline client rejects an invalid success payload', async () => {
  await assert.rejects(
    () => parsePipelineResponse(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    { message: 'Pipeline 返回的数据结构不完整。' }
  )
})
