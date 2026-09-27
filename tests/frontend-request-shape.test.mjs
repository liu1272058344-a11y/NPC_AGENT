import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../src/agent/npcCreator.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const agent = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const fixture = JSON.parse(await readFile(new URL('./fixtures/frontend-npc-response.json', import.meta.url), 'utf8'))

const world = {
  name: '灰烬边城',
  genre: '末日废土',
  era: '灾变后第十年',
  atmosphere: '危险、克制但保留希望',
  coreRule: '净水和药品由配给委员会统一控制',
  centralConflict: '配给委员会与地下互助网络争夺救命物资',
  summary: '幸存者在资源配给与自由迁徙之间寻找新秩序。'
}

test('backend NPC request includes the confirmed phase and world context', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init })
    return new Response(JSON.stringify(fixture), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    agent.setAgentConfig({ provider: 'backend', endpoint: 'http://fixture.test/api/npc', model: 'fixture-model' })
    const result = await agent.createNPC([{ role: 'user', content: '确认世界观并设计药房前的急救员。' }], { phase: 'npc', world })
    const payload = JSON.parse(calls[0].init.body)
    assert.equal(payload.phase, 'npc')
    assert.deepEqual(payload.world, world)
    assert.deepEqual(payload.messages, [{ role: 'user', content: '确认世界观并设计药房前的急救员。' }])
    assert.equal(result.status, 'complete')
    assert.equal(result.phase, 'npc')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('frontend response filtering removes backend reviewer metadata', () => {
  const result = agent.sanitizeCreatorReply(fixture)
  assert.equal(result.status, 'complete')
  assert.equal('review' in result, false)
  assert.equal(result.npc && 'review' in result.npc, false)
  assert.equal(result.npc && 'score' in result.npc, false)
  assert.deepEqual(result.npc?.behaviorRules, fixture.npc.behaviorRules)
})

test('frontend rejects partial finalized responses but preserves clarification replies', () => {
  assert.throws(
    () => agent.sanitizeCreatorReply({ status: 'world_ready', phase: 'world', world: { name: '不完整世界' } }),
    /世界观生成结果不完整/
  )
  assert.throws(
    () => agent.sanitizeCreatorReply({ status: 'complete', phase: 'npc', npc: { name: '不完整角色' } }),
    /NPC生成结果不完整/
  )
  const whitespaceNpc = { ...fixture.npc, personality: [' ', '\t'], behaviorRules: ['  '] }
  assert.throws(
    () => agent.sanitizeCreatorReply({ status: 'complete', phase: 'npc', npc: whitespaceNpc }),
    /NPC生成结果不完整/
  )
  assert.deepEqual(
    agent.sanitizeCreatorReply({ status: 'needs_clarification', phase: 'world', question: '游戏类型是什么？', options: ['末日废土'] }),
    { status: 'needs_clarification', phase: 'world', question: '游戏类型是什么？', options: ['末日废土'] }
  )
})

test('asset phase request includes confirmed world context and filters asset fields', async () => {
  const calls = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init })
    return new Response(JSON.stringify({ status: 'complete', phase: 'asset', asset: {
      type: '场景概念图', style: '末日废土写实概念艺术', objects: ['药房招牌', '急救箱'], composition: '正面广角', palette: '灰褐与暗红', lighting: '阴天散射光', details: ['锈蚀金属', '积雪'], format: 'PNG', aspectRatio: '16:9', promptZh: '末日废土药房', promptEn: 'post-apocalyptic pharmacy', negativePrompt: '现代城市高楼'
    }, score: 99, review: { approved: true } }), { status: 200 })
  }
  try {
    agent.setAgentConfig({ provider: 'backend', endpoint: 'http://fixture.test/api/npc', model: 'fixture-model' })
    const result = await agent.createAsset([{ role: 'user', content: '我需要药房外观概念图' }], { world })
    const payload = JSON.parse(calls[0].init.body)
    assert.equal(payload.phase, 'asset')
    assert.deepEqual(payload.world, world)
    assert.equal(result.asset.type, '场景概念图')
    assert.equal('review' in result, false)
    assert.equal('score' in result, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('asset prompt text combines copyable prompt sections', () => {
  const asset = { type: '道具', style: '写实', objects: ['药瓶'], composition: '特写', palette: '灰蓝', lighting: '冷光', details: ['磨损'], format: 'PNG', aspectRatio: '1:1', promptZh: '废土药瓶', promptEn: 'wasteland medicine bottle', negativePrompt: '现代塑料包装' }
  assert.match(agent.buildAssetPromptText(asset), /废土药瓶/)
  assert.match(agent.buildAssetPromptText(asset), /wasteland medicine bottle/)
  assert.match(agent.buildAssetPromptText(asset), /PNG/)
})

test('asset planner requires a complete confirmed world', () => {
  assert.equal(agent.hasConfirmedWorld(world), true)
  assert.equal(agent.hasConfirmedWorld(null), false)
  assert.equal(agent.hasConfirmedWorld({ ...world, centralConflict: ' ' }), false)
})

test('direct model retries once when the provider returns an empty message', async () => {
  const originalFetch = globalThis.fetch
  let attempts = 0
  globalThis.fetch = async () => {
    attempts += 1
    const content = attempts === 1 ? '' : JSON.stringify({ status: 'needs_clarification', phase: 'world', question: '请补充游戏类型和整体风格。', options: ['末日废土', '赛博朋克'] })
    return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 })
  }
  try {
    agent.setAgentConfig({ provider: 'deepseek', endpoint: 'https://api.deepseek.com', model: 'deepseek-chat', apiKey: 'fixture-key' })
    const result = await agent.createNPC([{ role: 'user', content: '我想做一个 NPC' }])
    assert.equal(attempts, 2)
    assert.equal(result.status, 'needs_clarification')
  } finally {
    globalThis.fetch = originalFetch
  }
})
