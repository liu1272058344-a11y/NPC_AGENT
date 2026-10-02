import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCharacterImageHandoff, buildWorldImageHandoff } from '../src/agent/creationImageHandoff.mjs'

const world={id:'world-1',name:'灰烬边城',genre:'废土生存',era:'灾后十年',atmosphere:'寒冷压抑',coreRule:'净水配给决定身份',centralConflict:'自由与秩序冲突',summary:'幸存者围绕地下水源重建城市'}
const npc={id:'character-1',name:'缝合线医生·凯登',role:'地下诊所主刀医师',world:'灰烬边城',function:'委托发布人',personality:['冷静务实','道德模糊'],background:'曾是企业医疗技师，如今在黑市救治底层居民',summary:'危险而可靠的义体医生',goal:'维持诊所运转',speechStyle:'低沉简短',behaviorRules:['先评估风险'],sourcePrompt:'地下医生'}

test('world handoff creates an editable environment prompt without another text-model call',()=>{
 const result=buildWorldImageHandoff(world)
 assert.equal(result.asset.type,'世界场景概念图')
 assert.match(result.asset.promptEn,/post-apocalyptic survival/)
 assert.match(result.asset.promptEn,/灰烬边城/)
 assert.match(result.asset.promptEn,/净水配给决定身份/)
 assert.equal(result.archive.id,'world-visual:world-1')
 assert.equal(result.archive.profile.worldId,'world-1')
 assert.equal(result.archive.profile.category,'scene')
})

test('character handoff creates a full-body character prompt linked to the character archive',()=>{
 const result=buildCharacterImageHandoff(npc,world)
 assert.equal(result.asset.type,'角色立绘')
 assert.match(result.asset.promptEn,/full-body character concept art/)
 assert.match(result.asset.promptEn,/缝合线医生·凯登/)
 assert.match(result.asset.promptEn,/冷静务实/)
 assert.match(result.asset.promptEn,/寒冷压抑/)
 assert.equal(result.archive.id,'character-1')
 assert.equal(result.archive.profile.category,'character')
})

test('unsaved records still receive a safe local visual archive identity',()=>{
 const result=buildWorldImageHandoff(world,{linkWorld:false})
 assert.match(result.archive.id,/^world-visual:local-/)
 assert.equal(result.archive.profile.worldId,'')
})

test('character handoff does not claim an unsaved world relationship',()=>{
 const result=buildCharacterImageHandoff(npc,world,{linkWorld:false})
 assert.equal(result.archive.profile.worldId,'')
 assert.equal(result.archive.profile.world,null)
})
