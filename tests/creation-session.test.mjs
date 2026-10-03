import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyCharacterResult,
  applyWorldResult,
  copyDraftAsNew,
  createCharacterDraft,
  createWorldDraft,
  markDraftSaved,
  switchCreationKind
} from '../src/agent/creationSession.mjs'

const world = { name: '灰烬边城', genre: '废土', era: '灾后十年', atmosphere: '克制', coreRule: '净水配给', centralConflict: '自由与秩序', summary: '幸存者重建城市。' }
const npc = { id: 'model-id', name: '林医生', role: '地下医生', world: '灰烬边城', function: '任务发布者', personality: ['谨慎'], background: '曾任急救医生。', summary: '为底层治疗。', goal: '维持诊所', speechStyle: '简短', behaviorRules: ['先救人'], sourcePrompt: '地下医生' }
const ids = (...values) => { let index = 0; return () => values[index++] }

test('revision preserves the world archive id and marks it dirty', () => {
  const draft = createWorldDraft(ids('world-1'))
  const session = { activeKind: 'world', world: markDraftSaved({ ...draft, value: world }, '2026-10-02T00:00:00Z'), character: null }
  const revised = applyWorldResult(session, { ...world, era: '灾后十一年' })
  assert.equal(revised.world.id, 'world-1')
  assert.equal(revised.world.value.era, '灾后十一年')
  assert.equal(revised.world.saveState, 'dirty')
  assert.equal(revised.activeKind, 'world')
})

test('save as copies content under a different id', () => {
  const original = { ...createWorldDraft(ids('world-1')), value: world }
  const copied = copyDraftAsNew(original, ids('world-2'))
  assert.equal(copied.id, 'world-2')
  assert.deepEqual(copied.value, world)
  assert.equal(copied.saveState, 'unsaved')
})

test('generation results never switch the active creation kind', () => {
  const worldSession = { activeKind: 'world', world: createWorldDraft(ids('world-1')), character: null }
  assert.equal(applyWorldResult(worldSession, world).activeKind, 'world')
  const characterSession = { activeKind: 'character', world: { ...worldSession.world, value: world }, character: createCharacterDraft(ids('character-1'), { id: 'world-1', ...world }) }
  const result = applyCharacterResult(characterSession, npc)
  assert.equal(result.activeKind, 'character')
  assert.equal(result.character.id, 'character-1')
  assert.equal(result.character.value.id, 'character-1')
})

test('returning to world preserves the current character draft', () => {
  const session = {
    activeKind: 'character',
    world: { ...createWorldDraft(ids('world-1')), value: world },
    character: { ...createCharacterDraft(ids('character-1'), { id: 'world-1', ...world }), value: { ...npc, id: 'character-1' } }
  }
  const returned = switchCreationKind(session, 'world')
  assert.equal(returned.activeKind, 'world')
  assert.equal(returned.character.id, 'character-1')
  assert.equal(returned.character.value.name, '林医生')
})
