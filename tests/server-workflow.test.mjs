import assert from 'node:assert/strict'
import test from 'node:test'
import { runNpcRequest } from '../src/server/npcWorkflow.mjs'

const world = { name: '灰烬边城', genre: '末日废土', era: '灾变后', atmosphere: '危险', coreRule: '配给', centralConflict: '争夺物资', summary: '幸存者寻找秩序' }

test('workflow rejects a finalized response that contains no world schema with validation status', async () => {
  let instructions = ''
  await assert.rejects(runNpcRequest({ phase: 'world', messages: [{ role: 'user', content: '做一个世界' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async (request) => { instructions = request.instructions; return { status: 'world_ready', phase: 'world' } } }), (error) => error.code === 'INVALID_SCHEMA' && error.statusCode === 422)
  assert.match(instructions, /JSON/)
  assert.match(instructions, /needs_clarification/)
})

test('workflow returns a world clarification without entering finalized-world validation', async () => {
  const result = await runNpcRequest(
    { phase: 'world', messages: [{ role: 'user', content: '嗯。' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' },
    { requestStructured: async () => ({ status: 'needs_clarification', phase: 'world', question: '你想做什么类型的游戏？', options: ['角色扮演', '冒险'] }) }
  )
  assert.deepEqual(result, { status: 'needs_clarification', phase: 'world', question: '你想做什么类型的游戏？', options: ['角色扮演', '冒险'] })
})

test('workflow returns only a validated world or NPC result', async () => {
  const worldResult = await runNpcRequest({ phase: 'world', messages: [{ role: 'user', content: '继续' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async () => ({ status: 'nonsense', phase: 'world', world }) })
  assert.deepEqual(worldResult, { status: 'world_ready', phase: 'world', world })
  const npcResult = await runNpcRequest({ phase: 'npc', world, messages: [{ role: 'user', content: '设计角色' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async () => ({ status: 'needs_clarification', phase: 'npc', question: '用途？' }) })
  assert.deepEqual(npcResult, { status: 'needs_clarification', phase: 'npc', question: '用途？' })
  await assert.rejects(runNpcRequest({ phase: 'npc', world, messages: [{ role: 'user', content: '设计角色' }], provider: 'deepseek', model: 'deepseek-chat', key: 'k' }, { requestStructured: async () => ({ status: 'complete', phase: 'npc', npc: { name: '坏数据' } }) }))
})

test('workflow normalizes a validated provider asset type before returning it', async () => {
  const asset = { type: '环境概念图', style: '厚涂', objects: ['塔'], composition: '广角', palette: '冷色', lighting: '逆光', details: ['雾'], format: 'PNG', aspectRatio: '16:9', promptZh: '雾中高塔', promptEn: 'tower in fog', negativePrompt: 'text' }
  const result = await runNpcRequest(
    { phase: 'asset', messages: [{ role: 'user', content: '场景图' }], contentProfile: { notes: '雾中城市' }, provider: 'deepseek', model: 'deepseek-chat', key: 'k' },
    { requestStructured: async () => ({ status: 'complete', phase: 'asset', asset }) }
  )
  assert.equal(result.asset.type, '场景概念图')
})
