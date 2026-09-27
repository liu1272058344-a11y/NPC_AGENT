import assert from 'node:assert/strict'
import test from 'node:test'
import { runNpcRequest } from '../src/server/npcWorkflow.mjs'

const world = { name: '灰烬边城', genre: '末日废土', era: '灾变后', atmosphere: '危险', coreRule: '配给', centralConflict: '争夺物资', summary: '幸存者寻找秩序' }

test('workflow maps a valid clarification to application state without trusting a model status', async () => {
  const result = await runNpcRequest({ phase: 'world', messages: [{ role: 'user', content: '做一个世界' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async () => ({ status: 'complete', phase: 'world', question: '请补充类型', options: ['末日'] }) })
  assert.deepEqual(result, { status: 'needs_clarification', phase: 'world', question: '请补充类型', options: ['末日'] })
})

test('workflow returns only a validated world or NPC result', async () => {
  const worldResult = await runNpcRequest({ phase: 'world', messages: [{ role: 'user', content: '继续' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async () => ({ status: 'nonsense', phase: 'world', world }) })
  assert.deepEqual(worldResult, { status: 'world_ready', phase: 'world', world })
  const npcResult = await runNpcRequest({ phase: 'npc', world, messages: [{ role: 'user', content: '设计角色' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async () => ({ status: 'needs_clarification', phase: 'npc', question: '用途？' }) })
  assert.deepEqual(npcResult, { status: 'needs_clarification', phase: 'npc', question: '用途？' })
  await assert.rejects(runNpcRequest({ phase: 'npc', world, messages: [{ role: 'user', content: '设计角色' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async () => ({ status: 'complete', phase: 'npc', npc: { name: '坏数据' } }) }))
})
