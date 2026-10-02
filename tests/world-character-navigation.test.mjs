import test from 'node:test'
import assert from 'node:assert/strict'
import { creationSelectionFromCharacter, creationSelectionFromWorld } from '../src/agent/creationArchiveNavigation.mjs'

const worldProfile={name:'灰烬边城',genre:'废土',era:'灾后',atmosphere:'危险',coreRule:'配给',centralConflict:'争夺物资',summary:'幸存者重建城市'}

test('world archive opens the same stable id in the world workspace',()=>{
 const selection=creationSelectionFromWorld({id:'world-1',name:'灰烬边城',profile:worldProfile})
 assert.equal(selection.kind,'world')
 assert.equal(selection.world.id,'world-1')
 assert.equal(selection.npc,null)
})

test('character archive reopens with its linked world snapshot',()=>{
 const character={id:'character-1',name:'林医生',role:'医生',world:'灰烬边城',function:'治疗',summary:'地下医生',background:'旧背景',goal:'救人',speechStyle:'简短',sourcePrompt:'医生',personality:['谨慎'],behaviorRules:['先救人']}
 const profile={...character,category:'character',worldId:'world-1',world:worldProfile}
 const selection=creationSelectionFromCharacter({archive:{id:'character-1',name:'林医生',profile}})
 assert.equal(selection.kind,'character')
 assert.equal(selection.npc.id,'character-1')
 assert.equal(selection.world.id,'world-1')
 assert.equal(selection.world.summary,'幸存者重建城市')
})

test('legacy unlinked character opens without inventing a world archive',()=>{
 const profile={id:'legacy',name:'旧角色',role:'旅人',world:'旧世界',function:'向导',summary:'旧角色',background:'旧背景',goal:'旅行',speechStyle:'缓慢',sourcePrompt:'旅人',personality:['沉稳'],behaviorRules:['守信'],category:'character'}
 const selection=creationSelectionFromCharacter({archive:{id:'legacy',name:'旧角色',profile}})
 assert.equal(selection.npc.id,'legacy')
 assert.equal(selection.world,null)
})
