import test from 'node:test'
import assert from 'node:assert/strict'
import {designSections} from '../src/content/detailSections.mjs'
test('old NPC behavior and world fields remain visible without made-up dialogue',()=>{
 const npc=designSections({category:'character',profile:{goal:'保存记忆',background:'千年古树',personality:['沉默'],behaviorRules:['不移动'],speechStyle:'树叶表达'}})
 assert.ok(npc.some(v=>v.value==='不移动'));assert.ok(npc.some(v=>v.value==='保存记忆'))
 const world=designSections({category:'world',profile:{coreRule:'灵魂可保存',visualDirection:'水墨'}})
 assert.ok(world.some(v=>v.value==='灵魂可保存'));assert.ok(world.some(v=>v.value==='水墨'))
})
