import assert from 'node:assert/strict'
import test from 'node:test'
import { runReviewedGeneration } from '../server.mjs'

const world = {
  name: '灰烬边城',
  genre: '末日废土',
  era: '灾变后第十年',
  atmosphere: '危险、克制但保留希望',
  coreRule: '净水和药品由城墙内的配给委员会统一控制',
  centralConflict: '药品配给委员会与地下互助网络争夺救命物资的控制权。',
  summary: '幸存者在资源配给与自由迁徙之间寻找新秩序。'
}

const npc = (overrides = {}) => ({
  id: 'npc-field-medic',
  name: '苏砾',
  role: '药房前的急救员',
  world: world.name,
  function: '为玩家提供急救、线索和高风险求药任务',
  summary: '一名在配给制度夹缝中救人的急救员。',
  goal: '保护药房里的病患并揭露被隐瞒的药品短缺。',
  speechStyle: '短句、谨慎，先确认风险再提出请求。',
  background: '灾变后她在移动诊所学会止血，后来守在药房前救治伤者；玩家带来一名濒死的同伴后，她不得不请求玩家穿过封锁区寻找抗生素。',
  sourcePrompt: '末日废土药房前的急救员',
  personality: ['坚韧', '谨慎', '同理心强'],
  behaviorRules: ['先救命再谈报酬', '不浪费配给药物', '发现欺骗会终止合作'],
  ...overrides
})

test('approved first NPC draft performs one generation and one private review', async () => {
  const calls = []
  const request = async (input) => {
    calls.push(input)
    return input.kind === 'generation'
      ? { status: 'complete', phase: 'npc', npc: npc() }
      : { approved: true, issues: [], suggestions: [], score: 9 }
  }

  const result = await runReviewedGeneration({ phase: 'npc', world, messages: [{ role: 'user', content: '我确认以上世界观，设计药房前的急救员。' }], model: 'fixture', provider: 'fixture', key: 'fixture', request })
  assert.equal(result.status, 'complete')
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(({ kind }) => kind), ['generation', 'review'])
  assert.deepEqual(calls[1].world, world)
  assert.equal('issues' in result, false)
  assert.equal('suggestions' in result, false)
  assert.equal('score' in result, false)
})

test('rejected NPC draft injects private feedback into the next revision', async () => {
  const calls = []
  const request = async (input) => {
    calls.push(input)
    if (input.kind === 'generation') {
      const generationCount = calls.filter(({ kind }) => kind === 'generation').length
      return { status: 'complete', phase: 'npc', npc: npc(generationCount === 1 ? { background: '她守在药房前，等待玩家。' } : {}) }
    }
    const reviewCount = calls.filter(({ kind }) => kind === 'review').length
    return reviewCount === 1
      ? { approved: false, issues: ['背景没有交代与玩家相遇原因'], suggestions: ['说明玩家带来伤者后为何必须与该急救员合作'] }
      : { approved: true, issues: [], suggestions: [] }
  }

  const result = await runReviewedGeneration({ phase: 'npc', world, messages: [{ role: 'user', content: '我确认以上世界观，设计药房前的急救员。' }], model: 'fixture', provider: 'fixture', key: 'fixture', request })
  assert.equal(result.status, 'complete')
  assert.equal(calls.filter(({ kind }) => kind === 'generation').length, 2)
  assert.equal(calls.filter(({ kind }) => kind === 'review').length, 2)
  const secondGeneration = calls.filter(({ kind }) => kind === 'generation')[1]
  assert.match(secondGeneration.messages.at(-1).content, /与玩家相遇原因/)
  assert.match(secondGeneration.messages.at(-1).content, /灰烬边城/)
  assert.equal('issues' in result.npc, false)
})

test('NPC review receives the confirmed world and revision preserves its constraints', async () => {
  const calls = []
  const request = async (input) => {
    calls.push(input)
    if (input.kind === 'generation') {
      const generationCount = calls.filter(({ kind }) => kind === 'generation').length
      return { status: 'complete', phase: 'npc', npc: npc(generationCount === 1 ? { world: '自由贸易城' } : {}) }
    }
    const reviewCount = calls.filter(({ kind }) => kind === 'review').length
    if (reviewCount === 1) {
      assert.deepEqual(input.world, world)
      return { approved: false, issues: ['NPC违反药品配给委员会的核心规则'], suggestions: ['让角色的救治行为体现配给限制，并保留灰烬边城作为世界'] }
    }
    assert.deepEqual(input.world, world)
    return { approved: true, issues: [], suggestions: [] }
  }

  const result = await runReviewedGeneration({ phase: 'npc', world, messages: [{ role: 'user', content: '确认世界观并进入 NPC 设计。' }], model: 'fixture', provider: 'fixture', key: 'fixture', request })
  assert.equal(result.status, 'complete')
  const secondGeneration = calls.filter(({ kind }) => kind === 'generation')[1]
  assert.match(secondGeneration.messages.at(-1).content, /药品配给委员会/)
  assert.match(secondGeneration.messages.at(-1).content, /灰烬边城/)
  assert.equal(result.npc.world, world.name)
})

