import test from 'node:test'
import assert from 'node:assert/strict'
import {buildCharacterImageHandoff,buildWorldImageHandoff} from '../src/agent/creationImageHandoff.mjs'
const world={id:'w',name:'森林'},npc={id:'c',name:'古树'}
const asset={promptEn:'  原文\n古树  ',negativePrompt:'',promptZh:'古树'}
test('legacy narrative records require explicit upstream visual design',()=>{assert.throws(()=>buildCharacterImageHandoff(npc,world),/视觉提示词/);assert.throws(()=>buildWorldImageHandoff(world),/视觉提示词/)})
test('explicit upstream prompt is passed unchanged with stable source',()=>{
 const character=buildCharacterImageHandoff(npc,world,{asset});assert.equal(character.asset.promptEn,asset.promptEn);assert.equal(character.archive.id,'c')
 const environment=buildWorldImageHandoff(world,{asset});assert.equal(environment.asset.promptEn,asset.promptEn);assert.equal(environment.archive.profile.worldId,'w')
})
test('unlinked records keep no claimed world relationship',()=>{assert.equal(buildCharacterImageHandoff(npc,world,{asset,linkWorld:false}).archive.profile.worldId,'')})
