import test from 'node:test'
import assert from 'node:assert/strict'
import { characterArchivePayload, generationFailed, hasUnsavedCreationDraft, readCreationSaveStates, shouldConfirmLeave, writeCreationSaveStates, worldArchivePayload } from '../src/agent/creationWorkspaceState.mjs'

const world = { id: 'world-1', name: '灰烬边城', genre: '废土', era: '灾后十年', atmosphere: '克制', coreRule: '净水配给', centralConflict: '自由与秩序', summary: '幸存者重建城市。' }
const npc = { id: 'character-1', name: '林医生', role: '地下医生', world: '灰烬边城', function: '任务发布者', personality: ['谨慎'], background: '曾任急救医生。', summary: '为底层治疗。', goal: '维持诊所', speechStyle: '简短', behaviorRules: ['先救人'], sourcePrompt: '地下医生' }

test('world save payload uses the stable id and latest complete profile', () => {
  assert.deepEqual(worldArchivePayload({ id: 'world-1', value: world }), { id: 'world-1', name: '灰烬边城', profile: world })
})

test('character save payload embeds its world snapshot and link', () => {
  const payload = characterArchivePayload({ id: 'character-1', value: npc, worldId: 'world-1', worldSnapshot: world })
  assert.equal(payload.archive.id, 'character-1')
  assert.equal(payload.archive.profile.category, 'character')
  assert.equal(payload.archive.profile.worldId, 'world-1')
  assert.deepEqual(payload.archive.profile.world, world)
  assert.deepEqual(payload.prompts, [])
})

test('failed generation preserves the draft and dirty state', () => {
  const session = { activeKind: 'world', world: { id: 'world-1', value: world, saveState: 'dirty' }, character: null }
  assert.equal(generationFailed(session), session)
  assert.equal(generationFailed(session).world.saveState, 'dirty')
})

test('only dirty drafts require confirmation before leaving', () => {
  assert.equal(shouldConfirmLeave({ saveState: 'dirty' }), true)
  assert.equal(shouldConfirmLeave({ saveState: 'saved' }), false)
  assert.equal(shouldConfirmLeave({ saveState: 'unsaved', value: null }), false)
  assert.equal(shouldConfirmLeave({ saveState: 'unsaved', value: world }), true)
})

test('save states survive a page refresh and retain unsaved warnings',()=>{
  const values=new Map()
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)}
  writeCreationSaveStates(storage,{world:'dirty',character:'saved'})
  const restored=readCreationSaveStates(storage)
  assert.deepEqual(restored,{world:'dirty',character:'saved'})
  assert.equal(hasUnsavedCreationDraft(restored,world,npc),true)
})

test('missing or invalid persisted state safely treats legacy records as saved',()=>{
  const storage={getItem:()=>'{broken'}
  assert.deepEqual(readCreationSaveStates(storage),{world:'saved',character:'saved'})
})
