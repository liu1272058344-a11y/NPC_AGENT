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
